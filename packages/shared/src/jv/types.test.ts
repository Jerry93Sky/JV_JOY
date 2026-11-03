import test from 'node:test'
import assert from 'node:assert/strict'
import { decimalString } from './decimal.ts'
import { aggregateStatus, traceStep } from './trace.ts'
import { addDecimal, subtractDecimal, multiplyDecimal, divideDecimalExact, divideDecimalTruncateToInteger } from './decimal.ts'
import { executeGraph } from './graph.ts'
test('decimal text is validated without rounding',()=>{assert.equal(decimalString('1.005'),'1.005');assert.equal(decimalString('-0.5'),'-0.5');assert.throws(()=>decimalString('NaN'));assert.throws(()=>decimalString('1e3'))})
test('trace is immutable and preserves provenance',()=>{const x=traceStep({id:'s1',kind:'pricing',label:'price',inputRefs:['g1'],ruleId:'pending',catalogRefs:[{id:'prices',version:'v1'}],input:{amount:'1.005'},result:'1.005',status:'ok',errorIds:[],warningIds:[]});assert.equal(x.result,'1.005');assert.equal(x.catalogRefs[0].version,'v1');assert.ok(Object.isFrozen(x));assert.ok(Object.isFrozen(x.catalogRefs))})
test('status aggregation never converts failures into zero',()=>{assert.equal(aggregateStatus(['ok','unavailable']),'unavailable');assert.equal(aggregateStatus(['invalid_input','calculation_error']),'calculation_error');assert.equal(aggregateStatus([]),'ok')})

test('exact decimal arithmetic preserves scale and never rounds',()=>{assert.equal(addDecimal(decimalString('1000'),decimalString('0.025')),'1000.025');assert.equal(subtractDecimal(decimalString('1'),decimalString('1.2')),'-0.2');assert.equal(multiplyDecimal(decimalString('-2.50'),decimalString('4')),'-10');assert.equal(divideDecimalExact(decimalString('1'),decimalString('8')),'0.125');assert.throws(()=>divideDecimalExact(decimalString('1'),decimalString('3')),/Non-terminating/);assert.throws(()=>divideDecimalExact(decimalString('1'),decimalString('0')),/zero/i)})
test('graph orders dependencies deterministically and records trace',()=>{const rules=[{id:'b',version:'1',dependsOn:['a'],execute:({results}:any)=>Number(results.a)+1},{id:'a',version:'1',dependsOn:['x'],execute:({inputs}:any)=>inputs.x}];const result=executeGraph({x:2},rules);assert.deepEqual(Object.keys(result.values),['a','b']);assert.equal(result.values.b,3);assert.equal(result.trace.length,2)})
test('graph rejects unknown nodes, cycles and arbitrary code as data',()=>{assert.throws(()=>executeGraph({},[{id:'a',version:'1',dependsOn:['missing'],execute:()=>0}]),/unknown/);assert.throws(()=>executeGraph({},[{id:'a',version:'1',dependsOn:['b'],execute:()=>0},{id:'b',version:'1',dependsOn:['a'],execute:()=>0}]),/cycle/i);const payload='globalThis.__jvInjected=1';const result=executeGraph({payload},[{id:'echo',version:'1',dependsOn:['payload'],execute:({inputs}:any)=>inputs.payload}]);assert.equal(result.values.echo,payload);assert.equal((globalThis as any).__jvInjected,undefined)})

test('Line L1 I27 exact sourced expression, source trace and explicit shared units',()=>{const {calculateLineParkingAxisWidth}=requireLine();const r=calculateLineParkingAxisWidth({openingLeafWidth:{value:decimalString('900.5'),unit:'mm'},rollerAxisToEdge:{value:decimalString('50'),unit:'mm'}});assert.equal(r.value.value,'800.5');assert.equal(r.value.unit,'mm');assert.equal(r.trace[0].source?.cell,'I27');assert.equal(r.parity,'EXCEL_PARITY_UNVERIFIED')})
test('Line I27 rejects mismatched units and invalid decimal input',()=>{const {calculateLineParkingAxisWidth}=requireLine();assert.throws(()=>calculateLineParkingAxisWidth({openingLeafWidth:{value:decimalString('900'),unit:'mm'},rollerAxisToEdge:{value:decimalString('50'),unit:'m'}}),/unit/i);assert.throws(()=>calculateLineParkingAxisWidth({openingLeafWidth:{value:'NaN' as never,unit:'mm'},rollerAxisToEdge:{value:decimalString('50'),unit:'mm'}}),/Invalid decimal/)})
function requireLine():typeof import('./geometry/line.ts'){return lineModule}
import * as lineModule from './geometry/line.ts'
import * as pdCatalogModule from './geometry/pd-catalog.ts'

test('Line L1 no-PD chain D23 -> O15 -> I26 follows sourced formulas',()=>{const r=lineModule.calculateLineParkingDepthWithoutParkedDoor({leaves:decimalString('5'),sideCount:decimalString('1'),parkedDoorSelected:false,unit:'source-length',settings:{edgeToSwingAxis:decimalString('52'),sashProfileWidth:decimalString('34'),sideLockHandleProjection:decimalString('9'),parkingDepthReserve:decimalString('70'),rollerAxisToEdge:decimalString('50')}});assert.equal(r.doorState,'НЕТ');assert.equal(r.parkingPartCount,'3');assert.equal(r.depth.value,'369');assert.deepEqual(r.trace.map(x=>x.source?.cell),['D23','O15','I26']);assert.equal(r.parity,'EXCEL_PARITY_UNVERIFIED')})
test('Line parking requires C24 for PD lookup and rejects invalid settings',()=>{const base={leaves:decimalString('5'),sideCount:decimalString('1'),parkedDoorSelected:false,unit:'source-length' as const,settings:{edgeToSwingAxis:decimalString('52'),sashProfileWidth:decimalString('34'),sideLockHandleProjection:decimalString('9'),parkingDepthReserve:decimalString('70'),rollerAxisToEdge:decimalString('50')}};assert.throws(()=>lineModule.calculateLineParkingDepthWithoutParkedDoor({...base,parkedDoorSelected:true}),/PD lookup/i);assert.throws(()=>lineModule.calculateLineParkingDepthWithoutParkedDoor({...base,settings:{...base.settings,parkingDepthReserve:'?' as never}}),/Invalid decimal/)})

const lineDepthBase={unit:'source-length' as const,settings:{edgeToSwingAxis:decimalString('52'),sashProfileWidth:decimalString('34'),sideLockHandleProjection:decimalString('9'),parkingDepthReserve:decimalString('70'),rollerAxisToEdge:decimalString('50')}}
test('Line D23 preserves false branch laziness and the textual error result',()=>{
 const noPd=lineModule.calculateLineParkingDepthWithoutParkedDoor({...lineDepthBase,leaves:decimalString('5'),sideCount:decimalString('0'),parkedDoorSelected:false})
 assert.equal(noPd.doorState,'НЕТ')
 const d23Error=lineModule.calculateLineParkingDepthWithoutParkedDoor({...lineDepthBase,leaves:decimalString('1'),sideCount:decimalString('1'),parkedDoorSelected:true,parkedDoorPosition:decimalString('2')})
 assert.equal(d23Error.doorState,'ОШИБКА');assert.equal(d23Error.parkingPartCount,'0');assert.equal(d23Error.depth.value,'206')
})
test('Line single-sided PD table uses Excel INDEX row D5 and column C24, and traces exact cell',()=>{
 const r=lineModule.calculateLineParkingDepth({...lineDepthBase,leaves:decimalString('2'),sideCount:decimalString('1'),parkedDoorSelected:true,parkedDoorPosition:decimalString('2')})
 assert.equal(r.doorState,'ДА');assert.equal(r.parkingPartCount,'3');assert.equal(r.parkingLookup?.sourceCell,'E6');assert.equal(r.parkingLookup?.rowIndex,2);assert.equal(r.parkingLookup?.columnIndex,2);assert.equal(r.parkingLookup?.version,'JV-PD-2026-10-08');assert.equal(r.depth.value,'267')
 const trace=r.trace.find(s=>s.source?.cell==='O15');assert.equal((trace?.result as {lookup:{sourceCell:string}}).lookup.sourceCell,'E6')
})
test('Line two-sided PD matrix is selected only for D6=2 and is traceable',()=>{
 const r=lineModule.calculateLineParkingDepthWithoutParkedDoor({...lineDepthBase,leaves:decimalString('5'),sideCount:decimalString('2'),parkedDoorSelected:true,parkedDoorPosition:decimalString('2')})
 assert.equal(r.doorState,'ДА');assert.equal(r.parkingPartCount,'6');assert.equal(r.parkingLookup?.sourceCell,'E65');assert.equal(r.depth.value,'311')
})
test('Line PD index bounds and zero denominator retain typed calculation errors',()=>{
 const base={...lineDepthBase,leaves:decimalString('2'),sideCount:decimalString('1'),parkedDoorSelected:true}
 assert.throws(()=>lineModule.calculateLineParkingDepthWithoutParkedDoor({...base,parkedDoorPosition:decimalString('0')}),(e:any)=>e.code==='RULE_UNCONFIRMED')
 assert.throws(()=>lineModule.calculateLineParkingDepthWithoutParkedDoor({...base,parkedDoorPosition:decimalString('2.5')}),(e:any)=>e.code==='RULE_UNCONFIRMED')
 assert.throws(()=>lineModule.calculateLineParkingDepthWithoutParkedDoor({...base,parkedDoorPosition:decimalString('51')}),(e:any)=>e.code==='LOOKUP_NOT_FOUND'&&e.details.excelError==='#REF!')
 assert.throws(()=>lineModule.calculateLineParkingDepthWithoutParkedDoor({...base,leaves:decimalString('51'),parkedDoorPosition:decimalString('1')}),(e:any)=>e.code==='LOOKUP_NOT_FOUND'&&e.details.excelError==='#REF!')
 assert.throws(()=>lineModule.calculateLineParkingDepthWithoutParkedDoor({...base,parkedDoorPosition:decimalString('1'),sideCount:decimalString('0')}),(e:any)=>e.code==='DIVISION_BY_ZERO')
 assert.throws(()=>lineModule.calculateLineParkingDepth({...base,parkedDoorSelected:false,sideCount:'НЕТ'}),(e:any)=>e.code==='INVALID_DECIMAL'&&e.details.excelError==='#VALUE!'&&e.details.source==='L1!O15')
 assert.throws(()=>lineModule.calculateLineParkingDepth({...base,sideCount:'НЕТ'}),(e:any)=>e.code==='INVALID_DECIMAL'&&e.details.excelError==='#VALUE!'&&e.details.source==='L1!D23')
})
test('Line PD accepts 50x50 boundary addresses and extracted matrix cells are numeric',()=>{
 const {PD_CATALOG_TABLES}=pdCatalogModule
 assert.equal(pdCatalogModule.PD_CATALOG_TABLE_METADATA.oneSided.sourceRange,'D5:BA54');assert.equal(pdCatalogModule.PD_CATALOG_TABLE_METADATA.twoSided.sourceRange,'D61:BA110')
 assert.equal(PD_CATALOG_TABLES.oneSided.length,50);assert.equal(PD_CATALOG_TABLES.oneSided.every(r=>r.length===50&&r.every(v=>typeof v==='number')),true)
 assert.equal(PD_CATALOG_TABLES.twoSided.length,50);assert.equal(PD_CATALOG_TABLES.twoSided.every(r=>r.length===50&&r.every(v=>typeof v==='number')),true)
 const first=lineModule.calculateLineParkingDepthWithoutParkedDoor({...lineDepthBase,leaves:decimalString('2'),sideCount:decimalString('1'),parkedDoorSelected:true,parkedDoorPosition:decimalString('1')})
 assert.equal(first.parkingLookup?.sourceCell,'D6');assert.equal(first.parkingPartCount,'0')
 const last=lineModule.calculateLineParkingDepthWithoutParkedDoor({...lineDepthBase,leaves:decimalString('50'),sideCount:decimalString('1'),parkedDoorSelected:true,parkedDoorPosition:decimalString('50')})
 assert.equal(last.parkingLookup?.sourceCell,'BA54');assert.equal(last.parkingPartCount,'5')
})
test('Line D23 follows quotient semantics for negative values and preserves Excel text result',()=>{
 const negativeDenominator=lineModule.calculateLineParkingDepthWithoutParkedDoor({...lineDepthBase,leaves:decimalString('-5'),sideCount:decimalString('-2'),parkedDoorSelected:true,parkedDoorPosition:decimalString('1')})
 assert.equal(negativeDenominator.doorState,'ДА');assert.equal(negativeDenominator.parkingPartCount,'0')
 const belowOne=lineModule.calculateLineParkingDepthWithoutParkedDoor({...lineDepthBase,leaves:decimalString('1'),sideCount:decimalString('-2'),parkedDoorSelected:true,parkedDoorPosition:decimalString('1')})
 assert.equal(belowOne.doorState,'ОШИБКА')
})
test('Line I25 ROUNDDOWN and I27 close the sourced opening-width chain',()=>{
 const r=lineModule.calculateLineOpeningLeafWidth({openingWidth:decimalString('400'),leaves:decimalString('2'),sideCount:decimalString('1'),specialSashEnabled:false,specialSashWidth:decimalString('900'),mountingFrameState:'НЕТ',unit:'source-length',settings:{sideClearance:decimalString('3'),interLeafClearance:decimalString('4'),sideProfileWidth:decimalString('6'),rollerAxisToEdge:decimalString('50')}})
 assert.equal(r.I25.value,'195');assert.equal(r.I27.value,'95');assert.deepEqual(r.trace.map(s=>s.source?.cell),['I25','I27'])
 const switched=lineModule.calculateLineOpeningLeafWidth({openingWidth:decimalString('400'),leaves:decimalString('2'),sideCount:decimalString('1'),specialSashEnabled:true,specialSashWidth:decimalString('50'),mountingFrameState:'ДА',unit:'source-length',settings:{sideClearance:decimalString('3'),interLeafClearance:decimalString('4'),sideProfileWidth:decimalString('6'),rollerAxisToEdge:decimalString('50')}})
 assert.equal(switched.I25.value,'328')
})
test('Line geometry is deterministic and truncation matches ROUNDDOWN toward zero',()=>{
 assert.equal(divideDecimalTruncateToInteger(decimalString('-7'),decimalString('3')),'-2')
 const input={...lineDepthBase,leaves:decimalString('2'),sideCount:decimalString('1'),parkedDoorSelected:true,parkedDoorPosition:decimalString('2')}
 assert.deepEqual(lineModule.calculateLineParkingDepthWithoutParkedDoor(input),lineModule.calculateLineParkingDepthWithoutParkedDoor(input))
})
