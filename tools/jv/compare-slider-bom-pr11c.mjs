import { readFileSync, writeFileSync } from 'node:fs'
import { calculateSliderL3Geometry } from '../../packages/shared/src/jv/slider/geometry.ts'
import { calculateSliderL3FullBom } from '../../packages/shared/src/jv/slider/bom.ts'
import { rationalFromDecimal, roundRationalAwayFromZero } from '../../packages/shared/src/jv/rational.ts'

const fixture=JSON.parse(readFileSync('docs/jv/fixtures/slider-pr11c-bom-capture.json','utf8'))
const old=JSON.parse(readFileSync('docs/jv/fixtures/slider-pr11b-bom-capture.json','utf8'))
const geometryFixture=JSON.parse(readFileSync('docs/jv/fixtures/slider-pr11a-selector-capture.json','utf8'))
const rows=[]
const normalizeDisplay=value=>String(value).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'')
for(const scenario of fixture){
 const base=geometryFixture.scenarios.find(x=>x.profile===scenario.profile&&x.inputs.F11===3),sv=base.settings.cells
 const geometry=calculateSliderL3Geometry({workbook:scenario.workbook,systemSelector:3,widthMm:String(scenario.inputs.width),heightMm:String(scenario.inputs.height),leafCount:String(scenario.inputs.leaves),openingSelector:scenario.inputs.opening,interlockState:scenario.cells.D17,meetingSealState:scenario.cells.D18,settings:{D8:String(sv.D8.value),S2:String(sv.S2.value),S3:String(sv.S3.value),S4:String(sv.S4.value),S6:String(sv.S6.value),S9:String(sv.S9.value),S10:String(sv.S10.value),S11:String(sv.S11.value),S12:String(sv.S12.value),S13:String(sv.S13.value),S14:String(sv.S14.value),S21:String(sv.S21.value),L23:String(sv.L23.value),H25:Boolean(scenario.settings.H25)}})
 const result=calculateSliderL3FullBom(geometry,{interlockEnabled:Boolean(sv.H21.value),fittingUpgradeEnabled:Boolean(sv.H23.value),jointPairSelection:scenario.cells.D22,selectorControls:scenario.selectorControls},{D6:String(scenario.settings.D6),D8:String(scenario.settings.D8),S7:String(scenario.settings.S7),S16:String(scenario.settings.S16),L4:String(scenario.settings.L4),L5:String(scenario.settings.L5),L6:Boolean(scenario.settings.L6),H19:Number(scenario.settings.H19),H25:Boolean(scenario.settings.H25),H27:Boolean(scenario.settings.H27)})
 for(const position of result.positions){const excel=scenario.quantities[`K${position.bomRow}`],direct=position.quantity&&rationalFromDecimal(String(excel.value));let classification='UNVERIFIED';if(position.status==='NOT_APPLICABLE')classification='NOT_APPLICABLE';else if(position.quantity){classification=position.quantity.numerator===direct.numerator&&position.quantity.denominator===direct.denominator?'EXACT':'MISMATCH';if(classification==='MISMATCH'){const digits=excel.format.match(/[.,](0+)/)?.[1].length??0;if(normalizeDisplay(roundRationalAwayFromZero(position.quantity,digits))===normalizeDisplay(Number(excel.value).toFixed(digits)))classification='DISPLAY_MATCH'}}rows.push({profile:scenario.profile,scenarioId:scenario.scenarioId,cell:`S1!K${position.bomRow}`,formula:excel.formula,applicability:position.status,engineExactRational:position.quantity??null,excelValue2:excel.value,numberFormat:excel.format,classification})}
}
const counts=Object.fromEntries(['EXACT','NUMERICALLY_EQUIVALENT','DISPLAY_MATCH','MISMATCH','UNVERIFIED','NOT_APPLICABLE'].map(k=>[k,rows.filter(x=>x.classification===k).length]))
const report={schemaVersion:'1.0',method:'Microsoft Excel 16.0 CalculateFullRebuild on temporary workbook copies; exact decimal string comparison; display comparison uses each Excel cell NumberFormat, with no numeric epsilon.',sourceFixture:'docs/jv/fixtures/slider-pr11c-bom-capture.json',scenarios:fixture.length,quantityComparisons:rows.filter(x=>x.applicability==='CALCULATED').length,applicabilityComparisons:rows.filter(x=>x.applicability==='NOT_APPLICABLE').length,counts,comparisons:rows,coverageNote:'NOT_APPLICABLE rows are counted separately; they have no engine quantity and are not passed off as quantity-parity comparisons.'}
writeFileSync('docs/jv/SLIDER_L3_BOM_PARITY.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({scenarios:report.scenarios,quantityComparisons:report.quantityComparisons,counts},null,2))
if(counts.MISMATCH||counts.UNVERIFIED)process.exitCode=1
