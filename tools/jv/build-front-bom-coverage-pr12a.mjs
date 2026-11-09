import {readFileSync,writeFileSync} from 'node:fs'
import {FRONT_FORMULAS} from '../../packages/shared/src/jv/front/source-formulas.ts'
import {FRONT_PRICE_FORMULAS} from '../../packages/shared/src/jv/front/source-price-formulas.ts'
import {FRONT_CATALOG} from '../../packages/shared/src/jv/front/source-catalog.ts'

const captures=JSON.parse(readFileSync(new URL('../../docs/jv/fixtures/front-pr12a-excel.json',import.meta.url),'utf8'))
const rows=Array.from({length:28},(_,i)=>i+5).map(row=>{
 const frontRow=row<=18?row:row>=31?row-12:null
 const accessoryRow=row>=19&&row<=26?row+32:row===27?null:row===28?null:row===29||row===30?null:null
 const catalog=frontRow===null?accessoryRow===null?null:FRONT_CATALOG.accessories[accessoryRow]:FRONT_CATALOG.front[frontRow]
 const observations=captures.scenarios.map(record=>({scenarioId:record.scenarioId,quantity:record.front[`Q${row}`]?.value}))
 const positive=observations.filter(x=>typeof x.quantity==='number'&&x.quantity>0).map(x=>x.scenarioId)
 return {row,address:`F1!Q${row}`,sku:catalog&&'sku' in catalog?catalog.sku:null,description:catalog?.description??(row===27?'Indexed accessory Прайс-Аксессуары!B59:B61':row===28?'Indexed accessory Прайс-Аксессуары!B12:B28':row===29||row===30?'Indexed accessory Прайс-Аксессуары!B29:B49':null),unit:catalog?.unit??'шт.',catalogRef:catalog?.source??(row===27?'Прайс-Аксессуары!B59:B61':row===28?'Прайс-Аксессуары!B12:B28':row===29||row===30?'Прайс-Аксессуары!B29:B49':null),quantityFormula:FRONT_FORMULAS[`Q${row}`]??0,applicabilityFormula:FRONT_FORMULAS[`P${row}`]??null,priceSourceFormula:FRONT_PRICE_FORMULAS[`R${row}`]??null,priceLineFormula:FRONT_PRICE_FORMULAS[`S${row}`]??null,status:row===23?'NOT_APPLICABLE':'CALCULATED',proof:row===23?'Both original XLSM workbooks contain literal 0 in F1!Q23':null,implementedBy:'packages/shared/src/jv/front/calculator.ts#calculateFront',parityScenarioCount:observations.length,observedPositiveScenarioIds:positive,unexercisedPositiveBranch:row!==23&&positive.length===0}
})
const output={schemaVersion:'1.0',source:'Both original XLSM workbooks; Excel 16 CalculateFullRebuild temporary-copy captures',bomSheet:'F1',range:'Q5:Q32',positionCount:rows.length,supportedCount:rows.filter(x=>x.status==='CALCULATED').length,globallyNotApplicableCount:rows.filter(x=>x.status==='NOT_APPLICABLE').length,unsupportedCount:0,rows}
writeFileSync(new URL('../../docs/jv/FRONT_BOM_COVERAGE.json',import.meta.url),JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify({positionCount:output.positionCount,supportedCount:output.supportedCount,globallyNotApplicableCount:output.globallyNotApplicableCount,unexercisedPositiveRows:rows.filter(x=>x.unexercisedPositiveBranch).map(x=>x.row)},null,2))
