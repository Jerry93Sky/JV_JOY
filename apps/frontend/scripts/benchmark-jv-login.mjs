import {createServer} from 'node:http'
import {readFile,stat,writeFile} from 'node:fs/promises'
import {resolve,join,extname} from 'node:path'
import {chromium} from 'playwright'
import os from 'node:os'
const roots=process.argv.slice(2)
if(roots.length!==2)throw Error('usage: node scripts/benchmark-jv-login.mjs BASE_DIST CURRENT_DIST')
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}
const browser=await chromium.launch({channel:'chrome',headless:true})
const result={method:'production dist, loopback HTTP, Chrome headless 1440x900, no throttling, fresh browser context per run, one warmup and five measured login navigations per branch; no backend/database; timings are not SLO',node:process.version,chrome:browser.version(),cpu:os.cpus()[0].model,platform:process.platform,runs:{}}
try {
for(const [index,rootArg] of roots.entries()){
 const root=resolve(rootArg)
 const server=createServer(async(req,res)=>{try{let pathname=new URL(req.url,'http://localhost').pathname;let p=join(root,decodeURIComponent(pathname));if(!p.startsWith(root))throw Error('bad path');let st=await stat(p).catch(()=>null);if(!st||st.isDirectory())p=join(root,'index.html');const b=await readFile(p);res.writeHead(200,{'Content-Type':mime[extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(b)}catch{res.writeHead(404);res.end()}})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/login`;const samples=[]
 for(let n=0;n<6;n++){
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.__longtasks=[];new PerformanceObserver(list=>window.__longtasks.push(...list.getEntries().map(x=>x.duration))).observe({type:'longtask',buffered:true})})
  let count=0;page.on('request',()=>count++);const start=Date.now();await page.goto(url,{waitUntil:'networkidle'});await page.locator('input').first().waitFor();const data=await page.evaluate(()=>{const nav=performance.getEntriesByType('navigation')[0],paint=performance.getEntriesByName('first-contentful-paint')[0];return {fcpMs:paint?.startTime??null,domContentLoadedMs:nav.domContentLoadedEventEnd,heapBytes:performance.memory?.usedJSHeapSize??null,domNodes:document.querySelectorAll('*').length,longTasks:window.__longtasks,resources:performance.getEntriesByType('resource').filter(x=>/\.(js|css)(?:\?|$)/.test(x.name)).map(x=>({name:x.name.split('/').pop(),durationMs:x.duration,transferBytes:x.transferSize}))}});data.readyWallMs=Date.now()-start;data.requests=count;data.errors=errors;if(n)samples.push(data);await context.close()
 }
 const median=key=>{const v=samples.map(x=>x[key]).filter(x=>typeof x==='number').sort((a,b)=>a-b);return {median:v[Math.floor(v.length/2)]??null,min:v[0]??null,max:v.at(-1)??null}}
 result.runs[index?'current':'baseline']={root:index?'current':'baseline',samples,summary:Object.fromEntries(['fcpMs','domContentLoadedMs','readyWallMs','heapBytes','domNodes','requests'].map(k=>[k,median(k)]))};await new Promise(r=>server.close(r))
}
}finally{await browser.close()}
const destination=resolve('../../docs/jv/JV_UI_LOGIN_BENCHMARK.json');await writeFile(destination,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2))
