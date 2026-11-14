import { readFile, writeFile } from 'node:fs/promises'
import { calculateMixedOrder } from '../../packages/shared/src/jv/mixed-order.ts'
import { addRational, divideRational, multiplyRational, rationalFromDecimal } from '../../packages/shared/src/jv/rational.ts'

const [capturePath='docs/jv/fixtures/mixed-order-pr10h-excel.json',outputPath='docs/jv/MIXED_ORDER_EXCEL_PARITY.json']=process.argv.slice(2)
const [capture,lineCommercial,linePrices,glassPrices,paintPrices,zigPrices]=await Promise.all([
  capturePath,'docs/jv/fixtures/line-full-commercial-excel-golden.json','docs/jv/fixtures/line-price-snapshots.json','docs/jv/fixtures/line-glass-price-snapshots.json','docs/jv/fixtures/line-paint-price-snapshots.json','docs/jv/fixtures/zigzag-price-snapshots.json',
].map(async path=>JSON.parse(await readFile(path,'utf8'))))
const zigSettings={P4:'14',P24:'42',P25:'51',P26:'6.5',P27:'5.7',P28:'5',P29:'2.5',L23:'0',D8:'50',P3:'58',D6:'100',L4:'18',L5:'18',L6:false,L7:'0.95',L8:'0.95',P12:'17',P13:'6',P16:'2',P17:'0.5',P21:'1600'}
const zigSwitches={D14:{settingIndex:1,overrideIndex:1,choices:['ДА','НЕТ']},D15:{settingIndex:1,overrideIndex:1,choices:['ДА','НЕТ']},D16:{settingIndex:2,overrideIndex:1,choices:['ДА','НЕТ']},D17:{settingIndex:2,overrideIndex:1,choices:['ДА','НЕТ']}}
const inputsByCase=new Map(),comparisons=[],scenarios=[]
const bool=value=>/^(1|true|да)$/i.test(String(value))
function binary64Rational(hex){if(!hex)return undefined;const bits=BigInt(`0x${hex}`),sign=bits>>63n?-1n:1n,exponent=Number((bits>>52n)&0x7ffn),fraction=bits&((1n<<52n)-1n);if(exponent===0x7ff)return undefined;if(exponent===0&&fraction===0n)return {numerator:'0',denominator:'1'};const mantissa=exponent===0?fraction:(1n<<52n)+fraction,power=exponent===0?-1074:exponent-1023-52;return power>=0?{numerator:String(sign*(mantissa<<BigInt(power))),denominator:'1'}:{numerator:String(sign*mantissa),denominator:String(1n<<BigInt(-power))}}
function same(a,b){return BigInt(a.numerator)*BigInt(b.denominator)===BigInt(b.numerator)*BigInt(a.denominator)}
function numberBits(value){const n=Number(value.numerator)/Number(value.denominator);return Buffer.from(new Float64Array([n]).buffer).readBigUInt64LE().toString(16).padStart(16,'0').toUpperCase()}
function format(value,places){const n=BigInt(value.numerator),d=BigInt(value.denominator),scale=10n**BigInt(places),abs=n<0n?-n:n,scaled=abs*scale;let q=scaled/d;if((scaled%d)*2n>=d)q++;let text=q.toString().padStart(places+1,'0');if(places)text=`${text.slice(0,-places)}.${text.slice(-places)}`;const[whole,fraction='']=text.split('.');return `${n<0n?'-':''}${whole.replace(/\B(?=(\d{3})+(?!\d))/g,' ')}${places?`,${fraction}`:''}`}
function normalize(value){return String(value??'').replace(/[\s\u00a0\u202f]/g,'').replace(',','.')}
function places(cell){const formatCode=String(cell?.numberFormat??'');const decimals=/[.,](0+|#+)/.exec(formatCode)?.[1];if(decimals)return decimals.length;if(formatCode&&formatCode.toLowerCase()!=='general')return 0;return /[.,](\d+)/.exec(cell?.displayedText??'')?.[1].length??(/[.,](\d+)/.exec(String(cell?.value??''))?.[1].length??0)}
function classify(value,cell){
 if(value===undefined||value===null)return 'UNVERIFIED'
 if(typeof value==='string')return String(cell?.value??'')===value?'EXACT':'MISMATCH'
 const bits=binary64Rational(cell?.binary64)
 if(bits&&same(value,bits))return 'EXACT'
 if(cell?.binary64&&numberBits(value)===String(cell.binary64).toUpperCase())return 'NUMERICALLY_EQUIVALENT'
 if(cell?.value!=null&&cell?.numberFormat){const excelText=cell.displayedText||format(rationalFromDecimal(String(cell.value)),places(cell));if(normalize(format(value,places(cell)))===normalize(excelText))return 'DISPLAY_MATCH'}
 return 'MISMATCH'
}
function recordComparison(record,address,cell,value,traceStepIds=[],reason){const classification=classify(value,cell);comparisons.push({profile:record.profile,scenarioId:record.scenarioId,sourceCell:address,formula:cell?.formula??null,excelValue2:cell?.value??null,excelBinary64:cell?.binary64??null,numberFormat:cell?.numberFormat??null,excelDisplayed:cell?.displayedText??null,engineExactRational:value??null,classification,traceStepIds,...(reason?{reason}:{})});return classification}
function makeInput(record){
 const profile=record.profile,lineBase=lineCommercial.cases.find(x=>x.profile===profile&&x.scenarioId==='line_single_no_park'),lineSnapshot=linePrices.sources.find(x=>x.profile===profile),glassSnapshot=glassPrices.sources.find(x=>x.profile===profile),paintSnapshot=paintPrices.sources.find(x=>x.profile===profile),zigSnapshot=zigPrices.sources.find(x=>x.profile===profile)
 if(!lineBase||!lineSnapshot||!glassSnapshot||!paintSnapshot||!zigSnapshot)throw new Error(`Incomplete profile snapshots for ${profile}`)
 const lineSettings={...lineBase.settings,P19:glassSnapshot.settings.P19,L17:glassSnapshot.settings.L17,L18:glassSnapshot.settings.L18,L21:bool(glassSnapshot.settings.L21),L22:glassSnapshot.settings.L22,D32:bool(record.settings.D32.value)}
 const positions=record.positions.map(item=>{
  if(item.family==='LINE'){
   const base=lineBase.input,main=item.main
   const calculation={...base,constructionId:item.id,constructionQuantity:String(item.quantity),widthMm:String(item.widthMm),heightMm:String(item.heightMm),leaves:String(main.L.value),mainLeavesSelector:String(main.L.value),sideCount:String(main.K.value),direction:main.J.value==='1'?'НАЛЕВО':main.J.value==='2'?'НАПРАВО':'ДВУХСТОР',glassSelectionIndex:Number(main.I.value),finishSelectionIndex:Number(main.H.value),commercialModeIndex:Number(record.orderSettings.F28.value),profile,workbook:lineSnapshot.workbook,assemblyEnabled:bool(record.settings.D33.value),millingEnabled:bool(record.settings.L3.value),installationEnabled:bool(record.settings.D34.value)}
   return {id:item.id,slot:item.slot,family:'LINE',calculation}
  }
  const geometry={widthMm:String(item.widthMm),heightMm:String(item.heightMm),leafSelector:String(item.main.L.value),openingSelector:Number(item.main.J.value),frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'],settings:zigSettings,switches:zigSwitches}
  return {id:item.id,slot:item.slot,family:'ZIGZAG',quantity:String(item.quantity),geometry,commercial:{c8:String(item.main.H.value),F28:Number(record.orderSettings.F28.value),D32:bool(record.settings.D32.value),D33:bool(record.settings.D33.value),D34:bool(record.settings.D34.value),L3:bool(record.settings.L3.value),glassTypeSelector:Number(item.main.I.value)}}
 })
 const input={orderId:record.scenarioId,positions,lineSettings,linePriceSnapshot:lineSnapshot,glassSnapshot,paintSnapshot,zigzagSnapshot:zigSnapshot}
 return {input,result:calculateMixedOrder(input)}
}
function traceForLine(result,sourceCell){return result.trace.filter(step=>step.source?.cell===sourceCell||step.id===sourceCell)}

for(const record of capture.cases){
 const {result}=makeInput(record),positionResults=[]
 for(const address of ['N12','O5','N25','O18']){const value=address==='N12'?result.allocation.activatorPackages:address==='N25'?result.allocation.adhesivePackages:result.allocation.adhesiveFactors?.[address];recordComparison(record,`Клей+акт!${address}`,record.glue[address],value,result.allocation.trace.filter(x=>x.source?.cell===address).map(x=>x.id))}
 for(const item of record.positions){
  const actual=result.positions.find(x=>x.id===item.id),slot=item.slot,prmRow=24+slot,engineTrace=actual?.lineCalculation?.trace??actual?.zigzagCalculation?.trace??[]
  const allocation=result.allocation.systemAllocations?.find(x=>x.positionId===item.id)?.W
  const area=divideRational(multiplyRational(multiplyRational(rationalFromDecimal(String(item.widthMm)),rationalFromDecimal(String(item.heightMm))),rationalFromDecimal(String(item.quantity))),rationalFromDecimal('1000000'))
  recordComparison(record,`ПРМ!AA${prmRow}`,record.prm[`AA${prmRow}`],area)
  recordComparison(record,`ПРМ!AB${prmRow}`,record.prm[`AB${prmRow}`],allocation)
  const mainColumn=item.family==='LINE'?'R':'S'
  recordComparison(record,`Главная!${mainColumn}${10+slot}`,item.main[mainColumn],actual?.baseUnitSalePrice,engineTrace.map(x=>x.id))
  recordComparison(record,`Главная!Y${10+slot}`,item.main.Y,actual?.unitSalePrice,engineTrace.map(x=>x.id))
  if(item.family==='LINE'){
   const line=actual?.lineCalculation
   for(const [cell,value] of Object.entries({O49:line?.additionalBom.lines.find(x=>x.sku==='AA-110')?.quantity,O50:line?.additionalBom.lines.find(x=>x.sku==='AA-120')?.quantity,Q49:line?.additionalMaterials.positions.find(x=>x.sku==='AA-110')?.amount,Q50:line?.additionalMaterials.positions.find(x=>x.sku==='AA-120')?.amount,Q52:line?.materialSubtotal.supportedSubtotal,Q53:line?.paint.q53,Q54:line?.glass.surcharge,Q55:line?.work.assemblyAndMilling,Q56:line?.commercial.q56,Q57:line?.work.installation,Q58:line?.commercial.q58}))recordComparison(record,`L${slot}!${cell}`,item.cells[cell],typeof value==='string'?value:value,engineTrace.filter(x=>x.source?.cell===cell).map(x=>x.id))
   for(const cell of ['N5','N18']){const row=4+slot+(cell==='N18'?13:0),excel=record.glue[`N${row}`],sourceRow=cell==='N5'?'AA-110':'AA-120',perConstruction=line?.additionalBom.lines.find(x=>x.sku===sourceRow)?.quantity;if(perConstruction)recordComparison(record,`Клей+акт!N${row}`,excel,multiplyRational(perConstruction,rationalFromDecimal(String(item.quantity))),line?.trace.filter(x=>x.source?.cell?.endsWith(cell==='N5'?'O49':'O50')).map(x=>x.id)??[])}
   positionResults.push({id:item.id,slot,family:item.family,quantity:item.quantity,status:actual?.status,mainPriceStatuses:comparisons.filter(x=>x.profile===record.profile&&x.scenarioId===record.scenarioId&&x.sourceCell.startsWith('Главная!')&&x.sourceCell.endsWith(String(10+slot))).map(x=>x.classification),diagnostics:actual?.diagnostics??[]})
  }else{
   const zig=actual?.zigzagCalculation
   for(const line of zig?.materialCost?.positions??[]){const source=item.cells[`N${line.bomRow}`],sheet=`Z${slot}`;recordComparison(record,`${sheet}!N${line.bomRow}`,source,line.quantity,line.traceStepId?[line.traceStepId]:[]);recordComparison(record,`${sheet}!O${line.bomRow}`,item.cells[`O${line.bomRow}`],line.unitPrice,[line.traceStepId]);recordComparison(record,`${sheet}!P${line.bomRow}`,item.cells[`P${line.bomRow}`],line.amount,[line.traceStepId])}
   for(const cell of ['P38','P39','P40','P41','P42','P43','P44','W5']){const value=cell==='W5'?allocation:zig?.costs?.[cell];recordComparison(record,`Z${slot}!${cell}`,item.cells[cell],value,zig?.trace.filter(x=>x.source?.cell===cell).map(x=>x.id)??[])}
   const glueRow=4+slot;for(const [sourceCell,targetCell] of [[`N${glueRow}`,34],[`N${17+slot}`,35]]){const p=zig?.materialCost?.positions.find(x=>x.bomRow===targetCell);if(p)recordComparison(record,`Клей+акт!${sourceCell}`,record.glue[sourceCell],multiplyRational(p.quantity,rationalFromDecimal(String(item.quantity))),[p.traceStepId])}
   positionResults.push({id:item.id,slot,family:item.family,quantity:item.quantity,status:actual?.status,mainPriceStatuses:comparisons.filter(x=>x.profile===record.profile&&x.scenarioId===record.scenarioId&&x.sourceCell.startsWith('Главная!')&&x.sourceCell.endsWith(String(10+slot))).map(x=>x.classification),diagnostics:actual?.diagnostics??[]})
  }
 }
 const total=recordComparison(record,'Главная!ZZ100 (scratch total)',record.orderTotal,result.totalSalePrice,result.trace.filter(x=>x.source?.cell==='ZZ100').map(x=>x.id),'Scratch formula on temporary copy: sum of Main!Yslot × Main!Zslot; original workbook has no claimed total formula.')
 scenarios.push({profile:record.profile,scenarioId:record.scenarioId,workbook:record.sourceWorkbook,sourceSha256:record.sourceSha256,recalc:record.calculationMode,orderStatus:result.status,positions:positionResults,shared:{totalActivatorConsumption:result.allocation.totalActivatorConsumption,totalAdhesiveConsumption:result.allocation.totalAdhesiveConsumption,N12:result.allocation.activatorPackages,N25:result.allocation.adhesivePackages,O5:result.allocation.adhesiveFactors?.O5,O18:result.allocation.adhesiveFactors?.O18,slotShares:result.allocation.systemAllocations},excelTotal:{formula:record.orderTotal.formula,value2:record.orderTotal.value,binary64:record.orderTotal.binary64,classification:total,sourceWorkbookTotalFormula:false},diagnostics:result.diagnostics,traceStepIds:result.trace.map(x=>x.id)})
}
const names=['EXACT','DISPLAY_MATCH','NUMERICALLY_EQUIVALENT','MISMATCH','UNVERIFIED'],summary=Object.fromEntries(names.map(name=>[name,comparisons.filter(x=>x.classification===name).length]))
const report={schemaVersion:'1.0',method:'Microsoft Excel 16 COM CalculateFullRebuild on temporary copies of both source XLSM. The engine is rebuilt from source inputs and versioned literal snapshots; no Excel output/cache is passed as an engine input. EXACT compares exact rational to the captured IEEE-754 rational; NUMERICALLY_EQUIVALENT means correctly represented values round to the same binary64; DISPLAY_MATCH is formula-format presentation only and does not assert exact numeric equality. No epsilon is used.',sourceHashes:[...new Map(capture.cases.map(x=>[x.profile,{profile:x.profile,workbook:x.sourceWorkbook,sha256:x.sourceSha256}])).values()],summary,scenarioCount:scenarios.length,scenarios,comparisons}
await writeFile(outputPath,`${JSON.stringify(report,null,2)}\n`,'utf8')
console.log(JSON.stringify({outputPath,summary,scenarios:scenarios.map(x=>({profile:x.profile,id:x.scenarioId,status:x.orderStatus,total:x.excelTotal.classification,positions:x.positions.length}))},null,2))
