import {chromium} from 'playwright'
import {createServer} from 'vite'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
const vite=await createServer({configFile:'vite.config.ts',root:'.',server:{host:'127.0.0.1',port:0,strictPort:false}});await vite.listen();const url=`http://127.0.0.1:${vite.httpServer.address().port}`
const browser=await chromium.launch({channel:'chrome',headless:true});const dir=resolve('../../test-results/jv-ux-audit');await mkdir(dir,{recursive:true});const report=[]
try{for(const mode of ['light','dark'])for(const route of ['login','leads','deals','clients','warehouse','vendors','systems','finance','settings','jv/orders/new']){
 const context=await browser.newContext({viewport:{width:1440,height:900}})
 await context.addInitScript(({mode})=>{localStorage.setItem('bms-theme',mode);localStorage.setItem('bms-auth',JSON.stringify({state:{token:'isolated-test-placeholder',user:{id:'test',login:'test',firstName:'Test',lastName:'User',role:'ADMIN'}},version:0}))},{mode})
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>new URL(route.request().url()).pathname.startsWith('/api/')?route.fulfill({status:503,contentType:'application/json',body:'{"error":"test service unavailable"}'}):route.continue())
 await page.goto(`${url}/${route}`);await page.waitForFunction(()=>document.querySelector('#root')?.childElementCount>0,{timeout:20000});await page.waitForTimeout(700);const file=`${mode}-${route.replaceAll('/','-')}.png`;await page.screenshot({path:resolve(dir,file)});report.push({route:'/'+route,theme:mode,viewport:'1440x900',data:'all API requests mocked 503; no DB',screenshot:file,errors,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)});await context.close()
}}finally{await browser.close();await vite.close()}
await writeFile(resolve(dir,'audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))
