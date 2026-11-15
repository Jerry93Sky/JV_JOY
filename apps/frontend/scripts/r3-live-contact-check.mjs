import { chromium } from 'playwright'
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const env = Object.fromEntries((await readFile(process.argv[2], 'utf8')).split(/\r?\n/).filter(s => s.includes('=')).map(s => { const i=s.indexOf('='); return [s.slice(0,i),s.slice(i+1)] }))
const vite=await createServer({configFile:'vite.config.ts',root:'.',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:'http://127.0.0.1:3002'}}}});await vite.listen()
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),base=`http://127.0.0.1:${vite.httpServer.address().port}`,name=`CodexR31${Date.now()}`,phone=`+79${String(Date.now()).slice(-9)}`
try {
 await page.goto(base+'/login');await page.getByLabel('Логин',{exact:true}).fill('admin');await page.getByLabel('Пароль',{exact:true}).fill(env.JV_REVIEW_ADMIN_PASSWORD);await page.getByRole('button',{name:'Войти',exact:true}).click();await page.waitForURL(u=>!u.pathname.includes('login'))
 await page.goto(base+'/clients');await page.getByRole('button',{name:'Добавить контакт'}).click();let dialog=page.getByRole('dialog',{name:'Новый контакт'});await dialog.locator('[name=lastName]').fill(name);await dialog.locator('[name=firstName]').fill('Test');await dialog.locator('[name=phone]').fill(phone)
 let response=page.waitForResponse(r=>r.url().endsWith('/api/contacts')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Сохранить'}).click();assert.equal((await response).ok(),true);await dialog.waitFor({state:'hidden'})
 let row=page.getByRole('row').filter({hasText:name});await row.waitFor();await row.locator('td').first().dblclick();dialog=page.getByRole('dialog',{name:'Редактировать контакт'});assert.equal(await dialog.locator('[name=lastName]').inputValue(),name);await dialog.locator('[name=firstName]').fill('Updated')
 response=page.waitForResponse(r=>/\/api\/contacts\/[^/]+$/.test(r.url())&&r.request().method()==='PATCH');await dialog.getByRole('button',{name:'Сохранить'}).click();assert.equal((await response).ok(),true);await dialog.waitFor({state:'hidden'});await page.reload();row=page.getByRole('row').filter({hasText:name});await row.waitFor();assert.match(await row.innerText(),/Updated/)
 await row.locator('td').first().dblclick();dialog=page.getByRole('dialog',{name:'Редактировать контакт'});await dialog.locator('[name=firstName]').fill('Cancelled');await dialog.getByRole('button',{name:'Отмена'}).click();await dialog.waitFor({state:'hidden'});assert.match(await row.innerText(),/Updated/)
 page.once('dialog',d=>d.dismiss());await row.locator('button').last().click();assert.equal(await row.isVisible(),true);page.once('dialog',d=>d.accept());response=page.waitForResponse(r=>/\/api\/contacts\/[^/]+$/.test(r.url())&&r.request().method()==='DELETE');await row.locator('button').last().click();assert.equal((await response).ok(),true);await row.waitFor({state:'hidden'});console.log('PASS real backend contact create, double-click edit, reload, Cancel and controlled cleanup')
} finally {await browser.close();await vite.close()}
