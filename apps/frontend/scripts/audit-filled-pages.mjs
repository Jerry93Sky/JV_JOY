import {chromium} from 'playwright'
import {createServer} from 'vite'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
const vite=await createServer({configFile:'vite.config.ts',root:'.',server:{host:'127.0.0.1',port:0,strictPort:false}});await vite.listen();const url=`http://127.0.0.1:${vite.httpServer.address().port}`
const person={id:'u1',firstName:'Тест',lastName:'Сотрудник'}, date='2026-01-01T00:00:00.000Z', type={id:'t1',name:'Профиль'}
const data={
 '/leads':[{id:'l1',number:'TEST-001',leadStatus:'IN_PROGRESS',leadSource:'MANUAL',assignee:person,contact:{id:'c1',firstName:'Тест',lastName:'Клиент',phone:'+70000000000'},comment:'Длинное тестовое название без реальных персональных данных',createdAt:date,_count:{events:3}}],
 '/deals':[{id:'d1',number:'TEST-002',stage:'ASSEMBLY',direction:'PRIVATE',assignee:person,creator:person,contact:{id:'c1',firstName:'Тест',lastName:'Клиент',phone:'+70000000000'},needPainting:false,paintingOverdue:false,createdAt:date,updatedAt:date,_count:{items:2}}],
 '/users':[{...person,login:'test-user',role:'ADMIN',isActive:true}],
 '/products/types':[type], '/products':[{id:'p1',sku:'TEST-PROFILE-001',name:'Тестовый профиль с длинным наименованием',typeId:'t1',type,unit:'шт',isPaintable:true,markupRetail:0,markupWholesale:0,priceRetail:123456.78,priceWholesale:100000,quantity:1000,reservedQty:7,isActive:true}],
 '/systems':[{id:'s1',name:'Тестовая система остекления',isActive:true,createdAt:date,parameters:[],components:[],categories:[]}],
 '/vendors/categories':[{id:'vcat',name:'Тестовая категория',_count:{vendors:1}}], '/vendors':[{id:'v1',name:'Тестовый поставщик материалов',categoryId:'vcat',phone:'+70000000000',isPainting:false,isDefault:false,isActive:true,createdAt:date,category:{id:'vcat',name:'Тестовая категория'}}],
 '/finance/summary':{main:{grossRevenue:1234567,costOfGoods:456789,grossProfit:777778,netProfit:555555,margin:45,totalExpenses:10000,taxLoad:10,officialRevenue:1000000,expensesByCategory:{},dealsCount:3}},
 '/contacts':[{id:'c1',firstName:'Тест',lastName:'Клиент',phone:'+70000000000',companies:[]}], '/companies':[{id:'company1',name:'Тестовая компания',type:'OOO',bankAccounts:[]}], '/suppliers':[], '/receipts':[], '/writeoffs':[], '/finance/expenses':[], '/finance/expense-categories':[], '/finance/analytics':{topSystems:[],paintColors:[],topProducts:[],dealsCount:3}, '/finance/services-comparison':[]
}
const cases=[['leads','TEST-001'],['deals','TEST-002'],['warehouse','TEST-PROFILE-001'],['systems','Тестовая система остекления'],['settings','test-user'],['clients','Клиент Тест'],['vendors','Тестовый поставщик материалов'],['finance','Валовой доход']]
const browser=await chromium.launch({channel:'chrome',headless:true}),dir=resolve('../../test-results/jv-filled-audit');await mkdir(dir,{recursive:true});const report=[]
try{for(const mode of ['light','dark'])for(const width of [1440,1024,390])for(const [route,needle] of cases){
 const context=await browser.newContext({viewport:{width,height:width===390?844:width===1024?768:900}})
 await context.addInitScript(mode=>{localStorage.setItem('bms-theme',mode);localStorage.setItem('bms-auth',JSON.stringify({state:{token:'isolated-placeholder',user:{id:'u1',login:'test-user',firstName:'Тест',lastName:'Сотрудник',role:'ADMIN'}},version:0}))},mode)
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>{const pathname=new URL(route.request().url()).pathname;if(!pathname.startsWith('/api/'))return route.continue();const key=pathname.slice(4);return route.fulfill({status:key in data?200:503,contentType:'application/json',body:JSON.stringify(data[key]??{error:'fixture unavailable'})})})
 let rendered=false;try{await page.goto(`${url}/${route}`);await page.getByText(needle,{exact:false}).first().waitFor({timeout:5000});rendered=true}catch(e){errors.push(String(e).slice(0,400))}
 const file=`${mode}-${width}-${route}.png`;await page.screenshot({path:resolve(dir,file)});report.push({route:'/'+route,theme:mode,width,height:width===390?844:width===1024?768:900,fixture:needle,rendered,visualReview:'NOT_REVIEWED',errors,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),screenshot:file});await context.close()
}}finally{await browser.close();await vite.close()}
await writeFile(resolve(dir,'filled-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.some(x=>!x.rendered))process.exitCode=1
