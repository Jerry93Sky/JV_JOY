import { EngineError } from '../errors.ts'
import { rationalFromDecimal } from '../rational.ts'
import { addDecimal, divideDecimalExact, multiplyDecimal, subtractDecimal } from '../decimal.ts'
import { traceStep } from '../trace.ts'
import type { DecimalString, SpecificationLine, TraceStep } from '../types.ts'
import type { ZigzagGeometryResult } from './geometry.ts'

const sources=[
 {row:5,catalogId:'LN-010',description:'Профиль несущий',unit:'m',formula:'=Z1!D20/1000+Настройки!D8/1000'},
 {row:9,catalogId:'LN-070-A',description:'Роликовая каретка высокая',unit:'piece',formula:'=(Z1!D5-1)*Z1!D6'},
 {row:10,catalogId:'LN-080',description:'Защёлка боковая',unit:'piece',formula:'=Z1!D5*Z1!D6'},
 {row:13,catalogId:'LN-120',description:'Поворотный узел нижний (комплект)',unit:'set',formula:'=Z1!D6'},
 {row:14,catalogId:'LN-130',description:'Поворотный узел верхний (комплект)',unit:'set',formula:'=Z1!D6'},
 {row:15,catalogId:'LN-150',description:'Пластина соединительная',unit:'piece',formula:'=1'},
 {row:16,catalogId:'LN-180',description:'Спейсер',unit:'piece',formula:'=Z1!N9'},
 {row:17,catalogId:'LN-TL',description:'Заглушка верхняя рядовая левая',unit:'piece',formula:'=0'},
 {row:18,catalogId:'LN-TR',description:'Заглушка верхняя рядовая правая',unit:'piece',formula:'=IF(Z1!D6=2,2,0)'},
 {row:19,catalogId:'LN-TF',description:'Заглушка верхняя боковая плоская',unit:'piece',formula:'=IF(Z1!D13="ДА",0,2)'},
 {row:27,catalogId:'LN-210',description:'Верхняя петля + 2 башмака + винты (комплект)',unit:'piece',formula:'=Z1!D5*Z1!D6-Z1!D6'},
 {row:28,catalogId:'LN-220',description:'Нижняя петля + 2 башмака + винты (комплект)',unit:'piece',formula:'=Z1!N27'},
 {row:32,catalogId:'AA-050',description:'Уплотнитель светопрозр. h-типа, 3 м',unit:'piece',formula:'=Z1!D6*Z1!D5-1'},
 {row:33,catalogId:'AA-070',description:'Уплотнитель светопрозр. D-типа, 3 м',unit:'piece',formula:'=2'},
 {row:8,catalogId:'LN-040',description:'Профиль боковой',unit:'m',formula:'=IF(Z1!D13="ДА",Z1!C21*Z1!D21/1000+Настройки!D8/1000,0)'},
] as const

export function calculateZigzagBaseMaterialQuantities(geometry: ZigzagGeometryResult): {specification: readonly SpecificationLine[]; trace: readonly TraceStep[]} {
 const leaves=rationalFromDecimal(String(geometry.inputs.normalizedSashCount)),openings=rationalFromDecimal(String(geometry.inputs.normalizedOpeningCount))
 const l=BigInt(leaves.numerator)/BigInt(leaves.denominator),o=BigInt(openings.numerator)/BigInt(openings.denominator)
 if(l<2n||o<1n||o>2n)throw new EngineError('INVALID_CONFIGURATION','Zigzag BOM requires supported Z1 D5>=2 and D6 in {1,2}')
 const quantityByRow:Record<number,string>={5:'0',8:'0',9:String((l-1n)*o),10:String(l*o),13:String(o),14:String(o),15:'1',16:String((l-1n)*o),17:'0',18:o===2n?'2':'0',19:geometry.inputs.framePresent?'0':'2',27:String((l-1n)*o),28:String((l-1n)*o),32:String(l*o-1n),33:'2'}
 const d8=geometry.inputs.settings.D8,p3=geometry.inputs.settings.P3
 if(!d8||!p3) throw new EngineError('MISSING_INPUT','Zigzag N5/N8 require source settings Настройки!D8 and Настройки!P3')
 quantityByRow[5]=divideDecimalExact(addDecimal(String(geometry.inputs.widthMm) as DecimalString,d8 as DecimalString),'1000' as DecimalString)
 if(geometry.inputs.framePresent){
  quantityByRow[8]=divideDecimalExact(addDecimal(multiplyDecimal(subtractDecimal(String(geometry.inputs.heightMm) as DecimalString,p3 as DecimalString),'2' as DecimalString),d8 as DecimalString),'1000' as DecimalString)
 }
 const trace:TraceStep[]=[]
 const specification=sources.map((source,index)=>{
  const id=`JV.ZIGZAG.Z1.N${source.row}`
  const quantity=quantityByRow[source.row]
  trace.push(traceStep({id,kind:'material',label:`Zigzag ${source.catalogId} quantity`,inputRefs:['Z1.D5','Z1.D6'],ruleId:`JV.ZIGZAG.BOM.N${source.row}`,source:{workbook:'JV-комплектация 08.10.2026.xlsm / JV-розница 08.10.2026.xlsm',sheet:'Z1',cell:`N${source.row}`,formula:source.formula},catalogRefs:[{id:`JV-ZIGZAG-BASE-BOM-2026-10-08`,version:'1'}],input:{D5:String(l),D6:String(o)},result:quantity,status:'ok',errorIds:[],warningIds:[]}))
  return {id,positionId:'zigzag',kind:'component' as const,catalogId:source.catalogId,description:source.description,quantity:{value:quantity as DecimalString,unit:source.unit},sourceTraceStepId:id}
 })
 return {specification,trace}
}
