import { EngineError } from './errors.ts'
import { executeGraph } from './graph.ts'
import { addRational, multiplyRational, rationalFromDecimal, type ExactRational } from './rational.ts'
import type { LineMaterialBom } from './bom-line.ts'

export interface LinePaintPriceSnapshot {
  readonly profile: 'COMPLETATION'|'RETAIL'
  readonly workbook: string
  readonly workbookSha256: string
  readonly currency: 'RUB'
  readonly entries: readonly { readonly row: number; readonly value: string; readonly sourceCell: string }[]
  readonly settings: Readonly<{ L9:string; L10:string; L11:string }>
  readonly transportPrice: string
}
const ROWS = [
  { paintRow:5, bomRow:5, priceRow:5 }, { paintRow:6, bomRow:6, priceRow:6 },
  { paintRow:7, bomRow:7, priceRow:7 }, { paintRow:8, bomRow:8, priceRow:8 },
  { paintRow:9, bomRow:9, priceRow:9 }, { paintRow:10, bomRow:10, priceRow:10 },
  { paintRow:11, bomRow:40, priceRow:39 }, { paintRow:12, bomRow:41, priceRow:40 },
] as const
export interface LinePaintResult {
  readonly finishIndex:number
  readonly finishName:string
  readonly itemCosts:readonly {readonly sourceRow:number;readonly amount:ExactRational;readonly priceCell:string;readonly quantityCell:string}[]
  readonly indexedPaintSubtotal:ExactRational // L1!V13
  readonly minimumPaintCharge:ExactRational // L1!V14
  readonly appliedPaintCharge:ExactRational // L1!V15
  readonly transportCharge:ExactRational // L1!V17
  readonly finishTotal:ExactRational // L1!V18
  readonly q53:ExactRational
  readonly trace:ReturnType<typeof executeGraph>['trace']
}

/** Implements the sourced JV-Line paint pricing branch Q53 from BOM quantities and profile prices. */
export function calculateLinePaint(input:{
  readonly workbook:string
  readonly profile:'COMPLETATION'|'RETAIL'
  readonly finishIndex:number // Главная!H11 -> L1!C10
  readonly bom:LineMaterialBom
  readonly systemAllocationFactor:ExactRational // isolated quote X5 from JV.Line glass allocation step
  readonly priceSnapshot:LinePaintPriceSnapshot
}):LinePaintResult{
  if(input.workbook!==input.priceSnapshot.workbook||input.profile!==input.priceSnapshot.profile)throw new EngineError('INVALID_CONFIGURATION','Paint price snapshot must match the selected workbook and profile')
  if(!Number.isInteger(input.finishIndex)||input.finishIndex<1||input.finishIndex>4)throw new EngineError('INVALID_CONFIGURATION','Paint finish index must resolve to #1!C24:C27',{finishIndex:input.finishIndex})
  const finishes=['некраш.','глянец','матовый','муар'] as const
  const bySource=new Map(input.bom.lines.map(line=>[line.sourceCell,line.quantity.value]))
  const prices=new Map(input.priceSnapshot.entries.map(entry=>[entry.row,entry]))
  const values:Record<string,unknown>={finishIndex:input.finishIndex,paintMultiplier:rationalFromDecimal(input.priceSnapshot.settings.L11),minimumUnits:rationalFromDecimal(input.priceSnapshot.settings.L9),minimumRate:rationalFromDecimal(input.priceSnapshot.settings.L10),transportPrice:rationalFromDecimal(input.priceSnapshot.transportPrice),x5:input.systemAllocationFactor}
  for(const row of ROWS){
    const quantity=bySource.get(`L1!O${row.bomRow}`),price=prices.get(row.priceRow)
    if(quantity===undefined)throw new EngineError('MISSING_INPUT',`JV-Line BOM quantity L1!O${row.bomRow} is required for paint`,{sourceCell:`L1!O${row.bomRow}`})
    if(!price||price.sourceCell!==`'Прайс-Line'!G${row.priceRow}`)throw new EngineError('PRICE_NOT_FOUND',`Missing paint price 'Прайс-Line'!G${row.priceRow}`,{sourceCell:`'Прайс-Line'!G${row.priceRow}`})
    values[`O${row.bomRow}`]=rationalFromDecimal(quantity);values[`G${row.priceRow}`]=rationalFromDecimal(price.value)
  }
  const rules:any[]=[]
  for(const row of ROWS)rules.push({id:`JV.LINE.PAINT.V${row.paintRow}`,version:`JV-LINE-PAINT-2026-10-08:${input.priceSnapshot.workbookSha256}`,dependsOn:[`O${row.bomRow}`,`G${row.priceRow}`],source:{workbook:input.workbook,sheet:'L1',cell:`V${row.paintRow}`,formula:`=$O$${row.bomRow}*'Прайс-Line'!$G$${row.priceRow}`},execute:({inputs}:any)=>multiplyRational(inputs[`O${row.bomRow}`],inputs[`G${row.priceRow}`])})
  rules.push(
    {id:'JV.LINE.PAINT.V13',version:'JV-LINE-PAINT-2026-10-08',dependsOn:[...ROWS.map(row=>`JV.LINE.PAINT.V${row.paintRow}`),'finishIndex','paintMultiplier'],source:{workbook:input.workbook,sheet:'L1',cell:'V13',formula:'=SUM(V5:V12)*IF($C$10=4,Настройки!$L$11,1)'},execute:({inputs,results}:any)=>{const sum=ROWS.reduce((a,row)=>addRational(a,results[`JV.LINE.PAINT.V${row.paintRow}`]),rationalFromDecimal('0'));return multiplyRational(sum,inputs.finishIndex===4?inputs.paintMultiplier:rationalFromDecimal('1'))}},
    {id:'JV.LINE.PAINT.V14',version:'JV-LINE-PAINT-2026-10-08',dependsOn:['minimumUnits','minimumRate','x5'],source:{workbook:input.workbook,sheet:'L1',cell:'V14',formula:'=Настройки!$L$9*Настройки!$L$10*$X$5'},execute:({inputs}:any)=>multiplyRational(multiplyRational(inputs.minimumUnits,inputs.minimumRate),inputs.x5)},
    {id:'JV.LINE.PAINT.V15',version:'JV-LINE-PAINT-2026-10-08',dependsOn:['JV.LINE.PAINT.V10','JV.LINE.PAINT.V11','JV.LINE.PAINT.V12','JV.LINE.PAINT.V13','JV.LINE.PAINT.V14'],source:{workbook:input.workbook,sheet:'L1',cell:'V15',formula:'=MAX(V10:V14)'},execute:({results}:any)=>[10,11,12,13,14].map(row=>results[`JV.LINE.PAINT.V${row}`] as ExactRational).reduce((max,value)=>compare(value,max)>0?value:max,rationalFromDecimal('0'))},
    {id:'JV.LINE.PAINT.V17',version:'JV-LINE-PAINT-2026-10-08',dependsOn:['transportPrice','x5'],source:{workbook:input.workbook,sheet:'L1',cell:'V17',formula:"='Прайс-сб+монт'!$C$24*$X$5"},execute:({inputs}:any)=>multiplyRational(inputs.transportPrice,inputs.x5)},
    {id:'JV.LINE.PAINT.V18',version:'JV-LINE-PAINT-2026-10-08',dependsOn:['JV.LINE.PAINT.V15','JV.LINE.PAINT.V17'],source:{workbook:input.workbook,sheet:'L1',cell:'V18',formula:'=$V$15+$V$17'},execute:({results}:any)=>addRational(results['JV.LINE.PAINT.V15'],results['JV.LINE.PAINT.V17'])},
    {id:'JV.LINE.PAINT.Q53',version:'JV-LINE-PAINT-2026-10-08',dependsOn:['finishIndex','JV.LINE.PAINT.V18'],source:{workbook:input.workbook,sheet:'L1',cell:'Q53',formula:'=IF($C$10<>1,$V$18,0)'},execute:({inputs,results}:any)=>inputs.finishIndex!==1?results['JV.LINE.PAINT.V18']:rationalFromDecimal('0')},
  )
  const graph=executeGraph(values,rules)
  return Object.freeze({finishIndex:input.finishIndex,finishName:finishes[input.finishIndex-1],itemCosts:Object.freeze(ROWS.map(row=>Object.freeze({sourceRow:row.paintRow,amount:graph.values[`JV.LINE.PAINT.V${row.paintRow}`] as ExactRational,priceCell:`'Прайс-Line'!G${row.priceRow}`,quantityCell:`L1!O${row.bomRow}`}))),indexedPaintSubtotal:graph.values['JV.LINE.PAINT.V13'] as ExactRational,minimumPaintCharge:graph.values['JV.LINE.PAINT.V14'] as ExactRational,appliedPaintCharge:graph.values['JV.LINE.PAINT.V15'] as ExactRational,transportCharge:graph.values['JV.LINE.PAINT.V17'] as ExactRational,finishTotal:graph.values['JV.LINE.PAINT.V18'] as ExactRational,q53:graph.values['JV.LINE.PAINT.Q53'] as ExactRational,trace:graph.trace})
}
function compare(a:ExactRational,b:ExactRational):number{const x=BigInt(a.numerator)*BigInt(b.denominator),y=BigInt(b.numerator)*BigInt(a.denominator);return x<y?-1:x>y?1:0}
