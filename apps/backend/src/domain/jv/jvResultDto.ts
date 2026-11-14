import { randomBytes } from 'node:crypto'

type Obj = Record<string, any>
const record = (x: unknown): Obj =>
  x && typeof x === 'object' && !Array.isArray(x) ? (x as Obj) : {}
const pick = (x: unknown, keys: readonly string[]): Obj => {
  const r = record(x),
    out: Obj = {}
  for (const key of keys)
    if (typeof r[key] === 'string' || typeof r[key] === 'number' || typeof r[key] === 'boolean')
      out[key] = r[key]
  return out
}
const rational = (x: unknown): unknown => {
  const o = record(x)
  return (typeof o.numerator === 'bigint' || typeof o.numerator === 'string') &&
    (typeof o.denominator === 'bigint' || typeof o.denominator === 'string')
    ? { numerator: String(o.numerator), denominator: String(o.denominator) }
    : undefined
}
const measure = (x: unknown): unknown => {
  const o = record(x)
  return typeof o.value === 'string' && typeof o.unit === 'string'
    ? { value: o.value, unit: o.unit }
    : (rational(x) ??
        ((typeof x === 'string' && /^-?\d+(?:\.\d+)?$/.test(x)) ||
        typeof x === 'number' ||
        typeof x === 'boolean'
          ? x
          : undefined))
}
const values = (x: unknown, keys: readonly string[]): Obj => {
  const o = record(x),
    out: Obj = {}
  for (const k of keys) {
    const v = measure(o[k])
    if (v !== undefined) out[k] = v
  }
  return out
}
const list = (x: unknown): any[] => (Array.isArray(x) ? x : [])
const strings = (x: unknown): string[] =>
  list(x)
    .filter((v) => typeof v === 'string')
    .map((v) => v.slice(0, 500))
const bom = (x: unknown): Obj[] =>
  list(x).map((v) => {
    const a = pick(v, [
      'sku',
      'description',
      'unit',
      'sourcePositionId',
      'family',
      'sourceCell',
      'traceStepId',
    ])
    for (const k of ['quantity', 'unitPrice', 'amount']) {
      const q = rational(record(v)[k])
      if (q !== undefined) a[k] = q
    }
    return a
  })
const cells = (from: number, to: number, prefix: string): string[] =>
  Array.from({ length: to - from + 1 }, (_, i) => prefix + (from + i))
function calculation(p: Obj): Obj {
  const c = record(p.calculation),
    g = record(c.geometry),
    out: Obj = { geometry: {} }
  if (p.family === 'LINE') {
    out.geometry.openingWidth = values(g.openingWidth, ['I25', 'I27'])
    out.geometry.cutting = {
      items: list(record(g.cutting).items).map((x) => ({
        ...pick(x, ['label']),
        quantity: measure(record(x).quantity),
        cutLength: measure(record(x).cutLength),
        sourceCells: pick(record(x).sourceCells, ['length']),
      })),
    }
    out.glass = {
      ...values(c.glass, ['glassTotal', 'preCharge']),
      panes: list(record(c.glass).panes).map((x) => ({
        ...pick(x, ['sourceRow']),
        ...values(x, ['quantity', 'widthMm', 'heightMm']),
      })),
    }
    out.paint = values(c.paint, ['finishTotal'])
    out.work = values(c.work, ['assemblyAndMilling', 'installation'])
  } else if (p.family === 'ZIGZAG') {
    out.geometry.outputs = values(g.outputs, [
      ...cells(4, 9, 'H'),
      ...cells(13, 18, 'H'),
      ...cells(29, 31, 'D'),
    ])
    out.costs = values(c.costs, ['P39', 'P40', 'P41', 'P43'])
  } else if (typeof p.family === 'string' && p.family.startsWith('SLIDER')) {
    out.geometry.geometry = values(g.geometry, ['D31', 'D32', 'D33', 'D34', 'D43', 'D44', 'D45'])
    out.confirmedSubtotals = values(c.confirmedSubtotals, [
      'paintingM48',
      'glassD50',
      'additionalWorkM49',
      'installationM52',
    ])
  } else if (p.family === 'FRONT') {
    out.geometry.geometry = values(g.geometry, [
      'C3',
      'C4',
      'C5',
      'C8',
      'C17',
      'D3',
      'D5',
      'D32',
      'D33',
      'D34',
      ...cells(3, 11, 'H'),
    ])
    out.geometry.cutPieces = list(g.cutPieces).map((x) => ({
      ...pick(x, ['sku', 'lengthCell']),
      ...values(x, ['lengthMm', 'count']),
    }))
    out.glass = {
      ...values(c.glass, ['areaM2', 'glassAmount', 'treatmentAmount']),
      pieces: list(record(c.glass).pieces).map((x) => ({
        ...pick(x, ['row']),
        ...values(x, ['quantity', 'widthMm', 'heightMm']),
      })),
    }
    out.works = values(c.works, ['painting', 'additionalWork', 'installation'])
    out.consumables = values(c.consumables, [
      'activatorPerConstruction',
      'adhesivePerConstruction',
      'activatorPositionQuantity',
      'adhesivePositionQuantity',
    ])
  }
  return out
}
function traceStep(s: unknown): Obj {
  const o = record(s),
    result = measure(o.result)
  return {
    ...pick(o, ['id', 'kind', 'label', 'ruleId', 'status']),
    source: pick(o.source, ['workbook', 'sheet', 'cell']),
    inputRefs: strings(o.inputRefs),
    errorIds: strings(o.errorIds),
    warningIds: strings(o.warningIds),
    ...(result !== undefined ? { result } : {}),
  }
}
export function createResultDto(raw: any) {
  const c = raw.calculation,
    positions = list(c.positions)
  return {
    schemaVersion: 'JV-RESULT-1',
    ...pick(raw, ['correlationId', 'orderId', 'profile', 'engineVersion', 'status']),
    versions: {
      ...pick(raw.versions, ['rules', 'provider', 'workbook', 'workbookSha256']),
      familyPriceSnapshots: pick(raw.versions.familyPriceSnapshots, [
        'LINE',
        'ZIGZAG',
        'SLIDER_L3',
        'SLIDER_L5',
        'SLIDER_X3',
        'SLIDER_X5',
        'FRONT',
      ]),
      ...(Array.isArray(raw.versions.configurationProfiles)
        ? { configurationProfiles: strings(raw.versions.configurationProfiles) }
        : {}),
    },
    calculation: {
      ...pick(c, ['orderId', 'profile', 'status']),
      ...(c.status === 'COMPLETE' && raw.status === 'COMPLETE'
        ? { totalSalePrice: rational(c.totalSalePrice) }
        : {}),
      bom: bom(c.bom),
      diagnostics: strings(c.diagnostics),
      limitations: strings(c.limitations),
      traceCount: list(c.trace).length,
      positions: positions.map((p) => ({
        ...pick(p, ['id', 'slot', 'family', 'status']),
        quantity: rational(p.quantity),
        ...(p.status === 'COMPLETE'
          ? { confirmedUnitAmount: rational(p.confirmedUnitAmount) }
          : {}),
        bom: bom(p.bom),
        diagnostics: strings(p.diagnostics),
        traceCount: list(p.trace).length,
        calculation: calculation(p),
      })),
    },
  }
}
interface Entry {
  owner: string
  expires: number
  groups: Map<string, Obj[]>
  bytes: number
}
export class JvTraceStore {
  private entries = new Map<string, Entry>()
  private bytes = 0
  constructor(
    private readonly maxEntries = 16,
    private readonly maxBytes = 16 * 1024 * 1024,
    private readonly ttl = 5 * 60 * 1000,
    private readonly now = () => Date.now(),
  ) {}
  private remove(key: string) {
    const x = this.entries.get(key)
    if (x) {
      this.bytes -= x.bytes
      this.entries.delete(key)
    }
  }
  private prune() {
    for (const [k, v] of this.entries) if (v.expires <= this.now()) this.remove(k)
  }
  put(owner: string, raw: any): string | null {
    this.prune()
    const groups = new Map<string, Obj[]>()
    groups.set('', list(raw.calculation.trace).map(traceStep))
    for (const p of list(raw.calculation.positions))
      groups.set(String(p.id), list(p.trace).map(traceStep))
    const bytes = Buffer.byteLength(JSON.stringify([...groups.values()]))
    if (bytes > this.maxBytes) return null
    while (this.entries.size >= this.maxEntries || this.bytes + bytes > this.maxBytes) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) return null
      this.remove(oldest)
    }
    const key = randomBytes(32).toString('base64url')
    this.entries.set(key, { owner, expires: this.now() + this.ttl, groups, bytes })
    this.bytes += bytes
    return key
  }
  get(owner: string, key: string, position: string, query: string, offset: number, limit: number) {
    this.prune()
    const e = this.entries.get(key)
    if (!e || e.owner !== owner) return null
    const group = e.groups.get(position)
    if (!group) return null
    const q = query.toLowerCase()
    const filtered = q
      ? group.filter((s) =>
          [s.id, s.kind, s.ruleId, record(s.source).sheet, record(s.source).cell].some(
            (v) => typeof v === 'string' && v.toLowerCase().includes(q),
          ),
        )
      : group
    return { steps: filtered.slice(offset, offset + limit), total: filtered.length, offset, limit }
  }
}
