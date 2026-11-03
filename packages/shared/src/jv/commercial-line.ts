import { EngineError } from './errors.ts'
import { executeGraph } from './graph.ts'
import { addRational, multiplyRational, rationalFromDecimal, type ExactRational } from './rational.ts'

export interface LineCommercialResult {
  readonly status:'COMPLETE'|'PARTIAL'
  readonly q56:ExactRational
  readonly q58:ExactRational|'ОШИБКА !'
  readonly finalPriceAvailable:boolean
  readonly trace:ReturnType<typeof executeGraph>['trace']
}
function lessThanOrEqual(a:ExactRational,b:ExactRational){return BigInt(a.numerator)*BigInt(b.denominator)<=BigInt(b.numerator)*BigInt(a.denominator)}

/** Combines the sourced JV-Line Q52:Q58 final-price branch without currency rounding. */
export function calculateLineCommercial(input:{
  readonly workbook:string
  readonly q52:ExactRational
  readonly q53:ExactRational
  readonly q54:ExactRational
  readonly q55:ExactRational
  readonly q57:ExactRational
  readonly sideCount:string // L1!D6
  readonly direction:string // L1!D7, also tested against the Excel text error guard
  readonly commercialModeIndex:number // Главная!F28
  readonly priceC25:string // 'Прайс-сб+монт'!C25
  readonly systemAllocationFactor:ExactRational // L1!X5
  readonly componentsComplete:boolean
}):LineCommercialResult{
  if(!Number.isSafeInteger(input.commercialModeIndex))throw new EngineError('INVALID_CONFIGURATION','Главная!F28 must be an integer selector')
  const values={q52:input.q52,q53:input.q53,q54:input.q54,q55:input.q55,q57:input.q57,sideCount:rationalFromDecimal(input.sideCount),direction:input.direction,mode:input.commercialModeIndex,c25:rationalFromDecimal(input.priceC25),x5:input.systemAllocationFactor}
  const graph=executeGraph(values,[
    {id:'JV.LINE.COMMERCIAL.Q56',version:'JV-LINE-COMMERCIAL-2026-10-08',dependsOn:['q52','q53','q54','q55','mode','c25','x5'],source:{workbook:input.workbook,sheet:'L1',cell:'Q56',formula:"=SUM(Q52:Q55)+IF(Главная!$F$28=2,'Прайс-сб+монт'!$C$25*$X$5,0)"},execute:({inputs}:any)=>{let total=addRational(addRational(inputs.q52,inputs.q53),addRational(inputs.q54,inputs.q55));if(inputs.mode===2)total=addRational(total,multiplyRational(inputs.c25,inputs.x5));return total}},
    {id:'JV.LINE.COMMERCIAL.Q58',version:'JV-LINE-COMMERCIAL-2026-10-08',dependsOn:['q57','sideCount','direction','JV.LINE.COMMERCIAL.Q56'],source:{workbook:input.workbook,sheet:'L1',cell:'Q58',formula:'=IF(AND($D$6<=2,D7<>"ОШИБКА !"),SUM($Q$56:$Q$57),"ОШИБКА !")'},execute:({inputs,results}:any)=>lessThanOrEqual(inputs.sideCount,rationalFromDecimal('2'))&&inputs.direction!=='ОШИБКА !'?addRational(results['JV.LINE.COMMERCIAL.Q56'],inputs.q57):'ОШИБКА !'},
  ])
  const q58=graph.values['JV.LINE.COMMERCIAL.Q58'] as ExactRational|'ОШИБКА !'
  const finalPriceAvailable=input.componentsComplete&&typeof q58!=='string'
  return Object.freeze({status:finalPriceAvailable?'COMPLETE':'PARTIAL',q56:graph.values['JV.LINE.COMMERCIAL.Q56'] as ExactRational,q58,finalPriceAvailable,trace:graph.trace})
}
