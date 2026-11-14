import {readFileSync,writeFileSync} from 'node:fs'
const base=JSON.parse(readFileSync('docs/jv/fixtures/unified-order-all-seven-inputs.json','utf8'))
const fixture=JSON.parse(readFileSync('docs/jv/fixtures/front-pr12a-excel.json','utf8')).scenarios
const scenarios=[]
for(const profile of ['COMPLETATION','RETAIL'])for(const mode of [1,2]){
 const s=structuredClone(base.scenarios.find(x=>x.profile===profile))
 const f=fixture.find(x=>x.scenarioId===`${profile}-fittings`)
 s.scenarioId=`door-fittings-${profile.toLowerCase()}-f28-${mode}`
 s.orderSettings.F28=mode
 const front=s.engineInput.positions.find(p=>p.family==='FRONT');const c=front.calculation.construction
 c.widthMm=String(f.main.C11.value);c.heightMm=String(f.main.D11.value);c.sectionDemand=String(f.main.L11.value);c.finishSelector=Number(f.main.H11.value);c.glassSelector=Number(f.main.I11.value);c.openingSelector=Number(f.main.J11.value)
 for(const k of ['C11','C12','C13','C14','C15','C18','C19','C20','C21','C22','C23','C24'])c.controls[k]=Number(f.front[k].value)
 for(const k of ['D18','D19'])c.controls[k]=String(f.front[k].value)
 for(const k of ['H38','H40','H42','H44','I42','I44'])c.settings[k]=Number(f.settings[k].value)
 const update=(sheet,address,value)=>{const w=s.primaryInputWrites.filter(x=>x.sheet===sheet&&x.address===address);if(w.length>1)throw Error(`Duplicate ${sheet}!${address}`);if(w.length)w[0].value=value;else s.primaryInputWrites.push({sheet,address,value,source:'independent Front fittings source',family:'FRONT'})}
 for(const [a,v] of Object.entries({C17:+c.widthMm,D17:+c.heightMm,H17:c.finishSelector,I17:c.glassSelector,J17:c.openingSelector,L17:+c.sectionDemand}))update('Главная',a,v)
 for(const [k,v] of Object.entries(c.controls))update('F7',k,Number(v))
 for(const k of ['H38','H40','H42','H44','I42','I44'])update('Настройки',k,c.settings[k])
 update('Главная','F28',mode)
 for(const p of s.engineInput.positions){const t=p.calculation;if(p.family==='LINE')t.input.commercialModeIndex=mode;else if(p.family==='ZIGZAG')t.position.commercial.F28=mode;else if(p.family==='FRONT')t.commercial.mainSurchargeSelector=mode;else t.controls.mainSurchargeSelector=mode}
 s.engineInput.frontSlot7B26={schemaVersion:'1.0',sourceCell:'Главная!B26',workbook:s.workbook,workbookSha256:s.sourceSha256,value:s.orderSettings.frontMainSurchargeSelector,version:'JV-PR13E-B26-SCENARIO-1',sourceScenarioId:s.scenarioId}
 scenarios.push(s)
}
writeFileSync('docs/jv/fixtures/front-door-all-seven-inputs.json',JSON.stringify({schemaVersion:'1.0',scenarios},null,2)+'\n')
console.log(`Prepared ${scenarios.length} Front F7 cases`)
