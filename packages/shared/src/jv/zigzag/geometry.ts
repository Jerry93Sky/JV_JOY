import { EngineError } from '../errors.ts'
import { executeGraph, type CalculationRule } from '../graph.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal, rationalToDecimalExact, type ExactRational } from '../rational.ts'
import type { TraceStep } from '../types.ts'

export interface ZigzagGeometryInput {
  widthMm: string; heightMm: string; leafSelector: string; openingSelector: number
  frameSettingIndex: number; frameOverrideIndex: number; frameChoices: readonly ['ДА'|'НЕТ','ДА'|'НЕТ']
  settings: { P4: string; P24: string; P25: string; P26: string; P27: string; P28: string; P29: string; L23: string }
}
export interface ZigzagGeometryResult {
  status: 'PARTIAL'; family: 'ZIGZAG'; inputs: Readonly<Record<string, unknown>>
  outputs: Readonly<Record<'H4'|'H5'|'H6'|'H7'|'H8'|'H9'|'H13'|'H14'|'H15'|'H16'|'H17'|'H18'|'D29'|'D30'|'D31', ExactRational>>
  decimalOutputs: Readonly<Record<string, string | null>>; trace: readonly TraceStep[]
  unsupported: readonly string[]
}

const v=(x:string)=>rationalFromDecimal(x)
const add=(...xs:ExactRational[])=>xs.reduce(addRational,v('0'))
const sub=(a:ExactRational,b:ExactRational)=>add(a,multiplyRational(v('-1'),b))
const mul=(a:ExactRational,b:ExactRational)=>multiplyRational(a,b)
const half=(a:ExactRational)=>mul(a,v('0.5'))
const source=(cell:string,formula:string)=>({workbook:'JV-комплектация 08.10.2026.xlsm / JV-розница 08.10.2026.xlsm',sheet:'Z1',cell,formula})

export function calculateZigzagGeometry(input: ZigzagGeometryInput): ZigzagGeometryResult {
  const width=v(input.widthMm), height=v(input.heightMm), leaves=v(input.leafSelector)
  const leafN=BigInt(leaves.numerator), leafD=BigInt(leaves.denominator)
  if (leafN<=0n || width.numerator==='0' || height.numerator==='0') throw new EngineError('INVALID_CONFIGURATION','Zigzag dimensions and leaf selector must be positive')
  if (!Number.isInteger(input.openingSelector) || input.openingSelector<1) throw new EngineError('INVALID_CONFIGURATION','Main opening selector J must be a positive integer')
  const sashCount=(leafN+leafD-1n)/leafD
  if (sashCount<2n) throw new EngineError('INVALID_CONFIGURATION','Z1!D5 returns МАЛО! when Главная!M11 < 2')
  const openingCount=input.openingSelector<=2?1:input.openingSelector-1
  if (openingCount>2) throw new EngineError('INVALID_CONFIGURATION','Z1!D6 returns НЕТ when Главная!K11 > 2')
  const frameIndex=input.frameSettingIndex===3?input.frameOverrideIndex:input.frameSettingIndex
  if (!Number.isInteger(frameIndex)||frameIndex<1||frameIndex>2) throw new EngineError('INVALID_CONFIGURATION','Z1!D13 INDEX selection must be 1 or 2')
  const framePresent=input.frameChoices[frameIndex-1]==='ДА'
  for (const [key,value] of Object.entries(input.settings)) { try { v(value) } catch { throw new EngineError('INVALID_DECIMAL',`Invalid Zigzag setting Настройки!${key}: ${value}`) } }
  const rules:CalculationRule[]=[]
  const addRule=(id:string,deps:string[],cell:string,formula:string,run:(r:Readonly<Record<string,unknown>>)=>ExactRational)=>rules.push({id,version:'JV-ZIGZAG-GEOMETRY-2026-11-04-v1',dependsOn:deps,source:source(cell,formula),execute:({results})=>run(results)})
  const w=width, d5={numerator:String(sashCount),denominator:'1'} as ExactRational, d6={numerator:String(openingCount),denominator:'1'} as ExactRational
  rules.push({id:'Z1.D13',version:'JV-ZIGZAG-SETTINGS-2026-10-08-v1',dependsOn:['input'],source:source('D13','=IF(Настройки!I2=3,INDEX(\'#1\'!F3:F4,C13),INDEX(\'#1\'!F3:F4,Настройки!I2))'),execute:()=>framePresent?'ДА':'НЕТ'})
  addRule('Z1.H4',['Z1.D13'], 'H4','=D3-IF(D13="ДА",2*Настройки!P4,0)-Настройки!P25-Настройки!P26',r=>sub(sub(sub(w,r['Z1.D13']==='ДА'?mul(v('2'),v(input.settings.P4)):v('0')),v(input.settings.P25)),v(input.settings.P26)))
  addRule('Z1.H5',['input'],'H5','=2*D5-1',()=>sub(mul(v('2'),d5),v('1')))
  addRule('Z1.H6',['Z1.H4','Z1.H5'],'H6','=H4/H5',r=>divideRational(r['Z1.H4'] as ExactRational,r['Z1.H5'] as ExactRational))
  addRule('Z1.H7',['Z1.H6'],'H7','=H6-0.5*Настройки!P27+Настройки!P24',r=>add(sub(r['Z1.H6'] as ExactRational,half(v(input.settings.P27))),v(input.settings.P24)))
  addRule('Z1.H8',['Z1.H6'],'H8','=2*H6-Настройки!P27',r=>sub(mul(v('2'),r['Z1.H6'] as ExactRational),v(input.settings.P27)))
  addRule('Z1.H9',['Z1.H6'],'H9','=2*H6-0.5*Настройки!P27-Настройки!P29',r=>sub(sub(mul(v('2'),r['Z1.H6'] as ExactRational),half(v(input.settings.P27))),half(v(input.settings.P29))))
  addRule('Z1.H13',['Z1.D13'],'H13','=D3-IF(D13="ДА",2*Настройки!P4,0)-2*Настройки!P25',r=>sub(sub(w,r['Z1.D13']==='ДА'?mul(v('2'),v(input.settings.P4)):v('0')),mul(v('2'),v(input.settings.P25))))
  addRule('Z1.H14',['input'],'H14','=2*D5-1',()=>sub(mul(v('2'),d5),v('1')))
  addRule('Z1.H15',['Z1.H13','Z1.H14'],'H15','=0.5*H13/H14',r=>divideRational(half(r['Z1.H13'] as ExactRational),r['Z1.H14'] as ExactRational))
  addRule('Z1.H16',['Z1.H15'],'H16','=H15+Настройки!P24-0.5*Настройки!P27',r=>add(r['Z1.H15'] as ExactRational,sub(v(input.settings.P24),half(v(input.settings.P27)))))
  addRule('Z1.H17',['Z1.H15'],'H17','=2*H15-Настройки!P27',r=>sub(mul(v('2'),r['Z1.H15'] as ExactRational),v(input.settings.P27)))
  addRule('Z1.H18',['Z1.H15'],'H18','=2*H15-0.5*Настройки!P27-0.5*Настройки!P28',r=>sub(sub(mul(v('2'),r['Z1.H15'] as ExactRational),half(v(input.settings.P27))),half(v(input.settings.P28))))
  for (const [cell,h1,h2] of [['D29','Z1.H7','Z1.H16'],['D30','Z1.H8','Z1.H17'],['D31','Z1.H9','Z1.H18']] as const) addRule(`Z1.${cell}`,[h1,h2],'D'+cell.slice(1),`=IF(D6=1,${h1.slice(3)},0)+IF(D6=2,${h2.slice(3)},0)-Настройки!L23`,r=>sub(add(openingCount===1?r[h1] as ExactRational:v('0'),openingCount===2?r[h2] as ExactRational:v('0')),v(input.settings.L23)))
  const graph=executeGraph({input:true},rules)
  const ids=rules.map(x=>x.id).filter(id=>id!=='Z1.D13') as (keyof ZigzagGeometryResult['outputs'])[]
  const outputs=Object.fromEntries(ids.map(id=>[String(id).replace('Z1.',''),graph.values[id] as ExactRational])) as ZigzagGeometryResult['outputs']
  return {status:'PARTIAL',family:'ZIGZAG',inputs:{...input,normalizedSashCount:String(sashCount),normalizedOpeningCount:openingCount,framePresent},outputs,decimalOutputs:Object.fromEntries(Object.entries(outputs).map(([k,x])=>[k,rationalToDecimalExact(x)??null])),trace:graph.trace,unsupported:['Only the independently confirmed base BOM subset is implemented; other technology, cut and commercial lines remain unsupported.']}
}
