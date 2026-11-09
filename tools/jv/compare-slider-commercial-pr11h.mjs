import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { buildSliderX3PriceSnapshot, calculateSliderX3Commercial } from '../../packages/shared/src/jv/slider/l5-pricing.ts'
import { rationalFromDecimal } from '../../packages/shared/src/jv/rational.ts'

const root = new URL('../../', import.meta.url)
const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
const captures = read('docs/jv/fixtures/slider-pr11h-commercial-capture.json')
const snapshots = new Map(read('docs/jv/fixtures/slider-x3-price-snapshots.json').sources.map((s) => [s.profile, buildSliderX3PriceSnapshot(s)]))
for(const profile of ['COMPLETATION','RETAIL']){
 const record=captures.find(x=>x.profile===profile),snapshot=snapshots.get(profile)
 if(!record||!snapshot||record.sha256!==snapshot.workbookSha256)throw new Error(`Price snapshot identity differs for ${profile}`)
 const actual=createHash('sha256').update(readFileSync(new URL(`../${record.workbook}`,root))).digest('hex')
 if(actual!==record.sha256)throw new Error(`Original workbook SHA-256 differs for ${profile}`)
}
const selectorCapture = read('docs/jv/fixtures/slider-pr11a-selector-capture.json')
const bomCapture = read('docs/jv/fixtures/slider-pr11g-bom-capture.json')
const systemSheets = { 1:'L1', 2:'L2', 3:'S1', 4:'S2', 5:'S3', 6:'S4', 7:'F1' }
const byProfileDefault = (profile) => bomCapture.find((x) => x.profile===profile && x.scenarioId==='slider_default')

function inputFor(record) {
  if(record.cells.C12.formula!=='=Главная!$I$11'||!/^\d+$/.test(String(record.main.I11.formula)))throw new Error('Glass selector must come from literal Главная!I11')
  if(record.cells.C11.formula!=='=Главная!$H$11'||!/^\d+$/.test(String(record.main.H11.formula)))throw new Error('Price mode must come from literal Главная!H11')
  const base=selectorCapture.scenarios.find((x)=>x.profile===record.profile && x.inputs.F11===5), sv=base.settings.cells, bom=byProfileDefault(record.profile)
  const geometry={workbook:record.workbook,systemSelector:5,widthMm:String(record.requestedInputs.C11),heightMm:String(record.requestedInputs.D11),leafCount:String(record.requestedInputs.M11),openingSelector:record.requestedInputs.J11,interlockState:record.cells.D17.value,meetingSealState:record.cells.D18.value,settings:Object.fromEntries(['D8','S2','S3','S4','S6','S9','S10','S11','S12','S13','S14','S21','S23','L23','H25'].map((k)=>[k,k==='H25'?Boolean(sv[k].value):String(sv[k].value)]))}
  const positions=[]
  for(let row=25;row<=31;row++){
   const mainRow=row-14,source=record.mainOrderInputs,selector=Number(source[`F${mainRow}`].formula)
   for(const column of ['C','D','F','Z'])if(!/^[-+]?\d+(?:\.\d+)?$/.test(String(source[`${column}${mainRow}`].formula)))throw new Error(`Main input ${column}${mainRow} is not a literal`)
   positions.push({mainRow,widthMm:String(source[`C${mainRow}`].formula),heightMm:String(source[`D${mainRow}`].formula),quantity:String(source[`Z${mainRow}`].formula),systemSelector:selector,sourceSheet:selector>=3&&selector<=6?'S1':systemSheets[selector]})
  }
  return {geometry,bomOptions:{interlockEnabled:Boolean(record.settings.H21.value),fittingUpgradeEnabled:Boolean(record.settings.H23.value),jointPairSelection:record.cells.D22.value,selectorControls:{I25:Number(record.settings.I25.value),C20:Number(record.cells.C20.value),I29:Number(record.settings.I29.value),C24:Number(record.cells.C24.value),I31:Number(record.settings.I31.value),C26:Number(record.cells.C26.value)}},bomSettings:{D6:String(record.settings.D6.value),D8:String(record.settings.D8.value),S7:String(record.settings.S7.value),S18:String(sv.S18.value),L4:String(record.settings.L4.value),L5:String(record.settings.L5.value),L6:Boolean(record.settings.L6.value),H19:Number(record.settings.H19.value),H25:Boolean(record.settings.H25.value),H27:Boolean(record.settings.H27.value)},snapshot:snapshots.get(record.profile),controls:{priceMode:Number(record.main.H11.formula),mainSurchargeSelector:Number(record.main.F28.formula),glassSelector:Number(record.main.I11.formula),additionalWorkEnabled:Boolean(record.settings.D32.value),widthServiceEnabled:Boolean(record.settings.D33.value),l3SpecificLatchChargeEnabled:Boolean(record.settings.L3.value),installationEnabled:Boolean(record.settings.D34.value)},orderContext:{positions,sourceWorkbook:record.workbook}}
}

const cells=['M47','D47','D48','D49','D50','D53','R22','R23','R24','R26','R27','M48','M49','M50','M51','M52','M53']
const display=(value,digits)=>{const n=BigInt(value.numerator),d=BigInt(value.denominator),scale=10n**BigInt(digits),scaled=n*scale,q=scaled/d,r=scaled%d,rounded=q+(r===0n||r*2n<d?0n:(scaled<0n?-1n:1n)),abs=rounded<0n?-rounded:rounded;return `${rounded<0n?'-':''}${abs/scale}${digits?'.'+String(abs%scale).padStart(digits,'0'):''}`}
const same=(a,b)=>BigInt(a.numerator)*BigInt(b.denominator)===BigInt(b.numerator)*BigInt(a.denominator)
const reports=captures.map((record)=>{
  const result=calculateSliderX3Commercial(inputFor(record))
  const candidates=[...cells.map((cell)=>({sheet:'S1',cell,excel:record.cells[cell]})),...result.materialPositions.map((position)=>{const row=Number(position.sourceCell.slice(4));return {sheet:'S1',cell:`L${row}`,excel:record.materials[`L${row}`]}}),...Array.from({length:42},(_,i)=>{const cell=`M${i+5}`;return {sheet:'S1',cell,excel:record.materials[cell]}}),...['N12','O5','N25','O18'].map((cell)=>({sheet:'Клей+акт',cell,excel:record.glueCosts[cell]})),...['AA25','AA26','AA27','AA28','AA29','AA30','AA31','AA32','AB25'].map((cell)=>({sheet:'ПРМ',cell,excel:record.prm[cell]})),...['T11','Y11'].map((cell)=>({sheet:'Главная',cell,excel:record.main[cell]}))]
  const comparisons=candidates.map(({sheet,cell,excel})=>{
    const step=result.trace.find((x)=>x.source?.sheet===sheet&&x.source.cell===cell),engine=step?.result
    if(sheet==='S1'&&/^[LM]\d+$/.test(cell)&&Number(cell.slice(1))<=42&&step&&step.source?.formula.replace(/\s+/g,'')!==excel?.formula?.replace(/\s+/g,''))throw new Error(`X3 commercial formula differs from Excel at ${cell}: ${step?.source?.formula}`)
    let status='UNVERIFIED'
    const decimalMatch=excel?.format?.match(/[.,](0+)/),decimals=decimalMatch?decimalMatch[1].length:excel?.format?0:2
    if(typeof excel?.value==='number'&&engine?.numerator!==undefined){status=same(engine,rationalFromDecimal(String(excel.value)))?'EXACT':display(engine,decimals)===excel.value.toFixed(decimals)?'DISPLAY_MATCH':'MISMATCH'}
    return {excelAddress:`${sheet}!${cell}`,formula:excel?.formula??null,excelValue2:excel?.value??null,numberFormat:excel?.format??null,engineExact:engine??null,engineDisplayed:engine?display(engine,decimals):null,status,traceStepId:step?.id??null}
  })
  return {profile:record.profile,scenarioId:record.scenarioId,workbook:record.workbook,workbookSha256:record.sha256,recalc:record.recalc,inputs:{...record.requestedInputs,I11:record.main.I11.formula},orderInputs:record.mainOrderInputs,selectorControls:{C20:record.cells.C20,C24:record.cells.C24,C26:record.cells.C26},settings:Object.fromEntries(['D4','D6','D8','D13','D21','D32','D33','D34','H19','H21','H23','H25','H27','I25','I29','I31','L3','L4','L5','L6','L8','L9','L10','L11','L17','L18','S26'].map(key=>[key,record.settings[key]])),status:result.status,priceSnapshotVersion:result.priceSnapshotVersion,comparisons}
})
const counts=reports.flatMap((r)=>r.comparisons).reduce((a,x)=>(a[x.status]=(a[x.status]??0)+1,a),{EXACT:0,NUMERICALLY_EQUIVALENT:0,DISPLAY_MATCH:0,MISMATCH:0,UNVERIFIED:0})
writeFileSync(new URL('docs/jv/SLIDER_X3_PRICE_PARITY.json',root),JSON.stringify({schemaVersion:'1.0',generatedBy:'tools/jv/compare-slider-commercial-pr11h.mjs',classification:{EXACT:'Exact rational equals decimal Value2',NUMERICALLY_EQUIVALENT:'Reserved for separately proven algebraic equality; none asserted',DISPLAY_MATCH:'Displayed to source NumberFormat precision equally, underlying values differ',MISMATCH:'Displayed values differ',UNVERIFIED:'No closed numeric engine result'},counts,scenarios:reports},null,2)+'\n')
const quantityCoverage=read('docs/jv/SLIDER_X3_BOM_COVERAGE.json')
const priced=new Set(reports[0].comparisons.filter(c=>/^S1!L\d+$/.test(c.excelAddress)).map(c=>Number(c.excelAddress.slice(4))))
const coverageRows=Array.from({length:42},(_,i)=>{
 const row=i+5,source=captures[0].materials,quantity=quantityCoverage.rows.find(x=>x.row===row),status=priced.has(row)?'PRICED':quantity.applicability[0].status==='CALCULATED'?'INCLUDED_IN_PARENT_MATERIAL':'NOT_APPLICABLE'
 return {bomRow:row,status,skuConfirmed:row<43,quantityFormula:quantity.formula,priceFormula:source[`L${row}`].formula,amountFormula:source[`M${row}`].formula,priceSourceCell:status==='PRICED'?`Прайс-Slider!E${row===40?41:row===41?42:row===42?43:row}`:null,comparisons:reports.map(s=>({profile:s.profile,scenarioId:s.scenarioId,unitPrice:s.comparisons.find(c=>c.excelAddress===`S1!L${row}`)?.status??'UNVERIFIED',amount:s.comparisons.find(c=>c.excelAddress===`S1!M${row}`)?.status??'UNVERIFIED'}))}
})
writeFileSync(new URL('docs/jv/SLIDER_X3_PRICE_COVERAGE.json',root),JSON.stringify({schemaVersion:'1.0',scenarioCount:reports.length,profiles:[...snapshots.values()].map(s=>({profile:s.profile,version:s.version,workbookSha256:s.workbookSha256})),pricedRows:coverageRows.filter(r=>r.status==='PRICED').length,includedFastenerRows:coverageRows.filter(r=>r.status==='INCLUDED_IN_PARENT_MATERIAL').length,notApplicableRows:coverageRows.filter(r=>r.status==='NOT_APPLICABLE').length,rows:coverageRows},null,2)+'\n')
console.log(JSON.stringify({scenarios:reports.length,counts,m53:reports.map((r)=>({profile:r.profile,scenarioId:r.scenarioId,status:r.status,m53:r.comparisons.find((x)=>x.excelAddress==='S1!M53')?.status}))},null,2))
if(counts.MISMATCH||reports.some(r=>r.status!=='COMPLETE'||!['EXACT','NUMERICALLY_EQUIVALENT','DISPLAY_MATCH'].includes(r.comparisons.find(c=>c.excelAddress==='S1!M53')?.status)))process.exitCode=1
