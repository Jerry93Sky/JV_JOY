import {readFileSync,writeFileSync} from 'node:fs'
import {calculateSliderX3Geometry} from '../../packages/shared/src/jv/slider/x3-geometry.ts'
import {calculateSliderX3FullBom} from '../../packages/shared/src/jv/slider/x3-bom.ts'
import {rationalFromDecimal,roundRationalAwayFromZero} from '../../packages/shared/src/jv/rational.ts'

const read=(file)=>JSON.parse(readFileSync(file,'utf8'))
const captures=read('docs/jv/fixtures/slider-pr11g-bom-capture.json')
const selector=read('docs/jv/fixtures/slider-pr11a-selector-capture.json')
const equal=(a,b)=>BigInt(a.numerator)*BigInt(b.denominator)===BigInt(b.numerator)*BigInt(a.denominator)
function run(record){
 const reference=selector.scenarios.find(x=>x.profile===record.profile&&x.inputs.F11===5),sv=reference.settings.cells
 const geometry=calculateSliderX3Geometry({workbook:record.workbook,systemSelector:5,widthMm:String(record.inputs.width),heightMm:String(record.inputs.height),leafCount:String(record.inputs.leaves),openingSelector:record.inputs.opening,interlockState:record.cells.D17,meetingSealState:record.cells.D18,settings:Object.fromEntries(['D8','S2','S3','S4','S6','S9','S10','S11','S12','S13','S14','S21','S23','L23','H25'].map(k=>[k,k==='H25'?Boolean(record.settings.H25):String(sv[k].value)]))})
 const bom=calculateSliderX3FullBom(geometry,{interlockEnabled:Boolean(record.settings.H21),fittingUpgradeEnabled:Boolean(record.settings.H23),jointPairSelection:record.cells.D22,selectorControls:record.selectorControls},{D6:String(record.settings.D6),D8:String(record.settings.D8),S7:String(record.settings.S7),S18:String(record.settings.S18),L4:String(record.settings.L4),L5:String(record.settings.L5),L6:Boolean(record.settings.L6),H19:Number(record.settings.H19),H25:Boolean(record.settings.H25),H27:Boolean(record.settings.H27)})
 const compare=(cell,source,quantity,applicable=true)=>{const step=[...geometry.trace,...bom.trace].find(x=>x.source?.sheet==='S1'&&x.source.cell===cell),digits=source.format?.match(/[.,](0+)/)?.[1].length??0;let status='UNVERIFIED';if(quantity&&typeof source.value==='number')status=equal(quantity,rationalFromDecimal(String(source.value)))?'EXACT':Number(roundRationalAwayFromZero(quantity,digits))===Number(source.value.toFixed(digits))?'DISPLAY_MATCH':'MISMATCH';return {address:`S1!${cell}`,formula:source.formula,excelValue2:source.value,numberFormat:source.format??null,engineExact:quantity??null,status,applicable,traceStepId:step?.id??null}}
 const comparisons=[]
 for(const cell of ['D31','D32','D33','D34','D43','D44','D45']){
  const sourceFormula=reference.slider.cells[cell]?.formula
  const implementedFormula=geometry.trace.find(x=>x.source?.cell===cell)?.source?.formula
  if(!sourceFormula||sourceFormula.replace(/\s+/g,'')!==implementedFormula?.replace(/\s+/g,''))throw new Error(`Source formula differs for S1!${cell}`)
  comparisons.push(compare(cell,{value:record.cells[cell],formula:sourceFormula,format:'0'},geometry.geometry[cell]))
 }
 for(const position of bom.positions)comparisons.push(compare(`K${position.bomRow}`,record.quantities[`K${position.bomRow}`],position.status==='CALCULATED'?position.quantity:undefined,position.status==='CALCULATED'))
 return {profile:record.profile,workbook:record.workbook,scenarioId:record.scenarioId,recalc:record.recalc,inputs:record.inputs,selector:{F11:5,G11:reference.selectorResult.G11,C8:20,C9:3,C10:23},applicableRows:bom.supportedRows,notApplicableRows:bom.notApplicableRows,comparisons}
}
const scenarios=captures.map(run),counts=scenarios.flatMap(x=>x.comparisons).reduce((a,x)=>(a[x.status]=(a[x.status]??0)+1,a),{EXACT:0,NUMERICALLY_EQUIVALENT:0,DISPLAY_MATCH:0,MISMATCH:0,UNVERIFIED:0})
const output={schemaVersion:'1.0',generatedBy:'tools/jv/compare-slider-x3-pr11g.mjs',sources:['docs/jv/fixtures/slider-pr11a-selector-capture.json','docs/jv/fixtures/slider-pr11g-bom-capture.json'],classification:'EXACT compares exact rational to decimal Value2; DISPLAY_MATCH compares source NumberFormat decimal places; UNVERIFIED covers inactive rows',counts,scenarios}
writeFileSync('docs/jv/SLIDER_X3_EXCEL_PARITY.json',JSON.stringify(output,null,2)+'\n')
writeFileSync('docs/jv/SLIDER_X3_BOM_COVERAGE.json',JSON.stringify({schemaVersion:'1.0',scenarioCount:scenarios.length,rows:Array.from({length:42},(_,i)=>{const row=i+5;return {row,formula:captures[0].quantities[`K${row}`].formula,applicability:scenarios.map(x=>({profile:x.profile,scenarioId:x.scenarioId,status:x.applicableRows.includes(row)?'CALCULATED':'NOT_APPLICABLE'}))}})},null,2)+'\n')
console.log(JSON.stringify({scenarios:scenarios.length,counts,applicable:scenarios.map(x=>x.applicableRows.length)}))
if(counts.MISMATCH)process.exitCode=1
