import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { calculateLineOrder } from '../../packages/shared/src/jv/order-line.ts'
import { multiplyRational, rationalToDecimalExact } from '../../packages/shared/src/jv/rational.ts'
import { compareRationalToExcelValue2 } from '../../packages/shared/src/jv/excel-number-parity.ts'

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const read=async p=>JSON.parse(await readFile(path.join(repo,p),'utf8'))
const [golden,commercial,price,glass,paint]=await Promise.all([
  read('docs/jv/fixtures/line-order-excel-golden.json'),read('docs/jv/fixtures/line-full-commercial-excel-golden.json'),read('docs/jv/fixtures/line-price-snapshots.json'),read('docs/jv/fixtures/line-glass-price-snapshots.json'),read('docs/jv/fixtures/line-paint-price-snapshots.json'),
])
function display2(value){const n=BigInt(value.numerator),d=BigInt(value.denominator),a=n<0n?-n:n,s=a*100n;let q=s/d;if((s%d)*2n>=d)q++;const t=q.toString().padStart(3,'0');return `${n<0n?'-':''}${t.slice(0,-2)}.${t.slice(-2)}`}
function displayByFormat(value,format){const match=/\.([0#]+)/.exec(format);if(!match||format.includes('%'))return undefined;const places=match[1].length,n=BigInt(value.numerator),d=BigInt(value.denominator),negative=n<0n,scale=10n**BigInt(places),scaled=(negative?-n:n)*scale;let rounded=scaled/d;if((scaled%d)*2n>=d)rounded++;const whole=rounded/scale,fraction=(rounded%scale).toString().padStart(places,'0');return `${negative&&rounded!==0n?'-':''}${whole}${places?'.'+fraction:''}`}
function compare(actual,excel){const exact=rationalToDecimalExact(actual);const expected=String(excel);if(exact===expected)return{classification:'EXACT',engine:exact,excel:expected};const engineDisplay=display2(actual),excelDisplay=display2FromNumber(excel);return engineDisplay===excelDisplay?{classification:'DISPLAY_MATCH',engine:exact??`${actual.numerator}/${actual.denominator}`,excel:expected,engineDisplay,excelDisplay}:{classification:'MISMATCH',engine:exact??`${actual.numerator}/${actual.denominator}`,excel:expected,engineDisplay,excelDisplay}}
function display2FromNumber(value){const rounded=Math.sign(value)*Math.round(Math.abs(value)*100);return (rounded/100).toFixed(2)}
const results=[]
for(const capture of golden.cases){
  const base=commercial.cases.find(x=>x.profile===capture.profile&&x.scenarioId==='line_single_no_park')
  const selector=capture.selectors
  const g=glass.sources.find(x=>x.profile===capture.profile)
  const positions=capture.inputs.map(item=>{
    const id=`slot-${item.slot}`
    const src={...base.input,constructionId:id,profile:capture.profile,workbook:capture.sourceWorkbook,constructionQuantity:String(item.quantity),widthMm:String(item.width),heightMm:String(item.height),finishSelectionIndex:Number(selector.finishIndex),glassSelectionIndex:Number(selector.glassIndex),commercialModeIndex:Number(selector.commercialModeIndex),assemblyEnabled:Boolean(selector.assembly),millingEnabled:Boolean(selector.milling),installationEnabled:Boolean(selector.installation)}
    return{id,slot:item.slot,family:'LINE',calculation:src}
  })
  const settings={...base.settings,P19:g.settings.P19,L17:g.settings.L17,L18:g.settings.L18,L21:/^(true|1)$/i.test(g.settings.L21),L22:g.settings.L22,D32:/^(true|1)$/i.test(g.settings.D32)}
  const order=calculateLineOrder({orderId:capture.scenarioId,positions,settings,priceSnapshot:price.sources.find(x=>x.profile===capture.profile),glassSnapshot:g,paintSnapshot:paint.sources.find(x=>x.profile===capture.profile)})
  const comparisons={}
  for(const key of ['Q52','Q53','Q54','Q55','Q56','Q57','Q58'])comparisons[key]=compare(order.totals[key],capture.orderTotals[key])
  const positionComparisons=capture.positions.map((excel,index)=>{
    const calculation=order.positions[index].calculation,engineX=calculation.glass.systemAllocationFactor,excelX=excel.cells.X5
    const exact=rationalToDecimalExact(engineX)
    const xValueClass=compareRationalToExcelValue2(engineX,Number(excelX)),xDisplay=displayByFormat(engineX,excel.X5NumberFormat)
    const xClass=xValueClass==='MISMATCH'&&xDisplay===excel.X5Text?'DISPLAY_MATCH':xValueClass
    const glueValueClass=compareRationalToExcelValue2(calculation.adhesiveFactors.O5,Number(capture.glue.O5)),glueDisplay=displayByFormat(calculation.adhesiveFactors.O5,capture.glue.O5NumberFormat)
    const glueClass=glueValueClass==='MISMATCH'&&glueDisplay===capture.glue.O5Text?'DISPLAY_MATCH':glueValueClass
    return{slot:excel.slot,X5:{classification:xClass,engine:exact??`${engineX.numerator}/${engineX.denominator}`,excel:String(excelX),numberFormat:excel.X5NumberFormat,excelDisplay:excel.X5Text,engineDisplay:xDisplay,comparison:'Exact rational compared to COM Value2 without tolerance; when binary Excel operation order differs, displayed value is compared using captured NumberFormat/Text.'},adhesiveO5:{classification:glueClass,engine:rationalToDecimalExact(calculation.adhesiveFactors.O5)??`${calculation.adhesiveFactors.O5.numerator}/${calculation.adhesiveFactors.O5.denominator}`,excel:String(capture.glue.O5),numberFormat:capture.glue.O5NumberFormat,excelDisplay:capture.glue.O5Text,engineDisplay:glueDisplay,comparison:'Exact rational compared to COM Value2 without tolerance; display is compared using captured NumberFormat/Text.'}}
  })
  const activatorPackages=multiplyRational(order.sharedRules.totalActivatorConsumption,order.sharedRules.adhesiveFactors.O5),adhesivePackages=multiplyRational(order.sharedRules.totalAdhesiveConsumption,order.sharedRules.adhesiveFactors.O18)
  const packageCount=(rational,excel)=>({classification:rationalToDecimalExact(rational)===String(excel)?'EXACT':'MISMATCH',engine:rationalToDecimalExact(rational)??`${rational.numerator}/${rational.denominator}`,excel:String(excel)})
  results.push({scenarioId:capture.scenarioId,profile:capture.profile,sourceWorkbook:capture.sourceWorkbook,sourceSha256:capture.sourceSha256,excelVersion:capture.excelVersion,engineStatus:order.status,inputs:capture.inputs,comparisons,sharedPackageCounts:{activator:packageCount(activatorPackages,capture.glue.N12),adhesive:packageCount(adhesivePackages,capture.glue.N25)},positionComparisons})
}
const counts={EXACT:0,DISPLAY_MATCH:0,NUMERICALLY_EQUIVALENT:0,MISMATCH:0,UNVERIFIED:0}
for(const c of results){for(const v of Object.values(c.comparisons))counts[v.classification]++;for(const v of Object.values(c.sharedPackageCounts))counts[v.classification]++;for(const p of c.positionComparisons){counts[p.X5.classification]++;counts[p.adhesiveO5.classification]++}}
const output={schemaVersion:1,method:'Excel 16 CalculateFullRebuild on temporary workbook copies; the engine receives raw Main selectors/dimensions/quantities and versioned price/settings snapshots, never Excel formula outputs.',scope:'Two supported JV-Line slots; separate single-slot quantities 1 and 3; both COMPLETATION and RETAIL books. Mixed-family order total remains unsupported.',counts,cases:results}
await writeFile(path.join(repo,'docs/jv/ORDER_EXCEL_PARITY.json'),JSON.stringify(output,null,2)+'\n','utf8')
console.log(JSON.stringify({cases:results.length,counts},null,2))
