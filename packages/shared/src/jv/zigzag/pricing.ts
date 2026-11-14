import { EngineError } from '../errors.ts'
import { executeGraph, type CalculationRule } from '../graph.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal, type ExactRational } from '../rational.ts'
import { traceStep } from '../trace.ts'
import type { PriceProfile, TraceStep, Unit } from '../types.ts'
import { zigzagBomSources } from './material-quantities.ts'
import type { ZigzagOrderAllocationResult } from './order-allocation.ts'

export interface ZigzagPriceEntryInput {
  readonly bomRow: number
  readonly sku: string
  readonly description: string
  readonly excelUnit: string
  readonly price: string
  readonly sourceCell: string
  readonly sourceLiteral?: string
  readonly sourceFormula?: string
  readonly excelPriceFormula: string
  readonly divisorSetting?: 'D3'|'L7'|'L8'
  readonly amountFormula: string
}
export interface ZigzagPriceSnapshotInput {
  readonly schemaVersion: '1.0'
  readonly profile: PriceProfile
  readonly version: string
  readonly workbook: string
  readonly workbookSha256: string
  readonly capturedFrom: 'EXCEL_COM_VALUE2'
  readonly capturedWithExcel: string
  readonly currency: 'RUB'
  readonly settings: Readonly<Record<'D3'|'D12'|'L7'|'L8'|'L9'|'L10'|'L11'|'L26'|'P19'|'L17'|'L21',string>>
  readonly serviceRates:Readonly<Record<'C6'|'C8'|'C9'|'C13'|'C19'|'C23'|'C24'|'C25',Readonly<{value:string;sourceCell:string;sourceLiteral:string}>>>
  readonly lineCostRates:Readonly<Record<'G5'|'G6'|'G7'|'G8'|'G9'|'G10'|'G39'|'G40',Readonly<{value:string;sourceCell:string;sourceLiteral:string}>>>
  readonly glassRates:readonly Readonly<{selector:number;price:string;sourceCell:string;sourceLiteral:string}>[]
  readonly entries: readonly ZigzagPriceEntryInput[]
}
export interface ZigzagPriceSnapshot extends ZigzagPriceSnapshotInput {}
export interface ZigzagPricePosition {
  readonly bomRow: number
  readonly sku: string
  readonly sourceCell: string
  readonly quantity: ExactRational
  readonly unit: Unit
  readonly unitPrice: ExactRational
  readonly amount?: ExactRational
  readonly priceSourceCell: string
  readonly traceStepId: string
}
export interface ZigzagUnsupportedPricePosition { readonly bomRow: number; readonly sku: string; readonly sourceCell: string; readonly reason: 'PRICE_NOT_FOUND'|'UNIT_MISMATCH'|'ORDER_FACTOR_REQUIRED' }
export interface ZigzagMaterialCostResult {
  readonly profile: PriceProfile
  readonly currency: 'RUB'
  readonly priceSnapshotVersion: string
  readonly status: 'COMPLETE'|'PARTIAL'
  readonly positions: readonly ZigzagPricePosition[]
  readonly unsupportedPositions: readonly ZigzagUnsupportedPricePosition[]
  readonly supportedSubtotal: ExactRational
  /** Only set when all P5:P35 positions and factors are available. */
  readonly p38?: ExactRational
  readonly trace: readonly TraceStep[]
  readonly parity: 'EXCEL_PARITY_UNVERIFIED'
}

const rowSource = new Map(zigzagBomSources.map((source) => [source.row,source]))
const priceSourceRows = new Map<number,number>([
  [5,5],[6,6],[7,7],[8,8],[9,11],[10,15],[11,17],[12,18],[13,19],[14,20],[15,23],[16,26],[17,29],[18,30],[19,31],[20,32],[21,33],[22,34],[23,35],[24,36],[25,37],[26,38],[27,41],[28,42],[29,43],[30,45],[31,46],[32,47],[33,48],[34,50],[35,51],
])
const expectedDivisor = new Map<number,'D3'|'L7'|'L8'>([[5,'D3'],[6,'D3'],[7,'D3'],[8,'D3'],[30,'L7'],[31,'L8']])
const expectedAmountFormula = (row:number) => row===34 ? "=O34*N34*'Клей+акт'!$O$5" : row===35 ? "=O35*N35*'Клей+акт'!$O$18" : `=O${row}*N${row}`
function excelUnitToJV(value:string):Unit {
  if(value==='п.м'||value==='п.м.'||value==='м') return 'm'
  if(value==='шт.'||value==='шт') return 'piece'
  if(value==='комплект') return 'set'
  throw new EngineError('UNIT_MISMATCH',`Unrecognized Zigzag catalog unit: ${value}`,{excelUnit:value})
}
function expectedPriceFormula(row:number,catalogRow:number):string {
  const divisor=expectedDivisor.get(row)
  return divisor ? `='Прайс-Line'!$E${catalogRow}/Настройки!$${divisor}` : `='Прайс-Line'!$E${catalogRow}`
}
function normalizeFormula(value:string):string { return value.replace(/\$/g,'').replace(/ /g,'') }

/** Validates a COM-captured, workbook-versioned raw-price snapshot. Derived O-column values are never accepted as source prices. */
export function buildZigzagPriceSnapshot(input:ZigzagPriceSnapshotInput):ZigzagPriceSnapshot {
  if(!/^[a-f0-9]{64}$/i.test(input.workbookSha256)) throw new EngineError('INVALID_CONFIGURATION','Zigzag price snapshot requires the source workbook SHA-256')
  if(!input.version||!input.workbook||input.capturedFrom!=='EXCEL_COM_VALUE2'||input.currency!=='RUB') throw new EngineError('INVALID_CONFIGURATION','Incomplete Zigzag price snapshot provenance')
  for(const [name,value] of Object.entries(input.settings)) { if(name==='L21') { if(!/^(0|1|true|false)$/i.test(value))throw new EngineError('INVALID_CONFIGURATION',`Invalid boolean price setting Настройки!${name}: ${value}`);continue }try { rationalFromDecimal(value) } catch { throw new EngineError('INVALID_DECIMAL',`Invalid price setting Настройки!${name}: ${value}`) } }
  for(const [cell,rate] of Object.entries(input.serviceRates)) { if(rate.sourceCell!==`'Прайс-сб+монт'!${cell}`||rate.sourceLiteral.startsWith('=')||rate.sourceLiteral!==rate.value) throw new EngineError('RULE_UNCONFIRMED',`Expected literal service source for ${cell}`,{sourceCell:rate.sourceCell});try{rationalFromDecimal(rate.value)}catch{throw new EngineError('INVALID_DECIMAL',`Invalid service price at ${rate.sourceCell}`)} }
  for(const [cell,rate] of Object.entries(input.lineCostRates)) { if(rate.sourceCell!==`'Прайс-Line'!${cell}`||rate.sourceLiteral.startsWith('=')||rate.sourceLiteral!==rate.value) throw new EngineError('RULE_UNCONFIRMED',`Expected literal cost source for ${cell}`,{sourceCell:rate.sourceCell});try{rationalFromDecimal(rate.value)}catch{throw new EngineError('INVALID_DECIMAL',`Invalid cost price at ${rate.sourceCell}`)} }
  if(input.glassRates.length!==12||input.glassRates.some((rate,index)=>rate.selector!==index+1||rate.sourceCell!==`'Прайс-Стекло'!D${index+5}`||rate.sourceLiteral.startsWith('=')||rate.sourceLiteral!==rate.price)) throw new EngineError('RULE_UNCONFIRMED','Zigzag glass rates must provide literal D5:D16 values in selector order')
  for(const rate of input.glassRates)try{rationalFromDecimal(rate.price)}catch{throw new EngineError('INVALID_DECIMAL',`Invalid glass price at ${rate.sourceCell}`)}
  const seen=new Set<number>()
  for(const entry of input.entries) {
    const source=rowSource.get(entry.bomRow), catalogRow=priceSourceRows.get(entry.bomRow)
    if(!source||catalogRow===undefined) throw new EngineError('RULE_UNCONFIRMED',`No confirmed Zigzag price mapping for BOM row ${entry.bomRow}`)
    if(seen.has(entry.bomRow)) throw new EngineError('INVALID_CONFIGURATION',`Duplicate Zigzag price row ${entry.bomRow}`)
    seen.add(entry.bomRow)
    if(entry.sku!==source.catalogId) throw new EngineError('RULE_UNCONFIRMED',`Catalog identity differs from Zigzag BOM row ${entry.bomRow}`,{expectedSku:source.catalogId,actualSku:entry.sku})
    if(entry.sourceCell!==`'Прайс-Line'!E${catalogRow}`) throw new EngineError('RULE_UNCONFIRMED',`Unexpected raw price source for N${entry.bomRow}`,{expected:`'Прайс-Line'!E${catalogRow}`,actual:entry.sourceCell})
    if(entry.sourceFormula?.startsWith('=')) throw new EngineError('RULE_UNCONFIRMED',`Formula-derived catalog price is not an approved raw constant at ${entry.sourceCell}`)
    if(entry.sourceLiteral!==undefined&&entry.sourceLiteral!==entry.price) throw new EngineError('RULE_UNCONFIRMED',`Price value differs from its captured source literal at ${entry.sourceCell}`)
    try { rationalFromDecimal(entry.price) } catch { throw new EngineError('INVALID_DECIMAL',`Invalid source price at ${entry.sourceCell}`,{value:entry.price}) }
    const formula=expectedPriceFormula(entry.bomRow,catalogRow)
    if(normalizeFormula(entry.excelPriceFormula)!==normalizeFormula(formula)) throw new EngineError('RULE_UNCONFIRMED',`Excel O${entry.bomRow} formula differs from the confirmed rule`,{expected:formula,actual:entry.excelPriceFormula})
    if(entry.divisorSetting!==expectedDivisor.get(entry.bomRow)) throw new EngineError('RULE_UNCONFIRMED',`Excel divisor differs for O${entry.bomRow}`,{expected:expectedDivisor.get(entry.bomRow),actual:entry.divisorSetting})
    if(normalizeFormula(entry.amountFormula)!==normalizeFormula(expectedAmountFormula(entry.bomRow))) throw new EngineError('RULE_UNCONFIRMED',`Excel P${entry.bomRow} formula differs from the confirmed rule`,{expected:expectedAmountFormula(entry.bomRow),actual:entry.amountFormula})
    const expectedUnit=source.unit==='m'?'m':source.unit==='set'?'set':'piece'
    if(excelUnitToJV(entry.excelUnit)!==expectedUnit) throw new EngineError('UNIT_MISMATCH',`Catalog unit does not match Zigzag BOM row ${entry.bomRow}`,{bomUnit:expectedUnit,excelUnit:entry.excelUnit,sourceCell:entry.sourceCell})
  }
  return Object.freeze({...input,settings:Object.freeze({...input.settings}),serviceRates:Object.freeze({...input.serviceRates}),lineCostRates:Object.freeze({...input.lineCostRates}),glassRates:Object.freeze(input.glassRates.map((rate)=>Object.freeze({...rate}))),entries:Object.freeze([...input.entries].map((entry)=>Object.freeze({...entry})))})
}

/** Calculates confirmed O5:O35 and P5:P35 formula chains with rational arithmetic; shared glue coefficients are order inputs. */
export function calculateZigzagMaterialCost(input:{readonly bom:{readonly exactQuantities:Readonly<Record<number,ExactRational>>};readonly snapshot:ZigzagPriceSnapshot;readonly profile:PriceProfile;readonly orderAllocation?:ZigzagOrderAllocationResult}):ZigzagMaterialCostResult {
  const {bom,snapshot}=input
  if(snapshot.profile!==input.profile) throw new EngineError('INVALID_CONFIGURATION','Zigzag price snapshot profile must match calculation profile',{requested:input.profile,snapshot:snapshot.profile})
  if(input.orderAllocation&&input.orderAllocation.workbook!==snapshot.workbook) throw new EngineError('INVALID_CONFIGURATION','Adhesive allocation and price snapshot must use the same workbook')
  const adhesiveFactors=input.orderAllocation?.status==='COMPLETE'?input.orderAllocation.adhesiveFactors:undefined
  const entries=new Map(snapshot.entries.map((entry)=>[entry.bomRow,entry]))
  const values:Record<string,unknown>={}; const rules:CalculationRule[]=[]; const unsupported:ZigzagUnsupportedPricePosition[]=[]
  for(let row=5;row<=35;row++) {
    const definition=rowSource.get(row)!; const sourceCell=`Z1!P${row}`; const price=entries.get(row); const quantity=bom.exactQuantities[row]
    if(!quantity) throw new EngineError('MISSING_INPUT',`Zigzag BOM exact quantity N${row} is missing`,{sourceCell:`Z1!N${row}`})
    if(!price) { unsupported.push({bomRow:row,sku:definition.catalogId,sourceCell,reason:'PRICE_NOT_FOUND'}); continue }
    const expectedUnit=definition.unit==='m'?'m':definition.unit==='set'?'set':'piece'
    const actualUnit=excelUnitToJV(price.excelUnit)
    if(actualUnit!==expectedUnit) { unsupported.push({bomRow:row,sku:definition.catalogId,sourceCell,reason:'UNIT_MISMATCH'}); continue }
    const id=`JV.ZIGZAG.COST.P${row}`; values[`${id}.rawPrice`]=price.price; values[`${id}.quantity`]=quantity
    const divisorName=expectedDivisor.get(row); if(divisorName) values[`${id}.divisor`]=snapshot.settings[divisorName]
    const factorKey=row===34?'O5':row===35?'O18':undefined
    const factor=factorKey?adhesiveFactors?.[factorKey]:undefined
    const deps=[`${id}.rawPrice`,`${id}.quantity`,...(divisorName?[`${id}.divisor`]:[]),...(factorKey&&factor?[`${id}.orderFactor`]:[])]
    if(factor!==undefined) values[`${id}.orderFactor`]=factor
    if(factorKey&&factor===undefined) { unsupported.push({bomRow:row,sku:definition.catalogId,sourceCell,reason:'ORDER_FACTOR_REQUIRED'}); continue }
    rules.push({id,version:`JV-ZIGZAG-PRICE-RULES-2026-11-04:${snapshot.version}`,dependsOn:deps,source:{workbook:snapshot.workbook,sheet:'Z1',cell:`P${row}`,formula:price.amountFormula},execute:({inputs:source})=>{
      const raw=rationalFromDecimal(source[`${id}.rawPrice`] as string)
      const unitPrice=divisorName?divideRational(raw,rationalFromDecimal(source[`${id}.divisor`] as string)):raw
      const base=multiplyRational(unitPrice,source[`${id}.quantity`] as ExactRational)
      return factorKey?multiplyRational(base,source[`${id}.orderFactor`] as ExactRational):base
    }})
  }
  const graph=executeGraph(values,rules); let subtotal=rationalFromDecimal('0')
  const positions:ZigzagPricePosition[]=[]
  for(const row of rules.map((rule)=>Number(/P(\d+)$/.exec(rule.id)![1]))){
    const definition=rowSource.get(row)!,entry=entries.get(row)!,id=`JV.ZIGZAG.COST.P${row}`
    const raw=rationalFromDecimal(entry.price),divisorName=expectedDivisor.get(row)
    const unitPrice=divisorName?divideRational(raw,rationalFromDecimal(snapshot.settings[divisorName])):raw
    const amount=graph.values[id] as ExactRational; subtotal=addRational(subtotal,amount)
    positions.push(Object.freeze({bomRow:row,sku:definition.catalogId,sourceCell:`Z1!P${row}`,quantity:bom.exactQuantities[row],unit:excelUnitToJV(entry.excelUnit),unitPrice,amount,priceSourceCell:entry.sourceCell,traceStepId:id}))
  }
  const complete=positions.length===31&&unsupported.length===0
  const summaryTrace=traceStep({id:'JV.ZIGZAG.COST.P38',kind:'summary',label:'Zigzag material subtotal P38',inputRefs:positions.map((position)=>position.traceStepId),ruleId:'JV.ZIGZAG.PRICE.P38',source:{workbook:snapshot.workbook,sheet:'Z1',cell:'P38',formula:'=SUM($P$5:$P$35)'},catalogRefs:[{id:'JV-ZIGZAG-PRICE-SNAPSHOT',version:snapshot.version}],input:{supportedRows:positions.map((position)=>position.bomRow),missing:unsupported},result:complete?subtotal:{supportedSubtotal:subtotal},status:'ok',errorIds:[],warningIds:complete?[]:['P38_INCOMPLETE_DEPENDENCIES']})
  return Object.freeze({profile:snapshot.profile,currency:snapshot.currency,priceSnapshotVersion:snapshot.version,status:complete?'COMPLETE':'PARTIAL',positions:Object.freeze(positions),unsupportedPositions:Object.freeze(unsupported),supportedSubtotal:subtotal,...(complete?{p38:subtotal}:{}),trace:Object.freeze([...graph.trace,summaryTrace]),parity:'EXCEL_PARITY_UNVERIFIED'})
}
