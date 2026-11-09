import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { buildSliderX5PriceSnapshot, calculateSliderX5Commercial } from '../../packages/shared/src/jv/slider/l5-pricing.ts'
import { multiplyRational, rationalFromDecimal } from '../../packages/shared/src/jv/rational.ts'

const root = new URL('../../', import.meta.url)
const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
const captures = read('docs/jv/fixtures/slider-pr11j-commercial-capture.json')
const snapshots = new Map(read('docs/jv/fixtures/slider-x5-price-snapshots.json').sources.map((s) => [s.profile, buildSliderX5PriceSnapshot(s)]))
for(const profile of ['COMPLETATION','RETAIL']){
 const record=captures.find(x=>x.profile===profile),snapshot=snapshots.get(profile)
 if(!record||!snapshot||record.sha256!==snapshot.workbookSha256)throw new Error(`Price snapshot identity differs for ${profile}`)
 const actual=createHash('sha256').update(readFileSync(new URL(`../${record.workbook}`,root))).digest('hex')
 if(actual!==record.sha256)throw new Error(`Original workbook SHA-256 differs for ${profile}`)
}
const selectorCapture = read('docs/jv/fixtures/slider-pr11a-selector-capture.json')
const bomCapture = read('docs/jv/fixtures/slider-pr11i-bom-capture.json')
const systemSheets = { 1:'L1', 2:'L2', 3:'S1', 4:'S2', 5:'S3', 6:'S4', 7:'F1' }
const byProfileDefault = (profile) => bomCapture.find((x) => x.profile===profile && x.scenarioId==='slider_default')

function inputFor(record) {
  if(record.cells.C12.formula!=='=Главная!$I$11'||!/^\d+$/.test(String(record.main.I11.formula)))throw new Error('Glass selector must come from literal Главная!I11')
  if(record.cells.C11.formula!=='=Главная!$H$11'||!/^\d+$/.test(String(record.main.H11.formula)))throw new Error('Price mode must come from literal Главная!H11')
  const base=selectorCapture.scenarios.find((x)=>x.profile===record.profile && x.inputs.F11===6), sv=base.settings.cells, bom=byProfileDefault(record.profile)
  const geometry={workbook:record.workbook,systemSelector:6,widthMm:String(record.requestedInputs.C11),heightMm:String(record.requestedInputs.D11),leafCount:String(record.requestedInputs.M11),openingSelector:record.requestedInputs.J11,selectorControls:{I15:Number(record.settings.I15.value),C17:Number(record.cells.C17.value),I17:Number(record.settings.I17.value),C18:Number(record.cells.C18.value)},settings:Object.fromEntries(['D8','S2','S3','S4','S6','S9','S10','S11','S12','S13','S14','S24','L23','H25'].map((k)=>[k,k==='H25'?Boolean(sv[k].value):String(sv[k].value)]))}
  const positions=[]
  for(let row=25;row<=31;row++){
   const mainRow=row-14,source=record.mainOrderInputs,selector=Number(source[`F${mainRow}`].formula)
   for(const column of ['C','D','F','Z'])if(!/^[-+]?\d+(?:\.\d+)?$/.test(String(source[`${column}${mainRow}`].formula)))throw new Error(`Main input ${column}${mainRow} is not a literal`)
   positions.push({mainRow,widthMm:String(source[`C${mainRow}`].formula),heightMm:String(source[`D${mainRow}`].formula),quantity:String(source[`Z${mainRow}`].formula),systemSelector:selector,sourceSheet:selector>=3&&selector<=6?'S1':systemSheets[selector]})
  }
  return {geometry,bomOptions:{interlockEnabled:Boolean(record.settings.H21.value),fittingUpgradeEnabled:Boolean(record.settings.H23.value),selectorControls:{I25:Number(record.settings.I25.value),C20:Number(record.cells.C20.value),I27:Number(record.settings.I27.value),C22:Number(record.cells.C22.value),I29:Number(record.settings.I29.value),C24:Number(record.cells.C24.value),I31:Number(record.settings.I31.value),C26:Number(record.cells.C26.value)}},bomSettings:{D6:String(record.settings.D6.value),D8:String(record.settings.D8.value),S7:String(record.settings.S7.value),S19:String(sv.S19.value),L4:String(record.settings.L4.value),L5:String(record.settings.L5.value),L6:Boolean(record.settings.L6.value),H19:Number(record.settings.H19.value),H25:Boolean(record.settings.H25.value),H27:Boolean(record.settings.H27.value)},snapshot:snapshots.get(record.profile),controls:{priceMode:Number(record.main.H11.formula),mainSurchargeSelector:Number(record.main.F28.formula),glassSelector:Number(record.main.I11.formula),additionalWorkEnabled:Boolean(record.settings.D32.value),widthServiceEnabled:Boolean(record.settings.D33.value),l3SpecificLatchChargeEnabled:Boolean(record.settings.L3.value),installationEnabled:Boolean(record.settings.D34.value)},orderContext:{positions,sourceWorkbook:record.workbook}}
}

const cells=['C47','C48','C49','M47','D47','D48','D49','D50','D53','R22','R23','R24','R26','R27','M48','M49','M50','M51','M52','M53']
const display=(value,digits)=>{const n=BigInt(value.numerator),d=BigInt(value.denominator),scale=10n**BigInt(digits),scaled=n*scale,q=scaled/d,r=scaled%d,rounded=q+(r===0n||r*2n<d?0n:(scaled<0n?-1n:1n)),abs=rounded<0n?-rounded:rounded;return `${rounded<0n?'-':''}${abs/scale}${digits?'.'+String(abs%scale).padStart(digits,'0'):''}`}
const same=(a,b)=>BigInt(a.numerator)*BigInt(b.denominator)===BigInt(b.numerator)*BigInt(a.denominator)
const reports=captures.map((record)=>{
  if(record.requestedInputs.F11!==6||record.main.G11.value!==3||record.cells.A3.value!==1||record.cells.C8.value!==20||record.cells.C9.value!==5||record.cells.C10.value!==25)throw new Error(`Unexpected Slider-X5 route for ${record.profile}/${record.scenarioId}`)
  const result=calculateSliderX5Commercial(inputFor(record))
  const candidates=[...cells.map((cell)=>({sheet:'S1',cell,excel:record.cells[cell]})),...result.materialPositions.map((position)=>{const row=Number(position.sourceCell.slice(4));return {sheet:'S1',cell:`L${row}`,excel:record.materials[`L${row}`]}}),...Array.from({length:42},(_,i)=>{const cell=`M${i+5}`;return {sheet:'S1',cell,excel:record.materials[cell]}}),...Array.from({length:17},(_,i)=>{const cell=`R${i+5}`;return {sheet:'S1',cell,excel:record.materials[cell]}}),...['N5','N6','N7','N8','N9','N10','N11','N12','O5','N18','N19','N20','N21','N22','N23','N24','N25','O18'].map((cell)=>({sheet:'Клей+акт',cell,excel:record.glueCosts[cell]})),...['AA25','AA26','AA27','AA28','AA29','AA30','AA31','AA32','AB25'].map((cell)=>({sheet:'ПРМ',cell,excel:record.prm[cell]})),...['T11','Y11'].map((cell)=>({sheet:'Главная',cell,excel:record.main[cell]}))]
  const comparisons=candidates.map(({sheet,cell,excel})=>{
    const step=result.trace.find((x)=>x.source?.sheet===sheet&&x.source.cell===cell),engine=step?.result
    if(step&&typeof excel?.formula==='string'&&excel.formula.startsWith('=')&&step.source?.formula.replace(/\s+/g,'')!==excel.formula.replace(/\s+/g,''))throw new Error(`X5 commercial formula differs from Excel at ${sheet}!${cell}: ${step.source?.formula}`)
    let status='UNVERIFIED'
    const decimalMatch=excel?.format?.match(/[.,](0+)/),decimals=decimalMatch?decimalMatch[1].length:excel?.format?0:2
    if(typeof excel?.value==='number'&&engine?.numerator!==undefined){status=same(engine,rationalFromDecimal(String(excel.value)))?'EXACT':display(engine,decimals)===excel.value.toFixed(decimals)?'DISPLAY_MATCH':'MISMATCH'}
    let classificationEvidence=null
    if(status==='MISMATCH'&&sheet==='S1'&&/^R(?:[5-9]|1\d|20|21)$/.test(cell)){
      const row=Number(cell.slice(1)),rawQuantity=record.materials[`K${row}`]?.value,rawRate=record.sliderCatalog[`G${row}`]?.formula,exactQuantity=result.bom.positions.find(p=>p.bomRow===row)?.quantity
      if(typeof rawQuantity==='number'&&/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(rawRate??'')&&exactQuantity&&excel.value===rawQuantity*Number(rawRate)&&same(engine,multiplyRational(exactQuantity,rationalFromDecimal(rawRate)))){
        status='NUMERICALLY_EQUIVALENT'
        classificationEvidence={reason:'Excel IEEE-754 product of its captured K Value2 and source-literal G rate equals captured R Value2; engine is exact rational product of its verified K quantity and the same literal rate. Display differs at a half-cent boundary.',quantityValue2:rawQuantity,rateLiteral:rawRate,excelBinaryProduct:rawQuantity*Number(rawRate)}
      }
    }
    return {excelAddress:`${sheet}!${cell}`,formula:excel?.formula??null,excelValue2:excel?.value??null,numberFormat:excel?.format??null,engineExact:engine??null,engineDisplayed:engine?display(engine,decimals):null,status,classificationEvidence,traceStepId:step?.id??null,traceSourceFormula:step?.source?.formula??null,trace:step??null}
  })
  return {profile:record.profile,scenarioId:record.scenarioId,workbook:record.workbook,workbookSha256:record.sha256,recalc:record.recalc,inputs:{...record.requestedInputs,I11:record.main.I11.formula},orderInputs:record.mainOrderInputs,selectorControls:{C17:record.cells.C17,C18:record.cells.C18,C20:record.cells.C20,C22:record.cells.C22,C24:record.cells.C24,C26:record.cells.C26},settings:Object.fromEntries(['D4','D6','D8','D13','D21','D32','D33','D34','H19','H21','H23','H25','H27','I15','I17','I25','I27','I29','I31','L3','L4','L5','L6','L8','L9','L10','L11','L17','L18','S26'].map(key=>[key,record.settings[key]])),status:result.status,priceSnapshotVersion:result.priceSnapshotVersion,comparisons}
})
const counts=reports.flatMap((r)=>r.comparisons).reduce((a,x)=>(a[x.status]=(a[x.status]??0)+1,a),{EXACT:0,NUMERICALLY_EQUIVALENT:0,DISPLAY_MATCH:0,MISMATCH:0,UNVERIFIED:0})
writeFileSync(new URL('docs/jv/SLIDER_X5_PRICE_PARITY.json',root),JSON.stringify({schemaVersion:'1.0',generatedBy:'tools/jv/compare-slider-commercial-pr11j.mjs',classification:{EXACT:'Exact rational equals decimal Value2',NUMERICALLY_EQUIVALENT:'Same source formula and exact rational operands; captured Excel IEEE-754 operand product reproduces Value2 exactly. Display can differ.',DISPLAY_MATCH:'Displayed to source NumberFormat precision equally, underlying values differ',MISMATCH:'Displayed values differ without algebraic evidence of equivalence',UNVERIFIED:'No closed numeric engine result'},counts,scenarios:reports},null,2)+'\n')
const quantityCoverage=read('docs/jv/SLIDER_X5_BOM_COVERAGE.json')
const priced=new Set(reports[0].comparisons.filter(c=>/^S1!L\d+$/.test(c.excelAddress)).map(c=>Number(c.excelAddress.slice(4))))
const coverageRows=Array.from({length:42},(_,i)=>{
 const row=i+5,source=captures[0].materials,quantity=quantityCoverage.rows.find(x=>x.row===row),status=priced.has(row)?'PRICED':quantity.applicability[0].status==='CALCULATED'?'INCLUDED_IN_PARENT_MATERIAL':'NOT_APPLICABLE'
 return {bomRow:row,status,skuConfirmed:row<43,quantityFormula:quantity.formula,priceFormula:source[`L${row}`].formula,amountFormula:source[`M${row}`].formula,priceSourceCell:status==='PRICED'?`Прайс-Slider!E${row===40?41:row===41?42:row===42?43:row}`:null,comparisons:reports.map(s=>({profile:s.profile,scenarioId:s.scenarioId,unitPrice:s.comparisons.find(c=>c.excelAddress===`S1!L${row}`)?.status??'UNVERIFIED',amount:s.comparisons.find(c=>c.excelAddress===`S1!M${row}`)?.status??'UNVERIFIED'}))}
})
writeFileSync(new URL('docs/jv/SLIDER_X5_PRICE_COVERAGE.json',root),JSON.stringify({schemaVersion:'1.0',scenarioCount:reports.length,profiles:[...snapshots.values()].map(s=>({profile:s.profile,version:s.version,workbookSha256:s.workbookSha256})),pricedRows:coverageRows.filter(r=>r.status==='PRICED').length,includedFastenerRows:coverageRows.filter(r=>r.status==='INCLUDED_IN_PARENT_MATERIAL').length,notApplicableRows:coverageRows.filter(r=>r.status==='NOT_APPLICABLE').length,rows:coverageRows},null,2)+'\n')
console.log(JSON.stringify({scenarios:reports.length,counts,m53:reports.map((r)=>({profile:r.profile,scenarioId:r.scenarioId,status:r.status,m53:r.comparisons.find((x)=>x.excelAddress==='S1!M53')?.status}))},null,2))
const unverifiedAllowed=new Set([5,7,8,9,12,14,15,16,17,23,29,30,43,44,45,46].map(row=>`S1!M${row}`))
if(counts.MISMATCH||reports.some(r=>r.status!=='COMPLETE'||!['EXACT','NUMERICALLY_EQUIVALENT','DISPLAY_MATCH'].includes(r.comparisons.find(c=>c.excelAddress==='S1!M53')?.status)||r.comparisons.some(c=>c.status==='UNVERIFIED'&&!unverifiedAllowed.has(c.excelAddress))))process.exitCode=1
