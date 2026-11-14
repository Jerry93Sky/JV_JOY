import {createServer,request} from 'node:http'
import {readFile,stat,writeFile} from 'node:fs/promises'
import {resolve,join,extname} from 'node:path'
import {createRequire} from 'node:module'
import {randomBytes} from 'node:crypto'
import {performance} from 'node:perf_hooks'
import os from 'node:os'
import {chromium} from 'playwright'
const roots=process.argv.slice(2);if(roots.length!==2)throw Error('Pass base and current dist paths')
const req=createRequire(resolve('../backend/package.json')),Fastify=req('fastify'),{registerPlugins}=req('./dist/apps/backend/src/plugins/index.js'),{registerRoutes}=req('./dist/apps/backend/src/routes/index.js')
process.env.JWT_SECRET=randomBytes(32).toString('hex');const backend=Fastify({logger:false});await registerPlugins(backend);await registerRoutes(backend);await backend.listen({host:'127.0.0.1',port:0});const backendPort=backend.server.address().port
const browser=await chromium.launch({channel:'chrome',headless:true});const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}
const out={method:'Separate production builds, identical Fastify and test JWT, Chrome headless 1440x900, loopback HTTP; 1 warmup and 3 fresh contexts per branch; automation time included, no production DB, not SLO',node:process.version,chrome:browser.version(),cpu:os.cpus()[0].model,platform:process.platform,branches:{}}
try{for(const [idx,arg] of roots.entries()){
 const root=resolve(arg);const server=createServer(async(req,res)=>{if(req.url.startsWith('/api/')){const proxy=request({hostname:'127.0.0.1',port:backendPort,path:req.url,method:req.method,headers:req.headers},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res)});proxy.on('error',()=>{res.writeHead(502);res.end()});req.pipe(proxy);return}try{let p=join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root))throw Error();const st=await stat(p).catch(()=>null);if(!st||st.isDirectory())p=join(root,'index.html');const data=await readFile(p);res.writeHead(200,{'Content-Type':mime[extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data)}catch{res.writeHead(404);res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;const samples=[]
 for(let n=0;n<4;n++){
  const context=await browser.newContext({viewport:{width:1440,height:900}}),token=backend.jwt.sign({id:'benchmark-user',role:'ADMIN'});await context.addInitScript(t=>{localStorage.setItem('bms-auth',JSON.stringify({state:{token:t,user:{id:'benchmark-user',role:'ADMIN',firstName:'Test',lastName:'User'}},version:0}));window.__longTasks=[];new PerformanceObserver(list=>window.__longTasks.push(...list.getEntries().map(x=>x.duration))).observe({type:'longtask',buffered:true})},token)
  const page=await context.newPage(),errors=[];let requests=0;page.on('pageerror',e=>errors.push(e.message));page.on('request',()=>requests++);const m={};let t=performance.now();await page.goto(`${url}/jv/orders/new`);await page.getByRole('button',{name:'Добавить конструкцию'}).waitFor();await page.waitForFunction(()=>![...document.querySelectorAll('button')].find(b=>b.textContent==='Добавить конструкцию')?.disabled);m.openReadyMs=performance.now()-t
  const add=page.getByRole('button',{name:'Добавить конструкцию'});t=performance.now();for(const [i,family] of ['LINE','FRONT','ZIGZAG','SLIDER_L3','SLIDER_L5','SLIDER_X3','SLIDER_X5'].entries()){await add.click();const form=idx?page.locator('section').filter({has:page.getByLabel('Семейство')}):page.locator('section').nth(i);await form.getByLabel('Семейство').selectOption(family)}m.addSevenMs=performance.now()-t
  t=performance.now();const pending=page.waitForResponse(r=>r.url().includes('calculate-preview')&&r.request().method()==='POST');await page.getByRole('button',{name:'Рассчитать',exact:true}).click();const response=await pending;if(response.status()!==200)throw Error(await response.text());await page.getByRole('heading',{name:'Расчёт завершён'}).waitFor();m.calculateMs=performance.now()-t
  t=performance.now();await page.getByText('Общая спецификация заказа',{exact:true}).click();await page.getByText('Количество заказа',{exact:true}).waitFor();m.openBomMs=performance.now()-t
  t=performance.now();await page.getByText(/Шаги заказа \(/).click();await page.getByText(/Найдено:/).waitFor();m.openTraceMs=performance.now()-t
  t=performance.now();const trace=page.waitForResponse(r=>r.url().includes('/trace?')&&r.url().includes('JV.LINE'));await page.getByLabel('Поиск по шагам').fill('JV.LINE');await trace;m.searchTraceMs=performance.now()-t
  t=performance.now();await page.getByLabel('Ценовой профиль').selectOption('RETAIL');await page.waitForFunction(()=>![...document.querySelectorAll('button')].find(b=>b.textContent==='Рассчитать')?.disabled);m.profileChangeMs=performance.now()-t
  if(idx){t=performance.now();await page.getByRole('complementary',{name:'Список конструкций'}).getByRole('button').filter({hasText:'слот 1'}).click();m.switchPositionMs=performance.now()-t}
  const line=idx?page.locator('section').filter({has:page.getByLabel('Семейство')}):page.locator('section').nth(0)
  t=performance.now();await line.getByLabel('Ширина, мм').fill('4200');m.editWidthMs=performance.now()-t
  m.browser=await page.evaluate(()=>({fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime??null,heapBytes:performance.memory?.usedJSHeapSize??null,domNodes:document.querySelectorAll('*').length,longTasks:window.__longTasks}));m.requests=requests;m.errors=errors;if(n)samples.push(m);await context.close()
 }
 const summary={};for(const k of ['openReadyMs','addSevenMs','calculateMs','openBomMs','openTraceMs','searchTraceMs','profileChangeMs','editWidthMs']){const v=samples.map(x=>x[k]).sort((a,b)=>a-b);summary[k]={median:v[1],min:v[0],max:v[2]}}out.branches[idx?'current':'baseline']={samples,summary};await new Promise(r=>server.close(r))
}}finally{await browser.close();await backend.close()}
await writeFile(resolve('../../docs/jv/JV_UI_WORKSPACE_BENCHMARK.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2))
