import {readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {calculateJVOrder} from '../../packages/shared/src/jv/unified-order.ts'
import {findUnifiedInputMismatches} from '../../packages/shared/src/jv/unified-order-input-compatibility.ts'
import {rationalFromDecimal} from '../../packages/shared/src/jv/rational.ts'
import {multiplyRational} from '../../packages/shared/src/jv/rational.ts'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const manifest=JSON.parse(await readFile(path.join(root,'docs/jv/fixtures/unified-order-all-seven-f28-2-inputs.json'),'utf8'))
const captures=JSON.parse(await readFile(path.join(root,'docs/jv/fixtures/unified-order-all-seven-f28-2-excel.json'),'utf8'))
const captureById=new Map(captures.map(item=>[item.scenarioId,item]))
const counts={EXACT:0,NUMERICALLY_EQUIVALENT:0,DISPLAY_MATCH:0,MISMATCH:0,UNVERIFIED:0}
const aa18Counts={EXACT:0,NUMERICALLY_EQUIVALENT:0,DISPLAY_MATCH:0,MISMATCH:0,UNVERIFIED:0}
const intermediateCounts={EXACT:0,NUMERICALLY_EQUIVALENT:0,DISPLAY_MATCH:0,MISMATCH:0,UNVERIFIED:0}
const cases=[]
function rationalEqual(a,b){return BigInt(a.numerator)*BigInt(b.denominator)===BigInt(b.numerator)*BigInt(a.denominator)}
function compareValue(engine,excelValue,excelText=null,numberFormat=null){
 if(engine===undefined||engine===null||excelValue===undefined||excelValue===null||typeof excelValue!=='number'||!Number.isFinite(excelValue))return {status:'UNVERIFIED',reason:'A finite numeric value is not available on both sides.'}
 const bytes=new ArrayBuffer(8); const view=new DataView(bytes); view.setFloat64(0,excelValue); const bits=view.getBigUint64(0); const negative=(bits>>63n)!==0n; const exponent=Number((bits>>52n)&2047n); const fraction=bits&((1n<<52n)-1n); const mantissa=exponent===0?fraction:(1n<<52n)|fraction; const shift=(exponent===0?-1022:exponent-1023)-52; const binary={numerator:((negative?-mantissa:mantissa) << BigInt(Math.max(shift,0))).toString(),denominator:(1n << BigInt(Math.max(-shift,0))).toString()};
 if(rationalEqual(engine,binary))return {status:'EXACT',reason:'Exact rational equals the IEEE-754 binary64 Excel Value2.'}
 const engineBinary64=Number(engine.numerator)/Number(engine.denominator)
 if(Number.isFinite(engineBinary64)&&Object.is(engineBinary64,excelValue))return {status:'NUMERICALLY_EQUIVALENT',reason:'Exact IEEE-754 binary64 values are identical; no tolerance is applied.'}
 if(typeof numberFormat==='string'&&typeof excelText==='string'){
  const decimals=numberFormat.match(/[.,](0+)/)?.[1].length??0
  const grouped=numberFormat.includes('##0')
  let rendered=new Intl.NumberFormat('en-US',{maximumFractionDigits:decimals,minimumFractionDigits:decimals,useGrouping:grouped}).format(engineBinary64)
  if(grouped&&numberFormat.includes(' '))rendered=rendered.replace(/,/g,' ')
  const normalize=value=>value.replace(/[\s\u00a0\u202f]/g,'')
  if(normalize(rendered)===normalize(excelText))return {status:'DISPLAY_MATCH',engineText:rendered,reason:`Exact numeric values differ, but both render identically under the captured Excel NumberFormat ${numberFormat}; this is display parity only.`}
 }
 return {status:'MISMATCH',reason:'Engine and Excel numeric results differ exactly; no tolerance is applied.'}
}
function valueMap(trace){return new Map(trace.filter(step=>step.ruleId==='JV.UNIFIED.MAIN.PRICE-2026-11-08-v2').map(step=>[`${step.source.sheet}!${step.source.cell}`,{amount:step.result.extendedPrice,sourceAmount:step.input.sourceAmount,sourceCell:step.input.sourceCell,formula:step.source.formula,traceStepId:step.id}]))}
for(const scenario of manifest.scenarios){
 const excel=captureById.get(scenario.scenarioId)
 if(!excel)throw new Error(`Missing Excel capture: ${scenario.scenarioId}`)
 const inputCells=excel.inputCells.map(cell=>({scenarioId:scenario.scenarioId,family:cell.family??'ORDER',sheet:cell.sheet,address:cell.address,expected:cell.expected,actual:cell.actual,source:cell.source}))
 const inputMismatches=findUnifiedInputMismatches(inputCells)
 const inputCompatible=inputMismatches.length===0
 let engine=null,comparisons=[],aa18,traceSummary=null,intermediateComparisons=[]
 let blockedReason=null
 if(inputCompatible){try{engine=calculateJVOrder({...scenario.engineInput,frontSlot7B26:{schemaVersion:'1.0',sourceCell:'Главная!B26',workbook:scenario.workbook,workbookSha256:scenario.sourceSha256,value:scenario.orderSettings.frontMainSurchargeSelector,version:'JV-PR13E-B26-SCENARIO-1',sourceScenarioId:scenario.scenarioId}})}catch(error){if(error?.code!=='RULE_UNCONFIRMED')throw error;blockedReason=error.message}}
 if(inputCompatible && engine){
  const rowValues=valueMap(engine.trace)
  for(let slot=1;slot<=7;slot++){
   const address=`AA${10+slot}`,cell=excel.slots.find(x=>x.slot===slot)?.main.extendedPrice,engineRow=rowValues.get(`Главная!${address}`)
   const result=compareValue(engineRow?.amount,cell?.value2,cell?.text,cell?.numberFormat)
   counts[result.status]++
   comparisons.push({slot,family:scenario.engineInput.positions.find(x=>x.slot===slot)?.family,address:`Главная!${address}`,formula:cell?.formula??null,excelValue2:cell?.value2??null,excelText:cell?.text??null,numberFormat:cell?.numberFormat??null,engineRational:engineRow?.amount??null,engineTraceStepId:engineRow?.traceStepId??null,status:result.status,reason:result.reason})
  }
  for(let slot=1;slot<=7;slot++){
   const excelSlot=excel.slots.find(x=>x.slot===slot),engineRow=rowValues.get(`Главная!AA${10+slot}`),sourceCell=excelSlot?.main.unitPriceSource
   const result=compareValue(engineRow?.sourceAmount,sourceCell?.value2,sourceCell?.text,sourceCell?.numberFormat)
   intermediateCounts[result.status]++
   intermediateComparisons.push({kind:'family-source-price',slot,family:excelSlot?.family,excelAddress:engineRow?.sourceCell??null,formula:sourceCell?.formula??null,excelValue2:sourceCell?.value2??null,engineRational:engineRow?.sourceAmount??null,status:result.status,reason:result.reason})
  }
  const allocationByPosition=new Map(engine.sharedResources?.systemAllocations.map(x=>[x.positionId,x.W])??[])
  for(let slot=1;slot<=7;slot++){
   const position=scenario.engineInput.positions.find(x=>x.slot===slot),excelShare=excel.areaShares[`AB${24+slot}`],engineShare=allocationByPosition.get(position.id),result=compareValue(engineShare,excelShare?.value2,excelShare?.text,excelShare?.numberFormat)
   intermediateCounts[result.status]++
   intermediateComparisons.push({kind:'weighted-area-share',slot,family:position.family,excelAddress:`ПРМ!AB${24+slot}`,formula:excelShare?.formula??null,excelValue2:excelShare?.value2??null,engineRational:engineShare??null,status:result.status,reason:result.reason})
  }
  const factors=engine.sharedResources?.adhesiveFactors
  for(const [name,engineValue,excelCell] of [['activator-packages',engine.sharedResources?.activatorPackages,'N12'],['adhesive-packages',engine.sharedResources?.adhesivePackages,'N25'],['activator-distribution-factor',factors?.O5,'O5'],['adhesive-distribution-factor',factors?.O18,'O18']]){
   const cell=excel.sharedConsumables[excelCell],result=compareValue(engineValue,cell?.value2,cell?.text,cell?.numberFormat);intermediateCounts[result.status]++
   intermediateComparisons.push({kind:name,excelAddress:`Клей+акт!${excelCell}`,formula:cell?.formula??null,excelValue2:cell?.value2??null,engineRational:engineValue??null,status:result.status,reason:result.reason})
  }
  const sum=engine.trace.filter(step=>step.ruleId==='JV.UNIFIED.MAIN.PRICE-2026-11-08-v2').reduce((v,step)=>({numerator:(BigInt(v.numerator)*BigInt(step.result.extendedPrice.denominator)+BigInt(step.result.extendedPrice.numerator)*BigInt(v.denominator)).toString(),denominator:(BigInt(v.denominator)*BigInt(step.result.extendedPrice.denominator)).toString()}),{numerator:'0',denominator:'1'})
  const engineTotal=engine.totalSalePrice
  const sumMatchesTotal=Boolean(engineTotal&&rationalEqual(sum,engineTotal))
  const result=compareValue(engineTotal,excel.AA18.value2,excel.AA18.text,excel.AA18.numberFormat);aa18Counts[result.status]++
  aa18={address:'Главная!AA18',formula:excel.AA18.formula,excelValue2:excel.AA18.value2,excelText:excel.AA18.text,numberFormat:excel.AA18.numberFormat,engineRational:engineTotal??null,status:result.status,reason:result.reason,engineSevenRowsSum:sum,sumMatchesEngineRows:sumMatchesTotal,excelSevenRowsSum:excel.AA11toAA17.reduce((s,c)=>s+(typeof c.value2==='number'?c.value2:0),0),excelTotalMatchesExcelRows:excel.AA18.value2===excel.AA11toAA17.reduce((s,c)=>s+(typeof c.value2==='number'?c.value2:0),0)}
  traceSummary={calculationStatus:engine.status,positionCount:engine.positions.length,traceSteps:engine.trace.length,traceByMainCell:comparisons.map(x=>({cell:x.address,traceStepId:x.engineTraceStepId,formula:x.formula})),sharedResourceStatus:engine.sharedResources?.status,sharedResourceTraceSteps:engine.sharedResources?.trace.length,sharedActivatorPackages:engine.sharedResources?.activatorPackages??null,sharedAdhesivePackages:engine.sharedResources?.adhesivePackages??null,sharedActivatorConsumption:engine.sharedResources?.totalActivatorConsumption??null,sharedAdhesiveConsumption:engine.sharedResources?.totalAdhesiveConsumption??null}
 } else {
  comparisons=Array.from({length:7},(_,i)=>({slot:i+1,address:`Главная!AA${11+i}`,engineRational:null,excelValue2:excel.AA11toAA17[i]?.value2??null,status:'UNVERIFIED',reason:blockedReason ?? 'Commercial comparison skipped because required primary input cells differ.'}))
  aa18={address:'Главная!AA18',excelValue2:excel.AA18.value2,engineRational:null,status:'UNVERIFIED',reason:blockedReason ?? 'Commercial comparison skipped because required primary input cells differ.'}
  for(let i=0;i<7;i++)counts.UNVERIFIED++;aa18Counts.UNVERIFIED++
 }
 cases.push({scenarioId:scenario.scenarioId,profile:scenario.profile,workbook:scenario.workbook,sourceSha256:scenario.sourceSha256,excelVersion:excel.excelVersion,calculationMode:excel.calculationMode,excelScenarioValid:excel.AA18.formula==='=SUM(AA11:AA17)'&&excel.AA11toAA17.length===7,inputCompatibility:{status:inputCompatible?'MATCH':'BLOCKED',checkedCells:inputCells.length,mismatches:inputMismatches},primaryInputs:scenario.primaryInputWrites,excel:{AA11toAA17:comparisons,AA18:aa18,sharedConsumables:excel.sharedConsumables,areaShares:excel.areaShares,frontSlot7:excel.frontSlot7,sourcePrices:excel.slots.map(s=>({slot:s.slot,family:s.family,formula:s.main.unitPriceSource.formula,value2:s.main.unitPriceSource.value2,text:s.main.unitPriceSource.text}))},engine:engine?{status:engine.status,orderTotal:engine.totalSalePrice??null,positionStatuses:engine.positions.map(p=>({slot:p.slot,family:p.family,status:p.status})),trace:traceSummary,limitations:engine.limitations}: {status:'UNVERIFIED',orderTotal:null},intermediateComparisons,validForExcel:excel.AA18.formula==='=SUM(AA11:AA17)'})
}
const out={schemaVersion:'1.1',purpose:'PR_15A R1 F28=2 manifest-driven all-seven Excel / JV Engine parity. Excel values are outputs only, never engine inputs.',method:'12 F28=2 primary-input scenarios (six per profile), 84 positions total. Each scenario primaryInputWrites was applied to a fresh temporary copy of the matching original XLSM and recalculated by Excel 16 CalculateFullRebuild. calculateJVOrder received the same manifest engineInput.',manifest:'docs/jv/fixtures/unified-order-all-seven-f28-2-inputs.json',capture:'docs/jv/fixtures/unified-order-all-seven-f28-2-excel.json',minimumScenarioCount:12,scenarioCount:cases.length,validExcelScenarioCount:cases.filter(x=>x.excelScenarioValid).length,inputCompatibleScenarioCount:cases.filter(x=>x.inputCompatibility.status==='MATCH').length,profiles:{COMPLETATION:cases.filter(x=>x.profile==='COMPLETATION').length,RETAIL:cases.filter(x=>x.profile==='RETAIL').length},comparisonCount:cases.reduce((n,x)=>n+x.excel.AA11toAA17.length+1,0),comparisonCounts:counts,aa18Counts,intermediateComparisonCount:cases.reduce((n,x)=>n+x.intermediateComparisons.length,0),intermediateComparisonCounts:intermediateCounts,unresolvedBlocker:cases.some(x=>x.engine.status==='UNVERIFIED')?'Front slot 7 F28=2 is blocked pending source-bound Main B26.':cases.some(x=>x.inputCompatibility.status!=='MATCH')?'Some primary inputs differ; commercial parity was skipped for affected scenarios.':(counts.MISMATCH||aa18Counts.MISMATCH)?'All primary inputs match, but exact/display output mismatches remain; see case records.':'All 96 total-price comparisons have a declared exact, numeric, or display-only parity result; display-only results do not prove exact numeric equivalence.',cases}
await writeFile(path.join(root,'docs/jv/JV_UI_F28_PARITY.json'),JSON.stringify(out,null,2)+'\n','utf8')
console.log(JSON.stringify({scenarios:out.scenarioCount,inputCompatible:out.inputCompatibleScenarioCount,comparisons:out.comparisonCount,counts,aa18Counts,engineStatuses:cases.map(c=>[c.scenarioId,c.engine.status,c.inputCompatibility.status])},null,2))
if(counts.MISMATCH||counts.UNVERIFIED||aa18Counts.MISMATCH||aa18Counts.UNVERIFIED||out.inputCompatibleScenarioCount!==out.scenarioCount)process.exitCode=1
