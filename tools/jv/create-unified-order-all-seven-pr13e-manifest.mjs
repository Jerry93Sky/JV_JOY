import {readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {unifiedLinePosition,unifiedZigzagPosition,unifiedSliderPosition,unifiedFrontPosition} from './unified-order-scenario-fixtures.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const probe=JSON.parse(await readFile(path.join(root,'docs/jv/fixtures/unified-order-excel-probe.json'),'utf8'))
const settings={D32:true,D33:false,D34:false,L3:true,F28:1,frontMainSurchargeSelector:1}
const vectors=[
 {id:'base',q:[1,1,1,1,1,1,1]},
 {id:'multi-quantity',q:[2,1,3,1,2,1,2]},
 {id:'quantity-zigzag-slider',q:[1,3,1,2,1,2,1]},
 {id:'quantity-front-line',q:[2,1,1,1,1,1,3]},
 {id:'quantity-all-distinct',q:[1,2,3,2,1,3,2]},
 {id:'quantity-high-mix',q:[3,2,1,3,2,1,4]}
]
const mainCells=(position)=>{
 const c=position.calculation
 if(position.family==='LINE')return {H:c.input.finishSelectionIndex,I:c.input.glassSelectionIndex,J:c.input.direction==='НАЛЕВО'?1:2,K:Number(c.input.sideCount),L:Number(c.input.leaves),N:Number(c.input.profileCount)}
 if(position.family==='ZIGZAG')return {H:Number(c.position.commercial.c8),I:c.position.commercial.glassTypeSelector,J:Number(c.position.geometry.openingSelector),K:1,L:Number(c.position.geometry.leafSelector)}
 if(position.family.startsWith('SLIDER_'))return {H:c.controls.priceMode,I:c.controls.glassSelector,J:Number(c.geometry.openingSelector),M:Number(c.geometry.leafCount)}
 return {H:c.construction.finishSelector,I:c.construction.glassSelector,J:c.construction.openingSelector,L:Number(c.construction.sectionDemand)}
}
const familyWrites=(p)=>{
 const c=p.calculation, writes=[]
 if(p.family==='LINE'){
  const i=c.input,sheet=`L${p.slot}`
  for(const [address,value,source] of [['C21',i.specialSashEnabled,'input.specialSashEnabled'],['D21',Number(i.specialSashWidthMm),'input.specialSashWidthMm'],['D22',Number(i.rollerAxisToEdgeMm),'input.rollerAxisToEdgeMm'],['C23',i.parkedDoorSelected,'input.parkedDoorSelected'],['C24',Number(i.parkedDoorPosition),'input.parkedDoorPosition'],['C25',i.parkedDoorReuseOpening,'input.parkedDoorReuseOpening'],['D25',Number(i.parkedDoorWidthMm),'input.parkedDoorWidthMm']])writes.push({sheet,address,value,source})
 }
 if(p.family==='ZIGZAG')for(const address of ['N40','N41'])writes.push({sheet:`Z${p.slot}`,address,value:Number(c.position.commercial[address]),source:`calculation.position.commercial.${address}`})
 if(p.family==='FRONT')for(const [address,value] of Object.entries(c.construction.controls))writes.push({sheet:`F${p.slot}`,address,value:typeof value==='string'?Number(value):value,source:`calculation.construction.controls.${address}`})
 return writes
}
const makePositions=(profile)=>[
 unifiedLinePosition('line-1',1,'1',profile),
 unifiedZigzagPosition(profile),
 ...Array.from({length:4},(_,i)=>unifiedSliderPosition(i,profile)),
 unifiedFrontPosition(profile)
].map((p,i)=>{
 if(p.family==='LINE')p={...p,calculation:{...p.calculation,input:{...p.calculation.input,assemblyEnabled:settings.D33,millingEnabled:settings.L3,installationEnabled:settings.D34}}}
 if(p.family==='ZIGZAG')p={...p,calculation:{...p.calculation,position:{...p.calculation.position,commercial:{...p.calculation.position.commercial,D32:settings.D32,D33:settings.D33,D34:settings.D34,L3:settings.L3,F28:settings.F28}}}}
 if(p.family.startsWith('SLIDER_'))p={...p,calculation:{...p.calculation,controls:{...p.calculation.controls,additionalWorkEnabled:settings.D32,widthServiceEnabled:settings.D33,installationEnabled:settings.D34,l3SpecificLatchChargeEnabled:settings.L3,mainSurchargeSelector:settings.F28}}}
 if(p.family==='FRONT')p={...p,calculation:{...p.calculation,commercial:{...p.calculation.commercial,mainSurchargeSelector:settings.frontMainSurchargeSelector,finishingEnabled:settings.D32,installationEnabled:settings.D34}}}
 return p
})
const scenarios=[]
for(const profile of ['COMPLETATION','RETAIL']){
 const probeCase=probe.find(x=>x.profile===profile)
 const discountSource=probeCase.commercialSettings
 const mainDiscount={schemaVersion:'1.0',profile,workbook:probeCase.workbook,workbookSha256:probeCase.sha256,capturedWithExcel:'16.0',sourceCell:'Настройки!D19',sourceFormula:String(discountSource.D19.formula),value:String(discountSource.D19.value2),positionMarkups:Array.from({length:7},(_,i)=>({slot:i+1,sourceCell:`Настройки!D${21+i}`,sourceFormula:String(discountSource[`D${21+i}`].formula),value:String(discountSource[`D${21+i}`].value2)})),positionDivisors:[['LINE','D11'],['ZIGZAG','D12'],['SLIDER','D13'],['FRONT','D14']].map(([family,cell])=>({family,sourceCell:`Настройки!${cell}`,sourceFormula:String(discountSource[cell].formula),value:String(discountSource[cell].value2)}))}
 for(const v of vectors){
  const base=makePositions(profile)
  const positions=base.map((p,i)=>({...p,quantity:String(v.q[i])}))
  const writes=[...Object.entries(settings).map(([key,value])=>({sheet:key==='F28'||key==='frontMainSurchargeSelector'?'Главная':'Настройки',address:key==='frontMainSurchargeSelector'?'B26':key,value,source:`orderSettings.${key}`}))]
  for(const p of positions){
   const c=p.calculation
   const width=Number(p.family==='LINE'?c.input.widthMm:p.family==='ZIGZAG'?c.position.geometry.widthMm:p.family.startsWith('SLIDER_')?c.geometry.widthMm:c.construction.widthMm)
   const height=Number(p.family==='LINE'?c.input.heightMm:p.family==='ZIGZAG'?c.position.geometry.heightMm:p.family.startsWith('SLIDER_')?c.geometry.heightMm:c.construction.heightMm)
   const mc=mainCells(p),row=10+p.slot,selector=p.slot
   for(const [address,value,source] of [[`F${row}`,selector,'family-to-selector mapping'],[`C${row}`,width,'typed geometry width'],[`D${row}`,height,'typed geometry height'],[`Z${row}`,Number(p.quantity),'position quantity'],...Object.entries(mc).map(([k,value])=>[`${k}${row}`,value,`family primary input ${k}`])])writes.push({sheet:'Главная',address,value,source,family:p.family})
   writes.push(...familyWrites(p).map(w=>({...w,family:p.family})))
  }
  const unique=new Map()
  for(const w of writes){const key=`${w.sheet}!${w.address}`;if(unique.has(key)&&JSON.stringify(unique.get(key).value)!==JSON.stringify(w.value))throw new Error(`Conflicting manifest writes at ${key}`);unique.set(key,w)}
  scenarios.push({scenarioId:`pr13e-${profile.toLowerCase()}-${v.id}`,profile,workbook:probeCase.workbook,sourceSha256:probeCase.sha256,excelVersion:'16.0',calculationMode:'CalculateFullRebuild',orderId:`PR13E-${profile}-${v.id}`,orderSettings:settings,engineInput:{orderId:`PR13E-${profile}-${v.id}`,profile,positions,mainDiscount},primaryInputWrites:[...unique.values()],sourceMap:{primaryInputs:'Typed UnifiedPositionInput and per-family source workbook cells; mapped addresses are recorded on each write.',sharedSettings:'Excel Настройки!D32,D33,D34,L3 and Главная!F28; aligned to one order-level setting set.',excelDerived:'Main G/K/M/Y/R:X and all family calculation outputs are derived by Excel and are never used as engine inputs.',frontSlot:'Front uses F7!Y5/F7!S38 and Main slot 7 / ПРМ!AB31.'}})
 }
}
const manifest={schemaVersion:'1.0',purpose:'Canonical PR_13E all-seven primary input manifest shared by Excel COM capture and calculateJVOrder. Contains no Excel calculated prices.',source:'Existing typed family fixture builders plus versioned snapshots whose source workbook names and SHA-256 match the original books.',profileCount:2,scenarioCount:scenarios.length,positionFamilies:['LINE','ZIGZAG','SLIDER_L3','SLIDER_L5','SLIDER_X3','SLIDER_X5','FRONT'],scenarioCountPerProfile:vectors.length,sharedSettingsDefinition:settings,scenarios}
await writeFile(path.join(root,'docs/jv/fixtures/unified-order-all-seven-inputs.json'),JSON.stringify(manifest,null,2)+'\n','utf8')
console.log(JSON.stringify({manifest:'docs/jv/fixtures/unified-order-all-seven-inputs.json',scenarios:scenarios.length,positions:scenarios.reduce((n,s)=>n+s.engineInput.positions.length,0),inputWrites:scenarios.reduce((n,s)=>n+s.primaryInputWrites.length,0),profiles:{COMPLETATION:6,RETAIL:6}},null,2))
