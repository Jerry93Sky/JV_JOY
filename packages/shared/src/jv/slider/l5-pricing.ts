import { EngineError } from '../errors.ts'
import { executeGraph, type CalculationRule } from '../graph.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal, roundRationalAwayFromZero, type ExactRational } from '../rational.ts'
import { traceStep } from '../trace.ts'
import type { PriceProfile, TraceStep, Unit } from '../types.ts'
import { calculateSliderL5Geometry, type SliderL5GeometryInput } from './l5-geometry.ts'
import { calculateSliderL5FullBom, type SliderL5FullBomOptions, type SliderL5FullBomSettings, type SliderL5FullBomResult } from './l5-bom.ts'
import { calculateSliderX3Geometry, type SliderX3GeometryInput } from './x3-geometry.ts'
import { calculateSliderX3FullBom, type SliderX3FullBomOptions, type SliderX3FullBomSettings, type SliderX3FullBomResult } from './x3-bom.ts'
import { calculateSliderX5Geometry, type SliderX5GeometryInput } from './x5-geometry.ts'
import { calculateSliderX5FullBom, type SliderX5FullBomOptions, type SliderX5FullBomSettings, type SliderX5FullBomResult } from './x5-bom.ts'

export interface SliderL5PriceValue { readonly value:string; readonly sourceCell:string; readonly sourceFormula:string }
export interface SliderL5PriceSnapshotInput {
  readonly schemaVersion:'1.0'; readonly profile:PriceProfile; readonly version:string; readonly workbook:string
  readonly workbookSha256:string; readonly capturedWithExcel:'16.0'; readonly currency:'RUB'
  readonly settings:Readonly<Record<'D4'|'L8'|'L9'|'L10'|'L11'|'L17'|'L18'|'S26',SliderL5PriceValue>>
  readonly materialPrices:Readonly<Partial<Record<number,SliderL5PriceValue>>>
  readonly paintRates:Readonly<Record<number,SliderL5PriceValue>>
  readonly glassRates:Readonly<Record<number,SliderL5PriceValue>>
  readonly serviceRates:Readonly<Record<'C7'|'C14'|'C15'|'C19'|'C23'|'C24'|'C25',SliderL5PriceValue>>
}
export interface SliderL5PriceSnapshot extends SliderL5PriceSnapshotInput {}
export interface SliderX3PriceSnapshotInput extends Omit<SliderL5PriceSnapshotInput,'settings'> {
  readonly settings:SliderL5PriceSnapshotInput['settings'] & Readonly<Record<'D13'|'D21',SliderL5PriceValue>>
}
export interface SliderX3PriceSnapshot extends SliderX3PriceSnapshotInput {}
export interface SliderX5PriceSnapshotInput extends SliderX3PriceSnapshotInput {}
export interface SliderX5PriceSnapshot extends SliderX5PriceSnapshotInput {}
export interface SliderL5OrderContext {
  /** Raw order inputs linked by ПРМ!U25:W31 to Главная!C11:D17 and Z11:Z17. */
  readonly positions:readonly Readonly<{mainRow:11|12|13|14|15|16|17;widthMm:string;heightMm:string;quantity:string;systemSelector:number;sourceSheet:string;family?:'LINE'|'ZIGZAG'|'SLIDER'|'FRONT';adhesivePerUnit?:Readonly<{activator:ExactRational;glue:ExactRational;sourceWorkbook:string;sourceFormulas:Readonly<{activator:string;glue:string}>}>}>[]
  readonly sourceWorkbook:string
  readonly positionMainRow?:11|12|13|14|15|16|17
}
export interface SliderL5CommercialControls {
  /** S1!C11 = Главная!H11, retained as source numeric selector. */
  readonly priceMode:1|2|3|4
  /** Главная!F28; 2 enables the M51 surcharge. */
  readonly mainSurchargeSelector:1|2
  /** S1!C12 = Главная!I11, INDEX selector into Прайс-Стекло!D5:D16. */
  readonly glassSelector:number
  readonly additionalWorkEnabled:boolean
  readonly widthServiceEnabled:boolean
  /** Настройки!L3, the independently selectable L3 latch/service charge. */
  readonly l3SpecificLatchChargeEnabled:boolean
  readonly installationEnabled:boolean
}
export interface SliderL5CommercialInput {
  readonly geometry:SliderL5GeometryInput; readonly bomOptions:SliderL5FullBomOptions
  readonly bomSettings:SliderL5FullBomSettings; readonly snapshot:SliderL5PriceSnapshot
  readonly controls:SliderL5CommercialControls; readonly orderContext?:SliderL5OrderContext
}
export interface SliderL5CostPosition {
  readonly id:string; readonly sourceCell:string; readonly sku:string; readonly description:string; readonly unit:Unit
  readonly quantity:ExactRational; readonly unitPrice:ExactRational; readonly amount:ExactRational
  readonly priceSourceCell:string; readonly traceStepId:string
}
export interface SliderL5CommercialResult {
  readonly status:'COMPLETE'|'PARTIAL'; readonly profile:PriceProfile; readonly currency:'RUB'
  readonly engineVersion:string; readonly ruleVersion:string; readonly priceSnapshotVersion:string
  readonly geometry:ReturnType<typeof calculateSliderL5Geometry>; readonly bom:SliderL5FullBomResult
  readonly materialPositions:readonly SliderL5CostPosition[]; readonly materialSubtotal?:ExactRational
  readonly confirmedSubtotals:Readonly<{paintingM48?:ExactRational;glassD50?:ExactRational;additionalWorkM49?:ExactRational;widthAndLatchServicesM50?:ExactRational;installationM52?:ExactRational;productSubtotalM51?:ExactRational}>
  readonly orderFactor?:ExactRational; readonly m53?:ExactRational
  readonly diagnostics:readonly string[]; readonly trace:readonly TraceStep[]
}
export interface SliderX3CommercialInput extends Omit<SliderL5CommercialInput,'geometry'|'bomOptions'|'bomSettings'|'snapshot'> {
  readonly geometry:SliderX3GeometryInput; readonly bomOptions:SliderX3FullBomOptions
  readonly bomSettings:SliderX3FullBomSettings; readonly snapshot:SliderX3PriceSnapshot
}
export interface SliderX3CommercialResult extends Omit<SliderL5CommercialResult,'geometry'|'bom'> {
  readonly geometry:ReturnType<typeof calculateSliderX3Geometry>; readonly bom:SliderX3FullBomResult
  readonly mainTransfer?:Readonly<{T11:ExactRational;Y11:ExactRational}>
}
export interface SliderX5CommercialInput extends Omit<SliderL5CommercialInput,'geometry'|'bomOptions'|'bomSettings'|'snapshot'> {
  readonly geometry:SliderX5GeometryInput; readonly bomOptions:SliderX5FullBomOptions
  readonly bomSettings:SliderX5FullBomSettings; readonly snapshot:SliderX5PriceSnapshot
}
export interface SliderX5CommercialResult extends Omit<SliderL5CommercialResult,'geometry'|'bom'> {
  readonly geometry:ReturnType<typeof calculateSliderX5Geometry>; readonly bom:SliderX5FullBomResult
  readonly mainTransfer?:Readonly<{T11:ExactRational;Y11:ExactRational}>
}
type SliderCommercialCoreResult=Omit<SliderL5CommercialResult,'geometry'|'bom'> & {
  readonly geometry:SliderL5CommercialResult['geometry']|SliderX3CommercialResult['geometry']|SliderX5CommercialResult['geometry']
  readonly bom:SliderL5FullBomResult|SliderX3FullBomResult|SliderX5FullBomResult
  readonly mainTransfer?:Readonly<{T11:ExactRational;Y11:ExactRational}>
}

const SOURCE_WORKBOOKS:Record<PriceProfile,string>={COMPLETATION:'JV-комплектация 08.10.2026.xlsm',RETAIL:'JV-розница 08.10.2026.xlsm'}
const add=(...values:ExactRational[])=>values.reduce((a,b)=>addRational(a,b),rationalFromDecimal('0'))
const mul=(a:ExactRational,b:ExactRational)=>multiplyRational(a,b)
const div=(a:ExactRational,b:ExactRational)=>divideRational(a,b)
const neg=(a:ExactRational)=>mul(a,rationalFromDecimal('-1'))
const isRat=(value:unknown):value is ExactRational=>typeof value==='object'&&value!==null&&'numerator' in value&&'denominator' in value
const nonzero=(value:ExactRational)=>BigInt(value.numerator)!==0n
const catRow=(bomRow:number)=>bomRow===40?41:bomRow===41?42:bomRow===42?43:bomRow
const X5_SOURCE_FORMULAS:Readonly<Record<string,string>>={
  C49:'=$D$5-$C$47-$C$48',
  D50:'=$C$47*$D$47+$C$48*$D$48+$C$49*$D$49',
  D53:"=$D$50+'Прайс-сб+монт'!$C$23*$T$5",
  R27:'=$R$24+$R$26',
  M50:"=IF(Настройки!$D$33,  'Прайс-сб+монт'!$C$7*$D$3/1000,  0)  +  IF(Настройки!$L$3,$K$29*'Прайс-сб+монт'!C19,0)",
  M51:"=SUM($M$47:$M$50)+IF(Главная!$F$28=2,'Прайс-сб+монт'!$C$25*$T$5,0)",
  M52:"=IF(Настройки!$D$34,  $D$3*'Прайс-сб+монт'!$C$14/1000+$D$5*$D$4*'Прайс-сб+монт'!$C$15/1000,  0)",
}

/** Validates that snapshot prices are source literals from the correct original profile workbook. */
export function buildSliderL5PriceSnapshot(input:SliderL5PriceSnapshotInput):SliderL5PriceSnapshot {
  if(input.schemaVersion!=='1.0'||input.currency!=='RUB'||input.capturedWithExcel!=='16.0'||input.workbook!==SOURCE_WORKBOOKS[input.profile]||!/^[a-f0-9]{64}$/i.test(input.workbookSha256)||!input.version)throw new EngineError('INVALID_CONFIGURATION','Slider-L5 price snapshot provenance/profile is invalid')
  const check=(entries:Readonly<Record<string,SliderL5PriceValue|undefined>>,expected:(key:string)=>string)=>{for(const [key,entry] of Object.entries(entries)){if(!entry||entry.sourceCell!==expected(key)||entry.sourceFormula.startsWith('=')||entry.sourceFormula!==entry.value)throw new EngineError('RULE_UNCONFIRMED',`Expected raw source-price literal for ${key}`,{expected:expected(key),actual:entry?.sourceCell,formula:entry?.sourceFormula});try{rationalFromDecimal(entry.value)}catch{throw new EngineError('INVALID_DECIMAL',`Invalid Slider-L5 source price ${entry.value}`,{sourceCell:entry.sourceCell})}}}
  check(input.settings,(key)=>`Настройки!${key}`);check(input.materialPrices,(key)=>`Прайс-Slider!E${key}`);check(input.paintRates,(key)=>`Прайс-Slider!G${key}`);check(input.glassRates,(key)=>`Прайс-Стекло!D${Number(key)+4}`);check(input.serviceRates,(key)=>`Прайс-сб+монт!${key}`)
  for(let row=5;row<=43;row++)if(!input.materialPrices[row])throw new EngineError('MISSING_INPUT',`Slider price snapshot is missing required source price Прайс-Slider!E${row}`)
  for(let row=5;row<=21;row++)if(!input.paintRates[row])throw new EngineError('MISSING_INPUT',`Slider paint snapshot is missing Прайс-Slider!G${row}`)
  for(let selector=1;selector<=12;selector++)if(!input.glassRates[selector])throw new EngineError('MISSING_INPUT',`Slider glass snapshot is missing selector ${selector}`)
  for(const key of ['C7','C14','C15','C19','C23','C24','C25'] as const)if(!input.serviceRates[key])throw new EngineError('MISSING_INPUT',`Slider service snapshot is missing ${key}`)
  return Object.freeze(input)
}

/** Calculates the source-confirmed Slider-L5 material subtotal and all commercial branches whose dependency inputs are closed. */
export function calculateSliderL5Commercial(input:SliderL5CommercialInput):SliderL5CommercialResult {
  return calculateSliderCommercialCore(input,'L5') as SliderL5CommercialResult
}

/** Runs the same source-confirmed commercial graph with X3 geometry, BOM and price snapshot. */
export function calculateSliderX3Commercial(input:SliderX3CommercialInput):SliderX3CommercialResult {
  return calculateSliderCommercialCore({...input,snapshot:buildSliderX3PriceSnapshot(input.snapshot)},'X3') as SliderX3CommercialResult
}
export function calculateSliderX5Commercial(input:SliderX5CommercialInput):SliderX5CommercialResult {
  return calculateSliderCommercialCore({...input,snapshot:buildSliderX5PriceSnapshot(input.snapshot)},'X5') as SliderX5CommercialResult
}

export function buildSliderX5PriceSnapshot(input:SliderX5PriceSnapshotInput):SliderX5PriceSnapshot {
  if(!input.version.startsWith('JV-SLIDER-X5-PRICE-'))throw new EngineError('INVALID_CONFIGURATION','Slider-X5 price snapshot version is invalid')
  const snapshot=buildSliderL5PriceSnapshot(input)
  for(const key of ['D13','D21'] as const){const entry=input.settings[key];if(!entry||entry.sourceCell!==`Настройки!${key}`||entry.sourceFormula!==entry.value)throw new EngineError('RULE_UNCONFIRMED',`Missing X5 transfer setting Настройки!${key}`);rationalFromDecimal(entry.value)}
  if(BigInt(rationalFromDecimal(input.settings.D13.value).numerator)===0n)throw new EngineError('INVALID_CONFIGURATION','Настройки!D13 cannot be zero for Главная!T11')
  return snapshot as SliderX5PriceSnapshot
}

export function buildSliderX3PriceSnapshot(input:SliderX3PriceSnapshotInput):SliderX3PriceSnapshot {
  if(!input.version.startsWith('JV-SLIDER-X3-PRICE-'))throw new EngineError('INVALID_CONFIGURATION','Slider-X3 price snapshot version is invalid')
  const snapshot=buildSliderL5PriceSnapshot(input)
  for(const key of ['D13','D21'] as const){const entry=input.settings[key];if(!entry||entry.sourceCell!==`Настройки!${key}`||entry.sourceFormula!==entry.value)throw new EngineError('RULE_UNCONFIRMED',`Missing X3 transfer setting Настройки!${key}`);rationalFromDecimal(entry.value)}
  if(BigInt(rationalFromDecimal(input.settings.D13.value).numerator)===0n)throw new EngineError('INVALID_CONFIGURATION','Настройки!D13 cannot be zero for Главная!T11')
  return snapshot as SliderX3PriceSnapshot
}

function calculateSliderCommercialCore(input:SliderL5CommercialInput|SliderX3CommercialInput|SliderX5CommercialInput,variant:'L5'|'X3'|'X5'):SliderCommercialCoreResult {
  const {snapshot,controls}=input
  const ownMainRow=input.orderContext?.positionMainRow??11
  if(snapshot.workbook!==input.geometry.workbook)throw new EngineError('INVALID_CONFIGURATION','Slider geometry and price snapshot must use the same source workbook')
  if(![1,2,3,4].includes(controls.priceMode)||![1,2].includes(controls.mainSurchargeSelector)||!Number.isInteger(controls.glassSelector)||controls.glassSelector<1||controls.glassSelector>12)throw new EngineError('INVALID_CONFIGURATION','Invalid Slider price/glass selector')
  const geometry=variant==='L5'?calculateSliderL5Geometry(input.geometry as SliderL5GeometryInput):variant==='X3'?calculateSliderX3Geometry(input.geometry as SliderX3GeometryInput):calculateSliderX5Geometry(input.geometry as SliderX5GeometryInput)
  const bom=variant==='L5'
    ?calculateSliderL5FullBom(geometry as SliderL5CommercialResult['geometry'],input.bomOptions as SliderL5FullBomOptions,input.bomSettings as SliderL5FullBomSettings)
    :variant==='X3'?calculateSliderX3FullBom(geometry as SliderX3CommercialResult['geometry'],input.bomOptions as SliderX3FullBomOptions,input.bomSettings as SliderX3FullBomSettings)
    :calculateSliderX5FullBom(geometry as SliderX5CommercialResult['geometry'],input.bomOptions as SliderX5FullBomOptions,input.bomSettings as SliderX5FullBomSettings)
  const RULE_VERSION=`JV-SLIDER-${variant}-COMMERCIAL-${variant==='X5'?'2026-11-06':'2026-11-05'}-v1`
  const id=(name:string)=>`JV.SLIDER.${variant}.${name}`
  const qtyByRow=new Map(bom.positions.filter(x=>x.status==='CALCULATED'&&x.quantity).map(x=>[x.bomRow,x.quantity!]))
  const settings=(key:keyof SliderL5PriceSnapshot['settings'])=>rationalFromDecimal(snapshot.settings[key].value)
  const zero=rationalFromDecimal('0'),one=rationalFromDecimal('1'),thousand=rationalFromDecimal('1000'),million=rationalFromDecimal('1000000')
  const inputs:Record<string,unknown>={width:geometry.inputs.widthMm,height:geometry.inputs.heightMm,leaves:geometry.inputs.leafCount,sides:rationalFromDecimal(String(geometry.inputs.sideCount)),priceMode:controls.priceMode,surchargeSelector:controls.mainSurchargeSelector,glassSelector:controls.glassSelector,additionalWork:controls.additionalWorkEnabled,widthService:controls.widthServiceEnabled,l3LatchCharge:controls.l3SpecificLatchChargeEnabled,installation:controls.installationEnabled,D4:settings('D4'),L8:settings('L8'),L9:settings('L9'),L10:settings('L10'),L11:settings('L11'),L17:settings('L17'),L18:settings('L18'),S26:settings('S26'),serviceC7:rationalFromDecimal(snapshot.serviceRates.C7.value),serviceC14:rationalFromDecimal(snapshot.serviceRates.C14.value),serviceC15:rationalFromDecimal(snapshot.serviceRates.C15.value),serviceC19:rationalFromDecimal(snapshot.serviceRates.C19.value),serviceC23:rationalFromDecimal(snapshot.serviceRates.C23.value),serviceC24:rationalFromDecimal(snapshot.serviceRates.C24.value),serviceC25:rationalFromDecimal(snapshot.serviceRates.C25.value),D20:bom.resolvedSelectors.D20,D24:bom.resolvedSelectors.D24,D26:bom.resolvedSelectors.D26}
  const diagnostics:string[]=[]
  const hasOrder=!!input.orderContext
  let adhesiveContextComplete=hasOrder
  if(input.orderContext){
    const oc=input.orderContext
    if(oc.sourceWorkbook!==snapshot.workbook||oc.positions.length!==7)throw new EngineError('INVALID_CONFIGURATION','Slider order context requires all seven order slots from the same workbook')
    const sorted=[...oc.positions].sort((a,b)=>a.mainRow-b.mainRow)
    const sheetBySelector:Record<number,string>={1:'L',2:'Z',3:'S',4:'S',5:'S',6:'S',7:'F'},legacySheets:Record<number,string>={1:'L1',2:'L2',3:'S1',4:'S1',5:'S1',6:'S1',7:'F1'}
    for(let i=0;i<7;i++){
      const p=sorted[i]!;if(p.mainRow!==i+11)throw new EngineError('INVALID_CONFIGURATION','Slider order context must contain Main rows 11 through 17 exactly once')
      const w=rationalFromDecimal(p.widthMm),h=rationalFromDecimal(p.heightMm),q=rationalFromDecimal(p.quantity)
      if(BigInt(w.numerator)<0n||BigInt(h.numerator)<0n||BigInt(q.numerator)<0n||!Number.isInteger(p.systemSelector)||p.systemSelector<0||p.systemSelector>7)throw new EngineError('INVALID_CONFIGURATION','Order-context dimensions/quantities/system selectors are invalid')
      inputs[`orderW${p.mainRow}`]=w;inputs[`orderH${p.mainRow}`]=h;inputs[`orderQ${p.mainRow}`]=q;inputs[`orderSystem${p.mainRow}`]=p.systemSelector
      const prefix=sheetBySelector[p.systemSelector],expectedSheet=p.family?(p.family==='FRONT'?`F${p.mainRow-10}`:`${prefix}${p.mainRow-10}`):legacySheets[p.systemSelector];if(p.systemSelector>0&&p.sourceSheet!==expectedSheet)throw new EngineError('INVALID_CONFIGURATION','Order context selector and source sheet do not agree',{mainRow:p.mainRow,systemSelector:p.systemSelector,sourceSheet:p.sourceSheet})
      if(BigInt(q.numerator)>0n&&p.mainRow!==ownMainRow){
        const adhesive=p.adhesivePerUnit;if(!adhesive){adhesiveContextComplete=false;continue}
        const refs=p.family==='LINE'?{activator:`='${p.sourceSheet}'!$O$49`,glue:`='${p.sourceSheet}'!$O$50`}:p.family==='ZIGZAG'?{activator:`='${p.sourceSheet}'!$N$34`,glue:`='${p.sourceSheet}'!$N$35`}:p.family==='FRONT'?{activator:'0',glue:'0'}:{activator:`='${p.sourceSheet}'!$K$40`,glue:`='${p.sourceSheet}'!$K$41`}
        if(adhesive.sourceWorkbook!==snapshot.workbook||adhesive.sourceFormulas.activator!==refs.activator||adhesive.sourceFormulas.glue!==refs.glue)throw new EngineError('RULE_UNCONFIRMED','External order adhesive quantity must match its family source cells',{mainRow:p.mainRow,family:p.family,sourceSheet:p.sourceSheet})
        if(BigInt(adhesive.activator.numerator)<0n||BigInt(adhesive.glue.numerator)<0n)throw new EngineError('INVALID_CONFIGURATION','Order adhesive quantities cannot be negative')
        inputs[`adhesiveK40_${p.mainRow}`]=adhesive.activator;inputs[`adhesiveK41_${p.mainRow}`]=adhesive.glue
      }
    }
    const same=(a:ExactRational,b:ExactRational)=>compareRational(a,b)===0
    const own=sorted[ownMainRow-11]!;if(!same(rationalFromDecimal(own.widthMm),geometry.inputs.widthMm)||!same(rationalFromDecimal(own.heightMm),geometry.inputs.heightMm)||BigInt(rationalFromDecimal(own.quantity).numerator)===0n||own.systemSelector!==(variant==='L5'?4:variant==='X3'?5:6))throw new EngineError('INVALID_CONFIGURATION',`Slider-${variant} geometry and selector must match Main row ${ownMainRow} with positive order quantity`)
  }
  const rules:CalculationRule[]=[]
  const source=(cell:string,formula:string)=>({workbook:snapshot.workbook,sheet:`S${ownMainRow-10}`,cell,formula:variant==='X5'?X5_SOURCE_FORMULAS[cell]??formula:formula})
  const rule=(name:string,cell:string,formula:string,dependsOn:string[],execute:CalculationRule['execute'])=>rules.push({id:id(name),version:`${RULE_VERSION}:${snapshot.version}`,dependsOn,source:source(cell,formula),execute})
  const priceEntry=(row:number)=>snapshot.materialPrices[catRow(row)]
  const unitPrice=(row:number):ExactRational=>{
    const entry=priceEntry(row)
    if(!entry)throw new EngineError('MISSING_INPUT',`No literal source price for applicable S1!K${row}`,{sourceCell:`Прайс-Slider!E${catRow(row)}`})
    const raw=rationalFromDecimal(entry.value)
    if(row>=5&&row<=13)return div(raw,settings('D4'))
    if(row===14||row===18)return mul(raw,input.bomOptions.interlockEnabled?settings('S26'):one)
    if(row>=33&&row<=35)return div(raw,settings('L8'))
    return raw
  }
  const formulaL=(row:number)=>row>=5&&row<=13?`='Прайс-Slider'!E${row}/Настройки!$D$4`:row===14||row===18?`='Прайс-Slider'!E${row}*IF($D$28="ДА",Настройки!$S$26,1)`:row>=33&&row<=35?`='Прайс-Slider'!E${row}/Настройки!$L$8`:row===39?"='Прайс-Slider'!$E$39":`='Прайс-Slider'!E${catRow(row)}`
  const priceLines:SliderL5CostPosition[]=[]
  for(const position of bom.positions){
    if(position.status!=='CALCULATED'||!position.quantity||position.bomRow>=43)continue
    const row=position.bomRow,cat=catRow(row),price=unitPrice(row),q=position.quantity
    inputs[`K${row}`]=q;inputs[`unitPrice${row}`]=price
    rule(`L${row}`,`L${row}`,formulaL(row),[`unitPrice${row}`],({inputs:v})=>v[`unitPrice${row}`] as ExactRational)
    rule(`M${row}`,`M${row}`,row===39?'=$L$39*$K$39':`=L${row}*K${row}`,[`K${row}`,id(`L${row}`)],({inputs:v,results:r})=>mul(v[`K${row}`] as ExactRational,r[id(`L${row}`)] as ExactRational))
    priceLines.push(Object.freeze({id:id(`M${row}`),sourceCell:`S1!M${row}`,sku:position.sku??`SLIDER-${variant}-K${row}`,description:position.description,unit:excelUnit(position.unit),quantity:q,unitPrice:price,amount:zero,priceSourceCell:`Прайс-Slider!E${cat}`,traceStepId:id(`M${row}`)}))
  }
  const materialRuleDeps=priceLines.map(x=>x.traceStepId)
  let materialSubtotalClosed=true
  if(hasOrder&&adhesiveContextComplete){
    for(const category of ['activator','glue'] as const){const start=category==='activator'?5:18,nIds:string[]=[]
      for(let i=0;i<7;i++){const mainRow=11+i,p=input.orderContext!.positions.find(x=>x.mainRow===mainRow)!,q=rationalFromDecimal(p.quantity),perUnit=q.numerator==='0'?zero:mainRow===ownMainRow?qtyByRow.get(category==='activator'?40:41)??zero:(p.adhesivePerUnit?.[category]??zero),row=start+i,amount=mul(perUnit,q);inputs[`adhesiveN${row}`]=amount;if(BigInt(q.numerator)>0n&&mainRow!==ownMainRow&&!p.adhesivePerUnit)throw new EngineError('MISSING_INPUT','Order consumable input missing after completeness validation',{mainRow,category});const familyKey=`adhesiveK${category==='activator'?40:41}_${mainRow}`,perUnitKey=mainRow===ownMainRow?`adhesiveK${category==='activator'?40:41}`:familyKey;inputs[perUnitKey]=perUnit;if(mainRow===ownMainRow)inputs[`adhesiveK${category==='activator'?40:41}`]=perUnit;const ruleId=id(`ADHESIVE.N${row}`);rules.push({id:ruleId,version:`${RULE_VERSION}:${snapshot.version}`,dependsOn:[perUnitKey,`orderQ${mainRow}`],source:{workbook:snapshot.workbook,sheet:'Клей+акт',cell:`N${row}`,formula:variant==='X5'?`=IFERROR(L${row}*M${row},0)`:`=IFERROR(INDEX($E${row}:$K${row},$C${row}),0)*Главная!$Z${mainRow}`},execute:({inputs:v})=>mul(v[perUnitKey] as ExactRational,v[`orderQ${mainRow}`] as ExactRational)});nIds.push(ruleId)}
      const sumId=id(`ADHESIVE.SUM${start}`);rules.push({id:sumId,version:`${RULE_VERSION}:${snapshot.version}`,dependsOn:nIds,source:{workbook:snapshot.workbook,sheet:'Клей+акт',cell:`SUMN${start}`,formula:`=SUM(N${start}:N${start+6})`},execute:({results:r})=>add(...nIds.map(x=>r[x] as ExactRational))})
      const packsId=id(`ADHESIVE.PACKS${start}`);rules.push({id:packsId,version:`${RULE_VERSION}:${snapshot.version}`,dependsOn:[sumId],source:{workbook:snapshot.workbook,sheet:'Клей+акт',cell:`N${start+7}`,formula:`=IF(ROUNDUP(SUM(N${start}:N${start+6}),0)>1,ROUNDUP(SUM(N${start}:N${start+6}),0),1)`},execute:({results:r})=>{const rounded=rationalFromDecimal(roundRationalAwayFromZero(r[sumId] as ExactRational,0));return compareRational(rounded,one)>0?rounded:one}})
      const factorId=id(`ADHESIVE.O${start===5?5:18}`);rules.push({id:factorId,version:`${RULE_VERSION}:${snapshot.version}`,dependsOn:[packsId,sumId],source:{workbook:snapshot.workbook,sheet:'Клей+акт',cell:`O${start===5?5:18}`,formula:`=N${start+7}/SUM(N${start}:N${start+6})`},execute:({results:r})=>{const sum=r[sumId] as ExactRational;if(BigInt(sum.numerator)===0n)throw new EngineError('DIVISION_BY_ZERO',`Клей+акт!O${start===5?5:18} divides by zero`,{source:`Клей+акт!N${start}:N${start+6}`});return div(r[packsId] as ExactRational,sum)}})
      const row=category==='activator'?40:41,old=rules.findIndex(x=>x.id===id(`M${row}`));if(old>=0){const base=rules[old]!;rules[old]={...base,dependsOn:[...base.dependsOn,factorId],source:{...base.source,formula:`=L${row}*K${row}*'Клей+акт'!$O$${category==='activator'?5:18}`},execute:({inputs:v,results:r})=>mul(mul(v[`K${row}`] as ExactRational,r[id(`L${row}`)] as ExactRational),r[factorId] as ExactRational)}}
    }
  } else {
    materialSubtotalClosed=false
    for(const row of [40,41]){const index=rules.findIndex(x=>x.id===id(`M${row}`));if(index>=0)rules.splice(index,1);const lineIndex=priceLines.findIndex(x=>x.sourceCell===`S1!M${row}`);if(lineIndex>=0)priceLines.splice(lineIndex,1)}
    diagnostics.push(hasOrder?'ADHESIVE_UPSTREAM_QUANTITIES_REQUIRED: non-S1 nonzero order positions need their family calculator K40/K41 results before Клей+акт!O5/O18 can be resolved.':'ADHESIVE_ORDER_CONTEXT_REQUIRED: S1!M40 and M41 multiply K40/K41 by Клей+акт!O5/O18, which allocate the minimum whole packages once across order rows 5:11 and 18:24.')
  }
  if(materialSubtotalClosed)rule('M47','M47','=SUM($M$5:$M$46)',materialRuleDeps,({results:r})=>add(...materialRuleDeps.map(dep=>r[dep] as ExactRational)))
  const paintDeps:string[]=[]
  for(let row=5;row<=21;row++){
    const q=qtyByRow.get(row)??zero,rate=snapshot.paintRates[row]
    if(!rate||rate.value==='')throw new EngineError('MISSING_INPUT',`Missing source paint rate for S1!R${row}`)
    inputs[`paintQ${row}`]=q;inputs[`paintPrice${row}`]=rationalFromDecimal(rate.value)
    rule(`R${row}`,`R${row}`,`=K${row}*'Прайс-Slider'!G${row}`,[`paintQ${row}`,`paintPrice${row}`],({inputs:v})=>mul(v[`paintQ${row}`] as ExactRational,v[`paintPrice${row}`] as ExactRational))
    paintDeps.push(id(`R${row}`))
  }
  rule('R22','R22','=SUM(R5:R21)*IF($C$11=4,Настройки!$L$11,1)',paintDeps,({results:r})=>mul(add(...paintDeps.map(dep=>r[dep] as ExactRational)),controls.priceMode===4?settings('L11'):one))
  if(hasOrder){
    const aaDeps:string[]=[]
    for(let row=25;row<=31;row++){const mainRow=row-14;const ruleId=id(`AA${row}`),formula=`=IFERROR(U${row}*V${row}*W${row}/1000000,0)`;rules.push({id:ruleId,version:`${RULE_VERSION}:${snapshot.version}`,dependsOn:[`orderW${mainRow}`,`orderH${mainRow}`,`orderQ${mainRow}`],source:{workbook:snapshot.workbook,sheet:'ПРМ',cell:`AA${row}`,formula},execute:({inputs:v})=>div(mul(mul(v[`orderW${mainRow}`] as ExactRational,v[`orderH${mainRow}`] as ExactRational),v[`orderQ${mainRow}`] as ExactRational),million)});aaDeps.push(ruleId)}
    rules.push({id:id('AA32'),version:`${RULE_VERSION}:${snapshot.version}`,dependsOn:aaDeps,source:{workbook:snapshot.workbook,sheet:'ПРМ',cell:'AA32',formula:'=SUM(AA25:AA31)'},execute:({results:r})=>add(...aaDeps.map(dep=>r[dep] as ExactRational))})
    const areaRow=ownMainRow-10,prmRow=ownMainRow+14,abCell=`AB${prmRow}`
    rules.push({id:id('AB25'),version:`${RULE_VERSION}:${snapshot.version}`,dependsOn:[id(`AA${prmRow}`),id('AA32'),`orderQ${ownMainRow}`],source:{workbook:snapshot.workbook,sheet:'ПРМ',cell:abCell,formula:`=IFERROR(AA${prmRow}/($AA$32*W${prmRow}),0)`},execute:({inputs:v,results:r})=>{const denominator=mul(r[id('AA32')] as ExactRational,v[`orderQ${ownMainRow}`] as ExactRational);return BigInt(denominator.numerator)===0n?zero:div(r[id(`AA${prmRow}`)] as ExactRational,denominator)}})
    rules.push({id:id('T5'),version:`${RULE_VERSION}:${snapshot.version}`,dependsOn:[id('AB25')],source:{workbook:snapshot.workbook,sheet:`S${ownMainRow-10}`,cell:`T${ownMainRow-10}`,formula:`=ПРМ!$AB$${ownMainRow+14}`},execute:({results:r})=>r[id('AB25')]})
  } else diagnostics.push('ORDER_CONTEXT_REQUIRED: Slider T slot depends on its ПРМ!AB row and order-level AA/AA32/W inputs.')
  if(hasOrder){
    const t5=id('T5')
    rule('R23','R23','=Настройки!$L$9*Настройки!$L$10*$T$5',['L9','L10',t5],({inputs:v,results:r})=>mul(mul(v.L9 as ExactRational,v.L10 as ExactRational),r[t5] as ExactRational))
    const maxDeps=[...Array.from({length:9},(_,i)=>id(`R${i+13}`)),id('R22'),id('R23')]
    rule('R24','R24','=MAX(R13:R23)',maxDeps,({results:r})=>maxDeps.map(x=>r[x] as ExactRational).reduce((a,b)=>compareRational(a,b)>=0?a:b))
    rule('R26','R26',`='Прайс-сб+монт'!$C$24*$T$5`,[t5],({inputs:v,results:r})=>mul(rationalFromDecimal(snapshot.serviceRates.C24.value),r[t5] as ExactRational))
    rule('R27','R27','=R24+R26',[id('R24'),id('R26')],({results:r})=>add(r[id('R24')] as ExactRational,r[id('R26')] as ExactRational))
  }
  if(controls.priceMode===1)rule('M48','M48','=IF($C$11<>1,$R$27,0)',[],()=>zero)
  else if(hasOrder)rule('M48','M48','=IF($C$11<>1,$R$27,0)',[id('R27')],({results:r})=>r[id('R27')] as ExactRational)

  const selectorLocks=(bom.resolvedSelectors.D24==='ОДИН'?one:bom.resolvedSelectors.D24==='ДВА'?rationalFromDecimal('2'):zero)
  const selectorGlassLock=bom.resolvedSelectors.D26==='ОДИН'?rationalFromDecimal('2'):zero
  const baseJoint=bom.resolvedSelectors.D20==='1 / 2'?rationalFromDecimal(String(geometry.inputs.sideCount)):bom.resolvedSelectors.D20==='2 / 4'?mul(rationalFromDecimal('2'),rationalFromDecimal(String(geometry.inputs.sideCount))):zero
  const glassHandleCount=compareRational(add(baseJoint,neg(selectorLocks),neg(selectorGlassLock)),zero)>0?add(baseJoint,neg(selectorLocks),neg(selectorGlassLock)):zero
  const glassLockCount=add(selectorLocks,selectorGlassLock)
  const glassRemainder=add(geometry.inputs.leafCount,neg(glassHandleCount),neg(glassLockCount))
  inputs.C47=glassHandleCount;inputs.C48=glassLockCount;inputs.C49=glassRemainder
  const glassRate=rationalFromDecimal(snapshot.glassRates[controls.glassSelector].value)
  const glassArea=div(mul(geometry.geometry.D43,geometry.geometry.D44),million)
  inputs.glassRate=glassRate;inputs.glassArea=glassArea;inputs.glassSelector=controls.glassSelector
  rule('D47','D47',`=INDEX('Прайс-Стекло'!$D$5:$D$16,$C$12)*Настройки!$L$17*$D$43*$D$44/1000000`,['glassRate','glassArea','L17'],({inputs:v})=>mul(mul(v.glassRate as ExactRational,v.L17 as ExactRational),v.glassArea as ExactRational))
  rule('D48','D48',`=INDEX('Прайс-Стекло'!$D$5:$D$16,$C$12)*Настройки!$L$18*$D$43*$D$44/1000000`,['glassRate','glassArea','L18'],({inputs:v})=>mul(mul(v.glassRate as ExactRational,v.L18 as ExactRational),v.glassArea as ExactRational))
  rule('D49','D49',`=INDEX('Прайс-Стекло'!$D$5:$D$16,$C$12)*$D$43*$D$44/1000000`,['glassRate','glassArea'],({inputs:v})=>mul(v.glassRate as ExactRational,v.glassArea as ExactRational))
  rule('C47','C47','=IF((IF($D$20="1 / 2",$D$6,0)+IF($D$20="2 / 4",2*$D$6,0)-$C$48)>0,(IF($D$20="1 / 2",$D$6,0)+IF($D$20="2 / 4",2*$D$6,0)-$C$48),0)',[],()=>glassHandleCount)
  rule('C48','C48','=IF($D$24="ОДИН",1,0)+IF($D$24="ДВА",2,0)+IF($D$26="ОДИН",2,0)',[],()=>glassLockCount)
  rule('C49','C49','=D5-C47-C48',[id('C47'),id('C48')],({inputs:v,results:r})=>add(v.leaves as ExactRational,neg(r[id('C47')] as ExactRational),neg(r[id('C48')] as ExactRational)))
  rule('D50','D50','=C47*D47+C48*D48+C49*D49',[id('C47'),id('C48'),id('C49'),id('D47'),id('D48'),id('D49')],({results:r})=>add(mul(r[id('C47')] as ExactRational,r[id('D47')] as ExactRational),mul(r[id('C48')] as ExactRational,r[id('D48')] as ExactRational),mul(r[id('C49')] as ExactRational,r[id('D49')] as ExactRational)))
  if(hasOrder)rule('D53','D53',`=D50+'Прайс-сб+монт'!$C$23*$T$5`,[id('D50'),id('T5')],({results:r})=>add(r[id('D50')] as ExactRational,mul(rationalFromDecimal(snapshot.serviceRates.C23.value),r[id('T5')] as ExactRational)))
  if(!controls.additionalWorkEnabled)rule('M49','M49','=IF(Настройки!$D$32,$D$53,0)',[],()=>zero)
  else if(hasOrder)rule('M49','M49','=IF(Настройки!$D$32,$D$53,0)',[id('D53')],({results:r})=>r[id('D53')] as ExactRational)
  rule('M50','M50','=IF(Настройки!$D$33,\'Прайс-сб+монт\'!C7*D3/1000,0)+IF(Настройки!$L$3,K29*\'Прайс-сб+монт\'!C19,0)',[],()=>add(controls.widthServiceEnabled?div(mul(rationalFromDecimal(snapshot.serviceRates.C7.value),geometry.inputs.widthMm),thousand):zero,controls.l3SpecificLatchChargeEnabled?mul(qtyByRow.get(29)??zero,rationalFromDecimal(snapshot.serviceRates.C19.value)):zero))
  const commercialBranchesClosed=materialSubtotalClosed&&(controls.priceMode===1||hasOrder)&&(!controls.additionalWorkEnabled||hasOrder)&&(controls.mainSurchargeSelector!==2||hasOrder)
  if(commercialBranchesClosed&&controls.mainSurchargeSelector!==2)rule('M51','M51','=SUM($M$47:$M$50)+IF(Главная!$F$28=2,C25*T5,0)',[id('M47'),...(rules.some(x=>x.id===id('M48'))?[id('M48')]:[]),...(rules.some(x=>x.id===id('M49'))?[id('M49')]:[]),id('M50')],({results:r})=>add(r[id('M47')] as ExactRational,(r[id('M48')] as ExactRational|undefined)??zero,(r[id('M49')] as ExactRational|undefined)??zero,r[id('M50')] as ExactRational))
  else if(commercialBranchesClosed&&hasOrder)rule('M51','M51','=SUM($M$47:$M$50)+IF(Главная!$F$28=2,\'Прайс-сб+монт\'!$C$25*$T$5,0)',[id('M47'),...(rules.some(x=>x.id===id('M48'))?[id('M48')]:[]),...(rules.some(x=>x.id===id('M49'))?[id('M49')]:[]),id('M50'),id('T5')],({results:r})=>add(r[id('M47')] as ExactRational,(r[id('M48')] as ExactRational|undefined)??zero,(r[id('M49')] as ExactRational|undefined)??zero,r[id('M50')] as ExactRational,mul(rationalFromDecimal(snapshot.serviceRates.C25.value),r[id('T5')] as ExactRational)))
  if(!controls.installationEnabled)rule('M52','M52','=IF(Настройки!$D$34,width*C14/1000+leaves*height*C15/1000,0)',[],()=>zero)
  else rule('M52','M52','=IF(Настройки!$D$34,width*C14/1000+leaves*height*C15/1000,0)',[],()=>add(div(mul(geometry.inputs.widthMm,rationalFromDecimal(snapshot.serviceRates.C14.value)),thousand),div(mul(mul(geometry.inputs.leafCount,geometry.inputs.heightMm),rationalFromDecimal(snapshot.serviceRates.C15.value)),thousand)))
  const canM53=rules.some(x=>x.id===id('M51'))&&rules.some(x=>x.id===id('M52'))
  if(canM53)rule('M53','M53','=IF($D$6<=2,SUM($M$51:$M$52),"ОШИБКА !")',[id('M51'),id('M52')],({inputs:v,results:r})=>{if(compareRational(v.sides as ExactRational,rationalFromDecimal('2'))>0)throw new EngineError('INVALID_CONFIGURATION','Excel S1!M53 returns "ОШИБКА !" when S1!D6>2',{source:'S1!M53'});return add(r[id('M51')] as ExactRational,r[id('M52')] as ExactRational)})
  if(canM53&&(variant==='X3'||variant==='X5')){
    const transfer=(snapshot as SliderX3PriceSnapshot|SliderX5PriceSnapshot).settings
    inputs.mainD13=rationalFromDecimal(transfer.D13.value)
    inputs.mainD21=rationalFromDecimal(transfer.D21.value)
    rules.push({id:id('MAIN.T11'),version:`${RULE_VERSION}:${snapshot.version}`,dependsOn:[id('M53'),'mainD13'],source:{workbook:snapshot.workbook,sheet:'Главная',cell:'T11',formula:"='S1'!$M$53/Настройки!$D$13"},execute:({inputs:v,results:r})=>div(r[id('M53')] as ExactRational,v.mainD13 as ExactRational)})
    rules.push({id:id('MAIN.Y11'),version:`${RULE_VERSION}:${snapshot.version}`,dependsOn:[id('MAIN.T11'),'mainD21'],source:{workbook:snapshot.workbook,sheet:'Главная',cell:'Y11',formula:'=INDEX(R11:X11,G11)*(100+Настройки!$D21)/100'},execute:({inputs:v,results:r})=>div(mul(r[id('MAIN.T11')] as ExactRational,add(rationalFromDecimal('100'),v.mainD21 as ExactRational)),rationalFromDecimal('100'))})
  }
  const graph=executeGraph(inputs,rules)
  const values=graph.values
  const get=(name:string)=>{const v=values[id(name)];return isRat(v)?v:undefined}
  const materialPositions=priceLines.map(position=>Object.freeze({...position,amount:get(`M${Number(/M(\d+)$/.exec(position.id)?.[1])}`)??zero}))
  const materialSubtotal=materialSubtotalClosed?get('M47'):undefined
  const productSubtotal=get('M51'),m53=get('M53'),paint=get('M48'),glass=get('D50'),additional=get('M49'),services=get('M50'),installation=get('M52'),t5=get('T5')
  if(controls.priceMode!==1&&!hasOrder)diagnostics.push('PAINTING_SUBTOTAL_UNVERIFIED: S1!R23 and R26 depend on order allocation S1!T5.')
  if(controls.additionalWorkEnabled&&!hasOrder)diagnostics.push('ADDITIONAL_WORK_UNVERIFIED: S1!D53 requires PRM allocation S1!T5; no M49 amount is published.')
  if(controls.mainSurchargeSelector===2&&!hasOrder)diagnostics.push('MAIN_SURCHARGE_UNVERIFIED: S1!M51 applies Прайс-сб+монт!C25*S1!T5.')
  if(controls.priceMode!==1&&!hasOrder)diagnostics.push('M48_UNAVAILABLE: Excel M48 is a painting-related subtotal from S1!R27, not the glass amount.')
  const summaryTrace=traceStep({id:id('M53'),kind:'summary',label:`Slider-${variant} commercial total M53`,inputRefs:[id('M47'),id('M48'),id('M49'),id('M50'),id('M51'),id('M52')],ruleId:`JV.SLIDER.${variant}.COMMERCIAL.M53`,source:source('M53','=IF($D$6<=2,SUM($M$51:$M$52),"ОШИБКА !")'),catalogRefs:[{id:`JV-SLIDER-${variant}-PRICE-SNAPSHOT`,version:snapshot.version}],input:{profile:snapshot.profile,orderContextProvided:hasOrder,unresolved:diagnostics},...(m53?{result:m53}:{}),status:m53?'ok':'unavailable',errorIds:[],warningIds:m53?[]:['M53_INCOMPLETE_DEPENDENCIES']})
  const status=m53?'COMPLETE':'PARTIAL'
  const mainT11=get('MAIN.T11'),mainY11=get('MAIN.Y11')
  return Object.freeze({status,profile:snapshot.profile,currency:'RUB',engineVersion:`JV-SLIDER-${variant}-ENGINE-1`,ruleVersion:RULE_VERSION,priceSnapshotVersion:snapshot.version,geometry,bom,materialPositions:Object.freeze(materialPositions),...(materialSubtotal?{materialSubtotal}:{}),confirmedSubtotals:Object.freeze({...(paint?{paintingM48:paint}:{}),...(glass?{glassD50:glass}:{}),...(additional?{additionalWorkM49:additional}:{}),...(services?{widthAndLatchServicesM50:services}:{}),...(installation?{installationM52:installation}:{}),...(productSubtotal?{productSubtotalM51:productSubtotal}:{})}),...(t5?{orderFactor:t5}:{}),...(m53?{m53}:{}),...(mainT11&&mainY11?{mainTransfer:Object.freeze({T11:mainT11,Y11:mainY11})}:{}),diagnostics:Object.freeze(diagnostics),trace:Object.freeze([...bom.trace,...graph.trace,summaryTrace])})
}

function excelUnit(value:string):Unit { return value==='п.м'?'m':value==='шт.'?'piece':value }
function compareRational(a:ExactRational,b:ExactRational):number {const l=BigInt(a.numerator)*BigInt(b.denominator),r=BigInt(b.numerator)*BigInt(a.denominator);return l<r?-1:l>r?1:0}
