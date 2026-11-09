import { readFileSync, writeFileSync } from 'node:fs'

const capture=JSON.parse(readFileSync('docs/jv/fixtures/slider-pr11j-commercial-capture.json','utf8'))
const profiles=['COMPLETATION','RETAIL']
const literal=(cell,where)=>{
 const entry=where[cell]
 if(!entry||typeof entry.formula!=='string'||!/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(entry.formula))throw new Error(`Expected literal numeric source at ${cell}; received ${entry?.formula}`)
 return {value:entry.formula,sourceFormula:entry.formula,sourceValue2:entry.value,numberFormat:entry.format}
}
const sourced=(record,sourceCell)=>({...record,sourceCell})
const expectedWorkbook={COMPLETATION:'JV-комплектация 08.10.2026.xlsm',RETAIL:'JV-розница 08.10.2026.xlsm'}
const sources=profiles.map(profile=>{
 const r=capture.find(x=>x.profile===profile)
 if(!r||r.recalc!=='CalculateFullRebuild'||r.excelVersion!=='16.0')throw new Error(`No Excel 16 rebuilt source capture for ${profile}`)
 if(r.workbook!==expectedWorkbook[profile])throw new Error(`Wrong source workbook for ${profile}`)
 const settings=Object.fromEntries(['D4','D13','D21','L8','L9','L10','L11','L17','L18','S26'].map(cell=>[cell,sourced(literal(cell,r.settings),`Настройки!${cell}`)]))
 const materialPrices={}
 for(let row=5;row<=46;row++){const entry=r.sliderCatalog[`E${row}`];if(entry&&/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(entry.formula))materialPrices[row]=sourced(literal(`E${row}`,r.sliderCatalog),`Прайс-Slider!E${row}`)}
 const paintRates={}
 for(let row=5;row<=21;row++)paintRates[row]=sourced(literal(`G${row}`,r.sliderCatalog),`Прайс-Slider!G${row}`)
 const glassRates={}
 for(let index=1;index<=12;index++){const cell=`D${index+4}`;glassRates[index]=sourced(literal(cell,r.glassSheet),`Прайс-Стекло!${cell}`)}
 const serviceRates=Object.fromEntries(['C7','C14','C15','C19','C23','C24','C25'].map(cell=>[cell,sourced(literal(cell,r.serviceRates),`Прайс-сб+монт!${cell}`)]))
 return {schemaVersion:'1.0',profile,version:`JV-SLIDER-X5-PRICE-${profile}-2026-10-08-${r.sha256.slice(0,12)}`,workbook:r.workbook,workbookSha256:r.sha256,capturedFrom:'EXCEL_COM_LITERAL_FORMULAS',capturedWithExcel:r.excelVersion,currency:'RUB',settings,materialPrices,paintRates,glassRates,serviceRates,provenance:{captureFixture:'docs/jv/fixtures/slider-pr11j-commercial-capture.json',scenarioId:r.scenarioId,priceCellsAreSourceLiterals:true}}
})
writeFileSync('docs/jv/fixtures/slider-x5-price-snapshots.json',JSON.stringify({schemaVersion:'1.0',sources},null,2)+'\n')
console.log(JSON.stringify({profiles:sources.map(x=>({profile:x.profile,version:x.version,materialPrices:Object.keys(x.materialPrices).length,paintRates:Object.keys(x.paintRates).length,glassRates:Object.keys(x.glassRates).length}))},null,2))
