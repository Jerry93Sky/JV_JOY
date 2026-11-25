import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import { registerPlugins } from '../../src/plugins'
import { jvOrderPersistenceRoutes } from '../../src/routes/jvOrders'
import { getJvUiFormConfig } from '../../src/domain/jv/jvCalculationService'
import { prisma } from '../../src/lib/prisma'

test('R4.2 idempotency, revision restoration, templates, isolation and access',async()=>{
 process.env.JWT_SECRET='r42-isolated-only';const app=Fastify();await registerPlugins(app);await app.register(jvOrderPersistenceRoutes,{prefix:'/api/jv'});await app.ready()
 const owner={authorization:`Bearer ${app.jwt.sign({id:'r42-owner',role:'OWNER'})}`},limited={authorization:`Bearer ${app.jwt.sign({id:'r42-user',role:'USER'})}`};const c=getJvUiFormConfig('RETAIL');const draft={profile:'RETAIL',uiSchemaVersion:c.schemaVersion,rulesVersion:c.rulesVersion,positions:[{id:'one',family:'LINE',slot:1,quantity:'1',inputs:c.families.LINE}]};let id='';const templates:string[]=[]
 try {
  assert.equal((await app.inject({method:'GET',url:'/api/jv/templates',headers:limited})).statusCode,403)
  const creation={...owner,'idempotency-key':'r42-retry-test'}
  const [a,b]=await Promise.all([app.inject({method:'POST',url:'/api/jv/orders',headers:creation,payload:draft}),app.inject({method:'POST',url:'/api/jv/orders',headers:creation,payload:draft})]);assert.deepEqual([a.statusCode,b.statusCode].sort(),[200,201]);assert.equal(a.json().id,b.json().id);id=a.json().id
  const noChange=await app.inject({method:'PUT',url:`/api/jv/orders/${id}`,headers:owner,payload:{version:1,draft}});assert.equal(noChange.statusCode,200);assert.equal(noChange.json().version,1)
  const changed={...draft,positions:[{...draft.positions[0],quantity:'2'}]};const updated=await app.inject({method:'PUT',url:`/api/jv/orders/${id}`,headers:owner,payload:{version:1,draft:changed}});assert.equal(updated.json().version,2)
  const conflict=await app.inject({method:'POST',url:`/api/jv/orders/${id}/revisions/1/restore`,headers:owner,payload:{version:1}});assert.equal(conflict.statusCode,409)
  const restored=await app.inject({method:'POST',url:`/api/jv/orders/${id}/revisions/1/restore`,headers:owner,payload:{version:2}});assert.equal(restored.statusCode,200);assert.equal(restored.json().version,3);assert.deepEqual(restored.json().draft,draft)
  const history=await app.inject({method:'GET',url:`/api/jv/orders/${id}/revisions`,headers:owner});assert.deepEqual(history.json().map((x:{version:number})=>x.version),[3,2,1])
  for(const family of ['LINE','ZIGZAG','SLIDER_L3','SLIDER_L5','SLIDER_X3','SLIDER_X5','FRONT'] as const){const d={...draft,positions:[{...draft.positions[0],family,inputs:c.families[family]}]};const created=await app.inject({method:'POST',url:'/api/jv/templates',headers:owner,payload:{name:family,draft:d}});assert.equal(created.statusCode,201,created.body);templates.push(created.json().id)}
  const singleDoor={...draft,positions:[{...draft.positions[0],family:'FRONT',configurationId:c.frontDoorProfile.id}]};assert.equal((await app.inject({method:'POST',url:'/api/jv/templates',headers:owner,payload:{name:'bad',draft:singleDoor}})).statusCode,400)
  const fullDoor={...draft,positions:c.frontDoorProfile.slots.map((family,i)=>({id:`door-${i}`,family,slot:i+1,quantity:'1',inputs:family==='FRONT'?c.frontDoorProfile.defaults:c.families[family],...(family==='FRONT'?{configurationId:c.frontDoorProfile.id}:{})}))};const door=await app.inject({method:'POST',url:'/api/jv/templates',headers:owner,payload:{name:'door',draft:fullDoor}});assert.equal(door.statusCode,201,door.body);templates.push(door.json().id)
  assert.equal((await app.inject({method:'PATCH',url:`/api/jv/templates/${templates[0]}`,headers:owner,payload:{name:'renamed'}})).statusCode,200);assert.equal((await app.inject({method:'DELETE',url:`/api/jv/templates/${templates[0]}`,headers:limited})).statusCode,403)
 } finally {await prisma.jvTemplate.deleteMany({where:{id:{in:templates}}});if(id)await prisma.jvOrder.delete({where:{id}});await app.close();await prisma.$disconnect()}
})
