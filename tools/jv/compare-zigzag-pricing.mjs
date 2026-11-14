import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { calculateZigzagGeometry } from '../../packages/shared/src/jv/zigzag/geometry.ts'
import { calculateZigzagBaseMaterialQuantities } from '../../packages/shared/src/jv/zigzag/material-quantities.ts'
import { calculateZigzagOrderAdhesiveAllocation } from '../../packages/shared/src/jv/zigzag/order-allocation.ts'
import { buildZigzagPriceSnapshot, calculateZigzagMaterialCost } from '../../packages/shared/src/jv/zigzag/pricing.ts'
import { calculateZigzagCommercialPrice, calculateZigzagP39, calculateZigzagP40, calculateZigzagP41, calculateZigzagP43 } from '../../packages/shared/src/jv/zigzag/commercial-cost.ts'
import { rationalFromDecimal, multiplyRational, roundRationalAwayFromZero } from '../../packages/shared/src/jv/rational.ts'

const [priceCapturePath='docs/jv/fixtures/zigzag-pricing-excel.json',snapshotsPath='docs/jv/fixtures/zigzag-price-snapshots.json',geometryPath='docs/jv/fixtures/zigzag-geometry-excel.json',outputPath='docs/jv/ZIGZAG_PRICE_PARITY.json']=process.argv.slice(2)
const [capture,snapshotFile,geometryFile]=await Promise.all([priceCapturePath,snapshotsPath,geometryPath].map(async(path)=>JSON.parse(await readFile(path,'utf8'))))
function binary64(hex){if(!hex)return undefined;const bits=BigInt(`0x${hex}`),sign=bits>>63n?-1n:1n,exponent=Number((bits>>52n)&0x7ffn),fraction=bits&((1n<<52n)-1n);if(exponent===0x7ff)return undefined;if(exponent===0&&fraction===0n)return {numerator:'0',denominator:'1'};const mantissa=exponent===0?fraction:(1n<<52n)+fraction,power=exponent===0?-1074:exponent-1023-52;return power>=0?{numerator:String(sign*(mantissa<<BigInt(power))),denominator:'1'}:{numerator:String(sign*mantissa),denominator:String(1n<<BigInt(-power))}}
function sameRational(a,b){return BigInt(a.numerator)*BigInt(b.denominator)===BigInt(b.numerator)*BigInt(a.denominator)}
function format(value,places){const n=BigInt(value.numerator),d=BigInt(value.denominator),scale=10n**BigInt(places),abs=n<0n?-n:n,scaled=abs*scale;let q=scaled/d;if((scaled%d)*2n>=d)q++;let text=q.toString().padStart(places+1,'0');if(places)text=`${text.slice(0,-places)}.${text.slice(-places)}`;const [whole,fraction='']=text.split('.');return `${n<0n?'-':''}${whole.replace(/\B(?=(\d{3})+(?!\d))/g,' ')}${places?`,${fraction}`:''}`}
function normalize(text){return String(text??'').replace(/[\s\u00a0\u202f]/g,'').replace(',','.')}
function classify(value,cell){const excel=binary64(cell?.binary64);if(excel&&sameRational(value,excel))return 'EXACT';if(!cell?.displayedText||!cell?.numberFormat)return 'UNVERIFIED';const decimals=/[.,](0+|#+)/.exec(cell.numberFormat)?.[1].length??0;return normalize(format(value,decimals))===normalize(cell.displayedText)?'DISPLAY_MATCH':'MISMATCH'}
function isOn(value){return /^(1|true|да)$/i.test(String(value).trim())}
function sourcePosition(captureCase,geometryCase,snapshot){
 const geometry=calculateZigzagGeometry({...geometryCase.inputs,settings:geometryCase.settings,switches:geometryCase.inputs.switches})
 const bom=calculateZigzagBaseMaterialQuantities(geometry)
 const order=calculateZigzagOrderAdhesiveAllocation({orderId:`${captureCase.profile}-${captureCase.id}`,workbook:snapshot.workbook,positions:[{id:'slot1',family:'ZIGZAG',quantity:rationalFromDecimal('1'),activatorPerConstruction:bom.exactQuantities[34],adhesivePerConstruction:bom.exactQuantities[35],widthMm:rationalFromDecimal(String(captureCase.inputs.width)),heightMm:rationalFromDecimal(String(captureCase.inputs.height))}]})
 const materials=calculateZigzagMaterialCost({bom,snapshot,profile:captureCase.profile,orderAllocation:order})
 const p39=calculateZigzagP39({workbook:snapshot.workbook,geometry,bom,snapshot,allocation:order,slotId:'slot1',c8:String(captureCase.cells.C8.value),N40:'0',N41:'0'})
 const p40=calculateZigzagP40({workbook:snapshot.workbook,enabled:isOn(captureCase.sources.settings.D32.value),geometry,snapshot,allocation:order,slotId:'slot1',glassTypeSelector:Number(captureCase.sources.main.I11.value)})
 const p41=calculateZigzagP41({workbook:snapshot.workbook,assemblyEnabled:isOn(captureCase.sources.settings.D33.value),l3Enabled:isOn(captureCase.sources.settings.L3.value),widthMm:String(captureCase.inputs.width),exactN10:bom.exactQuantities[10],snapshot})
 const p43=calculateZigzagP43({workbook:snapshot.workbook,enabled:isOn(captureCase.sources.settings.D34.value),widthMm:String(captureCase.inputs.width),heightMm:String(captureCase.inputs.height),leafCount:geometry.inputs.normalizedSashCount,snapshot})
 const commercial=calculateZigzagCommercialPrice({workbook:snapshot.workbook,materialCost:materials,p39:p39.value,p40:p40.value,p41:p41.value,p43:p43.value,F28:Number(captureCase.sources.main.F28.value),snapshot,allocation:order,slotId:'slot1'})
 const computed=new Map()
 for(const p of materials.positions){computed.set(`O${p.bomRow}`,p.unitPrice);computed.set(`P${p.bomRow}`,p.amount)}
 computed.set('P38',materials.p38)
 for(const cell of ['P39','P40','P41','P42','P43','P44'])computed.set(cell,cell==='P39'?p39.value:cell==='P40'?p40.value:cell==='P41'?p41.value:cell==='P43'?p43.value:cell==='P42'?commercial.p42:commercial.p44)
 return {geometry,bom,order,materials,p39,p40,p41,p43,commercial,computed,commercialTrace:{p39:p39.trace,p40:p40.trace,p41:p41.trace,p43:p43.trace}}
}
function findGeometry(profile,width,height,leaves,opening){return geometryFile.cases.find(item=>item.profile===profile&&Number(item.inputs.widthMm)===width&&Number(item.inputs.heightMm)===height&&String(item.inputs.leafSelector)===String(leaves)&&item.inputs.openingSelector===opening)}
function addComparison(profile,scenarioId,sourceCell,cell,value,traceStepIds=[]){comparisons.push({profile,scenarioId,sourceCell,formula:cell?.formula,numberFormat:cell?.numberFormat,excelValue2:cell?.value,excelBinary64:cell?.binary64,excelDisplayed:cell?.displayedText,engineExactRational:value??null,classification:value?classify(value,cell):'UNVERIFIED',reason:value?undefined:'Calculation dependency is not available in the independent engine result',traceStepIds})}
function traceArray(trace){return Array.isArray(trace)?trace:trace?[trace]:[]}
const comparisons=[]
for(const excel of capture.cases.filter(item=>item.id.startsWith('single_'))){
 const snapshotInput=snapshotFile.sources.find(item=>item.profile===excel.profile)
 const snapshot=buildZigzagPriceSnapshot(snapshotInput)
 const geometryCase=findGeometry(excel.profile,excel.inputs.width,excel.inputs.height,excel.inputs.leaves,excel.inputs.opening)
 if(!geometryCase)throw new Error(`No geometry fixture for ${excel.profile} ${excel.id}`)
 const engine=sourcePosition(excel,geometryCase,snapshot)
 const addresses=[...Array.from({length:31},(_,index)=>`O${index+5}`),...Array.from({length:31},(_,index)=>`P${index+5}`),'P38','P39','P40','P41','P42','P43','P44']
 for(const address of addresses){const value=engine.computed.get(address),cell=excel.cells[address];const trace=address==='P39'?engine.p39.trace:address==='P40'?engine.p40.trace:address==='P41'?engine.p41.trace:address==='P43'?engine.p43.trace:address==='P42'||address==='P44'?engine.commercial.trace:engine.materials.trace.filter(step=>step.id===`JV.ZIGZAG.COST.P${address.slice(1)}`||step.id==='JV.ZIGZAG.COST.P38');addComparison(excel.profile,excel.id,`Z1!${address}`,cell,value,traceArray(trace).map(step=>step.id))}
}
for(const excel of capture.cases.filter(item=>item.id==='two_positions_4200x2500_5leaf')){
 const snapshot=buildZigzagPriceSnapshot(snapshotFile.sources.find(item=>item.profile===excel.profile))
 const firstGeo=findGeometry(excel.profile,excel.inputs.width,excel.inputs.height,excel.inputs.leaves,excel.inputs.opening),secondGeo=findGeometry(excel.profile,3600,2400,4,2)
 if(!firstGeo||!secondGeo)throw new Error(`No geometry fixtures for mixed Zigzag order ${excel.profile}`)
 const first=sourcePosition({...excel,id:'slot1',inputs:{...excel.inputs,secondQuantity:0},cells:excel.cells},firstGeo,snapshot)
 const second=sourcePosition({...excel,id:'slot2',inputs:{...excel.inputs,width:3600,height:2400,leaves:4,opening:2,secondQuantity:0},cells:excel.cells},secondGeo,snapshot)
 const order=calculateZigzagOrderAdhesiveAllocation({orderId:`mixed-${excel.profile}`,workbook:snapshot.workbook,positions:[{id:'slot1',family:'ZIGZAG',quantity:rationalFromDecimal('1'),activatorPerConstruction:first.bom.exactQuantities[34],adhesivePerConstruction:first.bom.exactQuantities[35],widthMm:rationalFromDecimal('4200'),heightMm:rationalFromDecimal('2500')},{id:'slot2',family:'ZIGZAG',quantity:rationalFromDecimal('2'),activatorPerConstruction:second.bom.exactQuantities[34],adhesivePerConstruction:second.bom.exactQuantities[35],widthMm:rationalFromDecimal('3600'),heightMm:rationalFromDecimal('2400')}]})
 first.materials=calculateZigzagMaterialCost({bom:first.bom,snapshot,profile:excel.profile,orderAllocation:order})
 second.materials=calculateZigzagMaterialCost({bom:second.bom,snapshot,profile:excel.profile,orderAllocation:order})
 for(const [cell,value] of [['N12',order.activatorPackages],['O5',order.adhesiveFactors?.O5],['N25',order.adhesivePackages],['O18',order.adhesiveFactors?.O18]])addComparison(excel.profile,excel.id,`Клей+акт!${cell}`,excel.sources.glue[cell],value,order.trace.map(step=>step.id))
 for(const [position,engine,sourceCells] of [['slot1',first,excel.cells],['slot2',second,excel.slot2Cells]]){
  for(const row of [34,35]){const line=engine.materials.positions.find(item=>item.bomRow===row);addComparison(excel.profile,excel.id,`${position==='slot1'?'Z1':'Z2'}!P${row}`,sourceCells[`P${row}`],line?.amount,engine.materials.trace.filter(step=>step.id===`JV.ZIGZAG.COST.P${row}`).map(step=>step.id))}
  addComparison(excel.profile,excel.id,`${position==='slot1'?'Z1':'Z2'}!P38`,sourceCells.P38,engine.materials.p38,engine.materials.trace.filter(step=>step.id==='JV.ZIGZAG.COST.P38').map(step=>step.id))
  const W=order.systemAllocations?.find(item=>item.positionId===position)?.W;addComparison(excel.profile,excel.id,`${position==='slot1'?'Z1':'Z2'}!W5`,sourceCells.W5,W,[])
 }
}
const names=['EXACT','DISPLAY_MATCH','NUMERICALLY_EQUIVALENT','MISMATCH','UNVERIFIED']
const summary=Object.fromEntries(names.map(name=>[name,comparisons.filter(item=>item.classification===name).length]))
const report={schemaVersion:'1.0',method:'Excel 16 COM CalculateFullRebuild on temporary workbook copies; original workbook Value2, IEEE-754 binary64 bits, formula, display, and number format are retained. Engine receives only source geometry/configuration and literal catalog snapshot inputs. EXACT compares exact rationals with the captured IEEE-754 rational. DISPLAY_MATCH compares the exact engine rational formatted according to the source number format; it does not imply equal underlying values. No epsilon is used.',workbooks:snapshotFile.sources.map(source=>({profile:source.profile,workbook:source.workbook,sha256:source.workbookSha256})),summary,comparisons,engineTrace:{COMPLETATION:sourcePosition(capture.cases.find(item=>item.profile==='COMPLETATION'&&item.id==='single_3600x2400_4leaf'),geometryFile.cases.find(item=>item.profile==='COMPLETATION'&&item.id==='zigzag_yes_3600x2400_4leaf'),buildZigzagPriceSnapshot(snapshotFile.sources.find(item=>item.profile==='COMPLETATION'))).commercialTrace,RETAIL:sourcePosition(capture.cases.find(item=>item.profile==='RETAIL'&&item.id==='single_3600x2400_4leaf'),geometryFile.cases.find(item=>item.profile==='RETAIL'&&item.id==='zigzag_yes_3600x2400_4leaf'),buildZigzagPriceSnapshot(snapshotFile.sources.find(item=>item.profile==='RETAIL'))).commercialTrace}}
await writeFile(outputPath,`${JSON.stringify(report,null,2)}\n`,'utf8')
console.log(JSON.stringify({outputPath,summary,commercial:comparisons.filter(x=>['P38','P39','P40','P41','P42','P43','P44'].includes(x.sourceCell.split('!')[1])).map(x=>[x.profile,x.sourceCell,x.classification,x.excelDisplayed,x.engineExactRational])},null,2))
