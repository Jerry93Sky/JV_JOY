import {readFileSync,writeFileSync} from 'node:fs'
import {calculateFront} from '../../packages/shared/src/jv/front/calculator.ts'
import {calculateFrontMaterialCosts} from '../../packages/shared/src/jv/front/material-pricing.ts'
import {rationalFromDecimal} from '../../packages/shared/src/jv/rational.ts'
const source=JSON.parse(readFileSync(new URL('../../docs/jv/fixtures/front-pr12a-excel.json',import.meta.url)))
const prices=JSON.parse(readFileSync(new URL('../../docs/jv/fixtures/front-material-price-snapshots.json',import.meta.url))).sources
const captures=JSON.parse(readFileSync(new URL('../../docs/jv/fixtures/front-material-price-parity.xlsx.json',import.meta.url))).records
const comparisons=[]
function calculate(r){const c=r.front,s=r.settings,v=a=>Number(c[a].value),st=a=>String(s[a].value);const bom=calculateFront({workbook:r.workbook,sourceSha256:r.sourceSha256,systemSelector:7,widthMm:String(r.inputs.width),heightMm:String(r.inputs.height),sectionDemand:String(r.main.L11.value),finishSelector:Number(r.main.H11.value),glassSelector:Number(r.main.I11.value),openingSelector:Number(r.main.J11.value),controls:{C11:v('C11'),C12:v('C12'),C13:v('C13'),C14:v('C14'),C15:v('C15'),C18:v('C18'),C19:v('C19'),C20:v('C20'),C21:v('C21'),C22:v('C22'),C23:v('C23'),C24:v('C24'),D18:String(c.D18.value),D19:String(c.D19.value)},settings:{D8:st('D8'),S29:st('S29'),S30:st('S30'),S31:st('S31'),S32:st('S32'),S33:st('S33'),S34:st('S34'),L22:st('L22'),L23:st('L23'),H38:Number(s.H38.value),H40:Number(s.H40.value),H42:Number(s.H42.value),H44:Number(s.H44.value),I42:Number(s.I42.value),I44:Number(s.I44.value)}});return calculateFrontMaterialCosts({bom,snapshot:prices.find(x=>x.profile===r.profile),controls:{C21:v('C21'),C22:v('C22'),C23:v('C23'),C24:v('C24')}})}
function compare(record,engineValue){let status='UNVERIFIED',rational=engineValue&&typeof engineValue==='object'&&'numerator'in engineValue;if(rational){const exact=rationalFromDecimal(String(record.value));status=exact.numerator===engineValue.numerator&&exact.denominator===engineValue.denominator?'EXACT':'DISPLAY_MATCH';if(status==='DISPLAY_MATCH'){const d=record.numberFormat?.match(/\.(0+)/)?.[1].length??0;const n=Number(engineValue.numerator)/Number(engineValue.denominator);if(n.toFixed(d)!==Number(record.value).toFixed(d))status='MISMATCH'}}else if(typeof engineValue==='number'&&engineValue===record.value)status='EXACT';comparisons.push({...record,engineRational:rational?engineValue:null,engineValue,status,trace:record.address.startsWith('F1!S')?`JV.FRONT.PRICE.${record.address.slice(4)}`:null})}
for(const r of source.scenarios.filter(x=>['base','wide','door_one'].some(id=>x.scenarioId.endsWith(`-${id}`)))){
 const result=calculate(r);for(const c of captures.filter(x=>x.scenarioId===r.scenarioId)){
  const m=/^F1!([RS])(\d+)$/.exec(c.address);if(m&&Number(m[2])<=32){const row=Number(m[2]),p=result.positions.find(x=>x.row===row);compare(c,m[1]==='R'?p?.unitPrice:p?.amount);continue}
  if(c.address==='F1!S33')compare(c,result.confirmedSubtotal)
  else if(c.address==='Настройки!D5')compare(c,rationalFromDecimal(String(c.d5)))
  else if(c.address==='Настройки!D14')compare(c,rationalFromDecimal(String(c.d14)))
 }
}
const counts=Object.fromEntries(['EXACT','NUMERICALLY_EQUIVALENT','DISPLAY_MATCH','MISMATCH','UNVERIFIED'].map(k=>[k,comparisons.filter(x=>x.status===k).length]))
const out={schemaVersion:'1.0',method:'Excel 16 CalculateFullRebuild on temporary copies; exact rational comparison, otherwise source NumberFormat display only',scenarioCount:new Set(captures.map(x=>x.scenarioId)).size,comparisonCount:comparisons.length,counts,comparisons}
writeFileSync(new URL('../../docs/jv/FRONT_MATERIAL_PRICE_PARITY.json',import.meta.url),JSON.stringify(out,null,2)+'\n')
console.log(JSON.stringify({scenarioCount:out.scenarioCount,comparisonCount:out.comparisonCount,counts,mismatches:comparisons.filter(x=>x.status==='MISMATCH').slice(0,10)},null,2));if(counts.MISMATCH)process.exitCode=1
