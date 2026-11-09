import { EngineError } from '../errors.ts'
import { executeGraph, type CalculationRule } from '../graph.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal, roundRationalAwayFromZero, type ExactRational } from '../rational.ts'
import type { TraceStep } from '../types.ts'
import { traceStep } from '../trace.ts'
import type { SliderL5GeometryResult } from './l5-geometry.ts'

const VERSION='JV-SLIDER-L5-BOM-2026-11-05-v1'
export type SliderL5Direction='left'|'right'|'two-sided'
export type SliderL5JointPairSelection='1 / 2'|'2 / 4'|'НЕТ'
export interface SliderL5BomOptions {
  /** Настройки!H21, also exposed as S1!D28 (ДА/НЕТ). */
  readonly interlockEnabled:boolean
  /** Настройки!H23, gate for S1!J30. */
  readonly fittingUpgradeEnabled:boolean
  /** Resolved S1!D22 choice; selector-table resolution is an upstream input. */
  readonly jointPairSelection:SliderL5JointPairSelection
}
export interface SliderL5BomLine {
  readonly bomRow:14|15|16|17|22|23|29|30|43|45
  readonly sku:string
  readonly description:string
  readonly unit:string
  readonly quantity:ExactRational
  readonly formula:string
  readonly traceStepId:string
  readonly status:'CALCULATED'
}
export interface SliderL5BomResult {
  readonly status:'PARTIAL'
  readonly family:'SLIDER'
  readonly variant:'L5'
  readonly lines:readonly SliderL5BomLine[]
  readonly alreadyImplementedRows:readonly number[]
  readonly notApplicableRows:readonly number[]
  readonly unsupportedRows:readonly number[]
  readonly trace:readonly TraceStep[]
}

export interface SliderL5FullBomSettings {
  readonly D6:string; readonly D8:string; readonly S7:string; readonly S17:string
  readonly L4:string; readonly L5:string; readonly L6:boolean
  readonly H19:1|2; readonly H25:boolean; readonly H27:boolean
}
export interface SliderL5FullBomOptions extends SliderL5BomOptions {
  /** Raw INDEX selector controls; lookup tables are restored from source #1 cells. */
  readonly selectorControls:Readonly<{I25:number;C20:number;I29:number;C24:number;I31:number;C26:number}>
}
export interface SliderL5FullBomPosition {
  readonly id:string; readonly bomRow:number; readonly sku:string|null; readonly description:string
  readonly unit:string; readonly status:'CALCULATED'|'NOT_APPLICABLE'
  readonly quantity?:ExactRational; readonly sourceFormula:string; readonly traceStepId:string
  readonly catalogVersion:string; readonly ruleVersion:string; readonly diagnostic?:string
}
export interface SliderL5FullBomResult {
  readonly status:'COMPLETE'; readonly family:'SLIDER'; readonly variant:'L5'
  readonly positions:readonly SliderL5FullBomPosition[]; readonly supportedRows:readonly number[]
  readonly notApplicableRows:readonly number[]; readonly resolvedSelectors:Readonly<{D20:'1 / 2'|'2 / 4'|'нет';D24:'ОДИН'|'ДВА'|'НЕТ'|'инд. по поз.';D26:'ОДИН'|'НЕТ'|'инд. по поз.'}>; readonly trace:readonly TraceStep[]
}

/** Full 42-row quantity BOM for verified L5. Selector outputs are explicit inputs, never read from cached Excel cells. */
export function calculateSliderL5FullBom(geometry:SliderL5GeometryResult,options:SliderL5FullBomOptions,settings:SliderL5FullBomSettings):SliderL5FullBomResult {
  const base=calculateSliderL5Bom(geometry,options)
  for(const key of ['D6','D8','S7','S17','L4','L5'] as const)if(settings?.[key]===undefined)throw new EngineError('MISSING_INPUT',`Missing Slider BOM setting Настройки!${key}`,{source:`Настройки!${key}`})
  if(typeof settings.L6!=='boolean'||typeof settings.H25!=='boolean'||typeof settings.H27!=='boolean'||![1,2].includes(settings.H19))throw new EngineError('MISSING_INPUT','Missing or invalid Slider BOM switch setting')
  const zero=rationalFromDecimal('0'),one=rationalFromDecimal('1'),two=rationalFromDecimal('2'),thousand=rationalFromDecimal('1000')
  const width=geometry.inputs.widthMm,height=geometry.inputs.heightMm,leaves=geometry.inputs.leafCount,side=rationalFromDecimal(String(geometry.inputs.sideCount))
  const controls=options.selectorControls
  if(!controls)throw new EngineError('MISSING_INPUT','Missing Slider selector controls Настройки!I25/I29/I31 and S1!C20/C24/C26')
  const lookup=(values:readonly string[],index:number,source:string)=>{if(!Number.isInteger(index)||index<1||index>values.length)throw new EngineError('RULE_UNCONFIRMED',`INDEX selector ${source} is outside the source table`,{index,tableLength:values.length});return values[index-1]}
  const tables={D20:['1 / 2','2 / 4','нет'] as const,D24:['ОДИН','ДВА','НЕТ','инд. по поз.'] as const,D26:['ОДИН','НЕТ','инд. по поз.'] as const}
  const set=(k:keyof SliderL5FullBomSettings)=>typeof settings[k]==='string'?rationalFromDecimal(settings[k] as string):zero
  const minus=(a:ExactRational,b:ExactRational)=>addRational(a,multiplyRational(b,rationalFromDecimal('-1')))
  const rows:Record<number,ExactRational>=Object.fromEntries(base.lines.map(x=>[x.bomRow,x.quantity]))
  for(const line of geometry.materialQuantities)rows[line.bomRow]=line.quantity
  if(BigInt(set('L4').numerator)<=0n||BigInt(set('L5').numerator)<=0n)throw new EngineError('INVALID_CONFIGURATION','Slider consumable factors Настройки!L4/L5 must be positive')
  // L5 selectors prove five further formula branches inactive (C9=5, C10=15, C8=10).
  const notApplicable=[5,7,9,10,13,18,19,20,21,24,31,32,44,46]
  const formulas:Record<number,string>={5:'=IF($J$5>0, $J$5*$D$32/1000 + Настройки!$D$8/1000, 0)',6:'=IF($J$6>0, $J$6*$D$32/1000 + Настройки!$D$8/1000, 0)',7:'=IF($J$7>0,  $J$7*$D$31/1000 + IF($C$9=3,2*$D$37/1000,0) + Настройки!$D$8/1000, 0)',8:'=IF($J$8>0,  $J$8*$D$31/1000 + IF($C$9=5,2*$D$37/1000,0) + Настройки!$D$8/1000, 0)',9:'=IF($J$9>0, $J$9*$D$31/1000 + Настройки!$D$8/1000, 0)',10:'=IF($J$10>0, $J$10*$D$31/1000 + Настройки!$D$8/1000, 0)',11:'=IF($J$11>0, $J$11*2*$D$36/1000 + Настройки!$D$8/1000, 0)',12:'=IF($J$12>0, $J$12*($C$33*$D$33+$C$34*$D$34)/1000 + Настройки!$D$6/1000, 0)',13:'=IF($J$13>0, $J$13*($C$33*$D$33+$C$34*$D$34)/1000 + Настройки!$D$6/1000, 0)',14:'=$J$14*2*$D$6',15:'=$J$15*(2*$D$5-$K$14)',16:'=$J$16*(2*$D$5-$K$14)/$D$6',17:'=$J$17*(2*$D$5-$K$14)/$D$6',18:'=$J$18*2*$D$6',19:'=$J$19*(2*$D$5-$K$18)',20:'=$J$20*(2*$D$5-$K$18)/$D$6',21:'=$J$21*(2*$D$5-$K$18)/$D$6',22:'=2*($K$15+$K$19)+$K$16+$K$17+$K$20+$K$21',23:'=$J$23*2*$D$5',24:'=$J$24*2*$D$5',25:'=$J$25*$D$6 * ( IF($D$20="1 / 2",1,0)+IF($D$20="2 / 4",2,0)+IF($D$20="нет",0,0) )',26:'=$J$26*$D$6 * ( IF($D$20="1 / 2",1,0)+IF($D$20="2 / 4",2,0)+IF($D$20="нет",0,0) )',27:'=IF($D$24="ОДИН",1,0)+IF($D$24="ДВА",2,0)',28:'=IF($D$26="ОДИН",1,0)',29:'=$J$29*$D$6*(IF($D$22="1 / 2",1,0)+IF($D$22="2 / 4",2,0))-$K$30',30:'=$J$30*$D$6',31:'=$J$31*$D$6*(IF($D$22="1 / 2",1,0)+IF($D$22="2 / 4",1,0))',32:'=$J$32*$D$6*(IF($D$22="1 / 2",0,0)+IF($D$22="2 / 4",1,0))',33:'=0.001*$D$3*$C$9*2 + IF($J$33=1,$D$5*$D$33*2/1000,0)',34:'=IF($D$17="ДА",$D$36*4/1000,0)',35:'=IF(Настройки!$H$19=1,  $K$38*($D$4-100)/1000,  0)',36:'=IF(Настройки!$H$19=2,  IF($D$6=1,$D$5-1,0)+IF($D$6=2,$D$5-2,0),  0)',37:'=2*$D$6-$K$39',38:'=IF(Настройки!$H$19=1,  IF($D$6=1,$D$5-1,0)+IF($D$6=2,$D$5-2,0),  0)',39:'=IF(Настройки!$H$25,  IF($D$6=2, 2, 0),  0)',40:'=ROUNDUP(0.001*$D$3/Настройки!$L$4,IF(Настройки!$L$6,0,3))',41:'=ROUNDUP(0.001*$D$3/Настройки!$L$5,IF(Настройки!$L$6,0,3))',42:'=ROUNDUP(0.001*$D$3*Настройки!$S$7,0)',43:'=2*SUM($K$14:$K$21)',44:'=2*$K$24',45:'=2*$K$29',46:'=4*$K$31+4*$K$32'}
  const inputs={width,height,leaves,side,interlock:geometry.inputs.interlockState,h19:settings.H19,h25:settings.H25,h27:settings.H27,D8:set('D8'),D6Allowance:set('D6'),S7:set('S7'),S17:set('S17'),L4:set('L4'),L5:set('L5'),L6:settings.L6,I25:controls.I25,C20:controls.C20,I29:controls.I29,C24:controls.C24,I31:controls.I31,C26:controls.C26,D33:geometry.geometry.D33,D34:geometry.geometry.D34,C8:10,C9:5,I12:10,I33:20}
  const rule=(row:number,dependsOn:string[],execute:CalculationRule['execute']):CalculationRule=>({id:`JV.SLIDER.L5.K${row}`,version:VERSION,dependsOn,source:{workbook:geometry.trace.find(x=>x.source?.workbook)?.source?.workbook,sheet:'S1',cell:`K${row}`,formula:formulas[row]},execute})
  const rules:CalculationRule[]=[
   {id:'JV.SLIDER.L5.D20',version:VERSION,dependsOn:['I25','C20'],source:{sheet:'S1',cell:'D20',formula:"=IF(Настройки!$I$25=4,INDEX('#1'!$F$24:$F$26,$C$20),INDEX('#1'!$F$24:$F$26,Настройки!$I$25))"},execute:({inputs:v})=>lookup(tables.D20,(v.I25 as number)===4?v.C20 as number:v.I25 as number,'S1!D20/#1!F24:F26')},
   {id:'JV.SLIDER.L5.D24',version:VERSION,dependsOn:['I29','C24'],source:{sheet:'S1',cell:'D24',formula:"=IF(Настройки!$I$29=4,INDEX('#1'!$F$29:$F$32,$C$24),INDEX('#1'!$F$29:$F$32,Настройки!$I$29))"},execute:({inputs:v})=>lookup(tables.D24,(v.I29 as number)===4?v.C24 as number:v.I29 as number,'S1!D24/#1!F29:F32')},
   {id:'JV.SLIDER.L5.D26',version:VERSION,dependsOn:['I31','C26','side'],source:{sheet:'S1',cell:'D26',formula:"=IF($D$6=2,IF(Настройки!$I$31=3,INDEX('#1'!$G$29:$G$31,$C$26),INDEX('#1'!$G$29:$G$31,Настройки!$I$31)),\"НЕТ\")"},execute:({inputs:v})=>BigInt((v.side as ExactRational).numerator)!==2n?'НЕТ':lookup(tables.D26,(v.I31 as number)===3?v.C26 as number:v.I31 as number,'S1!D26/#1!G29:G31')},
   {id:'JV.SLIDER.L5.J11',version:VERSION,dependsOn:['interlock'],source:{sheet:'S1',cell:'J11',formula:'=IF(AND($C$10>0,$D$17="ДА"),1,0)'},execute:({inputs:v})=>v.interlock==='ДА'?one:zero},
   {id:'JV.SLIDER.L5.J12',version:VERSION,dependsOn:['C8','I12'],source:{sheet:'S1',cell:'J12',formula:'=IF($C$8=I12,1,0)'},execute:({inputs:v})=>v.C8===v.I12?one:zero},
   {id:'JV.SLIDER.L5.J25',version:VERSION,dependsOn:['JV.SLIDER.L5.J26'],source:{sheet:'S1',cell:'J25',formula:'=IF(J26=1,0,1)'},execute:({results:r})=>BigInt((r['JV.SLIDER.L5.J26'] as ExactRational).numerator)===1n?zero:one},
   {id:'JV.SLIDER.L5.J26',version:VERSION,dependsOn:['h27'],source:{sheet:'S1',cell:'J26',formula:'=IF(Настройки!H27,1,0)'},execute:({inputs:v})=>v.h27?one:zero},
   {id:'JV.SLIDER.L5.J33',version:VERSION,dependsOn:['C8','I33'],source:{sheet:'S1',cell:'J33',formula:'=IF($C$8=20,1,0)'},execute:({inputs:v})=>v.C8===v.I33?one:zero},
   {id:'JV.SLIDER.L5.D36',version:VERSION,dependsOn:['height','interlock','S17'],source:{sheet:'S1',cell:'D36',formula:'=ROUNDUP(IF($D$17="ДА",IF($C$10=13,$D$4-Настройки!$S$16,0)+IF($C$10=15,$D$4-Настройки!$S$17,0)+IF($C$10=23,$D$4-Настройки!$S$18,0)+IF($C$10=25,$D$4-Настройки!$S$19,0),0),0)'},execute:({inputs:v})=>v.interlock==='ДА'?rationalFromDecimal(roundRationalAwayFromZero(minus(v.height as ExactRational,v.S17 as ExactRational),0)):zero},
   {id:'JV.SLIDER.L5.C34',version:VERSION,dependsOn:['side'],source:{sheet:'S1',cell:'C34',formula:'=IF($D$6=2,2,0)'},execute:({inputs:v})=>BigInt((v.side as ExactRational).numerator)===2n?two:zero},
   {id:'JV.SLIDER.L5.C33',version:VERSION,dependsOn:['leaves','JV.SLIDER.L5.C34'],source:{sheet:'S1',cell:'C33',formula:'=$D$5-$C$34'},execute:({inputs:v,results:r})=>minus(v.leaves as ExactRational,r['JV.SLIDER.L5.C34'] as ExactRational)},
   rule(11,['JV.SLIDER.L5.J11','JV.SLIDER.L5.D36','D8'],({results:r,inputs:v})=>BigInt((r['JV.SLIDER.L5.J11'] as ExactRational).numerator)>0n?addRational(divideRational(multiplyRational(two,r['JV.SLIDER.L5.D36'] as ExactRational),thousand),divideRational(v.D8 as ExactRational,thousand)):zero),
   rule(12,['JV.SLIDER.L5.J12','JV.SLIDER.L5.C33','JV.SLIDER.L5.C34','D33','D34','D6Allowance'],({inputs:v,results:r})=>BigInt((r['JV.SLIDER.L5.J12'] as ExactRational).numerator)>0n?addRational(divideRational(addRational(multiplyRational(r['JV.SLIDER.L5.C33'] as ExactRational,v.D33 as ExactRational),multiplyRational(r['JV.SLIDER.L5.C34'] as ExactRational,v.D34 as ExactRational)),thousand),divideRational(v.D6Allowance as ExactRational,thousand)):zero),
   rule(25,['side','JV.SLIDER.L5.D20','JV.SLIDER.L5.J25'],({inputs:v,results:r})=>multiplyRational(multiplyRational(v.side as ExactRational,r['JV.SLIDER.L5.J25'] as ExactRational),r['JV.SLIDER.L5.D20']==='1 / 2'?one:r['JV.SLIDER.L5.D20']==='2 / 4'?two:zero)),
   rule(26,['side','JV.SLIDER.L5.D20','JV.SLIDER.L5.J26'],({inputs:v,results:r})=>multiplyRational(multiplyRational(v.side as ExactRational,r['JV.SLIDER.L5.J26'] as ExactRational),r['JV.SLIDER.L5.D20']==='1 / 2'?one:r['JV.SLIDER.L5.D20']==='2 / 4'?two:zero)),
   rule(27,['JV.SLIDER.L5.D24'],({results:r})=>r['JV.SLIDER.L5.D24']==='ОДИН'?one:r['JV.SLIDER.L5.D24']==='ДВА'?two:zero),rule(28,['JV.SLIDER.L5.D26'],({results:r})=>r['JV.SLIDER.L5.D26']==='ОДИН'?one:zero),
   rule(33,['width','leaves','JV.SLIDER.L5.J33','D33'],({inputs:v,results:r})=>addRational(multiplyRational(multiplyRational(multiplyRational(rationalFromDecimal('0.001'),v.width as ExactRational),rationalFromDecimal('5')),two),BigInt((r['JV.SLIDER.L5.J33'] as ExactRational).numerator)===1n?divideRational(multiplyRational(multiplyRational(multiplyRational(v.leaves as ExactRational,v.D33 as ExactRational),two),rationalFromDecimal('1')),thousand):zero)),
   rule(34,['interlock','JV.SLIDER.L5.D36'],({inputs:v,results:r})=>v.interlock==='ДА'?divideRational(multiplyRational(r['JV.SLIDER.L5.D36'] as ExactRational,rationalFromDecimal('4')),thousand):zero),
   rule(38,['leaves','side','h19'],({inputs:v})=>v.h19!==1?zero:minus(v.leaves as ExactRational,BigInt((v.side as ExactRational).numerator)===1n?one:two)),
   rule(39,['side','h25'],({inputs:v})=>v.h25&&BigInt((v.side as ExactRational).numerator)===2n?two:zero),
   rule(35,['JV.SLIDER.L5.K38','height','h19'],({inputs:v,results:r})=>v.h19===1?divideRational(multiplyRational(r['JV.SLIDER.L5.K38'] as ExactRational,minus(v.height as ExactRational,rationalFromDecimal('100'))),thousand):zero),
   rule(36,['leaves','side','h19'],({inputs:v})=>v.h19!==2?zero:minus(v.leaves as ExactRational,BigInt((v.side as ExactRational).numerator)===1n?one:two)),
   rule(37,['side','JV.SLIDER.L5.K39'],({inputs:v,results:r})=>minus(multiplyRational(two,v.side as ExactRational),r['JV.SLIDER.L5.K39'] as ExactRational)),
   rule(40,['width','L4','L6'],({inputs:v})=>rationalFromDecimal(roundRationalAwayFromZero(divideRational(multiplyRational(rationalFromDecimal('0.001'),v.width as ExactRational),v.L4 as ExactRational),v.L6?0:3))),
   rule(41,['width','L5','L6'],({inputs:v})=>rationalFromDecimal(roundRationalAwayFromZero(divideRational(multiplyRational(rationalFromDecimal('0.001'),v.width as ExactRational),v.L5 as ExactRational),v.L6?0:3))),
   rule(42,['width','S7'],({inputs:v})=>rationalFromDecimal(roundRationalAwayFromZero(multiplyRational(multiplyRational(rationalFromDecimal('0.001'),v.width as ExactRational),v.S7 as ExactRational),0))),
  ]
  const fullGraph=executeGraph(inputs,rules)
  for(const row of Object.keys(formulas).map(Number)){const q=fullGraph.values[`JV.SLIDER.L5.K${row}`];if(isRational(q))rows[row]=q}
  const meta:Record<number,[string|null,string,string]>={5:['S-010','Профиль верхний 3-дорожечный','п.м'],6:['S-020','Профиль верхний 5-дорожечный','п.м'],7:['SL-110','Профиль L опорный плоский 3-дорож.','п.м'],8:['SL-120','Профиль L опорный плоский 5-дорож.','п.м'],9:['SX-110','Профиль X опорный 3-дорож.','п.м'],10:['SX-120','Профиль X опорный 5-дорож.','п.м'],11:['S-030','Боковой профиль','п.м'],12:['SL-130','Профиль L створочный','п.м'],13:['SX-130','Профиль X створочный','п.м'],14:['SL-140-0','Заглушка L створочная боковая НОВАЯ','шт.'],15:['SL-140-2','Заглушка L створочная 2-стор.','шт.'],16:['SL-140-L','Заглушка L створочная левая НОВАЯ','шт.'],17:['SL-140-R','Заглушка L створочная правая НОВАЯ','шт.'],18:['SX-140-0','Заглушка X створочная боковая НОВАЯ','шт.'],19:['SX-140-2','Заглушка X створочная 2-стор.','шт.'],20:['SX-140-L','Заглушка X створочная левая НОВАЯ','шт.'],21:['SX-140-R','Заглушка X створочная правая НОВАЯ','шт.'],22:['S-080','Демпфер заглушки c кольцом','шт.'],23:['SL-150','Роликовая каретка L','шт.'],24:['SX-150','Роликовая каретка X','шт.'],25:['S-040','Ручка круглая','шт.'],26:['S-050','Ручка светопрозрачная','шт.'],27:['S-060','Замок с ответкой на стену','шт.'],28:['S-070','Замок с ответкой на стекло','шт.'],29:['SL-160','Задвижка нижняя L с винтом (комплект)','шт.'],30:['SL-161','Задвижка нижняя L с ручкой (комплект)','шт.'],31:['SX-081','Задвижка нижняя X (комплект 1)','шт.'],32:['SX-082','Задвижка нижняя X (комплект 2)','шт.'],33:['AA-030','Уплотнитель щёточный 5х4','п.м'],34:['AA-040','Уплотнитель щёточный 5x9','п.м'],35:['AA-041','Уплотнитель щёточный 5x12 с клеем','п.м'],36:['AA-060','Уплотнитель светопрозр. F-типа, 3 м','шт.'],37:['AA-070','Уплотнитель светопрозр. D-типа, 3 м','шт.'],38:['AA-071','Уплотнитель светопрозр. под щётку','шт.'],39:['AA-080','Уплотнитель светопрозр. магнитный прямой, 3 м','шт.'],40:['AA-110','Активатор (50 мл)','шт.'],41:['AA-120','Клей (уп."колбаса")','шт.'],42:['AA-200','Саморез для опорного профиля','шт.'],43:[null,'Саморез 3,5х20 головка впотай, крепл. заглушек','шт.'],44:[null,'Саморез с буром 3,9х22 крепление X-кареток','шт.'],45:[null,'Саморез с прессшайбой 4,2x25 - креп. L-задвижки','шт.'],46:[null,'Саморез 3х16 кругл. гол., крепление Х-задвижки','шт.']}
  const inactiveTrace:TraceStep[]=notApplicable.filter(row=>![18,19,20,21].includes(row)).map(row=>traceStep({id:`JV.SLIDER.L5.K${row}`,kind:'validation',label:`Slider-L5 inactive selector proof K${row}`,inputRefs:['S1!C8','S1!C9','S1!C10'],ruleId:`JV.SLIDER.L5.SELECTOR.K${row}`,source:{workbook:geometry.trace.find(x=>x.source?.workbook)?.source?.workbook,sheet:'S1',cell:`K${row}`,formula:formulas[row]},catalogRefs:[{id:`JV.SLIDER.L5.SELECTOR.K${row}`,version:VERSION}],input:{C8:10,C9:5,C10:15,selectorRow:row},result:{applicable:false,quantityFormulaIsInactive:true},status:'ok',errorIds:[],warningIds:[]}))
  const workbook=geometry.trace.find(x=>x.source?.workbook)?.source?.workbook??'unidentified-workbook'
  const positions=Array.from({length:42},(_,i)=>i+5).map(row=>{const [sku,description,unit]=meta[row]!,na=notApplicable.includes(row),q=rows[row];return Object.freeze({id:`JV.SLIDER.L5.K${row}`,bomRow:row,sku,description,unit,status:na?'NOT_APPLICABLE' as const:'CALCULATED' as const,...(!na&&q?{quantity:q}:{}),sourceFormula:formulas[row]??FORMULA[row as SliderL5BomLine['bomRow']]??'',traceStepId:`JV.SLIDER.L5.K${row}`,catalogVersion:`${workbook}#'Прайс-Slider'!B:D`,...(na?{diagnostic:'L5 selector branch is formulaically inactive; L5 selector codes prove no applicable source quantity.'}:{}),ruleVersion:VERSION})})
  return Object.freeze({status:'COMPLETE',family:'SLIDER',variant:'L5',positions:Object.freeze(positions),supportedRows:Object.freeze(positions.filter(x=>x.status==='CALCULATED').map(x=>x.bomRow)),notApplicableRows:Object.freeze(notApplicable),resolvedSelectors:Object.freeze({D20:fullGraph.values['JV.SLIDER.L5.D20'] as '1 / 2'|'2 / 4'|'нет',D24:fullGraph.values['JV.SLIDER.L5.D24'] as 'ОДИН'|'ДВА'|'НЕТ'|'инд. по поз.',D26:fullGraph.values['JV.SLIDER.L5.D26'] as 'ОДИН'|'НЕТ'|'инд. по поз.'}),trace:Object.freeze([...geometry.trace,...base.trace,...fullGraph.trace,...inactiveTrace])})
}

const FORMULA:Record<SliderL5BomLine['bomRow'],string>={
  14:'=$J$14*2*$D$6',
  15:'=$J$15*(2*$D$5-$K$14)',
  16:'=$J$16*(2*$D$5-$K$14)/$D$6',
  17:'=$J$17*(2*$D$5-$K$14)/$D$6',
  22:'=2*($K$15+$K$19)+$K$16+$K$17+$K$20+$K$21',
  23:'=$J$23*2*$D$5',
  29:'=$J$29*$D$6*(IF($D$22="1 / 2",1,0)+IF($D$22="2 / 4",2,0))-$K$30',
  30:'=$J$30*$D$6',
  43:'=2*SUM($K$14:$K$21)',
  45:'=2*$K$29',
}

/** Calculates the confirmed quantity branch of Slider-L5 BOM. Price rules and other BOM branches remain out of scope. */
export function calculateSliderL5Bom(geometry:SliderL5GeometryResult,options:SliderL5BomOptions):SliderL5BomResult {
  if(!geometry||geometry.family!=='SLIDER'||geometry.variant!=='L5')throw new EngineError('INVALID_CONFIGURATION','Slider-L5 BOM requires a calculated Slider-L5 geometry result')
  if(typeof options?.interlockEnabled!=='boolean')throw new EngineError('MISSING_INPUT','Missing Настройки!H21 for Slider-L5 BOM',{source:'Настройки!H21'})
  if(typeof options?.fittingUpgradeEnabled!=='boolean')throw new EngineError('MISSING_INPUT','Missing Настройки!H23 for Slider-L5 BOM',{source:'Настройки!H23'})
  if(!['1 / 2','2 / 4','НЕТ'].includes(options?.jointPairSelection))throw new EngineError('RULE_UNCONFIRMED','Slider-L5 S1!D22 must be resolved from the source selector table',{source:'S1!D22',value:options?.jointPairSelection})
  const zero=rationalFromDecimal('0'),one=rationalFromDecimal('1'),two=rationalFromDecimal('2')
  const direction:SliderL5Direction=geometry.inputs.openingSelector===1?'left':geometry.inputs.openingSelector===2?'right':'two-sided'
  const row14='JV.SLIDER.L5.K14',row15='JV.SLIDER.L5.K15',row16='JV.SLIDER.L5.K16',row17='JV.SLIDER.L5.K17',row29='JV.SLIDER.L5.K29',row30='JV.SLIDER.L5.K30'
  const workbook=geometry.trace.find(step=>step.source?.workbook)?.source?.workbook
  const values:Record<string,unknown>={leaves:geometry.inputs.leafCount,sideCount:rationalFromDecimal(String(geometry.inputs.sideCount)),direction,interlockEnabled:options.interlockEnabled,fittingUpgradeEnabled:options.fittingUpgradeEnabled,jointPairSelection:options.jointPairSelection,D6:rationalFromDecimal(String(geometry.inputs.sideCount)),systemCode:10,I14:10,I15:10,I16:10,I17:10,I23:10,I29:10,I30:10}
  const rule=(row:SliderL5BomLine['bomRow'],dependsOn:string[],execute:CalculationRule['execute']):CalculationRule=>({id:`JV.SLIDER.L5.K${row}`,version:VERSION,dependsOn,source:{workbook,sheet:'S1',cell:`K${row}`,formula:FORMULA[row]},execute})
  const selectorRule=(cell:string,formula:string,dependsOn:string[],execute:CalculationRule['execute']):CalculationRule=>({id:`JV.SLIDER.L5.J${cell}`,version:VERSION,dependsOn,source:{workbook,sheet:'S1',cell:`J${cell}`,formula},execute})
  const inactiveXRows:CalculationRule[]=(['18','19','20','21'] as const).map(row=>({id:`JV.SLIDER.L5.K${row}`,version:VERSION,dependsOn:['LSystemCode'],source:{workbook,sheet:'S1',cell:`K${row}`,formula:row==='18'?'=$J$18*2*$D$6':row==='19'?'=$J$19*(2*$D$5-$K$18)':`=$J$${row}*(2*$D$5-$K$18)/$D$6`},execute:({inputs:v})=>{if(v.LSystemCode!==10)throw new EngineError('RULE_UNCONFIRMED','X-system inactive branch is only verified while S1!C8=10');return zero}}))
  values.LSystemCode=10
  const rules:CalculationRule[]=[
    ...inactiveXRows,
    selectorRule('14','=IF($C$8=I14,1,0)',['systemCode','I14'],({inputs:v})=>v.systemCode===v.I14?one:zero),
    selectorRule('15','=IF(AND($C$8=I15,D28="НЕТ"),1,0)',['systemCode','I15','interlockEnabled'],({inputs:v})=>v.systemCode===v.I15&&v.interlockEnabled===false?one:zero),
    selectorRule('16','=IF(AND($C$8=I16,Настройки!$H$21,OR($D$7="НАЛЕВО",$D$7="ДВУХСТОР.")),1,0)',['systemCode','I16','interlockEnabled','direction'],({inputs:v})=>v.systemCode===v.I16&&v.interlockEnabled===true&&(v.direction==='left'||v.direction==='two-sided')?one:zero),
    selectorRule('17','=IF(AND($C$8=I17,Настройки!$H$21,OR($D$7="НАПРАВО",$D$7="ДВУХСТОР.")),1,0)',['systemCode','I17','interlockEnabled','direction'],({inputs:v})=>v.systemCode===v.I17&&v.interlockEnabled===true&&(v.direction==='right'||v.direction==='two-sided')?one:zero),
    selectorRule('23','=IF($C$8=I23,1,0)',['systemCode','I23'],({inputs:v})=>v.systemCode===v.I23?one:zero),
    selectorRule('29','=IF($C$8=I29,1,0)',['systemCode','I29'],({inputs:v})=>v.systemCode===v.I29?one:zero),
    selectorRule('30','=IF(AND($C$8=I30,Настройки!$H$23),1,0)',['systemCode','I30','fittingUpgradeEnabled'],({inputs:v})=>v.systemCode===v.I30&&v.fittingUpgradeEnabled===true?one:zero),
    rule(14,['JV.SLIDER.L5.J14','D6'],({inputs:v,results:r})=>multiplyRational(r['JV.SLIDER.L5.J14'] as ExactRational,multiplyRational(two,v.D6 as ExactRational))),
    rule(15,['leaves','JV.SLIDER.L5.K14','JV.SLIDER.L5.J15'],({inputs:v,results:r})=>multiplyRational(r['JV.SLIDER.L5.J15'] as ExactRational,subtract(multiplyRational(two,v.leaves as ExactRational),r[row14] as ExactRational))),
    rule(16,['leaves','D6','JV.SLIDER.L5.K14','JV.SLIDER.L5.J16'],({inputs:v,results:r})=>divideRational(multiplyRational(r['JV.SLIDER.L5.J16'] as ExactRational,subtract(multiplyRational(two,v.leaves as ExactRational),r[row14] as ExactRational)),v.D6 as ExactRational)),
    rule(17,['leaves','D6','JV.SLIDER.L5.K14','JV.SLIDER.L5.J17'],({inputs:v,results:r})=>divideRational(multiplyRational(r['JV.SLIDER.L5.J17'] as ExactRational,subtract(multiplyRational(two,v.leaves as ExactRational),r[row14] as ExactRational)),v.D6 as ExactRational)),
    rule(22,['JV.SLIDER.L5.K15','JV.SLIDER.L5.K16','JV.SLIDER.L5.K17','JV.SLIDER.L5.K19','JV.SLIDER.L5.K20','JV.SLIDER.L5.K21'],({results:r})=>addRational(addRational(multiplyRational(two,r[row15] as ExactRational),addRational(r[row16] as ExactRational,r[row17] as ExactRational)),addRational(addRational(r['JV.SLIDER.L5.K19'] as ExactRational,r['JV.SLIDER.L5.K20'] as ExactRational),r['JV.SLIDER.L5.K21'] as ExactRational))),
    rule(23,['leaves','JV.SLIDER.L5.J23'],({inputs:v,results:r})=>multiplyRational(r['JV.SLIDER.L5.J23'] as ExactRational,multiplyRational(two,v.leaves as ExactRational))),
    rule(30,['D6','JV.SLIDER.L5.J30'],({inputs:v,results:r})=>multiplyRational(r['JV.SLIDER.L5.J30'] as ExactRational,v.D6 as ExactRational)),
    rule(29,['D6','jointPairSelection','JV.SLIDER.L5.J29','JV.SLIDER.L5.K30'],({inputs:v,results:r})=>subtract(multiplyRational(r['JV.SLIDER.L5.J29'] as ExactRational,multiplyRational(v.D6 as ExactRational,v.jointPairSelection==='2 / 4'?two:v.jointPairSelection==='1 / 2'?one:zero)),r[row30] as ExactRational)),
    rule(43,['JV.SLIDER.L5.K14','JV.SLIDER.L5.K15','JV.SLIDER.L5.K16','JV.SLIDER.L5.K17','JV.SLIDER.L5.K18','JV.SLIDER.L5.K19','JV.SLIDER.L5.K20','JV.SLIDER.L5.K21'],({results:r})=>multiplyRational(two,['14','15','16','17','18','19','20','21'].map(row=>r[`JV.SLIDER.L5.K${row}`] as ExactRational).reduce(addRational))),
    rule(45,['JV.SLIDER.L5.K29'],({results:r})=>multiplyRational(two,r[row29] as ExactRational)),
  ]
  const graph=executeGraph(values,rules)
  const specs:readonly Omit<SliderL5BomLine,'quantity'|'traceStepId'|'status'>[]=[
    {bomRow:14,sku:'SL-140-0',description:options.interlockEnabled?'Заглушка L створочная боковая НОВАЯ':'Заглушка L створочная боковая',unit:'шт.',formula:FORMULA[14]},
    {bomRow:15,sku:'SL-140-2',description:'Заглушка L створочная 2-стор.',unit:'шт.',formula:FORMULA[15]},
    {bomRow:16,sku:'SL-140-L',description:'Заглушка L створочная левая НОВАЯ',unit:'шт.',formula:FORMULA[16]},
    {bomRow:17,sku:'SL-140-R',description:'Заглушка L створочная правая НОВАЯ',unit:'шт.',formula:FORMULA[17]},
    {bomRow:22,sku:'S-080',description:'Демпфер заглушки c кольцом',unit:'шт.',formula:FORMULA[22]},
    {bomRow:23,sku:'SL-150',description:'Роликовая каретка L',unit:'шт.',formula:FORMULA[23]},
    {bomRow:29,sku:'SL-160',description:'Задвижка нижняя L с винтом (комплект)',unit:'шт.',formula:FORMULA[29]},
    {bomRow:30,sku:'SL-161',description:'Задвижка нижняя L с ручкой (комплект)',unit:'шт.',formula:FORMULA[30]},
    {bomRow:43,sku:'',description:'Саморез 3,5х20 головка впотай, крепл. заглушек',unit:'шт.',formula:FORMULA[43]},
    {bomRow:45,sku:'',description:'Саморез с прессшайбой 4,2x25 - креп. L-задвижки',unit:'шт.',formula:FORMULA[45]},
  ]
  const lines=specs.map(spec=>{const id=`JV.SLIDER.L5.K${spec.bomRow}`,quantity=graph.values[id];if(!isRational(quantity))throw new EngineError('RULE_FAILED',`Slider BOM rule S1!K${spec.bomRow} did not return an exact rational`);return Object.freeze({...spec,quantity,traceStepId:id,status:'CALCULATED' as const})})
  return Object.freeze({status:'PARTIAL',family:'SLIDER',variant:'L5',lines:Object.freeze(lines),alreadyImplementedRows:Object.freeze([6,8]),notApplicableRows:Object.freeze([18,19,20,21,24,31,32,44,46]),unsupportedRows:Object.freeze([6,8,9,10,11,12,13,25,26,27,28,33,34,35,36,37,38,39,40,41,42]),trace:graph.trace})
}

function subtract(a:ExactRational,b:ExactRational):ExactRational{return addRational(a,multiplyRational(b,rationalFromDecimal('-1')))}
function isRational(value:unknown):value is ExactRational{return typeof value==='object'&&value!==null&&'numerator' in value&&'denominator' in value}
