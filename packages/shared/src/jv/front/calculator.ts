import { EngineError } from '../errors.ts'
import { executeGraph, type CalculationRule } from '../graph.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal, rationalFromFraction, roundRationalAwayFromZero, type ExactRational } from '../rational.ts'
import type { TraceStep } from '../types.ts'
import { FRONT_FORMULAS } from './source-formulas.ts'
import { FRONT_CATALOG } from './source-catalog.ts'

/** Raw workbook controls are part of the request: no cached F1 result is accepted as input. */
export interface FrontInput {
  readonly workbook: string
  readonly sourceSha256: string
  readonly systemSelector: 7
  readonly widthMm: string
  readonly heightMm: string
  readonly sectionDemand: string // raw Главная!Lslot; Mslot=CEILING(Lslot,1)
  readonly finishSelector: number // Главная!Hslot / F1!C6
  readonly glassSelector: number // Главная!Islot / F1!C7
  readonly openingSelector: 1 | 2 | 3 | 4 // raw Главная!Jslot; Kslot is calculated by Excel
  readonly controls: Readonly<{
    C11: number; C12: number; C13: number; C14: number; C15: number
    C18: 1 | 2; C19: 1 | 2; C20: 1 | 2 | 3; C21: number
    C22: number; C23: number; C24: number; D18: string; D19: string
  }>
  readonly settings: Readonly<{
    D8: string; S29: string; S30: string; S31: string; S32: string; S33: string; S34: string
    L22: string; L23: string
    H38: number; H40: number; H42: number; H44: number; I42: number; I44: number
  }>
}

export interface FrontBomPosition {
  readonly row: number
  readonly sku: string | null
  readonly description: string | null
  readonly unit: string
  readonly catalogRef: string
  readonly quantity: ExactRational
  readonly sourceFormula: string
  readonly traceStepId: string
  readonly status: 'CALCULATED' | 'NOT_APPLICABLE'
  readonly diagnostic?: string
}
export interface FrontCutPiece {
  readonly bomRow: number
  readonly sku: string | null
  readonly lengthMm: ExactRational
  readonly count: ExactRational
  readonly lengthCell: 'H12'|'H13'|'H14'
  readonly allowanceSource: 'Настройки!D8'
  readonly stockRuleCell: string
}
export interface FrontGlassPiece {
  readonly row: 28|29|30|31
  readonly widthMm: ExactRational
  readonly heightMm: ExactRational
  readonly count: ExactRational
  readonly sourceCells: readonly string[]
}
export interface FrontResult {
  readonly status: 'COMPLETE'
  readonly family: 'FRONT'
  readonly versions: Readonly<{rules:string;sourceSha256:string}>
  readonly selector: Readonly<{mainF:7;mainG:7;calculationSheet:'F1';priceColumn:'X'}>
  readonly selections: Readonly<Record<string,string|number>>
  readonly geometry: Readonly<Record<string,ExactRational>>
  readonly cut: Readonly<{H12:ExactRational;H13:ExactRational;H14:ExactRational}>
  readonly cutPieces: readonly FrontCutPiece[]
  readonly glass: Readonly<Record<string,ExactRational>>
  readonly glassPieces: readonly FrontGlassPiece[]
  readonly bom: readonly FrontBomPosition[]
  readonly consumables: Readonly<{activatorPerConstruction:ExactRational;adhesivePerConstruction:ExactRational}>
  readonly trace: readonly TraceStep[]
}

const VERSION='JV-FRONT-PR12A-2026-11-06-v1'
const R=(s:string|number):ExactRational=>rationalFromDecimal(String(s))
const Z=R(0), ONE=R(1), TWO=R(2), THOUSAND=R(1000)
const add=(...v:ExactRational[]):ExactRational=>v.reduce(addRational,Z)
const mul=(...v:ExactRational[]):ExactRational=>v.reduce(multiplyRational,ONE)
const sub=(a:ExactRational,b:ExactRational):ExactRational=>addRational(a,mul(R(-1),b))
const div=divideRational
const eq=(a:ExactRational,b:number):boolean=>BigInt(a.numerator)===BigInt(b)*BigInt(a.denominator)
const gt=(a:ExactRational,b:number):boolean=>BigInt(a.numerator)>BigInt(b)*BigInt(a.denominator)
const lt=(a:ExactRational,b:number):boolean=>BigInt(a.numerator)<BigInt(b)*BigInt(a.denominator)
const positive=(a:ExactRational):boolean=>gt(a,0)
const round=(a:ExactRational):ExactRational=>{let n=BigInt(a.numerator),d=BigInt(a.denominator);const neg=n<0n;if(neg)n=-n;const q=n/d, rem=n%d;return rationalFromFraction(String((neg?-1n:1n)*(q+(rem*2n>=d?1n:0n))),'1')}
const roundup=(a:ExactRational):ExactRational=>R(roundRationalAwayFromZero(a,0))
const rounddown=(a:ExactRational):ExactRational=>rationalFromFraction(String(BigInt(a.numerator)/BigInt(a.denominator)),'1')
const pick=<T>(items:readonly T[],index:number,source:string):T=>{if(!Number.isInteger(index)||index<1||index>items.length)throw new EngineError('INVALID_CONFIGURATION',`INDEX ${source} is outside its source table`,{index,source});return items[index-1]!}
const parse=(value:string,source:string):ExactRational=>{try{return R(value)}catch{throw new EngineError('INVALID_DECIMAL',`Invalid ${source}`,{value,source})}}
const asR=(value:unknown,cell:string):ExactRational=>{if(typeof value!=='object'||value===null||!('numerator' in value)||!('denominator' in value))throw new EngineError('RULE_FAILED',`F1!${cell} is not an exact rational`);return value as ExactRational}

/** Executes the source-confirmed F1 geometry, cut and quantity rules without Excel. */
export function calculateFront(input:FrontInput):FrontResult {
  if(input.systemSelector!==7)throw new EngineError('RULE_UNCONFIRMED','Only Front Fslot=7 is implemented')
  if(!input.workbook?.trim())throw new EngineError('MISSING_INPUT','Missing source workbook identity')
  if(!/^[0-9a-f]{64}$/i.test(input.sourceSha256))throw new EngineError('MISSING_INPUT','Missing valid source workbook SHA-256')
  const width=parse(input.widthMm,'Главная!Cslot'),height=parse(input.heightMm,'Главная!Dslot'),sectionDemand=parse(input.sectionDemand,'Главная!Lslot')
  if(!positive(width)||!positive(height)||!positive(sectionDemand))throw new EngineError('INVALID_CONFIGURATION','Front dimensions and section demand must be positive')
  if(![1,2,3,4].includes(input.openingSelector))throw new EngineError('INVALID_CONFIGURATION','Invalid Главная!Jslot')
  const c=input.controls,s=input.settings
  if(!c||!s)throw new EngineError('MISSING_INPUT','Front controls and settings are required')
  const numeric:Record<string,ExactRational>={width,height,sectionDemand}
  for(const key of ['D18','D19'] as const)numeric[key]=parse(c[key],`F1!${key}`)
  for(const key of ['D8','S29','S30','S31','S32','S33','S34','L22','L23'] as const)numeric[key]=parse(s[key],`Настройки!${key}`)
  if(!positive(numeric.S33!)||!positive(numeric.S34!))throw new EngineError('INVALID_CONFIGURATION','Front glass spacing settings must be positive')
  for(const [name,value] of Object.entries({...c,...s,finishSelector:input.finishSelector,glassSelector:input.glassSelector,openingSelector:input.openingSelector}))if(typeof value==='number'&&!Number.isSafeInteger(value))throw new EngineError('INVALID_CONFIGURATION',`Invalid selector ${name}`)
  const v:Record<string,unknown>={...c,...s,...numeric,systemSelector:input.systemSelector,finishSelector:input.finishSelector,glassSelector:input.glassSelector,openingSelector:input.openingSelector}
  const rules:CalculationRule[]=[]
  const id=(cell:string)=>`JV.FRONT.F1.${cell}`
  const rule=(cell:string,deps:string[],execute:CalculationRule['execute'])=>rules.push({id:id(cell),version:VERSION,dependsOn:deps.map(d=>d.startsWith('@')?d.slice(1):d==='width'?id('C3'):d==='height'?id('C4'):d in v?d:id(d)),source:{workbook:input.workbook,sheet:'F1',cell,formula:FRONT_FORMULAS[cell as keyof typeof FRONT_FORMULAS]},execute})
  const get=(r:Readonly<Record<string,unknown>>,cell:string)=>r[id(cell)]
  const n=(r:Readonly<Record<string,unknown>>,cell:string)=>asR(get(r,cell),cell)
  const yes=(x:unknown)=>x==='ДА'
  const active=(r:Readonly<Record<string,unknown>>)=>get(r,'I23')==='НЕТ'

  rules.push({id:id('C3'),version:VERSION,dependsOn:['width'],source:{workbook:input.workbook,sheet:'F1',cell:'C3',formula:FRONT_FORMULAS.C3},execute:({inputs:x})=>x.width})
  rules.push({id:id('C4'),version:VERSION,dependsOn:['height'],source:{workbook:input.workbook,sheet:'F1',cell:'C4',formula:FRONT_FORMULAS.C4},execute:({inputs:x})=>x.height})
  rules.push({id:'JV.FRONT.MAIN.G11',version:VERSION,dependsOn:['systemSelector'],source:{workbook:input.workbook,sheet:'Главная',cell:'G11',formula:'=IF(OR(F11=4,F11=5,F11=6),3,IF(F11=11,10,F11))'},execute:({inputs:x})=>x.systemSelector===7?R(7):Z})
  rule('A2',['@JV.FRONT.MAIN.G11'],({results:r})=>r['JV.FRONT.MAIN.G11'])
  rule('A3',['A2'],({results:r})=>eq(n(r,'A2'),7)?ONE:Z)
  rules.push({id:'JV.FRONT.MAIN.K11',version:VERSION,dependsOn:['openingSelector'],source:{workbook:input.workbook,sheet:'Главная',cell:'K11',formula:'=IF(J11<=2,1,J11-1)'},execute:({inputs:x})=>R((x.openingSelector as number)<=2?1:(x.openingSelector as number)-1)})
  rule('C8',['@JV.FRONT.MAIN.K11'],({results:r})=>r['JV.FRONT.MAIN.K11'])
  rules.push({id:'JV.FRONT.MAIN.M11',version:VERSION,dependsOn:['sectionDemand'],source:{workbook:input.workbook,sheet:'Главная',cell:'M11',formula:'=CEILING($L11,1)'},execute:({inputs:x})=>roundup(x.sectionDemand as ExactRational)})
  rule('C5',['@JV.FRONT.MAIN.M11'],({results:r})=>r['JV.FRONT.MAIN.M11'])
  rule('D6',['finishSelector'],({inputs:x})=>pick(['некраш.','глянец','матовый','муар'],x.finishSelector as number,'#1!C24:C27'))
  rule('D7',['glassSelector'],({inputs:x})=>pick(['6 мм проз.','6 мм освет.','6 мм тон.','6 мм мат.','8 мм проз.','8 мм освет.','8 мм тон.','8 мм мат.','10 мм проз.','10 мм освет.','10 мм тон.','10 мм мат.'],x.glassSelector as number,'#1!C11:C22'))
  rule('C17',['C8'],({results:r})=>eq(n(r,'C8'),1)?TWO:eq(n(r,'C8'),2)?R(3):ONE)
  rule('D8',['C8'],({results:r})=>pick(['1-створч.','2-створч.','нет'],Number(n(r,'C8').numerator),'F1!D8'))
  rule('D11',['H38','C11'],({inputs:x})=>pick(['Зажимной','П-образный'],x.H38===3?x.C11 as number:x.H38 as number,'#2!C6:C7'))
  for(const [cell,setting,control] of [['D12','H40','C12'],['D13','H42','C13'],['D14','H44','C14'],['D15','I44','C15']] as const)rule(cell,[setting,control],({inputs:x})=>pick(['ДА','НЕТ'],x[setting]===3?x[control] as number:x[setting] as number,`#2!${cell==='D14'?'F':cell==='D15'?'L':'E'}6:7`))
  rule('D17',['D11','C17','C5'],({results:r})=>{if(get(r,'D11')==='Зажимной'){const f=n(r,'C17');if(!gt(n(r,'C5'),Number(f.numerator)-2))return 'ОШИБКА!';return pick(['НЕТ','1-створч.','2-створч.'],Number(f.numerator),'#2!G6:G8')}return gt(n(r,'C17'),1)?'Надо зажимной!':'НЕТ'})
  rule('E18',['C18','C5','C17'],({inputs:x,results:r})=>x.C18===2&&!gt(n(r,'C5'),Number(n(r,'C17').numerator)-1)?'ОШИБКА!':x.C18)
  rule('D20',['C17','C20','C5'],({inputs:x,results:r})=>{if(!gt(n(r,'C17'),1))return 0;const i=x.C20 as number,leaves=n(r,'C5');const valid=i===1?gt(leaves,0):i===2?gt(leaves,-1):eq(leaves,-1);return valid?pick(['стекло-дверь-стекло','стена-дверь-стекло','стена-дверь-стена'],i,'#2!C42:C44'):'ОШИБКА!'})
  rule('I6',['D17'],({results:r})=>['1-створч.','2-створч.'].includes(String(get(r,'D17')))?ONE:Z)
  rule('I7',['D17'],({results:r})=>get(r,'D17')==='2-створч.'?ONE:Z)
  rule('I17',['I42','C8'],({inputs:x,results:r})=>x.I42===1&&lt(n(r,'C8'),3)?ONE:Z)
  rule('I18',['D17'],({results:r})=>get(r,'D17')==='Надо зажимной!'?ONE:Z)
  rule('I19',['E18'],({results:r})=>get(r,'E18')==='ОШИБКА!'?ONE:Z)
  rule('I20',['D20'],({results:r})=>get(r,'D20')==='ОШИБКА!'?ONE:Z)
  rule('I21',['D11','D15'],({results:r})=>get(r,'D11')==='П-образный'&&yes(get(r,'D15'))?ONE:Z)
  rule('I22',['D11','C17'],({results:r})=>get(r,'D11')==='П-образный'&&gt(n(r,'C17'),1)?ONE:Z)
  rule('I23',['I17','I18','I19','I20','I21','I22'],({results:r})=>[17,18,19,20,21,22].some(k=>positive(n(r,`I${k}`)))?'ОШИБКА!':'НЕТ')
  rule('D3',['width','C5','C17','C18','D18'],({inputs:x,results:r})=>x.C18===1?mul(div(x.width as ExactRational,n(r,'C5')),add(sub(n(r,'C5'),n(r,'C17')),ONE)):sub(x.width as ExactRational,mul(x.D18 as ExactRational,sub(n(r,'C17'),ONE))))
  rule('D5',['C5','C17'],({results:r})=>add(sub(n(r,'C5'),n(r,'C17')),ONE))
  rule('H3',['width'],({inputs:x})=>x.width)
  rule('H4',['C5','S32'],({inputs:x,results:r})=>mul(add(n(r,'C5'),ONE),x.S32 as ExactRational))
  rule('H5',['H3','H4'],({results:r})=>sub(n(r,'H3'),n(r,'H4')))
  rule('H6',['I6','E18','H5','C5','D18'],({inputs:x,results:r})=>mul(n(r,'I6'),get(r,'E18')===1?div(n(r,'H5'),n(r,'C5')):x.D18 as ExactRational))
  rule('H7',['I7','E18','H5','C5','D18'],({inputs:x,results:r})=>mul(n(r,'I7'),get(r,'E18')===1?div(n(r,'H5'),n(r,'C5')):x.D18 as ExactRational))
  rule('H8',['H5','H6','H7'],({results:r})=>sub(sub(n(r,'H5'),n(r,'H6')),n(r,'H7')))
  rule('H9',['H8','C5','I6','I7'],({results:r})=>{const denominator=sub(sub(n(r,'C5'),n(r,'I6')),n(r,'I7'));return eq(denominator,0)?Z:div(n(r,'H8'),denominator)})
  rule('H10',['H5','H9','C5','I6','I7','H6','H7'],({results:r})=>sub(sub(n(r,'H5'),mul(n(r,'H9'),sub(sub(n(r,'C5'),n(r,'I6')),n(r,'I7')))),add(mul(n(r,'H6'),n(r,'I6')),mul(n(r,'H7'),n(r,'I7')))))
  rule('H11',['C19','C8','S32','C17','H6','H7'],({inputs:x,results:r})=>x.C19===1&&lt(n(r,'C8'),3)?add(mul(x.S32 as ExactRational,n(r,'C17')),n(r,'H6'),n(r,'H7')):Z)
  rule('H12',['H3','H11','D8'],({inputs:x,results:r})=>round(add(sub(n(r,'H3'),n(r,'H11')),x.D8 as ExactRational)))
  rule('H13',['H3','C8','S32','C17','H6','H7','D8'],({inputs:x,results:r})=>round(add(sub(n(r,'H3'),lt(n(r,'C8'),3)?add(mul(x.S32 as ExactRational,n(r,'C17')),n(r,'H6'),n(r,'H7')):Z),x.D8 as ExactRational)))
  rule('H14',['D15','height','D8'],({inputs:x,results:r})=>round(yes(get(r,'D15'))?add(x.height as ExactRational,x.D8 as ExactRational):Z))

  // Glass geometry and clip counts: F1!C28:K34.
  rule('C31',['I23','C17','C20'],({inputs:x,results:r})=>active(r)&&gt(n(r,'C17'),1)?x.C20===1?TWO:x.C20===2?ONE:Z:Z)
  rule('C28',['I23','D5','C31'],({results:r})=>active(r)&&positive(sub(n(r,'D5'),n(r,'C31')))?sub(n(r,'D5'),n(r,'C31')):Z)
  rule('C29',['I23','I6','I7'],({results:r})=>active(r)?add(n(r,'I6'),n(r,'I7')):Z)
  rule('C30',['I23','C17','C19'],({inputs:x,results:r})=>active(r)&&gt(n(r,'C17'),1)&&x.C19===2?ONE:Z)
  rule('D28',['C28','H9','L23'],({inputs:x,results:r})=>positive(n(r,'C28'))?sub(n(r,'H9'),x.L23 as ExactRational):Z)
  rule('D29',['C29','H6','L23'],({inputs:x,results:r})=>positive(n(r,'C29'))?sub(n(r,'H6'),x.L23 as ExactRational):Z)
  rule('D30',['C30','C19','D29','C17'],({inputs:x,results:r})=>positive(n(r,'C30'))&&x.C19===2?mul(n(r,'D29'),sub(n(r,'C17'),ONE)):Z)
  rule('D31',['C31','H9','L23'],({inputs:x,results:r})=>positive(n(r,'C31'))?sub(n(r,'H9'),x.L23 as ExactRational):Z)
  rule('E28',['C28','height','D11','S29','S30','D12','L23'],({inputs:x,results:r})=>positive(n(r,'C28'))?sub(sub(x.height as ExactRational,add(get(r,'D11')==='Зажимной'?x.S29 as ExactRational:Z,get(r,'D11')==='П-образный'?x.S30 as ExactRational:Z,yes(get(r,'D12'))&&get(r,'D11')==='П-образный'?R(40):Z)),x.L23 as ExactRational):Z)
  rule('E29',['C29','C19','D19','height','S31','S32','L23'],({inputs:x,results:r})=>positive(n(r,'C29'))?sub(sub(sub(x.C19===2?x.D19 as ExactRational:x.height as ExactRational,x.S31 as ExactRational),x.S32 as ExactRational),x.L23 as ExactRational):Z)
  rule('E30',['C30','C19','height','D19','S29','L23'],({inputs:x,results:r})=>positive(n(r,'C30'))?sub(sub(sub(x.C19===2?sub(x.height as ExactRational,x.D19 as ExactRational):Z,mul(R('0.5'),x.S29 as ExactRational)),x.L23 as ExactRational),Z):Z)
  rule('E31',['C31','height','D11','S29','S30','D12','L23'],({inputs:x,results:r})=>positive(n(r,'C31'))?sub(sub(x.height as ExactRational,add(get(r,'D11')==='Зажимной'?x.S29 as ExactRational:Z,get(r,'D11')==='П-образный'?x.S30 as ExactRational:Z,yes(get(r,'D12'))&&get(r,'D11')==='П-образный'?R(40):Z)),x.L23 as ExactRational):Z)
  rule('I27',['glassSelector','L22'],({inputs:x})=>mul(R(pick([6,6,6,6,8,8,8,8,10,10,10,10],x.glassSelector as number,'#1!D11:D22')),x.L22 as ExactRational))
  for(const row of [28,29,30,31]) {
    rule(`I${row}`,[`C${row}`,`D${row}`,`E${row}`,'I27'],({results:r})=>div(mul(n(r,`C${row}`),n(r,`D${row}`),n(r,`E${row}`),n(r,'I27')),R(1000000)))
  }
  rule('I32',['I28','I29','I30','I31'],({results:r})=>add(...[28,29,30,31].map(k=>n(r,`I${k}`))))
  rule('D32',['I32'],({results:r})=>n(r,'I32'))
  rule('D33',['D32','C5'],({results:r})=>div(n(r,'D32'),n(r,'C5')))
  rule('D34',['C28','D28','C29','D29','C31','D31','C5','L23'],({inputs:x,results:r})=>add(mul(n(r,'C28'),n(r,'D28')),mul(n(r,'C29'),n(r,'D29')),mul(n(r,'C31'),n(r,'D31')),mul(n(r,'C5'),x.L23 as ExactRational)))
  rule('J28',['C28','D28','S33'],({inputs:x,results:r})=>mul(n(r,'C28'),rounddown(div(n(r,'D28'),x.S33 as ExactRational)),TWO))
  rule('J30',['C30','D30','S33'],({inputs:x,results:r})=>mul(n(r,'C30'),rounddown(div(n(r,'D30'),x.S33 as ExactRational))))
  rule('J31',['C31','D31','S33'],({inputs:x,results:r})=>mul(n(r,'C31'),rounddown(div(n(r,'D31'),x.S33 as ExactRational)),TWO))
  rule('K28',['C28','J28'],({results:r})=>positive(n(r,'C28'))?add(div(n(r,'J28'),TWO),n(r,'C28')):Z)
  rule('K31',['C31','J31'],({results:r})=>positive(n(r,'C31'))?add(div(n(r,'J31'),TWO),n(r,'C31')):Z)
  rule('K32',['K28','K31'],({results:r})=>add(n(r,'K28'),n(r,'K31')))

  const clamp=(r:Readonly<Record<string,unknown>>)=>get(r,'D11')==='Зажимной'&&active(r)?ONE:Z
  const pProfile=(r:Readonly<Record<string,unknown>>)=>get(r,'D11')==='П-образный'&&active(r)?ONE:Z
  for(let row=5;row<=18;row++)rule(`P${row}`,['D11','I23'],({results:r})=>row<=11?clamp(r):pProfile(r))
  for(const row of [19,20,25,26,27,28,29,30])rule(`P${row}`,['C17'],({results:r})=>gt(n(r,'C17'),1)?ONE:Z)
  for(const row of [21,22,23,24])rule(`P${row}`,['C17','C19'],({inputs:x,results:r})=>gt(n(r,'C17'),1)&&x.C19===2?ONE:Z)
  rule('P31',['D13'],({results:r})=>yes(get(r,'D13'))?ONE:Z)
  rule('P32',['D13'],({results:r})=>yes(get(r,'D13'))?ONE:Z)
  const q=(row:number,deps:string[],calc:CalculationRule['execute'])=>rule(`Q${row}`,[`P${row}`,...deps],calc)
  q(5,['H12','H13','H14'],({results:r})=>div(mul(n(r,'P5'),add(n(r,'H12'),n(r,'H13'),mul(TWO,n(r,'H14')))),THOUSAND))
  q(6,['Q5'],({results:r})=>mul(n(r,'P6'),n(r,'Q5')))
  q(7,['J34'],({results:r})=>mul(n(r,'P7'),n(r,'J34')))
  q(8,['Q7'],({results:r})=>mul(n(r,'P8'),n(r,'Q7')))
  q(9,['Q7'],({results:r})=>mul(n(r,'P9'),n(r,'Q7')))
  q(10,['K32'],({results:r})=>mul(n(r,'P10'),n(r,'K32')))
  q(11,['D14','C17','C19'],({inputs:x,results:r})=>mul(n(r,'P11'),yes(get(r,'D14'))?add(R(4),gt(n(r,'C17'),1)?add(TWO,x.C19===1?TWO:Z):Z):Z))
  q(12,['H12','H13','H14'],({results:r})=>mul(n(r,'P12'),roundup(div(add(n(r,'H12'),n(r,'H13'),mul(TWO,n(r,'H14'))),R(3000))),R(3)))
  q(13,['Q12'],({results:r})=>mul(n(r,'P13'),n(r,'Q12')))
  q(14,['H12','H13'],({results:r})=>mul(n(r,'P14'),roundup(div(add(n(r,'H12'),n(r,'H13')),R(6000))),R(6)))
  q(15,['H12','H13','H14'],({results:r})=>mul(n(r,'P15'),roundup(div(mul(TWO,add(n(r,'H12'),n(r,'H13'),mul(TWO,n(r,'H14')))),R(3000)))))
  q(16,['D3'],({results:r})=>div(mul(n(r,'P16'),TWO,n(r,'D3')),THOUSAND))
  q(17,['H44'],({inputs:x,results:r})=>mul(n(r,'P17'),positive(R(x.H44 as number))?TWO:Z))
  q(18,['H44'],({inputs:x,results:r})=>mul(n(r,'P18'),positive(R(x.H44 as number))?TWO:Z))
  q(19,['C21','C17'],({inputs:x,results:r})=>mul(n(r,'P19'),x.C21===2?Z:sub(n(r,'C17'),ONE)))
  q(20,['C17'],({results:r})=>mul(n(r,'P20'),sub(n(r,'C17'),ONE)))
  q(21,['D20','C17'],({results:r})=>mul(n(r,'P21'),get(r,'D20')==='стена-дверь-стекло'?ONE:get(r,'D20')==='стена-дверь-стена'?sub(n(r,'C17'),ONE):Z))
  q(22,['D20','C17'],({results:r})=>mul(n(r,'P22'),get(r,'D20')==='стекло-дверь-стекло'?sub(n(r,'C17'),ONE):get(r,'D20')==='стена-дверь-стекло'?sub(n(r,'C17'),TWO):Z))
  q(23,[],()=>Z)
  q(24,['C17','D20'],({results:r})=>mul(n(r,'P24'),eq(n(r,'C17'),2)&&['стекло-дверь-стекло','стена-дверь-стекло'].includes(String(get(r,'D20')))?ONE:Z))
  q(25,['C21','C17'],({inputs:x,results:r})=>mul(n(r,'P25'),x.C21===1?sub(n(r,'C17'),ONE):Z))
  q(26,['C19','C17'],({inputs:x,results:r})=>mul(n(r,'P26'),x.C19===1?sub(n(r,'C17'),ONE):Z))
  q(27,['C21','C17'],({inputs:x,results:r})=>mul(n(r,'P27'),x.C21!==1?sub(n(r,'C17'),ONE):Z))
  q(28,['C22','D17'],({inputs:x,results:r})=>mul(n(r,'P28'),x.C22!==1?get(r,'D17')==='2-створч.'?TWO:ONE:Z))
  q(29,['C23','D17','P28'],({inputs:x,results:r})=>mul(n(r,'P28'),x.C23!==1?get(r,'D17')==='2-створч.'?ONE:ONE:Z))
  q(30,['C24','D17','P28'],({inputs:x,results:r})=>mul(n(r,'P28'),x.C24!==1?get(r,'D17')==='2-створч.'?ONE:ONE:Z))
  q(32,[],({results:r})=>mul(n(r,'P32'),TWO))
  q(31,['C5','Q32','C17'],({results:r})=>add(mul(n(r,'P31'),sub(add(n(r,'C5'),ONE),n(r,'Q32'))),sub(n(r,'C17'),ONE)))
  rule('J32',['J28','J30','J31'],({results:r})=>add(n(r,'J28'),n(r,'J30'),n(r,'J31')))
  rule('J33',['H14','S34'],({inputs:x,results:r})=>mul(TWO,rounddown(div(n(r,'H14'),x.S34 as ExactRational))))
  rule('J34',['J32','J33'],({results:r})=>add(n(r,'J32'),n(r,'J33')))
  rules.push({id:'JV.FRONT.CONSUMABLE.L5',version:VERSION,dependsOn:['systemSelector'],source:{workbook:input.workbook,sheet:'Клей+акт',cell:'L5',formula:'=IFERROR(INDEX($E5:$K5,$C5),0)'},execute:({inputs:x})=>x.systemSelector===7?Z:Z})
  rules.push({id:'JV.FRONT.CONSUMABLE.L18',version:VERSION,dependsOn:['systemSelector'],source:{workbook:input.workbook,sheet:'Клей+акт',cell:'L18',formula:'=IFERROR(INDEX($E18:$K18,$C18),0)'},execute:({inputs:x})=>x.systemSelector===7?Z:Z})
  const graph=executeGraph(v,rules)
  const result=(cell:string)=>asR(graph.values[id(cell)],cell)
  if(graph.values[id('I23')]!=='НЕТ')throw new EngineError('INVALID_CONFIGURATION','F1!I23=ОШИБКА! for these controls',{signals:Object.fromEntries([17,18,19,20,21,22].map(k=>[`I${k}`,result(`I${k}`).numerator]))})
  const geometryCells=['C3','C4','C5','C8','C17','D3','D5','D32','D33','D34','H3','H4','H5','H6','H7','H8','H9','H10','H11']
  const glassCells=['C28','C29','C30','C31','D28','D29','D30','D31','E28','E29','E30','E31','I27','I28','I29','I30','I31','I32','J28','J30','J31','J32','J33','J34','K28','K31','K32']
  const bom=Array.from({length:28},(_,i)=>i+5).map(row=>{
    const frontRow=row<=18?row:row>=31?row-12:undefined
    const accessoryRow=row>=19&&row<=26?row+32:row===27?c.C21===1?undefined:57+c.C21:row===28?11+c.C22:row===29?28+c.C23:row===30?28+c.C24:undefined
    const frontMeta=frontRow===undefined?undefined:(FRONT_CATALOG.front as Record<string,{sku:string|null;description:string;unit:string;source:string}>)[String(frontRow)]
    const accessoryMeta=accessoryRow===undefined?undefined:(FRONT_CATALOG.accessories as Record<string,{description:string|null;unit:string;source:string}>)[String(accessoryRow)]
    if(accessoryRow!==undefined&&!accessoryMeta)throw new EngineError('LOOKUP_NOT_FOUND',`Accessory catalog selector for F1!M${row} is outside the source table`,{row,accessoryRow})
    return Object.freeze({row,sku:frontMeta?.sku??null,description:frontMeta?.description??accessoryMeta?.description??null,unit:frontMeta?.unit??accessoryMeta?.unit??'шт.',catalogRef:frontMeta?.source??accessoryMeta?.source??`F1!M${row}=0`,quantity:result(`Q${row}`),sourceFormula:FRONT_FORMULAS[`Q${row}` as keyof typeof FRONT_FORMULAS]??'0',traceStepId:id(`Q${row}`),status:row===23?'NOT_APPLICABLE' as const:'CALCULATED' as const,...(row===23?{diagnostic:'F1!Q23 is a literal zero in both original workbooks.'}:{})})
  })
  const cutPieces:FrontCutPiece[]=[]
  for(const row of [5,6,12,13,14])if(positive(result(`P${row}`))){
    const meta=bom[row-5]!
    for(const cell of (row===14?['H12','H13']:['H12','H13','H14']) as ('H12'|'H13'|'H14')[]){
      const lengthMm=result(cell)
      if(positive(lengthMm))cutPieces.push(Object.freeze({bomRow:row,sku:meta.sku,lengthMm,count:cell==='H14'?TWO:ONE,lengthCell:cell,allowanceSource:'Настройки!D8',stockRuleCell:`F1!Q${row}`}))
    }
  }
  const glassPieces=([28,29,30,31] as const).map(row=>Object.freeze({row,widthMm:result(`D${row}`),heightMm:result(`E${row}`),count:result(`C${row}`),sourceCells:Object.freeze([`F1!C${row}`,`F1!D${row}`,`F1!E${row}`])}))
  const selections=Object.freeze(Object.fromEntries(['D6','D7','D8','D11','D12','D13','D14','D15','D17','D20','I23'].map(cell=>[cell,graph.values[id(cell)] as string|number])))
  const trace:TraceStep[]=graph.trace.map(step=>{
    const position=bom.find(line=>line.traceStepId===step.id)
    return position?Object.freeze({...step,kind:'material' as const,catalogRefs:Object.freeze([...step.catalogRefs,{id:position.catalogRef,version:input.sourceSha256}])}):step
  })
  return Object.freeze({status:'COMPLETE',family:'FRONT',versions:Object.freeze({rules:VERSION,sourceSha256:input.sourceSha256.toLowerCase()}),selector:Object.freeze({mainF:7,mainG:7,calculationSheet:'F1',priceColumn:'X'}),selections,geometry:Object.freeze(Object.fromEntries(geometryCells.map(cell=>[cell,result(cell)]))),cut:Object.freeze({H12:result('H12'),H13:result('H13'),H14:result('H14')}),cutPieces:Object.freeze(cutPieces),glass:Object.freeze(Object.fromEntries(glassCells.map(cell=>[cell,result(cell)]))),glassPieces:Object.freeze(glassPieces),bom:Object.freeze(bom),consumables:Object.freeze({activatorPerConstruction:asR(graph.values['JV.FRONT.CONSUMABLE.L5'],'Клей+акт!L5'),adhesivePerConstruction:asR(graph.values['JV.FRONT.CONSUMABLE.L18'],'Клей+акт!L18')}),trace:Object.freeze(trace)})
}
