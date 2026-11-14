import type { DecimalString } from './types.ts'
import { EngineError } from './errors.ts'
import { executeGraph } from './graph.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal, rationalToDecimalExact, type ExactRational } from './rational.ts'

export interface LineGlassPriceSnapshot {
  readonly profile: 'COMPLETATION'|'RETAIL'
  readonly workbook: string
  readonly workbookSha256: string
  readonly prices: readonly { readonly index: number; readonly name: string; readonly unit: string; readonly value: string; readonly sourceCell: string }[]
  readonly glassChoices: readonly { readonly index: number; readonly name: string; readonly thickness: string; readonly sourceCell: string }[]
}
export interface LineGlassResult {
  readonly selection: { readonly index: number; readonly name: string; readonly sourceCell: string; readonly priceCell: string }
  readonly panes: readonly { readonly sourceRow: number; readonly quantity: DecimalString; readonly widthMm: DecimalString; readonly heightMm: DecimalString; readonly areaPrice: ExactRational; readonly amount: ExactRational }[]
  readonly glassTotal: ExactRational // L1!G49
  readonly preCharge: ExactRational // L1!D54
  readonly selectedGlassThickness: DecimalString // L1!I55
  readonly surcharge: ExactRational // L1!Q54
  readonly allocatedFixedCharge: ExactRational // 'Прайс-сб+монт'!C23*X5
  readonly systemAllocationFactor: ExactRational // L1!X5 for the isolated JV-Line slot
  readonly trace: ReturnType<typeof executeGraph>['trace']
}

const PANE_ROWS = [
  { row: 43, count: 'C46', width: 'D46', factor: 'doubleRetailOrWholesale' },
  { row: 44, count: 'C47', width: 'D47', factor: 'doubleOrOne' },
  { row: 45, count: 'C48', width: 'D48', factor: 'one' },
  { row: 46, count: 'C49', width: 'D49', factor: 'doubleOrOne' },
  { row: 47, count: 'C50', width: 'D50', factor: 'doubleOrOne' },
  { row: 48, count: 'C51', width: 'D51', factor: 'one' },
] as const

/** Calculates the confirmed JV-Line fill rows and Q54 on exact rationals. */
export function calculateLineGlass(input: {
  readonly workbook: string
  readonly profile: 'COMPLETATION'|'RETAIL'
  readonly heightMm: DecimalString
  readonly constructionQuantity: DecimalString
  readonly glassSelectionIndex: number // Главная!I11 -> L1!C11
  readonly sash: Readonly<Record<string, DecimalString>>
  readonly priceSnapshot: LineGlassPriceSnapshot
  readonly settings: Readonly<{ P19: string; L17: string; L18: string; L21: boolean; L22: string; D32: boolean }>
  readonly fixedChargePrice: string // 'Прайс-сб+монт'!C23
  /** Order-level X5 = ПРМ!AB slot allocation. Omit for isolated construction mode. */
  readonly orderSystemAllocationFactor?: ExactRational
  readonly orderSlot?: number
}) {
  if (input.workbook !== input.priceSnapshot.workbook || input.profile !== input.priceSnapshot.profile) throw new EngineError('INVALID_CONFIGURATION', 'Glass prices must match workbook and price profile')
  if (!Number.isSafeInteger(input.glassSelectionIndex) || input.glassSelectionIndex < 1 || input.glassSelectionIndex > 12) throw new EngineError('INVALID_CONFIGURATION', 'Glass selection index must resolve to one of Excel #1!D11:D22 / Прайс-Стекло!D5:D16', { index: input.glassSelectionIndex })
  const choice = input.priceSnapshot.glassChoices.find(x => x.index === input.glassSelectionIndex)
  const price = input.priceSnapshot.prices.find(x => x.index === input.glassSelectionIndex)
  if (!choice || !price || price.unit !== 'кв.м') throw new EngineError('PRICE_NOT_FOUND', 'Selected Excel glass catalog row or square-meter price is missing', { index: input.glassSelectionIndex })
  const required = ['C46','C47','C48','C49','C50','C51','D46','D47','D48','D49','D50','D51']
  for (const key of required) if (input.sash[key] === undefined) throw new EngineError('MISSING_INPUT', `Sash geometry ${key} is required for glass`, { sourceCell: `L1!${key}` })
  const values: Record<string, unknown> = {
    height: rationalFromDecimal(input.heightMm), p19: rationalFromDecimal(input.settings.P19), price: rationalFromDecimal(price.value),
    ...(input.orderSystemAllocationFactor===undefined?{}:{orderX5:input.orderSystemAllocationFactor}),
    l17: rationalFromDecimal(input.settings.L17), l18: rationalFromDecimal(input.settings.L18), l21: input.settings.L21,
    quantity: rationalFromDecimal(input.constructionQuantity), l22: rationalFromDecimal(input.settings.L22), d32: input.settings.D32,
    fixedCharge: rationalFromDecimal(input.fixedChargePrice),
    ...Object.fromEntries(required.map(key => [key, rationalFromDecimal(input.sash[key]!) ])),
  }
  const rules = [
    { id:'JV.LINE.GLASS.D45',version:'JV-LINE-GLASS-2026-10-08',dependsOn:['height','p19'],source:{workbook:input.workbook,sheet:'L1',cell:'D45',formula:'=$D$4-Настройки!$P$19'},execute:({inputs}:any)=>addRational(inputs.height, multiplyRational(inputs.p19,rationalFromDecimal('-1'))) },
    { id:'JV.LINE.GLASS.CATALOG_PRICE',version:`JV-LINE-GLASS-2026-10-08:${input.priceSnapshot.workbookSha256}`,dependsOn:[],source:{workbook:input.workbook,sheet:'Прайс-Стекло',cell:`D${4+input.glassSelectionIndex}`,formula:'Excel catalog Value2; price snapshot records the captured value'},execute:()=>rationalFromDecimal(price.value) },
    ...PANE_ROWS.flatMap(row => [
      { id:`JV.LINE.GLASS.F${row.row}`,version:'JV-LINE-GLASS-2026-10-08',dependsOn:['JV.LINE.GLASS.CATALOG_PRICE',`JV.LINE.GLASS.D45`,row.width,...(row.factor==='one'?[]:['l21',...(row.factor==='doubleRetailOrWholesale'?['l17','l18']:['l18'])])],source:{workbook:input.workbook,sheet:'L1',cell:`F${row.row}`,formula: row.factor==='doubleRetailOrWholesale' ? `=INDEX('Прайс-Стекло'!$D$5:$D$16,$C$11)*IF(Настройки!$L$21,Настройки!$L$18,Настройки!$L$17)*$D$45*$${row.width}/1000000` : row.factor==='doubleOrOne' ? `=INDEX('Прайс-Стекло'!$D$5:$D$16,$C$11)*IF(Настройки!$L$21,Настройки!$L$18,1)*$D$45*$${row.width}/1000000` : `=INDEX('Прайс-Стекло'!$D$5:$D$16,$C$11)*$D$45*$${row.width}/1000000`},execute:({inputs,results}:any)=>{
        const multiplier=row.factor==='one'?rationalFromDecimal('1'):inputs.l21===true?inputs.l18:row.factor==='doubleRetailOrWholesale'?inputs.l17:rationalFromDecimal('1')
        return divideRational(multiplyRational(multiplyRational(multiplyRational(results['JV.LINE.GLASS.CATALOG_PRICE'],multiplier),results['JV.LINE.GLASS.D45']),inputs[row.width]),rationalFromDecimal('1000000'))
      }},
      { id:`JV.LINE.GLASS.G${row.row}`,version:'JV-LINE-GLASS-2026-10-08',dependsOn:[row.count,`JV.LINE.GLASS.F${row.row}`],source:{workbook:input.workbook,sheet:'L1',cell:`G${row.row}`,formula:`=$${row.count}*$F$${row.row}`},execute:({inputs,results}:any)=>multiplyRational(inputs[row.count],results[`JV.LINE.GLASS.F${row.row}`]) },
    ]),
    { id:'JV.LINE.GLASS.G49',version:'JV-LINE-GLASS-2026-10-08',dependsOn:PANE_ROWS.map(row=>`JV.LINE.GLASS.G${row.row}`),source:{workbook:input.workbook,sheet:'L1',cell:'G49',formula:'=SUM($G$43:$G$48)'},execute:({results}:any)=>PANE_ROWS.reduce((sum,row)=>addRational(sum,results[`JV.LINE.GLASS.G${row.row}`]),rationalFromDecimal('0')) },
    { id:'JV.LINE.GLASS.I55',version:'JV-LINE-GLASS-2026-10-08',dependsOn:['l22'],source:{workbook:input.workbook,sheet:'L1',cell:'I55',formula:`=INDEX('#1'!$D$11:$D$22,$C$11)*Настройки!$L$22`},execute:()=>multiplyRational(rationalFromDecimal(choice.thickness),rationalFromDecimal(input.settings.L22)) },
    // In the isolated single-system scope, PRM!AB25 reduces to 1/Главная!Z11;
    // the shared quote denominator equals its sole active area row.
    { id:'JV.LINE.GLASS.X5_SINGLE_SLOT',version:'JV-LINE-GLASS-2026-10-08',dependsOn:input.orderSystemAllocationFactor===undefined?['quantity']:['orderX5'],source:{workbook:input.workbook,sheet:'L1',cell:'X5',formula:input.orderSystemAllocationFactor===undefined?'=ПРМ!$AB$25; isolated slot: AA25/(AA32*W25)=1/W25':input.orderSlot===undefined?'=ПРМ!$AB$25; order allocation AA25/(AA32*W25)':`=ПРМ!$AB$${24+input.orderSlot}`},execute:({inputs}:any)=>input.orderSystemAllocationFactor??divideRational(rationalFromDecimal('1'),inputs.quantity) },
    { id:'JV.LINE.GLASS.D54',version:'JV-LINE-GLASS-2026-10-08',dependsOn:['fixedCharge','JV.LINE.GLASS.G49','JV.LINE.GLASS.X5_SINGLE_SLOT'],source:{workbook:input.workbook,sheet:'L1',cell:'D54',formula:"=$G$49+'Прайс-сб+монт'!$C$23*$X$5"},execute:({inputs,results}:any)=>addRational(results['JV.LINE.GLASS.G49'],multiplyRational(inputs.fixedCharge,results['JV.LINE.GLASS.X5_SINGLE_SLOT'])) },
    { id:'JV.LINE.GLASS.Q54',version:'JV-LINE-GLASS-2026-10-08',dependsOn:['d32','JV.LINE.GLASS.D54'],source:{workbook:input.workbook,sheet:'L1',cell:'Q54',formula:'=IF(Настройки!$D$32,$D$54,0)'},execute:({inputs,results}:any)=> inputs.d32===true ? results['JV.LINE.GLASS.D54'] : rationalFromDecimal('0') },
  ]
  const graph = executeGraph(values,rules)
  const paneHeight=rationalToDecimalExact(graph.values['JV.LINE.GLASS.D45'] as ExactRational)
  if(paneHeight===undefined) throw new EngineError('RULE_FAILED','Excel glass height is not representable as an exact decimal')
  const panes = PANE_ROWS.map(row=>Object.freeze({sourceRow:row.row,quantity:input.sash[row.count]!,widthMm:input.sash[row.width]!,heightMm:paneHeight,areaPrice:graph.values[`JV.LINE.GLASS.F${row.row}`] as ExactRational,amount:graph.values[`JV.LINE.GLASS.G${row.row}`] as ExactRational}))
  return Object.freeze({selection:Object.freeze({index:choice.index,name:choice.name,sourceCell:choice.sourceCell,priceCell:price.sourceCell}),panes:Object.freeze(panes),glassTotal:graph.values['JV.LINE.GLASS.G49'] as ExactRational,preCharge:graph.values['JV.LINE.GLASS.D54'] as ExactRational,selectedGlassThickness:rationalToDecimalExact(graph.values['JV.LINE.GLASS.I55'] as ExactRational)!,surcharge:graph.values['JV.LINE.GLASS.Q54'] as ExactRational,systemAllocationFactor:graph.values['JV.LINE.GLASS.X5_SINGLE_SLOT'] as ExactRational,allocatedFixedCharge:multiplyRational(rationalFromDecimal(input.fixedChargePrice),graph.values['JV.LINE.GLASS.X5_SINGLE_SLOT'] as ExactRational),trace:graph.trace})
}
