import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import { registerPlugins } from '../../src/plugins'
import { jvOrderPersistenceRoutes } from '../../src/routes/jvOrders'
import { getJvUiFormConfig } from '../../src/domain/jv/jvCalculationService'
import { prisma } from '../../src/lib/prisma'

test('captures server-only COMPLETE snapshots for saved order version',async()=>{
 process.env.JWT_SECRET='r5-isolated-only';const app=Fastify();await registerPlugins(app);await app.register(jvOrderPersistenceRoutes,{prefix:'/api/jv'});await app.ready()
 const owner={authorization:`Bearer ${app.jwt.sign({id:'r5-owner',role:'OWNER'})}`},user={authorization:`Bearer ${app.jwt.sign({id:'r5-user',role:'USER'})}`};const c=getJvUiFormConfig('COMPLETATION');const draft={profile:'COMPLETATION',uiSchemaVersion:c.schemaVersion,rulesVersion:c.rulesVersion,positions:[{id:'one',family:'LINE',slot:1,quantity:'1',inputs:c.families.LINE}]};let id=''
 try{
  const created=await app.inject({method:'POST',url:'/api/jv/orders',headers:owner,payload:draft});assert.equal(created.statusCode,201,created.body);id=created.json().id;const route=`/api/jv/orders/${id}/calculation-snapshots`
  assert.equal((await app.inject({method:'POST',url:route,headers:user,payload:{version:1}})).statusCode,403)
  assert.equal((await app.inject({method:'POST',url:route,headers:owner,payload:{version:1,price:'1'}})).statusCode,400)
  assert.equal((await app.inject({method:'POST',url:route,headers:owner,payload:{version:2}})).statusCode,409)
  const captured=await app.inject({method:'POST',url:route,headers:owner,payload:{version:1}});assert.equal(captured.statusCode,201,captured.body);const snapshot=captured.json();assert.equal(snapshot.orderVersion,1);assert.equal(snapshot.result.status,'COMPLETE');assert.match(snapshot.contentSha256,/^[0-9a-f]{64}$/);assert.deepEqual(snapshot.input,draft)
  const changed={...draft,positions:[{...draft.positions[0],quantity:'2'}]};assert.equal((await app.inject({method:'PUT',url:`/api/jv/orders/${id}`,headers:owner,payload:{version:1,draft:changed}})).statusCode,200)
  const old=await app.inject({method:'GET',url:`${route}/${snapshot.id}`,headers:owner});assert.equal(old.statusCode,200);assert.deepEqual(old.json().result,snapshot.result);assert.equal(old.json().orderVersion,1)
  assert.equal((await app.inject({method:'POST',url:route,headers:owner,payload:{version:1}})).statusCode,409)
  await prisma.jvCalculationSnapshot.update({where:{id:snapshot.id},data:{contentSha256:'0'.repeat(64)}})
  assert.equal((await app.inject({method:'GET',url:`${route}/${snapshot.id}`,headers:owner})).statusCode,409)
  const historical={...draft,uiSchemaVersion:'JV-UI-INPUTS-2'};const historicOrder=await app.inject({method:'POST',url:'/api/jv/orders',headers:owner,payload:historical});assert.equal(historicOrder.statusCode,201);const historicId=historicOrder.json().id
  try{const oldSnapshot=await app.inject({method:'POST',url:`/api/jv/orders/${historicId}/calculation-snapshots`,headers:owner,payload:{version:1}});assert.equal(oldSnapshot.statusCode,201,oldSnapshot.body);const rejected=await app.inject({method:'POST',url:`/api/jv/orders/${historicId}/proposal-drafts`,headers:owner,payload:{snapshotId:oldSnapshot.json().id}});assert.equal(rejected.statusCode,409);assert.equal(rejected.json().error.code,'HISTORICAL_GLASS_POLICY')}finally{await prisma.jvCalculationSnapshot.deleteMany({where:{orderId:historicId}});await prisma.jvOrder.delete({where:{id:historicId}})}
  const partial={...draft,positions:[{...draft.positions[0],family:'FRONT',inputs:{...c.families.FRONT,'commercial.glassEnabled':false,'commercial.finishingEnabled':false}}]};const updated=await app.inject({method:'PUT',url:`/api/jv/orders/${id}`,headers:owner,payload:{version:2,draft:partial}});assert.equal(updated.statusCode,200)
  const incomplete=await app.inject({method:'POST',url:route,headers:owner,payload:{version:3}});assert.equal(incomplete.statusCode,422,incomplete.body);assert.equal(incomplete.json().error.code,'PARTIAL_CALCULATION')
 }finally{if(id){await prisma.jvCalculationSnapshot.deleteMany({where:{orderId:id}});await prisma.jvOrder.delete({where:{id}})}await app.close();await prisma.$disconnect()}
})
