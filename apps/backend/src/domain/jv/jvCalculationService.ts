import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { calculateJVOrder, EngineError, type PriceProfile, type UnifiedFamily, type UnifiedOrderResult, type UnifiedPositionInput } from '@bms/shared'
import completionJson from './catalogs/completation-pr13e.json'
import retailJson from './catalogs/retail-pr13e.json'

const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const FAMILIES = ['LINE', 'ZIGZAG', 'SLIDER_L3', 'SLIDER_L5', 'SLIDER_X3', 'SLIDER_X5', 'FRONT'] as const
export const JV_ORDER_RULES_VERSION = 'JV-UNIFIED-ORDER-PR13E-1'
const MAX_DECIMAL_LENGTH = 64
const MAX_POSITIONS = 7

const positionShape = (family: UnifiedFamily) => z.object({
  id: z.string().trim().min(1).max(80),
  slot: z.number().int().min(1).max(7),
  family: z.literal(family),
  quantity: z.string().min(1).max(MAX_DECIMAL_LENGTH),
  calculation: z.record(z.unknown()),
}).strict()

const previewSchema = z.object({
  orderId: z.string().trim().min(1).max(120).optional(),
  profile: z.enum(['COMPLETATION', 'RETAIL']),
  rulesVersion: z.string().trim().min(1).max(120),
  priceSnapshotVersion: z.string().trim().min(1).max(120).optional(),
  positions: z.array(z.discriminatedUnion('family', [
    positionShape('LINE'), positionShape('ZIGZAG'), positionShape('SLIDER_L3'), positionShape('SLIDER_L5'), positionShape('SLIDER_X3'), positionShape('SLIDER_X5'), positionShape('FRONT'),
  ])).min(1).max(MAX_POSITIONS),
}).strict()

type PreviewRequest = z.infer<typeof previewSchema>
type CatalogSourceSet = Readonly<Record<string, unknown>>
interface CatalogFamily { readonly requestShape: Record<string, unknown>; readonly sources: CatalogSourceSet }
interface CatalogSnapshot {
  readonly schemaVersion: '1.0'
  readonly providerId: string
  readonly profile: PriceProfile
  readonly workbook: string
  readonly workbookSha256: string
  readonly capturedWithExcel: '16.0'
  readonly sourceManifest: string
  readonly sourceScenarioId: string
  readonly engineRuleVersion: string
  readonly mainDiscount: NonNullable<Parameters<typeof calculateJVOrder>[0]['mainDiscount']>
  readonly families: Readonly<Record<UnifiedFamily, CatalogFamily>>
}

const catalogs: Readonly<Record<PriceProfile, CatalogSnapshot>> = Object.freeze({
  COMPLETATION: validateCatalog(completionJson as unknown as CatalogSnapshot, 'COMPLETATION'),
  RETAIL: validateCatalog(retailJson as unknown as CatalogSnapshot, 'RETAIL'),
})

export interface JvPreviewVersions {
  readonly rules: string
  readonly provider: string
  readonly workbook: string
  readonly workbookSha256: string
  readonly familyPriceSnapshots: Readonly<Record<string, string>>
}

export interface JvPreviewResult {
  readonly correlationId: string
  readonly orderId: string
  readonly profile: PriceProfile
  readonly engineVersion: 'JV-UNIFIED-ORDER-1'
  readonly versions: JvPreviewVersions
  readonly status: 'COMPLETE' | 'PARTIAL'
  readonly calculation: UnifiedOrderResult
}

export class JvRequestError extends Error {
  constructor(readonly statusCode: 400 | 409 | 422 | 503, readonly code: string, message: string, readonly issues: readonly string[] = []) {
    super(message)
    this.name = 'JvRequestError'
  }
}

/** Runtime validates caller data, then attaches only server-owned price sources before the real Engine call. */
export function calculateJvPreview(input: unknown): JvPreviewResult {
  const parsed = previewSchema.safeParse(input)
  if (!parsed.success) throw new JvRequestError(400, 'INVALID_REQUEST', 'JV calculation request is invalid', parsed.error.issues.map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`).slice(0, 20))
  const request = parsed.data as PreviewRequest
  const catalog = catalogs[request.profile]
  if (request.rulesVersion !== catalog.engineRuleVersion) throw new JvRequestError(409, 'RULE_VERSION_MISMATCH', 'Requested JV rule version is unavailable')
  if (request.priceSnapshotVersion && request.priceSnapshotVersion !== catalog.providerId) throw new JvRequestError(409, 'PRICE_PROFILE_MISMATCH', 'Requested price snapshot does not match the selected profile')

  const ids = new Set<string>()
  const slots = new Set<number>()
  const positions: UnifiedPositionInput[] = request.positions.map((position, index) => {
    if (ids.has(position.id)) throw new JvRequestError(400, 'DUPLICATE_POSITION_ID', 'Position ids must be unique', [`positions.${index}.id`])
    if (slots.has(position.slot)) throw new JvRequestError(400, 'DUPLICATE_SLOT', 'Each Excel slot may be used once', [`positions.${index}.slot`])
    ids.add(position.id)
    slots.add(position.slot)
    if (!DECIMAL.test(position.quantity) || position.quantity.length > MAX_DECIMAL_LENGTH) throw new JvRequestError(400, 'INVALID_DECIMAL', 'Position quantity must be a decimal string', [`positions.${index}.quantity`])
    if (!/^[1-9]\d{0,5}$/.test(position.quantity)) throw new JvRequestError(400, 'INVALID_QUANTITY', 'Position quantity must be a positive integer no greater than 999999', [`positions.${index}.quantity`])

    const familyCatalog = catalog.families[position.family]
    if (!familyCatalog) throw new JvRequestError(409, 'FAMILY_SNAPSHOT_UNAVAILABLE', `No server snapshot is available for ${position.family}`)
    const shapeIssues = validateShape(position.calculation, familyCatalog.requestShape, `positions.${index}.calculation`)
    validatePhysicalInputs(position.family, position.calculation, `positions.${index}.calculation`, shapeIssues)
    if (shapeIssues.length) throw new JvRequestError(400, 'INVALID_CALCULATION_INPUT', 'Calculation inputs do not match the supported typed contract', shapeIssues.slice(0, 20))
    const calculation = structuredClone(position.calculation) as Record<string, unknown>
    attachSources(position.family, calculation, familyCatalog.sources)
    bindServerContext(position.family, calculation, position.id, position.quantity, catalog)
    return { id: position.id, slot: position.slot, family: position.family, quantity: position.quantity, calculation } as UnifiedPositionInput
  })
  bindOrderContext(positions, catalog)

  const correlationId = randomUUID()
  const orderId = request.orderId ?? correlationId
  let calculation: UnifiedOrderResult
  try {
    calculation = calculateJVOrder({ orderId, profile: request.profile, positions, mainDiscount: catalog.mainDiscount })
  } catch (error) {
    if (error instanceof EngineError) {
      if (error.code === 'RULE_FAILED' || error.code === 'DEPENDENCY_CYCLE' || error.code === 'DIVISION_BY_ZERO') throw error
      if (error.code === 'PRICE_NOT_FOUND') throw new JvRequestError(503, 'PRICE_CATALOG_UNAVAILABLE', 'Selected price catalog cannot satisfy this calculation')
      const inputError = error.code === 'INVALID_DECIMAL' || error.code === 'MISSING_INPUT' || error.code === 'UNIT_MISMATCH' || error.code === 'INVALID_CONFIGURATION' || error.code === 'LOOKUP_NOT_FOUND' || error.code === 'DEPENDENCY_UNKNOWN' || error.code === 'RULE_UNCONFIRMED'
      const code = error.code === 'RULE_UNCONFIRMED' ? 'UNSUPPORTED_CALCULATION_RULE' : error.code
      throw new JvRequestError(inputError ? 422 : 409, code, safeEngineMessage(error.message))
    }
    throw error
  }
  const familyPriceSnapshots = Object.fromEntries(request.positions.map((position) => [position.family, sourceVersion(catalog.families[position.family].sources)]))
  return Object.freeze({
    correlationId,
    orderId,
    profile: request.profile,
    engineVersion: 'JV-UNIFIED-ORDER-1',
    versions: Object.freeze({ rules: catalog.engineRuleVersion, provider: catalog.providerId, workbook: catalog.workbook, workbookSha256: catalog.workbookSha256, familyPriceSnapshots: Object.freeze(familyPriceSnapshots) }),
    status: calculation.status,
    calculation,
  })
}

function validateCatalog(catalog: CatalogSnapshot, profile: PriceProfile): CatalogSnapshot {
  if (catalog.schemaVersion !== '1.0' || catalog.profile !== profile || catalog.engineRuleVersion !== JV_ORDER_RULES_VERSION || !/^[a-f0-9]{64}$/.test(catalog.workbookSha256) || catalog.capturedWithExcel !== '16.0') throw new Error(`Invalid JV snapshot provider for ${profile}`)
  for (const family of FAMILIES) {
    const data = catalog.families[family]
    if (!data || !data.requestShape || !data.sources) throw new Error(`Missing ${profile}/${family} snapshot provider data`)
    for (const source of Object.values(data.sources)) {
      if (!isRecord(source) || source.profile !== profile || source.workbookSha256 !== catalog.workbookSha256) throw new Error(`Snapshot provenance mismatch for ${profile}/${family}`)
    }
  }
  if (catalog.mainDiscount.profile !== profile || catalog.mainDiscount.workbookSha256 !== catalog.workbookSha256) throw new Error(`Main settings provenance mismatch for ${profile}`)
  if (!catalog.mainDiscount.positionMarkups?.some((entry) => entry.slot === 7) || !catalog.mainDiscount.positionDivisors?.some((entry) => entry.family === 'FRONT')) throw new Error(`Front Main price settings are missing for ${profile}`)
  return Object.freeze(catalog)
}

export function getJvPriceProviderVersion(profile: PriceProfile): string { return catalogs[profile].providerId }

function validateShape(value: unknown, expected: unknown, path: string): string[] {
  const issues: string[] = []
  const visit = (actual: unknown, sample: unknown, currentPath: string, key: string): void => {
    if (key === 'snapshot' || /^(?:priceSnapshot|glassSnapshot|paintSnapshot)$/.test(key) || /^(?:unitPrice|priceValue|priceAmount|catalogPrice)$/i.test(key)) {
      issues.push(`${currentPath}: price/snapshot inputs are server-managed`)
      return
    }
    if (isRecord(sample)) {
      if (!isRecord(actual)) { issues.push(`${currentPath}: expected object`); return }
      const expectedKeys = Object.keys(sample).sort()
      const actualKeys = Object.keys(actual).sort()
      for (const extra of actualKeys.filter((candidate) => !expectedKeys.includes(candidate))) issues.push(`${currentPath}.${extra}: unknown input`)
      for (const missing of expectedKeys.filter((candidate) => !actualKeys.includes(candidate))) issues.push(`${currentPath}.${missing}: required input is missing`)
      if (key === 'settings' || key === 'bomSettings' || key === 'choices' || key === 'frameChoices') {
        if (!sameJson(actual, sample)) issues.push(`${currentPath}: this versioned server setting cannot be overridden`)
        return
      }
      for (const child of expectedKeys) if (child in actual) visit(actual[child], sample[child], `${currentPath}.${child}`, child)
      return
    }
    if (Array.isArray(sample)) {
      if (!Array.isArray(actual) || actual.length !== sample.length) { issues.push(`${currentPath}: expected array of length ${sample.length}`); return }
      for (let i = 0; i < sample.length; i++) visit(actual[i], sample[i], `${currentPath}[${i}]`, key)
      return
    }
    if (sample === null) { if (actual !== null) issues.push(`${currentPath}: expected null`); return }
    if (typeof sample === 'string') {
      if (typeof actual !== 'string' || actual.length > MAX_DECIMAL_LENGTH || /^\s*=/.test(actual)) { issues.push(`${currentPath}: expected a bounded non-formula string`); return }
      if (['profile', 'workbook', 'workbookSha256', 'sourceSha256', 'sourceCell', 'sourceFormula', 'sourceLiteral', 'formula', 'capturedWithExcel', 'version'].includes(key) && actual !== sample) issues.push(`${currentPath}: source provenance is server-managed`)
      if (DECIMAL.test(sample) && (!DECIMAL.test(actual) || (actual.split('.')[1]?.length ?? 0) > 30)) issues.push(`${currentPath}: expected decimal string with at most 30 fractional digits`)
      if (['profile', 'workbook'].includes(key) && actual !== sample) issues.push(`${currentPath}: provenance is server-managed`)
      return
    }
    if (typeof sample === 'number') { if (typeof actual !== 'number' || !Number.isSafeInteger(actual)) issues.push(`${currentPath}: expected a safe integer selector`); return }
    if (typeof sample === 'boolean') { if (typeof actual !== 'boolean') issues.push(`${currentPath}: expected boolean`); return }
    issues.push(`${currentPath}: unsupported contract value`)
  }
  visit(value, expected, path, '')
  return issues
}

function validatePhysicalInputs(family: UnifiedFamily, calculation: Record<string, unknown>, path: string, issues: string[]): void {
  const geometry = family === 'LINE'
    ? getRecord(calculation, 'input')
    : family === 'ZIGZAG'
      ? getRecord(getRecord(calculation, 'position'), 'geometry')
      : family === 'FRONT'
        ? getRecord(calculation, 'construction')
        : getRecord(calculation, 'geometry')
  for (const key of ['widthMm', 'heightMm', 'depthMm']) {
    const value = geometry[key]
    if (value !== undefined && typeof value === 'string' && DECIMAL.test(value) && !isPositiveDecimal(value)) issues.push(`${path}.${key}: measurement in millimetres must be greater than zero`)
  }
}

function isPositiveDecimal(value: string): boolean {
  if (value.startsWith('-')) return false
  return /[1-9]/.test(value)
}

function attachSources(family: UnifiedFamily, calculation: Record<string, unknown>, sources: CatalogSourceSet): void {
  if (family === 'LINE') {
    calculation.priceSnapshot = sources.priceSnapshot
    calculation.glassSnapshot = sources.glassSnapshot
    calculation.paintSnapshot = sources.paintSnapshot
  } else if (family === 'FRONT') {
    const commercial = calculation.commercial
    if (!isRecord(commercial)) throw new JvRequestError(400, 'INVALID_CALCULATION_INPUT', 'Front commercial inputs are required')
    commercial.snapshot = sources.snapshot
  } else calculation.snapshot = sources.snapshot
}

function bindServerContext(family: UnifiedFamily, calculation: Record<string, unknown>, id: string, quantity: string, catalog: CatalogSnapshot): void {
  if (family === 'LINE') {
    const input = getRecord(calculation, 'input')
    input.constructionId = id
    input.constructionQuantity = quantity
    input.profile = catalog.profile
    input.workbook = catalog.workbook
  }
  if (family === 'SLIDER_L3' || family === 'SLIDER_L5' || family === 'SLIDER_X3' || family === 'SLIDER_X5') {
    const geometry = getRecord(calculation, 'geometry')
    geometry.workbook = catalog.workbook
  }
}

function bindOrderContext(positions: readonly UnifiedPositionInput[], catalog: CatalogSnapshot): void {
  const front = positions.find((position) => position.family === 'FRONT')
  if (!front) return
  const calculation = front.calculation as unknown as { construction: Record<string, unknown>; commercial: Record<string, unknown> }
  const markup = catalog.mainDiscount.positionMarkups?.find((entry) => entry.slot === front.slot)
  const divisor = catalog.mainDiscount.positionDivisors?.find((entry) => entry.family === 'FRONT')
  if (!markup || !divisor) throw new JvRequestError(409, 'MAIN_SETTINGS_UNAVAILABLE', 'Server Main price settings for Front are unavailable')
  const snapshot = calculation.commercial.snapshot as { settings?: Record<string, { value?: string }> } | undefined
  const frontDivisor = snapshot?.settings?.D5?.value
  if (!frontDivisor) throw new JvRequestError(409, 'FRONT_SETTINGS_UNAVAILABLE', 'Server Front divisor setting is unavailable')
  calculation.commercial.mainQuantity = front.quantity
  calculation.commercial.markupPercent = markup.value
  calculation.commercial.discountPercent = catalog.mainDiscount.value
  calculation.commercial.retailDivisor = frontDivisor
  calculation.commercial.order = {
    workbook: catalog.workbook,
    sourceSha256: catalog.workbookSha256,
    positionMainRow: 10 + front.slot,
    positions: positions.map((position) => {
      const dimensions = positionDimensions(position)
      return { mainRow: 10 + position.slot, widthMm: dimensions.widthMm, heightMm: dimensions.heightMm, quantity: position.quantity }
    }),
  }
}

function positionDimensions(position: UnifiedPositionInput): { widthMm: string; heightMm: string } {
  switch (position.family) {
    case 'LINE': return { widthMm: position.calculation.input.widthMm, heightMm: position.calculation.input.heightMm }
    case 'ZIGZAG': return { widthMm: position.calculation.position.geometry.widthMm, heightMm: position.calculation.position.geometry.heightMm }
    case 'SLIDER_L3': case 'SLIDER_L5': case 'SLIDER_X3': case 'SLIDER_X5': return { widthMm: position.calculation.geometry.widthMm, heightMm: position.calculation.geometry.heightMm }
    case 'FRONT': return { widthMm: position.calculation.construction.widthMm, heightMm: position.calculation.construction.heightMm }
  }
}

function sourceVersion(sources: CatalogSourceSet): string {
  const source = (sources.snapshot ?? sources.priceSnapshot) as Record<string, unknown> | undefined
  if (typeof source?.version === 'string') return source.version
  const versions = ['priceSnapshot', 'glassSnapshot', 'paintSnapshot'].map((key) => (sources[key] as Record<string, unknown> | undefined)?.version).filter((value): value is string => typeof value === 'string')
  return versions.join('|')
}

function safeEngineMessage(message: string): string { return message.replace(/(?:password|token|secret|authorization)\s*[:=]\s*\S+/gi, 'sensitive-value=[redacted]').slice(0, 240) }
function sameJson(left: unknown, right: unknown): boolean { return JSON.stringify(left) === JSON.stringify(right) }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function getRecord(value: Record<string, unknown>, key: string): Record<string, unknown> { const child = value[key]; if (!isRecord(child)) throw new JvRequestError(400, 'INVALID_CALCULATION_INPUT', `Missing ${key} input object`); return child }

/** JSON-safe exact result conversion; BigInt values are strings and Maps/Sets become arrays. */
export function serializeJvResult(value: unknown): unknown {
  const ancestors = new WeakSet<object>()
  const visit = (entry: unknown): unknown => {
    if (typeof entry === 'bigint') return entry.toString()
    if (entry === null || typeof entry !== 'object') return entry
    if (ancestors.has(entry)) throw new TypeError('Circular JV result cannot be serialized')
    ancestors.add(entry)
    let result: unknown
    if (entry instanceof Map) result = [...entry.entries()].map(([key, item]) => [visit(key), visit(item)])
    else if (entry instanceof Set) result = [...entry.values()].map(visit)
    else if (Array.isArray(entry)) result = entry.map(visit)
    else if (entry instanceof Error) result = { name: entry.name, message: entry.message }
    else result = Object.fromEntries(Object.entries(entry).map(([key, item]) => [key, visit(item)]))
    ancestors.delete(entry)
    return result
  }
  return visit(value)
}
