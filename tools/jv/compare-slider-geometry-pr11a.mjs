import { readFile,writeFile } from 'node:fs/promises'
import { calculateSliderL3Geometry } from '../../packages/shared/src/jv/slider/geometry.ts'
import { rationalFromDecimal } from '../../packages/shared/src/jv/rational.ts'

const inputPath=new URL('../../docs/jv/fixtures/slider-pr11a-selector-capture.json',import.meta.url)
const outputPath=new URL('../../docs/jv/SLIDER_GEOMETRY_PARITY.json',import.meta.url)
const capture=JSON.parse((await readFile(inputPath,'utf8')).replace(/^\uFEFF/,''))
const fields=['D31','D32','D33','D34','D43','D44','D45']
const comparisons=[]
for(const row of capture.scenarios.filter((item)=>item.inputs.F11===3)){
 const settings=row.settings.cells
 const text=(key)=>String(settings[key].value)
 const s=row.slider.cells
 const result=calculateSliderL3Geometry({workbook:row.workbook,systemSelector:row.inputs.F11,widthMm:String(row.inputs.C11),heightMm:String(row.inputs.D11),leafCount:String(row.inputs.M11),openingSelector:row.inputs.J11,interlockState:s.D17.value,meetingSealState:s.D18.value,settings:{D8:text('D8'),S2:text('S2'),S3:text('S3'),S4:text('S4'),S6:text('S6'),S9:text('S9'),S10:text('S10'),S11:text('S11'),S12:text('S12'),S13:text('S13'),S14:text('S14'),S21:text('S21'),L23:text('L23'),H25:Boolean(settings.H25.value)}})
 for(const cell of [...fields,'K5','K7']){
  const expected=rationalFromDecimal(String(s[cell].value)),actual=cell==='K5'?result.materialQuantities.find((line)=>line.bomRow===5).quantity:cell==='K7'?result.materialQuantities.find((line)=>line.bomRow===7).quantity:result.geometry[cell]
  const same=BigInt(actual.numerator)*BigInt(expected.denominator)===BigInt(expected.numerator)*BigInt(actual.denominator)
  comparisons.push({profile:row.profile,scenarioId:row.scenarioId,excelCell:`S1!${cell}`,formula:s[cell].formula,excelValue:s[cell].value,engineExactRational:actual,status:same?'EXACT':'MISMATCH'})
 }
}
const summary=Object.fromEntries(['EXACT','NUMERICALLY_EQUIVALENT','DISPLAY_MATCH','MISMATCH','UNVERIFIED'].map((status)=>[status,comparisons.filter((x)=>x.status===status).length]))
const probes=capture.scenarios.map((x)=>({profile:x.profile,scenarioId:x.scenarioId,F11:x.inputs.F11,G11:x.selectorResult.G11,C8:x.slider.cells.C8.value,C9:x.slider.cells.C9.value,C10:x.slider.cells.C10.value,activeSheet:x.sheets.S1.A3===1?'S1':'inactive',priceExpression:x.main.T11Formula}))
const report={schemaVersion:'1.0',method:capture.method,sourceHashes:[...new Map(capture.scenarios.map((x)=>[x.profile,{profile:x.profile,workbook:x.workbook,sha256:x.sha256}])).values()],selector:{mainF11:3,mainG11:3,header:'Slider-L3',priceFormula:capture.scenarios.find((x)=>x.inputs.F11===3).main.T11Formula,calculationSheet:'S1',activationFormula:capture.scenarios[0].slider.cells.C8.formula,variantFormula:capture.scenarios[0].slider.cells.C9.formula,probes},scenarioCount:capture.scenarios.filter((x)=>x.inputs.F11===3).length,selectorProbeCount:probes.length,summary,unpricedOutput:{excelCell:'S1!M53',formula:capture.scenarios.find((x)=>x.inputs.F11===3).slider.cells.M53.formula,excelValues:capture.scenarios.filter((x)=>x.inputs.F11===3).map((x)=>({profile:x.profile,scenarioId:x.scenarioId,value:x.slider.cells.M53.value})),status:'UNVERIFIED_NOT_IMPLEMENTED'},comparisons}
await writeFile(outputPath,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({outputPath:outputPath.pathname,scenarioCount:report.scenarioCount,comparisonCount:comparisons.length,summary},null,2))
