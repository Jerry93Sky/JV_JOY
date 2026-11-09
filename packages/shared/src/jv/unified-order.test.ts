import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {calculateJVOrder, type UnifiedPositionInput} from './unified-order.ts'
import {decimalString} from './decimal.ts'
import type {LineEngineInputs,LineEngineSettings} from './line-calculator.ts'

const read=(path:string)=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'))
const price=read('../../../../docs/jv/fixtures/line-price-excel-golden.json')
const linePrices=read('../../../../docs/jv/fixtures/line-price-snapshots.json').sources
const glass=read('../../../../docs/jv/fixtures/line-glass-price-snapshots.json').sources
const paint=read('../../../../docs/jv/fixtures/line-paint-price-snapshots.json').sources
function line(id:string,slot:number,quantity:string):UnifiedPositionInput {
 const workbook='JV-комплектация 08.10.2026.xlsm',record=price.cases.find((x:any)=>x.workbook===workbook&&x.scenarioId==='line_single_with_park')!,v=record.sourceInputs,s=record.settingsInputs
 const input:LineEngineInputs={constructionId:id,constructionQuantity:decimalString(quantity),commercialModeIndex:1,glassSelectionIndex:9,finishSelectionIndex:1,profile:'COMPLETATION',workbook,widthMm:decimalString(v.D3.value),heightMm:decimalString(v.D4.value),leaves:decimalString(v.D5.value),sideCount:decimalString(v.D6.value),direction:v.D7.value,profileCount:decimalString(v.D8.value),connectorAngle:decimalString(v.D9.value),frameState:v.D15.value,knobState:v.D16.value,latchState:v.D17.value,weatherSealState:v.D18.value,floorLockState:v.D19.value,bottomPivotState:v.D20.value,specialSashEnabled:Boolean(v.C21.value),specialSashWidthMm:decimalString(v.D21.value),rollerAxisToEdgeMm:decimalString(v.D22.value),parkedDoorSelected:Boolean(v.C23.value),parkedDoorPosition:decimalString(v.C24.value),parkedDoorReuseOpening:Boolean(v.C25.value),parkedDoorWidthMm:decimalString(v.D25.value),assemblyEnabled:Boolean(s.D33.value),millingEnabled:Boolean(s.L3.value),installationEnabled:Boolean(s.D34.value)}
 const gs=glass.find((x:any)=>x.profile==='COMPLETATION')!,keys=['P2','P3','P4','P5','P6','P7','P8','P9','P10','P12','P13','P14','P15','P16','P17','L23','D6','D7','D8','L4','L5','L7','L8','P21'],settings=Object.fromEntries(keys.map(k=>[k,String(s[k].value)])) as Record<string,string>
 const lineSettings={...settings,P19:gs.settings.P19,L17:gs.settings.L17,L18:gs.settings.L18,L22:gs.settings.L22,L6:Boolean(s.L6.value),L21:Boolean(gs.settings.L21),D32:Boolean(gs.settings.D32)} as LineEngineSettings
 return {id,slot,family:'LINE',quantity,calculation:{input,settings:lineSettings,priceSnapshot:linePrices.find((x:any)=>x.profile==='COMPLETATION'),glassSnapshot:gs,paintSnapshot:paint.find((x:any)=>x.profile==='COMPLETATION')}}
}

test('unified order dispatches real Line calculator and builds quantity-adjusted BOM',()=>{
 const result=calculateJVOrder({orderId:'unified-line-one',profile:'COMPLETATION',positions:[line('line-1',1,'1')]})
 assert.equal(result.positions.length,1);assert.equal(result.positions[0]!.family,'LINE');assert.equal(result.positions[0]!.calculation.status,'COMPLETE');assert.ok(result.positions[0]!.bom.length>0);assert.equal(result.bom.length,result.positions[0]!.bom.length);assert.equal(result.status,'PARTIAL');assert.equal(result.totalSalePrice,undefined)
})

test('unified order accepts multiple positions and extensions while withholding unconfirmed shared order total',()=>{
 const result=calculateJVOrder({orderId:'unified-two-lines',profile:'COMPLETATION',positions:[line('line-1',1,'1'),line('line-2',2,'2')]})
 assert.equal(result.positions.length,2);assert.ok(result.bom.length>0);assert.equal(result.status,'PARTIAL');assert.equal(result.totalSalePrice,undefined);assert.ok(result.limitations.length>0)
})

test('unified order rejects non-positive-integer quantities before dispatch',()=>{
 for(const quantity of ['0','-1','1.5','bad'])assert.throws(()=>calculateJVOrder({orderId:'invalid-quantity',profile:'COMPLETATION',positions:[line('line-1',1,quantity)]}))
})
