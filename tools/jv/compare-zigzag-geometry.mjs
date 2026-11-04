import { readFileSync, writeFileSync } from 'node:fs'
import { calculateZigzagGeometry } from '../../packages/shared/src/jv/zigzag/geometry.ts'
import { rationalToDecimalExact } from '../../packages/shared/src/jv/rational.ts'
import { calculateZigzagBaseMaterialQuantities } from '../../packages/shared/src/jv/zigzag/material-quantities.ts'

const input=process.argv[2]??'docs/jv/fixtures/zigzag-geometry-excel.json'
const output=process.argv[3]??'docs/jv/NEXT_FAMILY_EXCEL_PARITY.json'
const fixture=JSON.parse(readFileSync(input,'utf8'))
const formulas={D5:'=IF(Главная!M11>=2,Главная!M11,"МАЛО!")',D6:'=IF(Главная!K11<=2,Главная!K11,"НЕТ")',H4:'=D3-IF(D13="ДА",2*Настройки!P4,0)-Настройки!P25-Настройки!P26',H5:'=2*D5-1',H6:'=H4/H5',H7:'=H6-0.5*Настройки!P27+Настройки!P24',H8:'=2*H6-Настройки!P27',H9:'=2*H6-0.5*Настройки!P27-Настройки!P29',H13:'=D3-IF(D13="ДА",2*Настройки!P4,0)-2*Настройки!P25',H14:'=2*D5-1',H15:'=0.5*H13/H14',H16:'=H15+Настройки!P24-0.5*Настройки!P27',H17:'=2*H15-Настройки!P27',H18:'=2*H15-0.5*Настройки!P27-0.5*Настройки!P28',D29:'=IF(D6=1,H7,0)+IF(D6=2,H16,0)-Настройки!L23',D30:'=IF(D6=1,H8,0)+IF(D6=2,H17,0)-Настройки!L23',D31:'=IF(D6=1,H9,0)+IF(D6=2,H18,0)-Настройки!L23'}
const rows=[]
for(const c of fixture.cases){
 const x=calculateZigzagGeometry({...c.inputs,settings:c.settings})
 for(const [cell,formula] of Object.entries(formulas)){
  const ev=c.cells[cell], exact=cell==='D5'?x.inputs.normalizedSashCount:cell==='D6'?String(x.inputs.normalizedOpeningCount):rationalToDecimalExact(x.outputs[cell])
  const classification=exact===undefined?'UNVERIFIED':exact===ev?'EXACT':'MISMATCH'
  rows.push({scenario:c.id,profile:c.profile,cell,formula,excel:ev,engineExact:exact??null,engineRational:x.outputs[cell]??null,classification})
 }
 const bom=calculateZigzagBaseMaterialQuantities(x).specification
 const bomSources={N9:['LN-070-A','=($D$5-1)*$D$6'],N10:['LN-080','=$D$5*$D$6'],N13:['LN-120','=$D$6'],N14:['LN-130','=$D$6'],N16:['LN-180','=$N$9'],N17:['LN-TL','=0'],N18:['LN-TR','=IF($D$6=2,2,0)'],N19:['LN-TF','=IF($D$13="ДА",0,2)'],N27:['LN-210','=$D$5*$D$6-$D$6'],N28:['LN-220','=$N$27'],N32:['AA-050','=($D$6*$D$5)-1']}
 for(const [cell,[sku,formula]] of Object.entries(bomSources)){
  const line=bom.find(x=>x.catalogId===sku), engine=line?.quantity?.value??null, excel=c.cells[cell]
  rows.push({scenario:c.id,profile:c.profile,cell,formula,sku,excel,engineExact:engine,classification:engine===excel?'EXACT':'MISMATCH'})
 }
}
const counts=Object.fromEntries(['EXACT','DISPLAY_MATCH','NUMERICALLY_EQUIVALENT','MISMATCH','UNVERIFIED'].map(k=>[k,rows.filter(x=>x.classification===k).length]))
const report={schemaVersion:1,sourceFixture:input,method:'Fresh Excel 16 CalculateFullRebuild on temporary original workbook copies. Engine uses exact rational arithmetic. Excel COM JSON Value2 lacks the full binary rational; non-terminating engine rationals are UNVERIFIED, with no tolerance.',counts,cases:rows}
writeFileSync(output,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({scenarios:fixture.cases.length,comparisons:rows.length,counts},null,2))
if(counts.MISMATCH) process.exitCode=1
