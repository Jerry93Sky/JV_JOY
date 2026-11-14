import { readFileSync, writeFileSync } from 'node:fs'
import { buildSliderL5PriceSnapshot, calculateSliderL5Commercial } from '../../packages/shared/src/jv/slider/l5-pricing.ts'
import { rationalFromDecimal } from '../../packages/shared/src/jv/rational.ts'

const root = new URL('../../', import.meta.url)
const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
const captures = read('docs/jv/fixtures/slider-pr11f-commercial-capture.json')
const snapshots = new Map(read('docs/jv/fixtures/slider-l5-price-snapshots.json').sources.map((s) => [s.profile, buildSliderL5PriceSnapshot(s)]))
const selectorCapture = read('docs/jv/fixtures/slider-pr11a-selector-capture.json')
const bomCapture = read('docs/jv/fixtures/slider-pr11e-bom-capture.json')
const systemSheets = { 1:'L1', 2:'L2', 3:'S1', 4:'S2', 5:'S3', 6:'S4', 7:'F1' }
const sourceSetting = (profile,key) => selectorCapture.scenarios.find((x) => x.profile===profile && x.inputs.F11===4).settings.cells[key].value
const byProfileDefault = (profile) => bomCapture.find((x) => x.profile===profile && x.scenarioId==='slider_default')

function inputFor(record) {
  const base=selectorCapture.scenarios.find((x)=>x.profile===record.profile && x.inputs.F11===4), sv=base.settings.cells, bom=byProfileDefault(record.profile)
  const geometry={workbook:record.workbook,systemSelector:4,widthMm:String(record.requestedInputs.C11),heightMm:String(record.requestedInputs.D11),leafCount:String(record.requestedInputs.M11),openingSelector:record.requestedInputs.J11,interlockState:record.cells.D17.value,meetingSealState:record.cells.D18.value,settings:Object.fromEntries(['D8','S2','S3','S4','S6','S9','S10','S11','S12','S13','S14','S21','S22','L23','H25'].map((k)=>[k,k==='H25'?Boolean(sv[k].value):String(sv[k].value)]))}
  const positions=[]
  for(let row=25;row<=31;row++){const mainRow=row-14,selector=Number(record.mainOrderInputs[`F${mainRow}`].value);positions.push({mainRow,widthMm:String(record.prm[`U${row}`].value),heightMm:String(record.prm[`V${row}`].value),quantity:String(record.prm[`W${row}`].value),systemSelector:selector,sourceSheet:selector>=3&&selector<=6?'S1':systemSheets[selector]})}
  return {geometry,bomOptions:{interlockEnabled:Boolean(sourceSetting(record.profile,'H21')),fittingUpgradeEnabled:Boolean(sourceSetting(record.profile,'H23')),jointPairSelection:record.cells.D22.value,selectorControls:{I25:Number(record.settings.I25.value),C20:Number(record.cells.C20.value),I29:Number(record.settings.I29.value),C24:Number(record.cells.C24.value),I31:Number(record.settings.I31.value),C26:Number(record.cells.C26.value)}},bomSettings:{D6:String(record.settings.D6.value),D8:String(record.settings.D8.value),S7:String(record.settings.S7.value),S17:String(sv.S17.value),L4:String(record.settings.L4.value),L5:String(record.settings.L5.value),L6:Boolean(record.settings.L6.value),H19:Number(record.settings.H19.value),H25:Boolean(record.settings.H25.value),H27:Boolean(record.settings.H27.value)},snapshot:snapshots.get(record.profile),controls:{priceMode:Number(record.cells.C11.value),mainSurchargeSelector:Number(record.main.F28.value),glassSelector:Number(record.cells.C12.value),additionalWorkEnabled:Boolean(record.settings.D32.value),widthServiceEnabled:Boolean(record.settings.D33.value),l3SpecificLatchChargeEnabled:Boolean(record.settings.L3.value),installationEnabled:Boolean(record.settings.D34.value)},orderContext:{positions,sourceWorkbook:record.workbook}}
}

const cells=['M47','D47','D48','D49','D50','D53','R22','R23','R24','R26','R27','M48','M49','M50','M51','M52','M53']
const display=(value,digits)=>{const n=BigInt(value.numerator),d=BigInt(value.denominator),scale=10n**BigInt(digits),scaled=n*scale,q=scaled/d,r=scaled%d,rounded=q+(r===0n||r*2n<d?0n:(scaled<0n?-1n:1n)),abs=rounded<0n?-rounded:rounded;return `${rounded<0n?'-':''}${abs/scale}${digits?'.'+String(abs%scale).padStart(digits,'0'):''}`}
const same=(a,b)=>BigInt(a.numerator)*BigInt(b.denominator)===BigInt(b.numerator)*BigInt(a.denominator)
const reports=captures.map((record)=>{
  const result=calculateSliderL5Commercial(inputFor(record))
  const candidates=[...cells.map((cell)=>({sheet:'S1',cell,excel:record.cells[cell]})),...Array.from({length:42},(_,i)=>{const cell=`M${i+5}`;return {sheet:'S1',cell,excel:record.materials[cell]}}),...['N12','O5','N25','O18'].map((cell)=>({sheet:'Клей+акт',cell,excel:record.glueCosts[cell]})),...['AA25','AA26','AA27','AA28','AA29','AA30','AA31','AA32','AB25'].map((cell)=>({sheet:'ПРМ',cell,excel:record.prm[cell]}))]
  const comparisons=candidates.map(({sheet,cell,excel})=>{
    const step=result.trace.find((x)=>x.source?.sheet===sheet&&x.source.cell===cell),engine=step?.result
    let status='UNVERIFIED'
    const decimals=Number(excel?.format?.match(/[.,](0+)/)?.[1].length??2)
    if(typeof excel?.value==='number'&&engine?.numerator!==undefined){status=same(engine,rationalFromDecimal(String(excel.value)))?'EXACT':display(engine,decimals)===excel.value.toFixed(decimals)?'DISPLAY_MATCH':'MISMATCH'}
    return {excelAddress:`${sheet}!${cell}`,formula:excel?.formula??null,excelValue2:excel?.value??null,numberFormat:excel?.format??null,engineExact:engine??null,engineDisplayed:engine?display(engine,decimals):null,status,traceStepId:step?.id??null}
  })
  return {profile:record.profile,scenarioId:record.scenarioId,workbook:record.workbook,workbookSha256:record.sha256,recalc:record.recalc,inputs:record.requestedInputs,status:result.status,priceSnapshotVersion:result.priceSnapshotVersion,comparisons}
})
const counts=reports.flatMap((r)=>r.comparisons).reduce((a,x)=>(a[x.status]=(a[x.status]??0)+1,a),{EXACT:0,NUMERICALLY_EQUIVALENT:0,DISPLAY_MATCH:0,MISMATCH:0,UNVERIFIED:0})
writeFileSync(new URL('docs/jv/SLIDER_L5_PRICE_PARITY.json',root),JSON.stringify({schemaVersion:'1.0',generatedBy:'tools/jv/compare-slider-commercial-pr11f.mjs',classification:{EXACT:'Exact rational equals decimal Value2',NUMERICALLY_EQUIVALENT:'Reserved for separately proven algebraic equality; none asserted',DISPLAY_MATCH:'Displayed to two decimals equally, underlying values differ',MISMATCH:'Displayed values differ',UNVERIFIED:'No closed numeric engine result'},counts,scenarios:reports},null,2)+'\n')
console.log(JSON.stringify({scenarios:reports.length,counts,m53:reports.map((r)=>({profile:r.profile,scenarioId:r.scenarioId,status:r.status,m53:r.comparisons.find((x)=>x.excelAddress==='S1!M53')?.status}))},null,2))
