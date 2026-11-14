import { EngineError } from '../errors.ts'
import { executeGraph, type CalculationRule } from '../graph.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal, roundRationalAwayFromZero, type ExactRational } from '../rational.ts'
import { traceStep } from '../trace.ts'
import type { TraceStep } from '../types.ts'

export type SliderL3Toggle = 'ДА'|'НЕТ'
export interface SliderL3GeometrySettings {
  /** Captured Настройки constants referenced by S1 geometry formulas. */
  readonly S2:string; readonly S3:string; readonly S4:string; readonly S6:string
  readonly S9:string; readonly S10:string; readonly S11:string; readonly S12:string
  readonly S13:string; readonly S14:string; readonly S21:string
  readonly L23:string
  readonly D8:string
  readonly H25:boolean
}
export interface SliderL3MaterialQuantity {readonly bomRow:5|7;readonly sku:'S-010'|'SL-110';readonly description:string;readonly unit:'п.м';readonly quantity:ExactRational;readonly formula:string;readonly traceStepId:string}
export interface SliderL3GeometryInput {
  readonly workbook:string
  readonly systemSelector:3 // Главная!Fslot=3, the verified Slider-L3 variant
  readonly widthMm:string
  readonly heightMm:string
  readonly leafCount:string
  /** Главная!Jslot: 1=left, 2=right, 3=two-sided; S1!D6 maps this to 1,1,2. */
  readonly openingSelector:1|2|3
  /** Exact resulting S1!D17 and S1!D18 choice strings selected through Настройки/#1. */
  readonly interlockState:SliderL3Toggle
  readonly meetingSealState:SliderL3Toggle
  readonly settings:SliderL3GeometrySettings
}
export interface SliderL3GeometryResult {
  readonly status:'COMPLETE'
  readonly family:'SLIDER'
  readonly variant:'L3'
  readonly selector:Readonly<{mainF:3;mainG:3;priceColumn:'T';calculationSheet:'S1'}>
  readonly inputs:Readonly<{widthMm:ExactRational;heightMm:ExactRational;leafCount:ExactRational;openingSelector:number;sideCount:1|2;interlockState:SliderL3Toggle;meetingSealState:SliderL3Toggle}>
  readonly track:Readonly<{systemCode:10;trackCount:3;combinedCode:13}>
  readonly geometry:Readonly<{D31:ExactRational;D32:ExactRational;D33:ExactRational;D34:ExactRational;D43:ExactRational;D44:ExactRational;D45:ExactRational}>
  readonly materialQuantities:readonly SliderL3MaterialQuantity[]
  readonly trace:readonly TraceStep[]
  readonly diagnostics:readonly string[]
}

const VERSION='JV-SLIDER-L3-GEOMETRY-2026-11-04-v1'
const FORMULAS={
  C8:'=IF(OR(Главная!$F$11=3,Главная!$F$11=4),10,0)+IF(OR(Главная!$F$11=5,Главная!$F$11=6),20,0)',
  C9:'=IF(OR(Главная!$F$11=3,Главная!$F$11=5),3,0)+IF(OR(Главная!$F$11=4,Главная!$F$11=6),5,0)',
  C10:'=$C$8+$C$9',
  D31:'=ROUNDUP($D$3-IF(AND($C$8=20,$D$18="ДА"),2*Настройки!$S$6,0),0)',
  D32:'=ROUNDUP($D$3-IF($D$18="ДА",2*Настройки!$S$6,0),0)',
  C13:'=IF(AND($D$17="НЕТ",$D$18="НЕТ"),Настройки!$S$9,0)+IF(AND($D$17="ДА",$D$18="НЕТ"),Настройки!$S$10,0)+IF(AND($D$17="НЕТ",$D$18="ДА"),Настройки!$S$11,0)+IF(AND($D$17="ДА",$D$18="ДА"),Настройки!$S$12,0)',
  C14:'=IF($D$6=2,IF(Настройки!$H$25,Настройки!$S$14,Настройки!$S$13),0)',
  D43:'=ROUNDUP(($D$3+($D$5-$D$6)*Настройки!$S$2-2*$C$13-$C$14)/$D$5,0)+Настройки!$L$23',
  D44:'=$D$4-IF($C$10=13,Настройки!$S$21,0)-IF($C$10=15,Настройки!$S$22,0)-IF($C$10=23,Настройки!$S$23,0)-IF($C$10=25,Настройки!$S$24,0)',
  D33:'=$D$43+Настройки!$S$4',
  D34:'=IF($D$6=2,$D$33+Настройки!$S$3,0)',
  D45:'=$D$43+2*Настройки!$S$3',
} as const

/** Calculates only the closed, source-confirmed Slider-L3 geometry chain. */
export function calculateSliderL3Geometry(input:SliderL3GeometryInput):SliderL3GeometryResult {
  if(!input.workbook.trim())throw new EngineError('INVALID_CONFIGURATION','Slider geometry requires source workbook identity')
  const width=parsePositive(input.widthMm,'Главная!Cslot / S1!D3')
  const height=parsePositive(input.heightMm,'Главная!Dslot / S1!D4')
  const leaves=parsePositive(input.leafCount,'Главная!Mslot / S1!D5')
  if(BigInt(leaves.denominator)!==1n)throw new EngineError('INVALID_CONFIGURATION','Slider leaf count must be an integer')
  if(![1,2,3].includes(input.openingSelector))throw new EngineError('INVALID_CONFIGURATION','Slider opening selector must be 1, 2, or 3')
  if(!['ДА','НЕТ'].includes(input.interlockState)||!['ДА','НЕТ'].includes(input.meetingSealState))throw new EngineError('INVALID_CONFIGURATION','Slider selectors must resolve to the source strings ДА or НЕТ')
  const settings:Record<string,ExactRational>={}
  for(const key of ['D8','S2','S3','S4','S6','S9','S10','S11','S12','S13','S14','S21','L23'] as const)settings[key]=parseSetting(input.settings[key],`Настройки!${key}`)
  const sideCount:1|2=input.openingSelector===3?2:1
  const selector=input.systemSelector
  if(selector!==3)throw new EngineError('RULE_UNCONFIRMED','Only Главная!Fslot=3 (Slider-L3) is implemented',{selector})
  if(typeof input.settings.H25!=='boolean')throw new EngineError('MISSING_INPUT','Missing boolean setting Настройки!H25',{source:'Настройки!H25'})
  const values:Record<string,unknown>={width,height,leaves,sideCount,selector,interlockState:input.interlockState,meetingSealState:input.meetingSealState,H25:input.settings.H25,...settings}
  const rule=(id:string,cell:string,formula:string,dependsOn:string[],execute:CalculationRule['execute']):CalculationRule=>({id:`JV.SLIDER.L3.${id}`,version:VERSION,dependsOn,source:{workbook:input.workbook,sheet:'S1',cell,formula},execute})
  const rules:CalculationRule[]=[
    rule('C8','C8',FORMULAS.C8,['selector'],({inputs:v})=>{if(v.selector!==3)throw new EngineError('RULE_UNCONFIRMED','This module implements only verified Slider-L3 selector Главная!F11=3');return rationalFromDecimal('10')}),
    rule('C9','C9',FORMULAS.C9,['selector'],({inputs:v})=>{if(v.selector!==3)throw new EngineError('RULE_UNCONFIRMED','This module implements only verified Slider-L3 selector Главная!F11=3');return rationalFromDecimal('3')}),
    rule('C10','C10',FORMULAS.C10,['JV.SLIDER.L3.C8','JV.SLIDER.L3.C9'],({results:r})=>addRational(r['JV.SLIDER.L3.C8'] as ExactRational,r['JV.SLIDER.L3.C9'] as ExactRational)),
    rule('D31','D31',FORMULAS.D31,['width','JV.SLIDER.L3.C8','meetingSealState','S6'],({inputs:v,results:r})=>round0((r['JV.SLIDER.L3.C8'] as ExactRational).numerator==='20'&&v.meetingSealState==='ДА'?subtract(v.width as ExactRational,mul(rationalFromDecimal('2'),v.S6 as ExactRational)):v.width as ExactRational)),
    rule('D32','D32',FORMULAS.D32,['width','meetingSealState','S6'],({inputs:v})=>round0(input.meetingSealState==='ДА'?subtract(v.width as ExactRational,mul(rationalFromDecimal('2'),v.S6 as ExactRational)):v.width as ExactRational)),
    rule('C13','C13',FORMULAS.C13,['interlockState','meetingSealState','S9','S10','S11','S12'],({inputs:v})=>v.interlockState==='НЕТ'&&v.meetingSealState==='НЕТ'?v.S9:v.interlockState==='ДА'&&v.meetingSealState==='НЕТ'?v.S10:v.interlockState==='НЕТ'?v.S11:v.S12),
    rule('C14','C14',FORMULAS.C14,['sideCount','H25','S13','S14'],({inputs:v})=>v.sideCount===2?(v.H25===true?v.S14:v.S13):rationalFromDecimal('0')),
    rule('D43','D43',FORMULAS.D43,['width','leaves','sideCount','S2','JV.SLIDER.L3.C13','JV.SLIDER.L3.C14','L23'],({inputs:v,results:r})=>addRational(round0(divideRational(subtract(addRational(v.width as ExactRational,mul(subtract(v.leaves as ExactRational,v.sideCount===1?rationalFromDecimal('1'):rationalFromDecimal('2')),v.S2 as ExactRational)),addRational(mul(rationalFromDecimal('2'),r['JV.SLIDER.L3.C13'] as ExactRational),r['JV.SLIDER.L3.C14'] as ExactRational)),v.leaves as ExactRational)),v.L23 as ExactRational)),
    rule('D44','D44',FORMULAS.D44,['height','JV.SLIDER.L3.C10','S21'],({inputs:v,results:r})=>{if(BigInt((r['JV.SLIDER.L3.C10'] as ExactRational).numerator)!==13n)throw new EngineError('RULE_UNCONFIRMED','Slider-L3 height reduction formula requires S1!C10=13');return subtract(v.height as ExactRational,v.S21 as ExactRational)}),
    rule('D33','D33',FORMULAS.D33,['JV.SLIDER.L3.D43','S4'],({inputs:v,results:r})=>addRational(r['JV.SLIDER.L3.D43'] as ExactRational,v.S4 as ExactRational)),
    rule('D34','D34',FORMULAS.D34,['sideCount','JV.SLIDER.L3.D33','S3'],({inputs:v,results:r})=>v.sideCount===2?addRational(r['JV.SLIDER.L3.D33'] as ExactRational,v.S3 as ExactRational):rationalFromDecimal('0')),
    rule('D45','D45',FORMULAS.D45,['JV.SLIDER.L3.D43','S3'],({inputs:v,results:r})=>addRational(r['JV.SLIDER.L3.D43'] as ExactRational,mul(rationalFromDecimal('2'),v.S3 as ExactRational))),
    rule('D37','D37','=IF($D$18="ДА",$D$4,0)',['meetingSealState','height'],({inputs:v})=>v.meetingSealState==='ДА'?v.height:rationalFromDecimal('0')),
    rule('I5','I5','3',['selector'],()=>rationalFromDecimal('3')),
    rule('I7','I7','13',['selector'],()=>rationalFromDecimal('13')),
    rule('J5','J5','=IF($C$9=I5,1,0)',['JV.SLIDER.L3.C9','JV.SLIDER.L3.I5'],({results:r})=>(r['JV.SLIDER.L3.C9'] as ExactRational).numerator===(r['JV.SLIDER.L3.I5'] as ExactRational).numerator?rationalFromDecimal('1'):rationalFromDecimal('0')),
    rule('J7','J7','=IF($C$10=I7,1,0)',['JV.SLIDER.L3.C10','JV.SLIDER.L3.I7'],({results:r})=>(r['JV.SLIDER.L3.C10'] as ExactRational).numerator===(r['JV.SLIDER.L3.I7'] as ExactRational).numerator?rationalFromDecimal('1'):rationalFromDecimal('0')),
    rule('K5','K5','=IF($J$5>0,$J$5*$D$32/1000+Настройки!$D$8/1000,0)',['JV.SLIDER.L3.J5','JV.SLIDER.L3.D32','D8'],({inputs:v,results:r})=>(r['JV.SLIDER.L3.J5'] as ExactRational).numerator!=='0'?addRational(divideRational(r['JV.SLIDER.L3.D32'] as ExactRational,rationalFromDecimal('1000')),divideRational(v.D8 as ExactRational,rationalFromDecimal('1000'))):rationalFromDecimal('0')),
    rule('K7','K7','=IF($J$7>0,$J$7*$D$31/1000+IF($C$9=3,2*$D$37/1000,0)+Настройки!$D$8/1000,0)',['JV.SLIDER.L3.J7','JV.SLIDER.L3.C9','JV.SLIDER.L3.D31','JV.SLIDER.L3.D37','D8'],({inputs:v,results:r})=>(r['JV.SLIDER.L3.J7'] as ExactRational).numerator!=='0'?addRational(addRational(divideRational(r['JV.SLIDER.L3.D31'] as ExactRational,rationalFromDecimal('1000')),(r['JV.SLIDER.L3.C9'] as ExactRational).numerator==='3'?divideRational(mul(rationalFromDecimal('2'),r['JV.SLIDER.L3.D37'] as ExactRational),rationalFromDecimal('1000')):rationalFromDecimal('0')),divideRational(v.D8 as ExactRational,rationalFromDecimal('1000'))):rationalFromDecimal('0')),
  ]
  const graph=executeGraph(values,rules)
  const result=(cell:string)=>{const value=graph.values[`JV.SLIDER.L3.${cell}`];if(!isRational(value))throw new EngineError('RULE_FAILED',`Slider geometry rule S1!${cell} did not return an exact rational`);return value}
  for(const cell of ['D31','D32','D33','D34','D43','D44','D45'])if(BigInt(result(cell).numerator)<=0n&&cell!=='D34')throw new EngineError('INVALID_CONFIGURATION',`Slider geometry S1!${cell} is not a positive dimension`,{cell,value:result(cell)})
  const materialQuantities=([
    {bomRow:5,sku:'S-010',description:'Профиль верхний 3-дорожечный',unit:'п.м',quantity:result('K5'),formula:'=IF($J$5>0,$J$5*$D$32/1000+Настройки!$D$8/1000,0)',traceStepId:'JV.SLIDER.L3.K5'},
    {bomRow:7,sku:'SL-110',description:'Профиль L опорный плоский 3-дорож.',unit:'п.м',quantity:result('K7'),formula:'=IF($J$7>0,$J$7*$D$31/1000+IF($C$9=3,2*$D$37/1000,0)+Настройки!$D$8/1000,0)',traceStepId:'JV.SLIDER.L3.K7'},
  ] satisfies SliderL3MaterialQuantity[]).map(line=>Object.freeze(line))
  return Object.freeze({status:'COMPLETE',family:'SLIDER',variant:'L3',selector:Object.freeze({mainF:3,mainG:3,priceColumn:'T',calculationSheet:'S1'}),inputs:Object.freeze({widthMm:width,heightMm:height,leafCount:leaves,openingSelector:input.openingSelector,sideCount,interlockState:input.interlockState,meetingSealState:input.meetingSealState}),track:Object.freeze({systemCode:10,trackCount:3,combinedCode:13}),geometry:Object.freeze({D31:result('D31'),D32:result('D32'),D33:result('D33'),D34:result('D34'),D43:result('D43'),D44:result('D44'),D45:result('D45')}),materialQuantities:Object.freeze(materialQuantities),trace:graph.trace,diagnostics:Object.freeze([])})
}

function parsePositive(value:string,source:string):ExactRational {let parsed:ExactRational;try{parsed=rationalFromDecimal(value)}catch{throw new EngineError('INVALID_DECIMAL',`Invalid Slider dimension/quantity at ${source}`,{value,source})}if(BigInt(parsed.numerator)<=0n)throw new EngineError('INVALID_CONFIGURATION',`${source} must be positive`,{value});return parsed}
function parseSetting(value:string,source:string):ExactRational {if(value===undefined)throw new EngineError('MISSING_INPUT',`Missing Slider geometry setting ${source}`,{source});try{return rationalFromDecimal(value)}catch{throw new EngineError('INVALID_DECIMAL',`Invalid Slider geometry setting ${source}`,{value,source})}}
function round0(value:ExactRational):ExactRational{return rationalFromDecimal(roundRationalAwayFromZero(value,0))}
function subtract(a:ExactRational,b:ExactRational):ExactRational{return addRational(a,multiplyRational(b,rationalFromDecimal('-1')))}
function mul(a:ExactRational,b:ExactRational):ExactRational{return multiplyRational(a,b)}
function one():ExactRational{return rationalFromDecimal('1')}
function isRational(value:unknown):value is ExactRational{return typeof value==='object'&&value!==null&&'numerator' in value&&'denominator' in value}
