import {chromium} from 'playwright'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
const env=Object.fromEntries((await readFile(process.argv[2],'utf8')).trim().split(/\r?\n/).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)]}))
const browser=await chromium.launch({channel:'chrome',headless:true}),out=resolve('../../test-results/r3-dialogs');await mkdir(out,{recursive:true});const results=[]
try{for(const mode of ['light','dark'])for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://localhost:3002/login');await page.getByLabel('Логин',{exact:true}).fill('admin');await page.getByLabel('Пароль',{exact:true}).fill(env.JV_REVIEW_ADMIN_PASSWORD);await page.getByRole('button',{name:'Войти',exact:true}).click();await page.waitForURL(u=>!u.pathname.includes('login'))
 await page.evaluate(mode=>{localStorage.setItem('bms-theme',mode);document.documentElement.classList.toggle('dark',mode==='dark')},mode)
 for(const [route,button,title] of [['leads','Новый лид','Новый лид'],['deals','Новая заявка','Новая заявка'],['clients','Добавить контакт','Новый контакт'],['systems','Новая система','Новая система'],['settings','Добавить пользователя','Новый пользователь']]){
  await page.goto('http://localhost:3002/'+route);await page.getByRole('button',{name:button}).click();const dialog=page.getByRole('dialog');await dialog.getByText(title,{exact:true}).waitFor();await page.waitForTimeout(500);const box=await dialog.boundingBox();const clipped=!box||box.x<0||box.y<0||box.x+box.width>width+1||box.y+box.height>(width===390?844:900)+1
  await page.screenshot({path:resolve(out,`${mode}-${width}-${route}.png`)})
  await dialog.getByRole('button',{name:'Отмена'}).click();await dialog.waitFor({state:'hidden'});results.push({mode,width,route,clipped,errors:[...errors]})
 }
 await context.close()
}}finally{await browser.close()}
await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));if(results.some(x=>x.clipped||x.errors.length))process.exitCode=1
