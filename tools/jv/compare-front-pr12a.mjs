import {readFileSync,writeFileSync} from 'node:fs'
import {calculateFront} from '../../packages/shared/src/jv/front/calculator.ts'
import {rationalFromDecimal} from '../../packages/shared/src/jv/rational.ts'

const captures=JSON.parse(readFileSync(new URL('../../docs/jv/fixtures/front-pr12a-excel.json',import.meta.url),'utf8'))
const comparisons=[]
const inputFrom=(record)=>{
  const c=record.front,s=record.settings
  const val=a=>Number(c[a].value),setting=a=>String(s[a].value)
  return {workbook:record.workbook,sourceSha256:record.sourceSha256,systemSelector:7,widthMm:String(record.inputs.width),heightMm:String(record.inputs.height),sectionDemand:String(record.main.L11.value),finishSelector:Number(record.main.H11.value),glassSelector:Number(record.main.I11.value),openingSelector:Number(record.main.J11.value),controls:{C11:val('C11'),C12:val('C12'),C13:val('C13'),C14:val('C14'),C15:val('C15'),C18:val('C18'),C19:val('C19'),C20:val('C20'),C21:val('C21'),C22:val('C22'),C23:val('C23'),C24:val('C24'),D18:settingFromFront('D18'),D19:settingFromFront('D19')},settings:{D8:setting('D8'),S29:setting('S29'),S30:setting('S30'),S31:setting('S31'),S32:setting('S32'),S33:setting('S33'),S34:setting('S34'),L22:setting('L22'),L23:setting('L23'),H38:Number(s.H38.value),H40:Number(s.H40.value),H42:Number(s.H42.value),H44:Number(s.H44.value),I42:Number(s.I42.value),I44:Number(s.I44.value)}}
  function settingFromFront(a){return String(c[a].value)}
}
for(const record of captures.scenarios){
  let calculated
  try{calculated=calculateFront(inputFrom(record))}
  catch(error){comparisons.push({scenarioId:record.scenarioId,profile:record.profile,status:'MISMATCH',error:String(error)});continue}
  const outputs={...calculated.geometry,...calculated.cut,...calculated.glass,...Object.fromEntries(calculated.bom.map(p=>[`Q${p.row}`,p.quantity]))}
  const selectedByAddress=new Map()
  for(const [address,actual] of Object.entries(outputs))selectedByAddress.set(`F1!${address}`,{sheet:'F1',address,actual})
  for(const [address,actual] of Object.entries(calculated.selections))selectedByAddress.set(`F1!${address}`,{sheet:'F1',address,actual})
  for(const step of calculated.trace){
    const sheet=step.source?.sheet,address=step.source?.cell
    if((sheet==='F1'||sheet==='Главная')&&address&&(sheet==='F1'?record.front:record.main)[address])selectedByAddress.set(`${sheet}!${address}`,{sheet,address,actual:step.result})
  }
  const selected=[...selectedByAddress.values()]
  for(const {sheet,address,actual} of selected){
    const cell=(sheet==='F1'?record.front:record.main)[address],excel=cell?.value
    let status='UNVERIFIED'
    const rational=typeof actual==='object'&&actual!==null&&'numerator' in actual&&'denominator' in actual
    const actualNumber=rational?Number(actual.numerator)/Number(actual.denominator):null
    if(typeof excel==='string'&&typeof actual==='string')status=excel===actual?'EXACT':'MISMATCH'
    else if(typeof excel==='number'&&typeof actual==='number')status=Object.is(excel,actual)?'EXACT':'MISMATCH'
    else if(rational&&typeof excel==='number'&&Number.isFinite(excel)){
      try{const parsed=rationalFromDecimal(String(excel));if(parsed.numerator===actual.numerator&&parsed.denominator===actual.denominator)status='EXACT'}catch{}
      if(status!=='EXACT'){
        const digits=cell.numberFormat?.match(/\.(0+)/)?.[1].length??0
        status=Number(actualNumber.toFixed(digits))===Number(excel.toFixed(digits))?'DISPLAY_MATCH':'MISMATCH'
      }
    }
    comparisons.push({scenarioId:record.scenarioId,profile:record.profile,workbook:record.workbook,sourceSha256:record.sourceSha256,inputs:record.inputs,rawMainInputs:Object.fromEntries(['J11','L11','H11','I11'].map(k=>[k,record.main[k].value])),rawSettings:Object.fromEntries(['H38','H40','H42','H44','I42','I44'].map(k=>[k,record.settings[k].value])),selector:{mainF:7,mainG:record.main.G11.value,active:record.front.A3.value},address:`${sheet}!${address}`,formula:cell?.formula??null,excelValue:excel,excelNumberFormat:cell?.numberFormat??null,engineRational:rational?actual:null,engineValue:actual,engineNumber:actualNumber,trace:calculated.trace.find(x=>x.source?.sheet===sheet&&x.source?.cell===address)??null,status,...(status==='UNVERIFIED'?{reason:'Excel and engine result types are not comparable'}:{})})
  }
}
const counts=Object.fromEntries(['EXACT','NUMERICALLY_EQUIVALENT','DISPLAY_MATCH','MISMATCH','UNVERIFIED'].map(k=>[k,comparisons.filter(x=>x.status===k).length]))
const result={schemaVersion:'1.0',source:'Excel 16 CalculateFullRebuild on temporary copies of both original XLSM files',classification:{EXACT:'Excel Value2 decimal representation equals the exact rational, or text values match exactly',NUMERICALLY_EQUIVALENT:'Reserved for separately proven algebraic equality; not inferred from IEEE-754 coincidence',DISPLAY_MATCH:'Excel Value2 and exact rational display the same under source NumberFormat; internal values may differ',MISMATCH:'Source NumberFormat display or text differs',UNVERIFIED:'Unavailable or incomparable Excel value, with reason'},cases:captures.scenarios.length,comparisonCount:comparisons.length,counts,comparisons}
writeFileSync(new URL('../../docs/jv/FRONT_EXCEL_PARITY.json',import.meta.url),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({cases:result.cases,comparisonCount:result.comparisonCount,counts,mismatches:comparisons.filter(x=>x.status==='MISMATCH').slice(0,30)},null,2))
if(counts.MISMATCH)process.exitCode=1
