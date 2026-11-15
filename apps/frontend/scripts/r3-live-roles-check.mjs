import { chromium } from 'playwright'
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
const env = Object.fromEntries((await readFile(process.argv[2], 'utf8')).split(/\r?\n/).filter(s=>s.includes('=')).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)]}))
const api='http://127.0.0.1:3002/api', marker=`R32-${Date.now()}`, password=randomBytes(24).toString('base64url')
async function req(path,{token,method='GET',body}={}) { return fetch(api+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}) }
const ownerLogin=await req('/auth/login',{method:'POST',body:{login:'admin',password:env.JV_REVIEW_ADMIN_PASSWORD}});assert.equal(ownerLogin.ok,true);const owner=await ownerLogin.json();assert.equal(owner.user.role,'OWNER','demo account must be OWNER')
const created=[];let vendorId;let browser,vite;const results=[]
try {
 const cats=await (await req('/vendors/categories',{token:owner.token})).json();assert.ok(cats.length)
 const v=await req('/vendors',{token:owner.token,method:'POST',body:{name:marker,categoryId:cats[0].id}});assert.equal(v.status,201);vendorId=(await v.json()).id
 const accounts=[owner]
 for(const role of ['ADMIN','USER','GUEST']) {
  const login=`${marker}-${role}`;const c=await req('/users',{token:owner.token,method:'POST',body:{login,password,firstName:'R32',lastName:role,role}});assert.equal(c.status,201,`create ${role}`);const user=await c.json();created.push(user.id)
  const l=await req('/auth/login',{method:'POST',body:{login,password}});assert.equal(l.status,200);accounts.push(await l.json())
 }
 vite=await createServer({configFile:'vite.config.ts',root:'.',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:'http://127.0.0.1:3002'}}}});await vite.listen();const base=`http://127.0.0.1:${vite.httpServer.address().port}`;browser=await chromium.launch({channel:'chrome',headless:true})
 for(const account of accounts) {
  const role=account.user.role,canEdit=['OWNER','ADMIN'].includes(role)
  const patch=await req(`/vendors/${vendorId}`,{token:account.token,method:'PATCH',body:{comment:`role-${role}`}});assert.equal(patch.status,canEdit?200:403,`backend ${role}`)
  const ctx=await browser.newContext({viewport:{width:1440,height:900}})
  try {
   await ctx.addInitScript(auth=>localStorage.setItem('bms-auth',JSON.stringify({state:auth,version:0})),{token:account.token,user:account.user})
   const page=await ctx.newPage();await page.goto(base+'/vendors');const row=page.getByRole('row').filter({hasText:marker});await row.waitFor();const pencil=row.getByRole('button',{name:'Редактировать поставщика'});assert.equal(await pencil.isEnabled(),canEdit,`button ${role}`);await row.locator('td').first().dblclick();const dialog=page.getByRole('dialog',{name:'Редактировать поставщика'})
   if(canEdit){await dialog.waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'})}else assert.equal(await dialog.count(),0,`double click ${role}`)
   if(role==='OWNER'){
    await page.goto(base+'/settings');const userRow=page.getByRole('row').filter({hasText:`${marker}-USER`});await userRow.waitFor();await userRow.locator('td').first().dblclick();const edit=page.getByRole('dialog',{name:'Редактировать пользователя'});await edit.waitFor();const inputs=edit.locator('input');assert.equal(await inputs.nth(1).inputValue(),'R32');await inputs.nth(1).fill('R32Updated');const save=page.waitForResponse(r=>r.url().includes('/api/users/')&&r.request().method()==='PATCH');await edit.getByRole('button',{name:'Сохранить'}).click();assert.equal((await save).status(),200);await edit.waitFor({state:'hidden'});await page.reload();const updatedRow=page.getByRole('row').filter({hasText:`${marker}-USER`});await updatedRow.waitFor();assert.match(await updatedRow.innerText(),/R32Updated/);await updatedRow.locator('td').first().dblclick();await edit.waitFor();await inputs.nth(1).fill('Cancelled');await edit.getByRole('button',{name:'Отмена'}).click();await edit.waitFor({state:'hidden'});assert.match(await updatedRow.innerText(),/R32Updated/);console.log('PASS real user row edit, save, reload and cancel')
   }
   results.push({role,backend:patch.status,editEnabled:canEdit});console.log(`PASS ${role}: live authorization and vendor edit controls`)
  }finally {await ctx.close()}
 }
 const after=await (await req('/vendors',{token:owner.token})).json();assert.equal(after.find(x=>x.id===vendorId).comment,'role-ADMIN','rejected roles did not change data')
}finally {
 if(browser)await browser.close();if(vite)await vite.close()
 if(vendorId){const r=await req(`/vendors/${vendorId}`,{token:owner.token,method:'DELETE'});if(!r.ok)throw Error(`vendor cleanup failed ${r.status}`)}
 for(const id of created){const r=await req(`/users/${id}`,{token:owner.token,method:'DELETE'});if(!r.ok)throw Error(`user cleanup failed ${r.status}`)}
 const users=await (await req('/users',{token:owner.token})).json(),vendors=await (await req('/vendors',{token:owner.token})).json();assert.ok(!users.some(u=>u.login.startsWith(marker)));assert.ok(!vendors.some(v=>v.name===marker));console.log('PASS cleanup verified for generated users and vendor')
}
