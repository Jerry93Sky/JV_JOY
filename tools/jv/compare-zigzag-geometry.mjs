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
 const bom=calculateZigzagBaseMaterialQuantities(x)
 const bomSources={N5:['LN-010','=D20/1000+Настройки!D8/1000'],N6:['LN-020','=(C22*D22+C23*D23)/1000+Настройки!D6/1000'],N7:['LN-030','=N6'],N8:['LN-040','=IF(D13="ДА",C21*D21/1000+Настройки!D8/1000,0)'],N9:['LN-070-A','=($D$5-1)*$D$6'],N10:['LN-080','=$D$5*$D$6'],N11:['LN-100','=$N$10+IF($D$15="ДА",1,0)'],N12:['LN-110','=IF($D$14="ДА",$D$6,0)'],N13:['LN-120','=$D$6'],N14:['LN-130','=$D$6'],N15:['LN-150','=1'],N16:['LN-180','=$N$9'],N17:['LN-TL','=0'],N18:['LN-TR','=IF($D$6=2,2,0)'],N19:['LN-TF','=IF($D$13="ДА",0,2)'],N20:['LN-TSL','=IF($D$13="ДА",1,0)*$G$40'],N21:['LN-TSR','=IF($D$13="ДА",1,0)*$G$41'],N22:['LN-BL','=N17'],N23:['LN-BR','=N18'],N24:['LN-BF','=N19'],N25:['LN-BSL','=N20'],N26:['LN-BSR','=N21'],N27:['LN-210','=D5*D6-D6'],N28:['LN-220','=N27'],N29:['LN-230','=IF(D17="ДА",1,0)'],N30:['AA-010','=ROUNDUP(2*N7/(Настройки!L7*Настройки!P21/1000),0)'],N31:['AA-020','=(2*N5+IF(D16="ДА",2*N6,0)+IF(D13="ДА",N8,0))/Настройки!L8'],N32:['AA-050','=D6*D5-1'],N33:['AA-070','=2'],N34:['AA-110','=ROUNDUP(0.001*2*D3/Настройки!L4,IF(Настройки!L6,0,3))'],N35:['AA-120','=ROUNDUP(0.001*2*D3/Настройки!L5,IF(Настройки!L6,0,3))']}
 for(const [cell,[sku,formula]] of Object.entries(bomSources)){
  const rational=bom.exactQuantities[Number(cell.slice(1))],engine=rational?rationalToDecimalExact(rational):null,excel=c.cells[cell]
  const classification=engine===undefined?'UNVERIFIED':engine===excel?'EXACT':'MISMATCH'
  rows.push({scenario:c.id,profile:c.profile,cell,formula,sku,excel,engineExact:engine??null,engineRational:rational??null,classification})
 }
 const intermediateFormulas={C22:'=D6',C23:'=D5*D6-C22',D22:'=D29+2*Настройки!P16+2*Настройки!P17-Настройки!P12-Настройки!P13+Настройки!L23',D23:'=D30+2*Настройки!P16+2*Настройки!P17-2*Настройки!P13+Настройки!L23',G37:'=IF(Главная!J11=1,1,IF(Главная!J11=2,2,IF(Главная!J11=3,3,"ОШИБКА !")))',G38:'=IF(ISEVEN(D5),2,1)',G39:'=10*G37+G38',H39:"=MATCH(G39,'#3'!N5:N10)",G40:"=INDEX('#3'!O5:O10,H39)",G41:"=INDEX('#3'!P5:P10,H39)"}
 for(const [cell,formula] of Object.entries(intermediateFormulas)){
  const rational=bom.intermediates[cell],engine=rationalToDecimalExact(rational),excel=c.cells[cell]
  const classification=engine===undefined?'UNVERIFIED':engine===excel?'EXACT':'MISMATCH'
  rows.push({scenario:c.id,profile:c.profile,cell,formula,excel,engineExact:engine??null,engineRational:rational,classification})
 }
}
const counts=Object.fromEntries(['EXACT','DISPLAY_MATCH','NUMERICALLY_EQUIVALENT','MISMATCH','UNVERIFIED'].map(k=>[k,rows.filter(x=>x.classification===k).length]))
const formulaByCell=Object.fromEntries([...new Map(rows.map(({cell,formula})=>[cell,formula]))])
const catalogByCell=Object.fromEntries([...new Map(rows.filter(x=>x.sku).map(({cell,sku})=>[cell,sku]))])
const cases=rows.map(({formula,sku,engineRational,...row})=>({...row,...(engineRational&&row.engineExact===null?{engineRational}: {})}))
const report={schemaVersion:2,sourceFixture:input,method:'Fresh Excel 16 CalculateFullRebuild on temporary original workbook copies. Engine uses exact rational arithmetic. Excel COM JSON Value2 lacks the full binary rational; non-terminating engine rationals are UNVERIFIED, with no tolerance.',counts,formulaByCell,catalogByCell,cases}
writeFileSync(output,JSON.stringify(report)+'\n')
console.log(JSON.stringify({scenarios:fixture.cases.length,comparisons:rows.length,counts},null,2))
if(counts.MISMATCH) process.exitCode=1
