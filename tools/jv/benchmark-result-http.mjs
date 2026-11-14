import {createRequire} from 'node:module'
import {readFileSync,writeFileSync} from 'node:fs'
import {randomBytes} from 'node:crypto'
import {monitorEventLoopDelay,performance} from 'node:perf_hooks'
import os from 'node:os'
const require=createRequire(new URL('../../apps/backend/package.json',import.meta.url)),Fastify=require('fastify')
const {registerPlugins}=require('./dist/apps/backend/src/plugins/index.js'),{registerRoutes}=require('./dist/apps/backend/src/routes/index.js')
const fixture=JSON.parse(readFileSync(new URL('../../docs/jv/fixtures/unified-order-all-seven-inputs.json',import.meta.url))).scenarios[0]
process.env.JWT_SECRET=randomBytes(32).toString('hex')
const app=Fastify({logger:false});await registerPlugins(app);await registerRoutes(app);await app.ready();const token=app.jwt.sign({id:'bench',role:'ADMIN'})
const positions=fixture.engineInput.positions.map(p=>{const calculation=structuredClone(p.calculation);if(p.family==='LINE'){delete calculation.priceSnapshot;delete calculation.glassSnapshot;delete calculation.paintSnapshot}else if(p.family==='FRONT')delete calculation.commercial.snapshot;else delete calculation.snapshot;return {id:p.id,slot:p.slot,family:p.family,quantity:p.quantity,calculation}})
const payload={orderId:'benchmark',profile:fixture.profile,rulesVersion:'JV-UNIFIED-ORDER-PR13E-1',positions}
async function request(){const start=performance.now();const response=await app.inject({method:'POST',url:'/api/jv/orders/calculate-preview',headers:{authorization:`Bearer ${token}`},payload});return {ms:performance.now()-start,status:response.statusCode,body:response.json()}}
const warm=await request();if(warm.status!==200||warm.body.status!=='COMPLETE')throw Error('Warmup failed')
const {calculateJVOrder}=require('@bms/shared'),{serializeJvResult}=require('./dist/apps/backend/src/domain/jv/jvCalculationService.js')
let phase=performance.now();const raw=calculateJVOrder(fixture.engineInput);const engineMs=performance.now()-phase;phase=performance.now();const safe=serializeJvResult(raw);const projectionMs=performance.now()-phase;phase=performance.now();JSON.stringify(safe);const stringifyMs=performance.now()-phase
const delay=monitorEventLoopDelay({resolution:10});delay.enable();await new Promise(r=>setTimeout(r,20));const cpu=process.cpuUsage(),mem=process.memoryUsage(),start=performance.now(),count=8
const results=await Promise.all(Array.from({length:count},request));const elapsed=performance.now()-start,used=process.cpuUsage(cpu);await new Promise(r=>setTimeout(r,20));delay.disable()
const totals=results.map(r=>JSON.stringify(r.body.calculation.totalSalePrice));if(results.some(r=>r.status!==200)||new Set(totals).size!==1)throw Error('Concurrent responses differed or failed')
const values=results.map(r=>r.ms).sort((a,b)=>a-b),percentile=p=>values[Math.min(values.length-1,Math.ceil(values.length*p)-1)]
const output={method:'Fastify inject, same Node process, 8 concurrent requests, no production database; warmup 1; Node event loop remains single-threaded',node:process.version,platform:process.platform,arch:process.arch,logicalCpus:os.cpus().length,cpuModel:os.cpus()[0]?.model,systemRamBytes:os.totalmem(),requests:count,elapsedMs:elapsed,throughputPerSecond:count*1000/elapsed,latencyMs:{p50:percentile(.5),p95:percentile(.95),p99:percentile(.99)},phaseSampleMs:{engine:engineMs,serializeJvResult:projectionMs,jsonStringify:stringifyMs},errors:results.filter(r=>r.status!==200).length,responseBytes:Buffer.byteLength(JSON.stringify(warm.body)),cpuMs:{user:used.user/1000,system:used.system/1000},rssBytes:{before:mem.rss,after:process.memoryUsage().rss},heapBytes:{before:mem.heapUsed,after:process.memoryUsage().heapUsed},eventLoopDelayMs:{mean:Number.isFinite(delay.mean)?delay.mean/1e6:null,max:delay.max/1e6},totalIdentical:true}
writeFileSync(new URL('../../docs/jv/JV_RESULT_BENCHMARK.json',import.meta.url),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));await app.close()
