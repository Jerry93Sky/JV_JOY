import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {calculateJVOrder,type UnifiedPositionInput} from './unified-order.ts'
import {calculateSliderL3Commercial,buildSliderL3PriceSnapshot} from './slider/pricing.ts'
import {calculateSliderL5Commercial,calculateSliderX3Commercial,calculateSliderX5Commercial,buildSliderL5PriceSnapshot,buildSliderX3PriceSnapshot,buildSliderX5PriceSnapshot} from './slider/l5-pricing.ts'
import type {SliderL3GeometryInput} from './slider/geometry.ts'
import type {SliderL5GeometryInput} from './slider/l5-geometry.ts'
import type {SliderX3GeometryInput} from './slider/x3-geometry.ts'
import type {SliderX5GeometryInput} from './slider/x5-geometry.ts'
import {calculateLineConstruction} from './line-calculator.ts'
import {addRational,multiplyRational,rationalFromDecimal} from './rational.ts'
import {decimalString} from './decimal.ts'
import type {LineEngineInputs,LineEngineSettings} from './line-calculator.ts'
import {calculateZigzagOrder} from './zigzag/order-calculation.ts'
import {calculateFrontCommercial} from './front/commercial.ts'

const read=(file:string)=>JSON.parse(readFileSync(new URL(file,import.meta.url),'utf8')) as any
function line(id:string,slot:number,quantity:string,profile:'COMPLETATION'|'RETAIL'='COMPLETATION'):UnifiedPositionInput {
 const cases=read('../../../../docs/jv/fixtures/line-price-excel-golden.json'),snapshots=read('../../../../docs/jv/fixtures/line-price-snapshots.json').sources,glass=read('../../../../docs/jv/fixtures/line-glass-price-snapshots.json').sources,paint=read('../../../../docs/jv/fixtures/line-paint-price-snapshots.json').sources,r=cases.cases.find((x:any)=>x.profile===profile&&x.scenarioId==='line_single_with_park')!,workbook=r.workbook,v=r.sourceInputs,s=r.settingsInputs,gs=glass.find((x:any)=>x.profile===profile)!
 const input:LineEngineInputs={constructionId:id,constructionQuantity:decimalString(quantity),commercialModeIndex:1,glassSelectionIndex:9,finishSelectionIndex:1,profile,workbook,widthMm:decimalString(v.D3.value),heightMm:decimalString(v.D4.value),leaves:decimalString(v.D5.value),sideCount:decimalString(v.D6.value),direction:v.D7.value,profileCount:decimalString(v.D8.value),connectorAngle:decimalString(v.D9.value),frameState:v.D15.value,knobState:v.D16.value,latchState:v.D17.value,weatherSealState:v.D18.value,floorLockState:v.D19.value,bottomPivotState:v.D20.value,specialSashEnabled:Boolean(v.C21.value),specialSashWidthMm:decimalString(v.D21.value),rollerAxisToEdgeMm:decimalString(v.D22.value),parkedDoorSelected:Boolean(v.C23.value),parkedDoorPosition:decimalString(v.C24.value),parkedDoorReuseOpening:Boolean(v.C25.value),parkedDoorWidthMm:decimalString(v.D25.value),assemblyEnabled:Boolean(s.D33.value),millingEnabled:Boolean(s.L3.value),installationEnabled:Boolean(s.D34.value)}
 const keys=['P2','P3','P4','P5','P6','P7','P8','P9','P10','P12','P13','P14','P15','P16','P17','L23','D6','D7','D8','L4','L5','L7','L8','P21'],sv=Object.fromEntries(keys.map(k=>[k,String(s[k].value)]))
 return {id,slot,family:'LINE',quantity,calculation:{input,settings:{...sv,P19:gs.settings.P19,L17:gs.settings.L17,L18:gs.settings.L18,L22:gs.settings.L22,L6:Boolean(s.L6.value),L21:Boolean(gs.settings.L21),D32:Boolean(gs.settings.D32)} as LineEngineSettings,priceSnapshot:snapshots.find((x:any)=>x.profile===profile),glassSnapshot:gs,paintSnapshot:paint.find((x:any)=>x.profile===profile)}}
}
const selector=read('../../../../docs/jv/fixtures/slider-pr11a-selector-capture.json')
const variants=[
 {family:'SLIDER_L3',capture:'slider-pr11d-commercial-capture.json',snapshot:'slider-l3-price-snapshots.json',bom:'slider-pr11c-bom-capture.json',f:3,build:buildSliderL3PriceSnapshot,run:calculateSliderL3Commercial},
 {family:'SLIDER_L5',capture:'slider-pr11f-commercial-capture.json',snapshot:'slider-l5-price-snapshots.json',bom:'slider-pr11e-bom-capture.json',f:4,build:buildSliderL5PriceSnapshot,run:calculateSliderL5Commercial},
 {family:'SLIDER_X3',capture:'slider-pr11h-commercial-capture.json',snapshot:'slider-x3-price-snapshots.json',bom:'slider-pr11g-bom-capture.json',f:5,build:buildSliderX3PriceSnapshot,run:calculateSliderX3Commercial},
 {family:'SLIDER_X5',capture:'slider-pr11j-commercial-capture.json',snapshot:'slider-x5-price-snapshots.json',bom:'slider-pr11i-bom-capture.json',f:6,build:buildSliderX5PriceSnapshot,run:calculateSliderX5Commercial},
] as const
function sliderPosition(index:number,profile:'COMPLETATION'|'RETAIL'='COMPLETATION'):UnifiedPositionInput {
 const def=variants[index]!,record=read(`../../../../docs/jv/fixtures/${def.capture}`).find((x:any)=>x.profile===profile)!,base=selector.scenarios.find((x:any)=>x.profile===profile&&x.inputs.F11===def.f)!,sv=base.settings.cells,bom=read(`../../../../docs/jv/fixtures/${def.bom}`).find((x:any)=>x.profile===profile&&x.scenarioId==='slider_default')!,snapshot=(read(`../../../../docs/jv/fixtures/${def.snapshot}`).sources as any[]).map(def.build).find((x:any)=>x.profile===profile)!
 const common={workbook:record.workbook,widthMm:String(record.requestedInputs.C11),heightMm:String(record.requestedInputs.D11),leafCount:String(record.requestedInputs.M11),openingSelector:record.requestedInputs.J11,interlockState:record.cells.D17.value,meetingSealState:record.cells.D18.value}
 const settings={D8:String(sv.D8.value),S2:String(sv.S2.value),S3:String(sv.S3.value),S4:String(sv.S4.value),S6:String(sv.S6.value),S9:String(sv.S9.value),S10:String(sv.S10.value),S11:String(sv.S11.value),S12:String(sv.S12.value),S13:String(sv.S13.value),S14:String(sv.S14.value),L23:String(sv.L23.value),H25:Boolean(sv.H25.value)}
 let geometry:SliderL3GeometryInput|SliderL5GeometryInput|SliderX3GeometryInput|SliderX5GeometryInput
 if(index===0)geometry={...common,systemSelector:3,settings:{...settings,S21:String(sv.S21.value)}} as SliderL3GeometryInput
 else if(index===1)geometry={...common,systemSelector:4,settings:{...settings,S21:String(sv.S21.value),S22:String(sv.S22.value)}} as SliderL5GeometryInput
 else if(index===2)geometry={...common,systemSelector:5,settings:{...settings,S21:String(sv.S21.value),S23:String(sv.S23.value)}} as SliderX3GeometryInput
 else geometry={...common,systemSelector:6,selectorControls:{I15:Number(record.settings.I15.value),C17:Number(record.cells.C17.value),I17:Number(record.settings.I17.value),C18:Number(record.cells.C18.value)},settings:{...settings,S24:String(sv.S24.value)}} as SliderX5GeometryInput
 const optionsBase={interlockEnabled:Boolean(record.settings.H21?.value??sv.H21?.value),fittingUpgradeEnabled:Boolean(record.settings.H23?.value??sv.H23?.value),selectorControls:{I25:Number(record.settings.I25.value),C20:Number(record.cells.C20.value),I29:Number(record.settings.I29.value),C24:Number(record.cells.C24.value),I31:Number(record.settings.I31.value),C26:Number(record.cells.C26.value)}}
 const bomSettings={D6:String(record.settings.D6.value),D8:String(record.settings.D8.value),S7:String(record.settings.S7.value),L4:String(record.settings.L4.value),L5:String(record.settings.L5.value),L6:Boolean(record.settings.L6.value),H19:Number(record.settings.H19.value) as 1|2,H25:Boolean(record.settings.H25.value),H27:Boolean(record.settings.H27.value)}
 const controls={priceMode:Number(record.cells.C11?.value??record.main.H11.formula) as 1|2|3|4,mainSurchargeSelector:Number(record.main.F28.value??record.main.F28.formula) as 1|2,glassSelector:Number(record.cells.C12?.value??record.main.I11.formula),additionalWorkEnabled:Boolean(record.settings.D32.value),widthServiceEnabled:Boolean(record.settings.D33.value),l3SpecificLatchChargeEnabled:Boolean(record.settings.L3.value),installationEnabled:Boolean(record.settings.D34.value)}
 const calculation=index===0?{geometry:geometry as SliderL3GeometryInput,bomOptions:{...optionsBase,jointPairSelection:record.cells.D22.value},bomSettings:{...bomSettings,S16:String(bom.settings.S16)},snapshot,controls}:index===1?{geometry:geometry as SliderL5GeometryInput,bomOptions:{...optionsBase,jointPairSelection:record.cells.D22.value},bomSettings:{...bomSettings,S17:String(sv.S17.value)},snapshot,controls}:index===2?{geometry:geometry as SliderX3GeometryInput,bomOptions:{...optionsBase,jointPairSelection:record.cells.D22.value},bomSettings:{...bomSettings,S18:String(sv.S18.value)},snapshot,controls}:{geometry:geometry as SliderX5GeometryInput,bomOptions:{interlockEnabled:optionsBase.interlockEnabled,fittingUpgradeEnabled:optionsBase.fittingUpgradeEnabled,selectorControls:{I25:Number(record.settings.I25.value),C20:Number(record.cells.C20.value),I27:Number(record.settings.I27.value),C22:Number(record.cells.C22.value),I29:Number(record.settings.I29.value),C24:Number(record.cells.C24.value),I31:Number(record.settings.I31.value),C26:Number(record.cells.C26.value)}},bomSettings:{...bomSettings,S19:String(sv.S19.value)},snapshot,controls}
 return {id:`slider-${index}`,slot:index+3,family:def.family,quantity:'1',calculation} as UnifiedPositionInput
}

function frontPosition(profile:'COMPLETATION'|'RETAIL'='COMPLETATION'):UnifiedPositionInput {
 const records=read('../../../../docs/jv/fixtures/front-pr12a-excel.json').scenarios,sources=read('../../../../docs/jv/fixtures/front-commercial-component-snapshots.json').sources,r=records.find((x:any)=>x.scenarioId===profile+'-base')!,c=r.front,s=r.settings
 const construction={workbook:r.workbook,sourceSha256:r.sourceSha256,systemSelector:7,widthMm:String(r.inputs.width),heightMm:String(r.inputs.height),sectionDemand:String(r.main.L11.value),finishSelector:Number(r.main.H11.value),glassSelector:Number(r.main.I11.value),openingSelector:Number(r.main.J11.value),controls:{C11:+c.C11.value,C12:+c.C12.value,C13:+c.C13.value,C14:+c.C14.value,C15:+c.C15.value,C18:+c.C18.value,C19:+c.C19.value,C20:+c.C20.value,C21:+c.C21.value,C22:+c.C22.value,C23:+c.C23.value,C24:+c.C24.value,D18:String(c.D18.value),D19:String(c.D19.value)},settings:{D8:String(s.D8.value),S29:String(s.S29.value),S30:String(s.S30.value),S31:String(s.S31.value),S32:String(s.S32.value),S33:String(s.S33.value),S34:String(s.S34.value),L22:String(s.L22.value),L23:String(s.L23.value),H38:+s.H38.value,H40:+s.H40.value,H42:+s.H42.value,H44:+s.H44.value,I42:+s.I42.value,I44:+s.I44.value}}
 const order={workbook:r.workbook,sourceSha256:r.sourceSha256,positions:Array.from({length:7},(_,i)=>({mainRow:11+i,widthMm:String(i===0?r.inputs.width:0),heightMm:String(i===0?r.inputs.height:0),quantity:String(i===0?1:0)}))}
 const commercial={snapshot:sources.find((x:any)=>x.profile===profile),order,glassEnabled:true,finishingEnabled:false,glassServiceEnabled:true,installationEnabled:false,mainSurchargeSelector:1 as const,mainQuantity:'1',markupPercent:'0',discountPercent:'0',retailDivisor:'0.8'}
 return {id:'front',slot:7,family:'FRONT',quantity:'1',calculation:{construction,commercial}} as UnifiedPositionInput
}

function zigzagPosition(profile:'COMPLETATION'|'RETAIL'='COMPLETATION'):UnifiedPositionInput {
 const excel=read('../../../../docs/jv/fixtures/zigzag-order-pr10g-excel.json'),snapshot=read('../../../../docs/jv/fixtures/zigzag-price-snapshots.json').sources.find((x:any)=>x.profile===profile),source=excel.cases.find((x:any)=>x.profile===profile&&x.id==='two_zigzag_multiple_packages')!,record=source.positions[0]
 const settings={P4:'14',P24:'42',P25:'51',P26:'6.5',P27:'5.7',P28:'5',P29:'2.5',L23:'0',D8:'50',P3:'58',D6:'100',L4:'18',L5:'18',L6:false,L7:'0.95',L8:'0.95',P12:'17',P13:'6',P16:'2',P17:'0.5',P21:'1600'}
 const geometry={widthMm:String(record.inputs.width),heightMm:String(record.inputs.height),leafSelector:String(record.inputs.leaves),openingSelector:record.inputs.opening,frameSettingIndex:1,frameOverrideIndex:1,frameChoices:['ДА','НЕТ'] as const,settings,switches:{D14:{settingIndex:1,overrideIndex:1,choices:['ДА','НЕТ'] as const},D15:{settingIndex:1,overrideIndex:1,choices:['ДА','НЕТ'] as const},D16:{settingIndex:2,overrideIndex:1,choices:['ДА','НЕТ'] as const},D17:{settingIndex:2,overrideIndex:1,choices:['ДА','НЕТ'] as const}}}
 const position={geometry,commercial:{c8:String(record.inputs.c8),F28:source.inputs.F28 as 1|2,D32:source.inputs.D32===1,D33:source.inputs.D33===1,D34:source.inputs.D34===1,L3:source.inputs.L3===1,glassTypeSelector:record.inputs.glass,N40:String(record.inputs.n40),N41:String(record.inputs.n41)}}
 return {id:'zigzag',slot:2,family:'ZIGZAG',quantity:'1',calculation:{position,snapshot}} as UnifiedPositionInput
}

test('unified order executes all seven existing family adapters and shared resources for both price profiles',()=>{
 for(const profile of ['COMPLETATION','RETAIL'] as const){
 const positions:UnifiedPositionInput[]=[line(`line-1-${profile}`,1,'1',profile),zigzagPosition(profile),...variants.map((_,i)=>sliderPosition(i,profile)),frontPosition(profile)]
 const probe=read('../../../../docs/jv/fixtures/unified-order-excel-probe.json').find((x:any)=>x.profile===profile),settings=probe.commercialSettings
 const mainDiscount={schemaVersion:'1.0' as const,profile,workbook:probe.workbook,workbookSha256:probe.sha256,capturedWithExcel:'16.0' as const,sourceCell:'Настройки!D19' as const,sourceFormula:String(settings.D19.formula),value:String(settings.D19.value2),positionMarkups:Array.from({length:7},(_,i)=>({slot:i+1,sourceCell:`Настройки!D${21+i}`,sourceFormula:String(settings[`D${21+i}`].formula),value:String(settings[`D${21+i}`].value2)})),positionDivisors:(['LINE','ZIGZAG','SLIDER','FRONT'] as const).map((family,i)=>({family,sourceCell:`Настройки!D${11+i}`,sourceFormula:String(settings[`D${11+i}`].formula),value:String(settings[`D${11+i}`].value2)}))}
 const result=calculateJVOrder({orderId:`unified-seven-families-${profile}`,profile,positions,mainDiscount})
 assert.equal(result.positions.length,7);assert.deepEqual(new Set(result.positions.map(x=>x.family)),new Set(['LINE','ZIGZAG','SLIDER_L3','SLIDER_L5','SLIDER_X3','SLIDER_X5','FRONT']))
 assert.ok(result.positions.every(x=>x.calculation&&x.trace.length>0));assert.ok(result.bom.length>0);assert.equal(result.orderContext?.positions.length,7);assert.equal(result.orderContext?.sharedResources.status,'COMPLETE');assert.equal(result.status,'COMPLETE');assert.ok(result.totalSalePrice);const rowAmounts=result.trace.filter((x:any)=>x.ruleId==='JV.UNIFIED.MAIN.PRICE-2026-11-08-v2').map((x:any)=>x.result.extendedPrice as {numerator:string;denominator:string}),sumRows=rowAmounts.reduce((sum,x)=>addRational(sum,x),rationalFromDecimal('0'));assert.deepEqual(sumRows,result.totalSalePrice,'AA18 is only the sum of seven transferred row amounts; shared consumables are not charged again');assert.equal(rowAmounts.length,7);assert.ok(result.trace.some((x:any)=>x.source?.cell==='AA18'&&x.source.formula==='=SUM(AA11:AA17)'))
 for(const p of result.positions.filter(x=>x.family.startsWith('SLIDER_'))){const c=p.calculation as {readonly orderFactor?:unknown;readonly m53?:unknown};assert.ok(c.orderFactor,`${profile}/${p.family} must receive the shared Main-row area allocation`);assert.ok(c.m53,`${profile}/${p.family} must close the order-dependent commercial chain`)}
 const front=result.positions.find(x=>x.family==='FRONT')!.calculation as {readonly status:string;readonly trace:readonly {readonly id:string;readonly source?:{readonly cell:string;readonly sheet:string;readonly formula:string}}[]};assert.ok(front.trace.some(x=>x.id==='JV.FRONT.PRM.AB31'&&x.source?.formula==='=IFERROR(AA31/($AA$32*W31),0)'),`${profile}/FRONT in Main slot 7 must use PRM AB31`);assert.ok(front.trace.some(x=>x.id==='JV.FRONT.F7.Y5'&&x.source?.formula==='=ПРМ!$AB$31'),`${profile}/FRONT must transfer the slot 7 area share from F7!Y5`);const frontMain=result.trace.find((x:any)=>x.ruleId==='JV.UNIFIED.MAIN.PRICE-2026-11-08-v2'&&x.input.sourceCell==='F7!S38');assert.ok(frontMain,`${profile}/Main slot 7 must transfer its price from F7!S38`)
 assert.equal(result.sharedResources?.status,'COMPLETE');assert.deepEqual(result.sharedResources?.unsupportedPositions,[]);assert.ok(result.sharedResources?.activatorPackages);assert.ok(result.sharedResources?.adhesivePackages);assert.ok(result.sharedResources?.trace.some(x=>x.source?.cell==='N12'));assert.ok(result.sharedResources?.trace.some(x=>x.source?.cell==='N25'))
 const multiPositions=positions.map((p,i)=>({...p,quantity:String([2,1,3,2,1,2,3][i])})) as UnifiedPositionInput[],multiInput={orderId:`unified-seven-multi-${profile}`,profile,positions:multiPositions,mainDiscount},multi=calculateJVOrder(multiInput),multiAgain=calculateJVOrder(multiInput);assert.equal(multi.status,'COMPLETE');assert.ok(multi.totalSalePrice);assert.equal(multi.positions.length,7);assert.deepEqual(multi.totalSalePrice,multiAgain.totalSalePrice,'multi-instance shared order must be deterministic');assert.deepEqual(multi.sharedResources?.totalActivatorConsumption,multiAgain.sharedResources?.totalActivatorConsumption);assert.ok(BigInt(multi.sharedResources!.totalActivatorConsumption.numerator)>0n)
 }
})

test('Front-only slot 7 builds the order area context from its own Excel row without inventing glue factors',()=>{const p=frontPosition() as Extract<UnifiedPositionInput,{family:'FRONT'}>,position={...p,slot:7},result=calculateJVOrder({orderId:'front-only-slot-seven',profile:'COMPLETATION',positions:[position]});assert.equal(result.sharedResources?.status,'COMPLETE');assert.equal(result.sharedResources?.activatorPackages,undefined);assert.equal(result.sharedResources?.adhesiveFactors,undefined);assert.equal(result.orderContext?.positions[0]?.sourceSheet,'F7');assert.equal(result.orderContext?.positions[0]?.consumableSourceCells?.activator,'Клей+акт!K11');assert.equal(result.orderContext?.positions[0]?.consumableSourceCells?.adhesive,'Клей+акт!K24');const front=result.positions[0]!.calculation as {readonly trace:readonly {readonly source?:{readonly cell:string;readonly formula:string;readonly sheet:string}}[]};assert.ok(front.trace.some(x=>x.source?.cell==='AB31'&&x.source.formula==='=IFERROR(AA31/($AA$32*W31),0)'));assert.ok(front.trace.some(x=>x.source?.sheet==='F7'&&x.source.formula==='=ПРМ!$AB$31'));assert.equal(result.totalSalePrice,undefined)})

test('all 21 family pairs are accepted by the unified position router and never invent mixed totals',()=>{
 const all:UnifiedPositionInput[]=[line('line',1,'1'),zigzagPosition(),...variants.map((_,i)=>sliderPosition(i)),frontPosition()]
 const linePosition=all[0] as Extract<UnifiedPositionInput,{family:'LINE'}>,rawZigzag=all[1] as Extract<UnifiedPositionInput,{family:'ZIGZAG'}>
 all[1]={...rawZigzag,calculation:{...rawZigzag.calculation,position:{...rawZigzag.calculation.position,commercial:{...rawZigzag.calculation.position.commercial,F28:linePosition.calculation.input.commercialModeIndex,D32:linePosition.calculation.settings.D32,D33:linePosition.calculation.input.assemblyEnabled,D34:linePosition.calculation.input.installationEnabled,L3:linePosition.calculation.input.millingEnabled}}}} as Extract<UnifiedPositionInput,{family:'ZIGZAG'}>
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
  const pair=calculateJVOrder({orderId:`pair-${i}-${j}`,profile:'COMPLETATION',positions:[all[i]!,all[j]!]})
  assert.equal(pair.positions.length,2,`${all[i]!.family}+${all[j]!.family}`)
  assert.equal(pair.sharedResources?.status,'COMPLETE',`${all[i]!.family}+${all[j]!.family} shared consumables`)
  if(!(all[i]!.family==='LINE'&&all[j]!.family==='ZIGZAG')){assert.equal(pair.status,'PARTIAL',`${all[i]!.family}+${all[j]!.family}`);assert.equal(pair.totalSalePrice,undefined)}
 }
})

test('unified shared BOM inputs aggregate repeated Line SKUs by quantity and allocate whole-package demand once',()=>{
 const result=calculateJVOrder({orderId:'unified-two-lines-resources',profile:'COMPLETATION',positions:[line('line-a',1,'2'),line('line-b',2,'3')]})
 const resources=result.sharedResources!;assert.equal(resources.status,'COMPLETE');assert.equal(result.status,'PARTIAL');assert.equal(result.totalSalePrice,undefined)
 const expectedActivator=result.positions.reduce((sum,position)=>{const c=position.calculation as any;const q=position.quantity;const per=c.additionalBom.lines.find((x:any)=>x.sku==='AA-110')!.quantity;return addRational(sum,multiplyRational(per,q))},rationalFromDecimal('0'))
 const expectedGlue=result.positions.reduce((sum,position)=>{const c=position.calculation as any;const q=position.quantity;const per=c.additionalBom.lines.find((x:any)=>x.sku==='AA-120')!.quantity;return addRational(sum,multiplyRational(per,q))},rationalFromDecimal('0'))
 const equal=(a:any,b:any)=>BigInt(a.numerator)*BigInt(b.denominator)===BigInt(b.numerator)*BigInt(a.denominator)
 assert.ok(equal(resources.totalActivatorConsumption,expectedActivator));assert.ok(equal(resources.totalAdhesiveConsumption,expectedGlue))
 const q=BigInt(expectedActivator.numerator),d=BigInt(expectedActivator.denominator),ceil=String(q===0n?1n:(q+d-1n)/d)
 assert.equal(resources.activatorPackages?.numerator,ceil);assert.equal(resources.adhesivePackages?.denominator,'1')
 const allocationTotal=resources.systemAllocations!.reduce((sum,allocation)=>{const quantity=result.positions.find(p=>p.id===allocation.positionId)!.quantity;return addRational(sum,multiplyRational(allocation.W,quantity))},rationalFromDecimal('0'))
 assert.ok(equal(allocationTotal,rationalFromDecimal('1')))
 assert.ok(resources.trace.some(step=>step.inputRefs.includes('L1!O49')));assert.ok(resources.trace.some(step=>step.inputRefs.includes('L2!O50')))
 const sameSku=result.bom.filter(row=>row.family==='LINE'&&row.sku==='AA-110')
 assert.ok(sameSku.length<=1)
})

test('unified order rejects positions captured from different source workbook revisions',()=>{
 const a=line('revision-line',1,'1'),b=sliderPosition(0) as Extract<UnifiedPositionInput,{family:'SLIDER_L3'}>
 const corrupted={...b,calculation:{...b.calculation,snapshot:{...b.calculation.snapshot,workbookSha256:'a'.repeat(64)}}} as UnifiedPositionInput
 assert.throws(()=>calculateJVOrder({orderId:'mixed-source-revisions',profile:'COMPLETATION',positions:[a,corrupted]}),/one source workbook revision and matching SHA-256/)
})

test('unified Line+Zigzag total requires the sourced D19 setting and applies the confirmed AA discount factor once',()=>{
 const lineInput=line('discount-line',1,'1'),raw=zigzagPosition() as Extract<UnifiedPositionInput,{family:'ZIGZAG'}>
 const zig={...raw,calculation:{...raw.calculation,position:{...raw.calculation.position,commercial:{...raw.calculation.position.commercial,F28:lineInput.calculation.input.commercialModeIndex,D32:lineInput.calculation.settings.D32,D33:lineInput.calculation.input.assemblyEnabled,D34:lineInput.calculation.input.installationEnabled,L3:lineInput.calculation.input.millingEnabled}}}} as Extract<UnifiedPositionInput,{family:'ZIGZAG'}>
 const capture=read('../../../../docs/jv/fixtures/line-order-excel-golden.json').cases.find((x:any)=>x.profile==='COMPLETATION')
 const source={schemaVersion:'1.0' as const,profile:'COMPLETATION' as const,workbook:capture.sourceWorkbook,workbookSha256:capture.sourceSha256,capturedWithExcel:'16.0' as const,sourceCell:'Настройки!D19' as const,sourceFormula:String(capture.commercialSettings.D19.formula),value:String(capture.commercialSettings.D19.value2),positionMarkups:Array.from({length:7},(_,i)=>{const slot=i+1,cell=`D${20+slot}`,setting=capture.commercialSettings[cell];return{slot,sourceCell:`Настройки!${cell}`,sourceFormula:String(setting.formula),value:String(setting.value2)}})}
 const positions=[lineInput,zig]
 const unpriced=calculateJVOrder({orderId:'line-zig-no-main-discount',profile:'COMPLETATION',positions});assert.equal(unpriced.status,'PARTIAL');assert.equal(unpriced.totalSalePrice,undefined);assert.ok(unpriced.limitations.some(x=>x.includes('Настройки!D19')))
 const zero=calculateJVOrder({orderId:'line-zig-zero-discount',profile:'COMPLETATION',positions,mainDiscount:source});assert.equal(zero.status,'COMPLETE');assert.ok(zero.totalSalePrice);assert.deepEqual(zero.totalSalePrice,zero.confirmedLineZigzagOrder!.totalSalePrice);assert.ok(zero.trace.some((x:any)=>x.ruleId==='JV.UNIFIED.MAIN.MIXED.PRICE-2026-11-08-v1'))
 const ten=calculateJVOrder({orderId:'line-zig-ten-discount',profile:'COMPLETATION',positions,mainDiscount:{...source,value:'10',sourceFormula:'10'}});assert.equal(ten.status,'COMPLETE');const expected=multiplyRational(zero.confirmedLineZigzagOrder!.totalSalePrice!,{numerator:'11',denominator:'10'});assert.ok(BigInt(ten.totalSalePrice!.numerator)*BigInt(expected.denominator)===BigInt(expected.numerator)*BigInt(ten.totalSalePrice!.denominator))
})

test('unified Line-only order reuses shared Line order math and requires captured Main transfer settings',()=>{
 const position=line('line-main-price',1,'2'),capture=read('../../../../docs/jv/fixtures/line-order-excel-golden.json').cases.find((x:any)=>x.profile==='COMPLETATION'&&x.scenarioId==='line_single_qty3')
 const mainDiscount={schemaVersion:'1.0' as const,profile:'COMPLETATION' as const,workbook:capture.sourceWorkbook,workbookSha256:capture.sourceSha256,capturedWithExcel:'16.0' as const,sourceCell:'Настройки!D19' as const,sourceFormula:String(capture.commercialSettings.D19.formula),value:String(capture.commercialSettings.D19.value2),positionMarkups:Array.from({length:7},(_,i)=>{const slot=i+1,sourceCell=`Настройки!D${20+slot}`,setting=capture.commercialSettings[`D${20+slot}`];return{slot,sourceCell,sourceFormula:String(setting.formula),value:String(setting.value2)}})}
 const unpriced=calculateJVOrder({orderId:'line-only-without-main-context',profile:'COMPLETATION',positions:[position]})
 assert.equal(unpriced.status,'PARTIAL');assert.equal(unpriced.totalSalePrice,undefined);assert.equal(unpriced.confirmedLineOrder?.status,'COMPLETE');assert.ok(unpriced.bom.length>0);assert.ok(unpriced.trace.length>0);assert.ok(unpriced.limitations.some(x=>x.includes('Main discount and per-slot markup snapshot')))
 const priced=calculateJVOrder({orderId:'line-only-with-main-context',profile:'COMPLETATION',positions:[position],mainDiscount})
 assert.equal(priced.status,'COMPLETE');assert.ok(priced.totalSalePrice);assert.equal(priced.confirmedLineOrder?.positions[0]?.status,'COMPLETE');assert.ok(priced.trace.some((x:any)=>x.ruleId==='JV.UNIFIED.MAIN.LINE.PRICE-2026-11-08-v1'))
 assert.throws(()=>calculateJVOrder({orderId:'line-only-bad-markup-source',profile:'COMPLETATION',positions:[position],mainDiscount:{...mainDiscount,positionMarkups:[{...mainDiscount.positionMarkups[0]!,sourceCell:'Настройки!D22'},...mainDiscount.positionMarkups.slice(1)]}}),/provenance does not match/)
})
