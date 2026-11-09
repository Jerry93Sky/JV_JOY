import { EngineError } from '../errors.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal, type ExactRational } from '../rational.ts'
import type { PriceProfile, TraceStep } from '../types.ts'
import { traceStep } from '../trace.ts'
import { calculateZigzagGeometry, type ZigzagGeometryInput, type ZigzagGeometryResult } from './geometry.ts'
import { calculateZigzagBaseMaterialQuantities } from './material-quantities.ts'
import { calculateZigzagOrderAdhesiveAllocation, type ZigzagAdhesivePosition, type ZigzagOrderAllocationResult } from './order-allocation.ts'
import { buildZigzagPriceSnapshot, calculateZigzagMaterialCost, type ZigzagMaterialCostResult, type ZigzagPriceSnapshot, type ZigzagPriceSnapshotInput } from './pricing.ts'
import { calculateZigzagP39, calculateZigzagP40, calculateZigzagP41, calculateZigzagP43, calculateZigzagCommercialPrice } from './commercial-cost.ts'

export interface ZigzagOrderPositionInput {
  readonly id: string
  readonly slot: number
  readonly family: 'ZIGZAG' | 'OTHER'
  readonly quantity: string
  readonly geometry?: ZigzagGeometryInput
  readonly commercial?: Readonly<{
    c8: string
    F28: 1 | 2
    D32: boolean
    D33: boolean
    D34: boolean
    L3: boolean
    glassTypeSelector?: number
    /** Manual cells on the construction sheet; undefined remains missing. */
    N40?: string
    N41?: string
  }>
  readonly label?: string
}

export interface ZigzagOrderPositionResult {
  readonly id: string
  readonly slot: number
  readonly quantity: ExactRational
  readonly status: 'COMPLETE' | 'PARTIAL'
  readonly geometry?: ZigzagGeometryResult
  readonly materialCost?: ZigzagMaterialCostResult
  readonly costs?: Readonly<{ P38?: ExactRational; P39?: ExactRational; P40?: ExactRational; P41?: ExactRational; P42?: ExactRational; P43?: ExactRational; P44?: ExactRational }>
  readonly unitSalePrice?: ExactRational
  readonly extendedSalePrice?: ExactRational
  readonly trace: readonly TraceStep[]
  readonly missingDependencies: readonly string[]
  readonly diagnostics: readonly string[]
}

export interface ZigzagOrderCalculationResult {
  readonly orderId: string
  readonly workbook: string
  readonly profile: PriceProfile
  readonly status: 'COMPLETE' | 'PARTIAL'
  readonly positions: readonly ZigzagOrderPositionResult[]
  readonly allocation: ZigzagOrderAllocationResult
  readonly totalSalePrice?: ExactRational
  readonly trace: readonly TraceStep[]
  readonly diagnostics: readonly string[]
}

/** Orchestrates only supported Zigzag positions. It applies order-level glue and area factors once,
 * then computes each construction's P38:P44 and Главная!Sslot unit price before quantity extension. */
export function calculateZigzagOrder(input: {
  readonly orderId: string
  readonly snapshot: ZigzagPriceSnapshot | ZigzagPriceSnapshotInput
  readonly positions: readonly ZigzagOrderPositionInput[]
  /** Cross-family shared order allocation computed by the JV mixed-order coordinator. */
  readonly sharedAllocation?: ZigzagOrderAllocationResult
}): ZigzagOrderCalculationResult {
  if (!input.orderId.trim()) throw new EngineError('INVALID_CONFIGURATION', 'orderId must not be empty')
  if (!input.positions.length) throw new EngineError('MISSING_INPUT', 'A Zigzag order requires at least one position')
  if (new Set(input.positions.map((p) => p.id)).size !== input.positions.length) throw new EngineError('INVALID_CONFIGURATION', 'Order position ids must be unique')
  if (new Set(input.positions.map((p) => p.slot)).size !== input.positions.length || input.positions.some((p) => !Number.isInteger(p.slot) || p.slot < 1 || p.slot > 7)) throw new EngineError('INVALID_CONFIGURATION', 'Each position must use a unique Excel slot 1..7')
  const snapshot = 'capturedFrom' in input.snapshot ? buildZigzagPriceSnapshot(input.snapshot) : input.snapshot
  const parsed = input.positions.map((position) => {
    let quantity: ExactRational
    try { quantity = rationalFromDecimal(position.quantity) } catch { throw new EngineError('INVALID_DECIMAL', `Invalid quantity for ${position.id}`, { positionId: position.id }) }
    if (BigInt(quantity.numerator) <= 0n) throw new EngineError('INVALID_CONFIGURATION', 'Order position quantity must be positive', { positionId: position.id })
    if (position.family === 'ZIGZAG' && (!position.geometry || !position.commercial)) throw new EngineError('MISSING_INPUT', 'Zigzag positions require geometry and commercial inputs', { positionId: position.id })
    return { position, quantity }
  })
  const zigzags = parsed.filter(({ position }) => position.family === 'ZIGZAG').map(({ position, quantity }) => {
    const geometry = calculateZigzagGeometry(position.geometry!)
    const bom = calculateZigzagBaseMaterialQuantities(geometry)
    return { position, quantity, geometry, bom }
  })
  const commercialModes=new Set(zigzags.map(({position})=>{const c=position.commercial!;return `${c.F28}|${c.D32}|${c.D33}|${c.D34}|${c.L3}`}))
  if(commercialModes.size>1)throw new EngineError('INVALID_CONFIGURATION','Главная!F28 and Настройки!D32:D34/L3 are order-level settings and must be identical across every Zigzag position')
  const allocationPositions: ZigzagAdhesivePosition[] = parsed.map(({ position, quantity }) => {
    if (position.family !== 'ZIGZAG') return { id: position.id, family: 'OTHER', quantity }
    const item = zigzags.find((x) => x.position.id === position.id)!
    return { id: position.id, family: 'ZIGZAG', quantity, activatorPerConstruction: item.bom.exactQuantities[34], adhesivePerConstruction: item.bom.exactQuantities[35], widthMm: rationalFromDecimal(item.geometry.inputs.widthMm), heightMm: rationalFromDecimal(item.geometry.inputs.heightMm) }
  })
  if(input.sharedAllocation&&input.sharedAllocation.workbook!==snapshot.workbook)throw new EngineError('INVALID_CONFIGURATION','Shared mixed-order allocation must use the same workbook as the Zigzag snapshot')
  if(input.sharedAllocation&&input.sharedAllocation.status!=='COMPLETE')throw new EngineError('RULE_UNCONFIRMED','Zigzag positions require a complete cross-family shared allocation')
  if(input.sharedAllocation&&input.positions.some((position)=>!input.sharedAllocation!.systemAllocations?.some((allocation)=>allocation.positionId===position.id)))throw new EngineError('MISSING_INPUT','Shared mixed-order area allocation is missing a Zigzag position')
  const allocation = input.sharedAllocation??calculateZigzagOrderAdhesiveAllocation({ orderId: input.orderId, workbook: snapshot.workbook, positions: allocationPositions })
  const diagnostics: string[] = []
  if (allocation.status === 'PARTIAL') diagnostics.push(`Order-level adhesive/activator factors are unavailable for other families: ${allocation.unsupportedPositions.join(', ')}`)
  const output: ZigzagOrderPositionResult[] = []
  let orderTotal = rationalFromDecimal('0')
  for (const { position, quantity } of parsed) {
    if (position.family !== 'ZIGZAG') {
      output.push(Object.freeze({ id: position.id, slot: position.slot, quantity, status: 'PARTIAL', missingDependencies: Object.freeze(['other-family geometry and shared consumption rules']), diagnostics: Object.freeze(['Mixed-family order totals are blocked until that family supplies verified N34/N35 and area allocation inputs.']), trace: Object.freeze([]) }))
      continue
    }
    const item = zigzags.find((x) => x.position.id === position.id)!
    const commercialInputs = position.commercial!
    const materialCost = calculateZigzagMaterialCost({ bom: item.bom, snapshot, profile: snapshot.profile, orderAllocation: allocation })
    const p39 = calculateZigzagP39({ workbook: snapshot.workbook, geometry: item.geometry, bom: item.bom, snapshot, allocation, slotId: position.id, c8: commercialInputs.c8, N40: commercialInputs.N40, N41: commercialInputs.N41 })
    const p40 = calculateZigzagP40({ workbook: snapshot.workbook, enabled: commercialInputs.D32, geometry: item.geometry, snapshot, allocation, slotId: position.id, glassTypeSelector: commercialInputs.glassTypeSelector })
    const p41 = calculateZigzagP41({ workbook: snapshot.workbook, assemblyEnabled: commercialInputs.D33, l3Enabled: commercialInputs.L3, widthMm: item.geometry.inputs.widthMm, exactN10: item.bom.exactQuantities[10]!, snapshot })
    const p43 = calculateZigzagP43({ workbook: snapshot.workbook, enabled: commercialInputs.D34, widthMm: item.geometry.inputs.widthMm, heightMm: item.geometry.inputs.heightMm, leafCount: Number(item.geometry.inputs.normalizedSashCount), snapshot })
    const price = calculateZigzagCommercialPrice({ workbook: snapshot.workbook, materialCost, p39: p39.value, p40: p40.value, p41: p41.value, p43: p43.value, F28: commercialInputs.F28, snapshot, allocation, slotId: position.id })
    const missing = [...new Set([...p39.missingDependencies.map((d) => `Z${position.slot}!${d.replace(/^Z1!/, '')}`), ...p40.missingDependencies.map((d) => d.replace(/Z1/g, `Z${position.slot}`)), ...price.missingDependencies])]
    const rowDiagnostics: string[] = []
    if (allocation.status === 'PARTIAL') rowDiagnostics.push('Shared order allocation is incomplete because an unsupported family is present.')
    const slotN = position.slot
    // Keep sale price formula exact and only publish it when every P44 dependency is complete.
    let exactUnitPrice: ExactRational | undefined
    if (price.p44 !== undefined && allocation.status === 'COMPLETE') {
      const divisor = rationalFromDecimal(snapshot.settings.D12)
      if (BigInt(divisor.numerator) === 0n) throw new EngineError('DIVISION_BY_ZERO', 'Настройки!D12 must be non-zero for Главная!Sslot', { sourceCell: 'Настройки!D12' })
      exactUnitPrice = divideRational(price.p44, divisor)
    }
    const extendedSalePrice = exactUnitPrice ? multiplyRational(exactUnitPrice, quantity) : undefined
    if (extendedSalePrice) orderTotal = addRational(orderTotal, extendedSalePrice)
    const positionTrace:TraceStep[]=[...p39.trace,...p40.trace,p41.trace,p43.trace,...price.trace]
    if(exactUnitPrice)positionTrace.push(traceStep({id:`JV.ZIGZAG.ORDER.S${position.slot}`,kind:'pricing',label:`Главная!S${position.slot+10} unit sale price`,inputRefs:[`Z${position.slot}.P44`,'Настройки.D12'],ruleId:'JV.ZIGZAG.SALE.UNIT.PRICE-2026-11-04-v1',source:{workbook:snapshot.workbook,sheet:'Главная',cell:`S${position.slot+10}`,formula:`='Z${position.slot}'!$P$44/Настройки!$D$12`},catalogRefs:[{id:'JV-ZIGZAG-PRICE-SNAPSHOT',version:snapshot.version}],input:{P44:price.p44,D12:snapshot.settings.D12},result:exactUnitPrice,status:'ok',errorIds:[],warningIds:[]}))
    if(extendedSalePrice)positionTrace.push(traceStep({id:`JV.ZIGZAG.ORDER.EXTENDED.${position.id}`,kind:'summary',label:`${position.id} sale amount for all instances`,inputRefs:[`JV.ZIGZAG.ORDER.S${position.slot}`,`Главная!Z${position.slot+10}`],ruleId:'JV.ZIGZAG.ORDER.POSITION-EXTENSION-2026-11-04-v1',source:{workbook:snapshot.workbook,sheet:'order',cell:position.id,formula:'unit sale price × position quantity'},catalogRefs:[{id:'JV-ZIGZAG-PRICE-SNAPSHOT',version:snapshot.version}],input:{unitSalePrice:exactUnitPrice,quantity},result:extendedSalePrice,status:'ok',errorIds:[],warningIds:[]}))
    const complete = !!price.p44 && !!extendedSalePrice && allocation.status === 'COMPLETE' && missing.length === 0
    if (p40.missingDependencies.length) rowDiagnostics.push(...p40.diagnostics, `Active glass branch is incomplete: ${p40.missingDependencies.join(', ')}`)
    if (!complete) diagnostics.push(`${position.id}: ${missing.join('; ') || 'commercial result is partial'}`)
    output.push(Object.freeze({ id: position.id, slot: slotN, quantity, status: complete ? 'COMPLETE' : 'PARTIAL', geometry: item.geometry, materialCost, costs: Object.freeze({ ...(materialCost.p38 ? { P38: materialCost.p38 } : {}), ...(p39.value ? { P39: p39.value } : {}), ...(p40.value ? { P40: p40.value } : {}), ...(p41.value ? { P41: p41.value } : {}), ...(price.p42 ? { P42: price.p42 } : {}), ...(p43.value ? { P43: p43.value } : {}), ...(price.p44 ? { P44: price.p44 } : {}) }), ...(exactUnitPrice ? { unitSalePrice: exactUnitPrice } : {}), ...(extendedSalePrice ? { extendedSalePrice } : {}), missingDependencies: Object.freeze(missing), diagnostics: Object.freeze(rowDiagnostics), trace: Object.freeze(positionTrace) }))
  }
  const complete = output.every((position) => position.status === 'COMPLETE') && allocation.status === 'COMPLETE'
  const orderTrace:TraceStep[]=[...allocation.trace, ...zigzags.flatMap(({ position, geometry, bom }) => {
    const result = output.find((x) => x.id === position.id)!
    return [...geometry.trace, ...bom.trace, ...(result.materialCost?.trace ?? []), ...result.trace]
  })]
  if(complete)orderTrace.push(traceStep({id:'JV.ZIGZAG.ORDER.TOTAL',kind:'summary',label:'Zigzag order sale total',inputRefs:output.map((position)=>`JV.ZIGZAG.ORDER.EXTENDED.${position.id}`),ruleId:'JV.ZIGZAG.ORDER.TOTAL-2026-11-04-v1',source:{workbook:snapshot.workbook,sheet:'order',cell:'saleTotal',formula:'Σ(unit sale price × position quantity); derived because original workbook has no order-total cell'},catalogRefs:[{id:'JV-ZIGZAG-PRICE-SNAPSHOT',version:snapshot.version}],input:Object.fromEntries(output.map((position)=>[position.id,position.extendedSalePrice])),result:orderTotal,status:'ok',errorIds:[],warningIds:[]}))
  return Object.freeze({ orderId: input.orderId, workbook: snapshot.workbook, profile: snapshot.profile, status: complete ? 'COMPLETE' : 'PARTIAL', positions: Object.freeze(output), allocation, ...(complete ? { totalSalePrice: orderTotal } : {}), trace:Object.freeze(orderTrace), diagnostics: Object.freeze(diagnostics) })
}
