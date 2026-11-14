import {readFileSync, writeFileSync} from 'node:fs'
import {calculateJVOrder} from '../../packages/shared/src/jv/unified-order.ts'
import {multiplyRational} from '../../packages/shared/src/jv/rational.ts'
const source=JSON.parse(readFileSync('docs/jv/fixtures/front-slot7-b26-r2-excel.json','utf8')).records
const manifest=JSON.parse(readFileSync('docs/jv/fixtures/unified-order-all-seven-inputs.json','utf8'))
function classify(r,c){
 if(!r||typeof c?.value2!=='number'||!Number.isFinite(c.value2))return 'UNVERIFIED'
 const v=new DataView(new ArrayBuffer(8));v.setFloat64(0,c.value2);const bits=v.getBigUint64(0),negative=bits>>63n,exponent=Number((bits>>52n)&2047n),fraction=bits&((1n<<52n)-1n),mantissa=exponent===0?fraction:(1n<<52n)|fraction,shift=(exponent===0?-1022:exponent-1023)-52
 const n=(negative?-mantissa:mantissa)<<BigInt(Math.max(shift,0)),d=1n<<BigInt(Math.max(-shift,0))
 if(BigInt(r.numerator)*d===n*BigInt(r.denominator))return 'EXACT'
 const x=Number(r.numerator)/Number(r.denominator);if(Object.is(x,c.value2))return 'NUMERICALLY_EQUIVALENT'
 const digits=c.numberFormat.match(/[.,](0+)/)?.[1].length??0
 const normalize=s=>s.replace(/[\s\u00a0\u202f,]/g,'')
 const text=new Intl.NumberFormat('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits,useGrouping:c.numberFormat.includes('##0')}).format(x)
 return normalize(text)===normalize(c.text)?'DISPLAY_MATCH':'MISMATCH'
}
const comparisons=[]
for(const record of source){
 const scenario=manifest.scenarios.find(s=>s.scenarioId===record.scenario&&s.profile===record.profile)
 if(!scenario||scenario.sourceSha256!==record.sha256||record.excelVersion!=='16.0'||![1,2].includes(record.B26.value2))throw Error('Invalid Excel capture provenance')
 const input=structuredClone(scenario.engineInput)
 for(const p of input.positions){const c=p.calculation;if(p.family==='LINE')c.input.commercialModeIndex=record.F28;else if(p.family==='ZIGZAG')c.position.commercial.F28=record.F28;else if(p.family==='FRONT')c.commercial.mainSurchargeSelector=record.F28;else c.controls.mainSurchargeSelector=record.F28}
 input.frontSlot7B26={schemaVersion:'1.0',sourceCell:'Главная!B26',workbook:record.workbook,workbookSha256:record.sha256,value:record.B26.value2,version:'JV-PR13E-B26-SCENARIO-1',sourceScenarioId:record.scenario}
 const result=calculateJVOrder(input),front=result.positions.find(p=>p.family==='FRONT'&&p.slot===7),trace=front?.calculation.trace.find(t=>t.source?.sheet==='F7'&&t.source.cell==='Y5')
 const items=[['F7!Y5',record.Y5,trace?.result],['F7!S36',record.S36,front?.calculation.s36],['F7!S38',record.S38,front?.calculation.s38],['Главная!AA17',record.AA17,front?.confirmedUnitAmount&&multiplyRational(front.confirmedUnitAmount,front.quantity)],['Главная!AA18',record.AA18,result.totalSalePrice]]
 for(const [address,cell,engine] of items)comparisons.push({profile:record.profile,scenario:record.scenario,F28:record.F28,B26:record.B26.value2,address,formula:cell.formula,excelValue2:cell.value2,excelText:cell.text,numberFormat:cell.numberFormat,engineRational:engine??null,status:classify(engine,cell)})
 const s36trace=front?.calculation.trace.find(t=>t.ruleId==='JV.FRONT.COMMERCIAL.S36');if(s36trace?.source?.sheet!=='F7'||!s36trace.source.formula.includes('$B$26'))throw Error('F7 trace is missing its true Excel source')
}
const counts=Object.fromEntries(['EXACT','NUMERICALLY_EQUIVALENT','DISPLAY_MATCH','MISMATCH','UNVERIFIED'].map(s=>[s,comparisons.filter(c=>c.status===s).length]))
writeFileSync('docs/jv/FRONT_SLOT7_B26_R2_PARITY.json',JSON.stringify({capture:'fixtures/front-slot7-b26-r2-excel.json',scenarioCount:source.length,comparisonCount:comparisons.length,counts,comparisons},null,2)+'\n')
console.log(JSON.stringify(counts));if(counts.MISMATCH||counts.UNVERIFIED)process.exitCode=1
