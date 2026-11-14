import {readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const source=JSON.parse(await readFile(path.join(root,'docs/jv/fixtures/unified-order-all-seven-pr13d-excel.json'),'utf8'))
const classifications={EXACT:0,NUMERICALLY_EQUIVALENT:0,DISPLAY_MATCH:0,MISMATCH:0,UNVERIFIED:0}
const cases=source.map(scenario=>{
 const rows=[]
 const familyBySelector={1:'LINE',2:'ZIGZAG',3:'SLIDER_L3',4:'SLIDER_L5',5:'SLIDER_X3',6:'SLIDER_X5',7:'FRONT'}
 for(let slot=1;slot<=7;slot++){
  const sourceRow=scenario.MainRows.find(x=>x.slot===slot)
  for(const address of [`AA${10+slot}`]){
   const cell=sourceRow?.cells[address]
   rows.push({slot,family:familyBySelector[sourceRow?.cells[`F${10+slot}`]?.value2]??null,address:`Главная!${address}`,formula:cell?.formula??null,excelValue2:cell?.value2??null,excelText:cell?.text??null,numberFormat:cell?.numberFormat??null,engineValue:null,status:'UNVERIFIED',reason:'No engine input snapshot with the same raw family controls and source settings exists for this Excel capture; a value from the distinct family fixture set would not be a valid parity comparison.'})
   classifications.UNVERIFIED++
  }
 }
 const total=scenario.AA18
 return {scenarioId:scenario.scenarioId,profile:scenario.profile,workbook:scenario.workbook,sourceSha256:scenario.sourceSha256,excelVersion:scenario.excelVersion,calculationMode:scenario.calculationMode,excelScenarioValid:scenario.valid,primaryInputs:scenario.inputs,excel:{AA11toAA17:rows,AA18:{address:'Главная!AA18',formula:total.formula,excelValue2:total.value2,excelText:total.text,numberFormat:total.numberFormat,engineValue:null,status:'UNVERIFIED',reason:'Excel recomputation is valid, but equivalent per-family typed input values and trace have not been assembled for this exact order.'},sharedConsumables:scenario.sharedConsumables,frontAreaRows:scenario.frontAreaRows,front:scenario.front},engine:{status:'UNVERIFIED',orderTotal:null,reason:'Input equivalence is unproven. Engine fixtures currently use separately captured family scenarios; substituting the Excel results or comparing different dimensions/control selectors would fabricate parity.'},validForExcel:scenario.valid}
})
const out={schemaVersion:'1.0',purpose:'Fresh Excel-only all-seven scenario capture and strict status ledger for PR_13D. No engine value is inferred from Excel Value2.',method:'Microsoft Excel 16.0 COM CalculateFullRebuild on a fresh temporary copy of each original workbook for every scenario.',sourceFixture:'docs/jv/fixtures/unified-order-all-seven-pr13d-excel.json',minimumScenarioCount:12,scenarioCount:cases.length,validExcelScenarioCount:cases.filter(x=>x.validForExcel).length,profiles:{COMPLETATION:cases.filter(x=>x.profile==='COMPLETATION').length,RETAIL:cases.filter(x=>x.profile==='RETAIL').length},comparisonCounts:classifications,aa18Counts:{EXACT:0,NUMERICALLY_EQUIVALENT:0,DISPLAY_MATCH:0,MISMATCH:0,UNVERIFIED:cases.length},unresolvedBlocker:'No serialized matched all-seven UnifiedPositionInput fixture exists that maps each raw Excel Main input to all source-tab parameters (in particular Line, Zigzag, Slider-L3/L5/X3/X5, and Front selectors/settings). Current family fixtures correspond to separate standalone captures and differ from the 12 Main inputs. Build a provenance-backed fixture bridge, then execute calculateJVOrder against these same inputs and compare AA11:AA18; until then no all-seven engine parity is claimed.',cases}
await writeFile(path.join(root,'docs/jv/UNIFIED_ORDER_ALL_SEVEN_PARITY.json'),JSON.stringify(out,null,2)+'\n','utf8')
console.log(JSON.stringify({scenarios:cases.length,excelValid:out.validExcelScenarioCount,engineParity:'UNVERIFIED',counts:classifications},null,2))
