import { EngineError } from '../errors.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal, rationalToDecimalExact, roundRationalAwayFromZero, type ExactRational } from '../rational.ts'
import { traceStep } from '../trace.ts'
import type { DecimalString, SpecificationLine, TraceStep } from '../types.ts'
import type { ZigzagGeometryResult } from './geometry.ts'

export type ZigzagBomSource = { row:number; catalogId:string; description:string; unit:string; formula:string; refs:readonly string[]; kind:'material'|'component' }
export const zigzagBomSources:readonly ZigzagBomSource[]=[
 {row:5,catalogId:'LN-010',description:'Профиль несущий',unit:'m',formula:'=$D$20/1000+Настройки!$D$8/1000',refs:['Z1.D20','Настройки.D8'],kind:'material'},
 {row:6,catalogId:'LN-020',description:'Профиль створочный верхний',unit:'m',formula:'=($C$22*$D$22+$C$23*$D$23)/1000+Настройки!$D$6/1000',refs:['Z1.D5','Z1.D6','Z1.D29','Z1.D30','Настройки.D6','Настройки.P12','Настройки.P13','Настройки.P16','Настройки.P17','Настройки.L23'],kind:'material'},
 {row:7,catalogId:'LN-030',description:'Профиль створочный нижний',unit:'m',formula:'=$N$6',refs:['Z1.N6'],kind:'material'},
 {row:8,catalogId:'LN-040',description:'Профиль боковой',unit:'m',formula:'=IF(D13="ДА",C21*D21/1000+Настройки!D8/1000,0)',refs:['Z1.D13','Z1.C21','Z1.D21','Настройки.D8'],kind:'material'},
 {row:9,catalogId:'LN-060',description:'Роликовая каретка низкая',unit:'piece',formula:'=($D$5-1)*$D$6',refs:['Z1.D5','Z1.D6'],kind:'component'},
 {row:10,catalogId:'LN-080',description:'Защёлка боковая',unit:'piece',formula:'=$D$5*$D$6',refs:['Z1.D5','Z1.D6'],kind:'component'},
 {row:11,catalogId:'LN-100',description:'Ответная втулка защёлки',unit:'piece',formula:'=$N$10+IF($D$15="ДА",1,0)',refs:['Z1.N10','Z1.D15'],kind:'component'},
 {row:12,catalogId:'LN-110',description:'Ручка-кноб',unit:'piece',formula:'=IF($D$14="ДА",$D$6,0)',refs:['Z1.D14','Z1.D6'],kind:'component'},
 {row:13,catalogId:'LN-120',description:'Поворотный узел нижний (комплект)',unit:'set',formula:'=$D$6',refs:['Z1.D6'],kind:'component'},
 {row:14,catalogId:'LN-130',description:'Поворотный узел верхний (комплект)',unit:'set',formula:'=$D$6',refs:['Z1.D6'],kind:'component'},
 {row:15,catalogId:'LN-150',description:'Пластина соединительная',unit:'piece',formula:'=1',refs:[],kind:'component'},
 {row:16,catalogId:'LN-180',description:'Спейсер',unit:'piece',formula:'=$N$9',refs:['Z1.N9'],kind:'component'},
 {row:17,catalogId:'LN-TL',description:'Заглушка верхняя рядовая левая',unit:'piece',formula:'=0',refs:[],kind:'component'},
 {row:18,catalogId:'LN-TR',description:'Заглушка верхняя рядовая правая',unit:'piece',formula:'=IF($D$6=2,2,0)',refs:['Z1.D6'],kind:'component'},
 {row:19,catalogId:'LN-TF',description:'Заглушка верхняя боковая плоская',unit:'piece',formula:'=IF($D$13="ДА",0,2)',refs:['Z1.D13'],kind:'component'},
 {row:20,catalogId:'LN-TSL',description:'Заглушка верхняя боковая левая',unit:'piece',formula:'=IF($D$13="ДА",1,0)*$G$40',refs:['Z1.D13','Z1.G40','Z1.G37','Z1.G38','Z1.G39','Z1.H39','#3.N5:N10','#3.O5:O10'],kind:'component'},
 {row:21,catalogId:'LN-TSR',description:'Заглушка верхняя боковая правая',unit:'piece',formula:'=IF($D$13="ДА",1,0)*$G$41',refs:['Z1.D13','Z1.G41','Z1.G37','Z1.G38','Z1.G39','Z1.H39','#3.N5:N10','#3.P5:P10'],kind:'component'},
 {row:22,catalogId:'LN-BL',description:'Заглушка нижняя рядовая левая',unit:'piece',formula:'=$N$17',refs:['Z1.N17'],kind:'component'},
 {row:23,catalogId:'LN-BR',description:'Заглушка нижняя рядовая правая',unit:'piece',formula:'=$N$18',refs:['Z1.N18'],kind:'component'},
 {row:24,catalogId:'LN-BF',description:'Заглушка нижняя боковая плоская',unit:'piece',formula:'=$N$19',refs:['Z1.N19'],kind:'component'},
 {row:25,catalogId:'LN-BSL',description:'Заглушка нижняя боковая левая',unit:'piece',formula:'=$N$20',refs:['Z1.N20'],kind:'component'},
 {row:26,catalogId:'LN-BSR',description:'Заглушка нижняя боковая правая',unit:'piece',formula:'=$N$21',refs:['Z1.N21'],kind:'component'},
 {row:27,catalogId:'LN-210',description:'Верхняя петля + 2 башмака + винты (комплект)',unit:'piece',formula:'=$D$5*$D$6-$D$6',refs:['Z1.D5','Z1.D6'],kind:'component'},
 {row:28,catalogId:'LN-220',description:'Нижняя петля + 2 башмака + винты (комплект)',unit:'piece',formula:'=$N$27',refs:['Z1.N27'],kind:'component'},
 {row:29,catalogId:'LN-230',description:'Замок в пол (комплект)',unit:'piece',formula:'=IF($D$17="ДА",1,0)',refs:['Z1.D17'],kind:'component'},
 {row:30,catalogId:'AA-010',description:'Полосовая щётка, 1,6 м',unit:'piece',formula:'=ROUNDUP(2*$N$7/(Настройки!$L$7*Настройки!$P$21/1000),0)',refs:['Z1.N7','Настройки.L7','Настройки.P21'],kind:'material'},
 {row:31,catalogId:'AA-020',description:'Уплотнитель щёточный 7х12',unit:'m',formula:'=(2*$N$5+IF($D$16="ДА",2*$N$6,0)+IF($D$13="ДА",$N$8,0))/Настройки!$L$8',refs:['Z1.N5','Z1.N6','Z1.N8','Z1.D16','Z1.D13','Настройки.L8'],kind:'material'},
 {row:32,catalogId:'AA-050',description:'Уплотнитель светопрозр. h-типа, 3 м',unit:'piece',formula:'=$D$6*$D$5-1',refs:['Z1.D5','Z1.D6'],kind:'material'},
 {row:33,catalogId:'AA-070',description:'Уплотнитель светопрозр. D-типа, 3 м',unit:'piece',formula:'=2',refs:[],kind:'material'},
 {row:34,catalogId:'AA-110',description:'Активатор (50 мл) — расход одной конструкции',unit:'piece',formula:'=ROUNDUP(0.001*2*$D$3/Настройки!$L$4,IF(Настройки!$L$6,0,3))',refs:['Z1.D3','Настройки.L4','Настройки.L6'],kind:'material'},
 {row:35,catalogId:'AA-120',description:'Клей (упаковка) — расход одной конструкции',unit:'piece',formula:'=ROUNDUP(0.001*2*$D$3/Настройки!$L$5,IF(Настройки!$L$6,0,3))',refs:['Z1.D3','Настройки.L5','Настройки.L6'],kind:'material'},
]

const r=(value:string)=>rationalFromDecimal(value)
const add=(...values:ExactRational[])=>values.reduce(addRational,r('0'))
const mul=(...values:ExactRational[])=>values.reduce(multiplyRational,r('1'))
const div=(a:ExactRational,b:ExactRational)=>{if(BigInt(b.numerator)===0n)throw new EngineError('DIVISION_BY_ZERO','Zigzag BOM formula denominator is zero');return divideRational(a,b)}
const sub=(a:ExactRational,b:ExactRational)=>add(a,mul(r('-1'),b))
const source=(cell:string,formula:string)=>({workbook:'JV-комплектация 08.10.2026.xlsm / JV-розница 08.10.2026.xlsm',sheet:'Z1',cell,formula})
const lookupRows=[{key:11,left:'2',right:'0'},{key:12,left:'1',right:'1'},{key:21,left:'0',right:'2'},{key:22,left:'1',right:'1'},{key:31,left:'1',right:'1'},{key:32,left:'1',right:'1'}] as const
const need=(geometry:ZigzagGeometryResult,key:string):ExactRational=>{const value=geometry.inputs.settings[key as keyof typeof geometry.inputs.settings];if(value===undefined||typeof value==='boolean')throw new EngineError('MISSING_INPUT',`Zigzag BOM requires original Настройки!${key}`);try{return r(String(value))}catch{throw new EngineError('INVALID_DECIMAL',`Invalid Настройки!${key}: ${value}`)}}
const exactDecimal=(value:ExactRational)=>rationalToDecimalExact(value)

export function calculateZigzagBaseMaterialQuantities(geometry: ZigzagGeometryResult): {specification: readonly SpecificationLine[]; trace: readonly TraceStep[]; exactQuantities:Readonly<Record<number,ExactRational>>; intermediates:Readonly<Record<string,ExactRational>>; unsupportedRows:readonly number[]} {
 const leaves=BigInt(geometry.inputs.normalizedSashCount),openings=BigInt(geometry.inputs.normalizedOpeningCount)
 if(leaves<2n||openings<1n||openings>2n)throw new EngineError('INVALID_CONFIGURATION','Zigzag BOM requires supported Z1 D5>=2 and D6 in {1,2}')
 const d5=r(String(leaves)),d6=r(String(openings))
 const exact:Record<number,ExactRational>={
  9:r(String((leaves-1n)*openings)),10:r(String(leaves*openings)),13:d6,14:d6,15:r('1'),16:r(String((leaves-1n)*openings)),17:r('0'),18:r(openings===2n?'2':'0'),19:r(geometry.inputs.framePresent?'0':'2'),27:r(String((leaves-1n)*openings)),28:r(String((leaves-1n)*openings)),32:r(String(leaves*openings-1n)),33:r('2'),
 }
 const d8=geometry.inputs.settings.D8,p3=geometry.inputs.settings.P3
 if(!d8||!p3)throw new EngineError('MISSING_INPUT','Zigzag N5/N8 require source settings Настройки!D8 and Настройки!P3')
 exact[5]=div(add(r(geometry.inputs.widthMm),r(d8)) as ExactRational,r('1000'))
 exact[8]=geometry.inputs.framePresent?div(add(mul(sub(r(geometry.inputs.heightMm),r(p3)),r('2')),r(d8)),r('1000')):r('0')
 const switches=geometry.inputs.switches??{}
 if(switches.D14===undefined||switches.D15===undefined||switches.D16===undefined||switches.D17===undefined)throw new EngineError('MISSING_INPUT','Zigzag BOM N11/N12/N29/N31 require raw selector inputs for D14, D15, D16 and D17')
 exact[11]=r(String(leaves*openings+(switches.D15?1n:0n)));exact[12]=r(switches.D14?String(openings):'0');exact[29]=r(switches.D17?'1':'0')

 // Z1 C22/C23, D22/D23 and N6/N7, expanded from their actual Excel dependencies.
 const c22=d6,c23=sub(mul(d5,d6),c22),l23=need(geometry,'L23')
 const d22=add(geometry.outputs.D29,mul(r('2'),need(geometry,'P16')),mul(r('2'),need(geometry,'P17')),mul(r('-1'),need(geometry,'P12')),mul(r('-1'),need(geometry,'P13')),l23)
 const d23=add(geometry.outputs.D30,mul(r('2'),need(geometry,'P16')),mul(r('2'),need(geometry,'P17')),mul(r('-2'),need(geometry,'P13')),l23)
 exact[6]=add(div(add(mul(c22,d22),mul(c23,d23)),r('1000')),div(need(geometry,'D6'),r('1000')))
 exact[7]=exact[6]

 // G37/G38 -> G39 -> MATCH in #3!N5:N10 -> INDEX #3!O/P -> G40/G41.
 const openingSelector=geometry.inputs.openingSelector
 if(!Number.isInteger(openingSelector)||openingSelector<1||openingSelector>3)throw new EngineError('INVALID_CONFIGURATION','Zigzag accessory lookup requires Главная!J11 in 1..3')
 const lookupKey=10*openingSelector+(leaves%2n===0n?2:1)
 const lookup=lookupRows.find(row=>row.key===lookupKey)
 if(!lookup)throw new EngineError('LOOKUP_NOT_FOUND',`No #3!N5:N10 row matches Z1!G39=${lookupKey}`,{lookupKey})
 const frameFlag=geometry.inputs.framePresent
 const selectorMajor=r(String(openingSelector)),selectorParity=r(String(leaves%2n===0n?2:1)),lookupPosition=r(String(lookupRows.indexOf(lookup)+1))
 const intermediates:Record<string,ExactRational>={'C22':c22,'C23':c23,'D22':d22,'D23':d23,'G37':selectorMajor,'G38':selectorParity,'G39':r(String(lookupKey)),'H39':lookupPosition,'G40':r(lookup.left),'G41':r(lookup.right)}
 exact[20]=r(frameFlag?lookup.left:'0');exact[21]=r(frameFlag?lookup.right:'0')
 exact[22]=exact[17];exact[23]=exact[18];exact[24]=exact[19];exact[25]=exact[20];exact[26]=exact[21]
 // N30 ROUNDUP(...,0) and N31 seal consumption (no rounding in source formula).
 exact[30]=r(roundRationalAwayFromZero(div(mul(r('2'),exact[7]),mul(need(geometry,'L7'),div(need(geometry,'P21'),r('1000')))),0))
 exact[31]=div(add(mul(r('2'),exact[5]),switches.D16?mul(r('2'),exact[6]):r('0'),frameFlag?exact[8]:r('0')),need(geometry,'L8'))
 // N34/N35 are per-construction consumption. Whole-order package allocation remains an order-level rule.
 const wholeGlue=geometry.inputs.settings.L6
 if(typeof wholeGlue!=='boolean')throw new EngineError('MISSING_INPUT','Zigzag N34/N35 require boolean source setting Настройки!L6')
 for(const [row,setting] of [[34,'L4'],[35,'L5']] as const){const raw=div(mul(r('0.001'),r('2'),r(geometry.inputs.widthMm)),need(geometry,setting));const digits=wholeGlue?0:3;exact[row]=r(roundRationalAwayFromZero(raw,digits))}

 const byRow:Record<number,string>={};for(const [row,value] of Object.entries(exact)){const decimal=exactDecimal(value);if(decimal!==undefined)byRow[Number(row)]=decimal}
 const traces:TraceStep[]=[]
 const specification:SpecificationLine[]=[]
 for(const item of zigzagBomSources){
  const value=exact[item.row];if(!value)continue
  const decimal=byRow[item.row]
  const id=`JV.ZIGZAG.Z1.N${item.row}`
  const status='ok'
  const dependencyValues=Object.fromEntries(item.refs.map(ref=>{const match=/^Z1\.N(\d+)$/.exec(ref);if(match)return[ref,exact[Number(match[1])]??null];if(ref==='Z1.D13')return[ref,geometry.inputs.framePresent?'ДА':'НЕТ'];if(/^Z1\.D1[4567]$/.test(ref)){const cell=ref.slice(-3) as 'D14'|'D15'|'D16'|'D17';return[ref,geometry.inputs.switches?.[cell]===undefined?null:geometry.inputs.switches[cell]?'ДА':'НЕТ']}if(ref==='Z1.D5')return[ref,d5];if(ref==='Z1.D6')return[ref,d6];const geometryMatch=/^Z1\.(D29|D30|D31)$/.exec(ref);if(geometryMatch)return[ref,geometry.outputs[geometryMatch[1] as keyof typeof geometry.outputs]];const intermediate=ref.startsWith('Z1.')?intermediates[ref.slice(3)]:undefined;if(intermediate)return[ref,intermediate];const settingMatch=/^Настройки\.(.+)$/.exec(ref);if(settingMatch)return[ref,geometry.inputs.settings[settingMatch[1] as keyof typeof geometry.inputs.settings]??null];return[ref,ref.startsWith('#3.')?lookupRows:ref]}))
  traces.push(traceStep({id,kind:item.kind==='material'?'material':'component',label:`Zigzag ${item.catalogId} quantity`,inputRefs:item.refs,ruleId:`JV.ZIGZAG.BOM.N${item.row}`,source:source(`N${item.row}`,item.formula),catalogRefs:[{id:'JV-ZIGZAG-BASE-BOM-2026-10-08',version:'2'},{id:'JV-ZIGZAG-PRICE-LINE-2026-10-08',version:'source-workbook'},{id:'JV-ZIGZAG-LOOKUP-3-2026-10-08',version:'1'}],input:{formula:item.formula,dependencies:dependencyValues,exactResult:value,...(item.row===20||item.row===21?{lookupKey,lookupRow:`#3!${item.row===20?'O':'P'}${lookup.key}`}:{})},result:decimal??value,status,errorIds:[],warningIds:decimal===undefined?['NON_TERMINATING_DECIMAL_SERIALIZATION']:[]}))
  specification.push({id,positionId:'zigzag',kind:item.kind,catalogId:item.catalogId,description:item.description,...(decimal===undefined?{}:{quantity:{value:decimal as DecimalString,unit:item.unit}}),exactQuantity:value,sourceTraceStepId:id})
 }
 const supported=new Set(Object.keys(exact).map(Number))
 const unsupportedRows=Array.from({length:31},(_,index)=>index+5).filter(row=>row<=35&&!supported.has(row))
 return {specification,trace:traces,exactQuantities:Object.freeze(exact),intermediates:Object.freeze(intermediates),unsupportedRows:Object.freeze(unsupportedRows)}
}
