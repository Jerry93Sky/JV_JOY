import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import { registerPlugins } from '../../src/plugins'
import { jvOrderPersistenceRoutes } from '../../src/routes/jvOrders'
import { getJvUiFormConfig } from '../../src/domain/jv/jvCalculationService'
import { prisma } from '../../src/lib/prisma'

test('proposal drafts derive frozen amounts from a verified complete snapshot',async()=>{
 process.env.JWT_SECRET='r52-isolated-only';const app=Fastify();await registerPlugins(app);await app.register(jvOrderPersistenceRoutes,{prefix:'/api/jv'});await app.ready()
 const owner={authorization:`Bearer ${app.jwt.sign({id:'r52-owner',role:'OWNER'})}`},user={authorization:`Bearer ${app.jwt.sign({id:'r52-user',role:'USER'})}`};const c=getJvUiFormConfig('RETAIL');const draft={profile:'RETAIL',uiSchemaVersion:c.schemaVersion,rulesVersion:c.rulesVersion,positions:[{id:'one',family:'LINE',slot:1,quantity:'1',inputs:c.families.LINE}]};let id=''
 try{
  const order=await app.inject({method:'POST',url:'/api/jv/orders',headers:owner,payload:draft});id=order.json().id;const snapshots=`/api/jv/orders/${id}/calculation-snapshots`,proposals=`/api/jv/orders/${id}/proposal-drafts`;const snap=await app.inject({method:'POST',url:snapshots,headers:owner,payload:{version:1}});assert.equal(snap.statusCode,201,snap.body);const snapshot=snap.json()
  assert.equal((await app.inject({method:'POST',url:proposals,headers:user,payload:{snapshotId:snapshot.id}})).statusCode,403)
  assert.equal((await app.inject({method:'POST',url:proposals,headers:owner,payload:{snapshotId:snapshot.id,totalSalePrice:'1'}})).statusCode,400)
  assert.equal((await app.inject({method:'POST',url:'/api/jv/orders/other/proposal-drafts',headers:owner,payload:{snapshotId:snapshot.id}})).statusCode,404)
  const response=await app.inject({method:'POST',url:proposals,headers:owner,payload:{snapshotId:snapshot.id}});assert.equal(response.statusCode,201,response.body);const proposal=response.json();assert.deepEqual(proposal.payload.totalSalePrice,snapshot.result.calculation.totalSalePrice);assert.equal(proposal.payload.orderVersion,1);assert.equal(proposal.payload.profile,'RETAIL')
  const updated={...draft,positions:[{...draft.positions[0],quantity:'2'}]};assert.equal((await app.inject({method:'PUT',url:`/api/jv/orders/${id}`,headers:owner,payload:{version:1,draft:updated}})).statusCode,200)
  const read=await app.inject({method:'GET',url:`${proposals}/${proposal.id}`,headers:owner});assert.equal(read.statusCode,200);assert.deepEqual(read.json().payload,proposal.payload)
  await prisma.jvProposalDraft.update({where:{id:proposal.id},data:{contentSha256:'0'.repeat(64)}});assert.equal((await app.inject({method:'GET',url:`${proposals}/${proposal.id}`,headers:owner})).statusCode,409)
  await prisma.jvCalculationSnapshot.update({where:{id:snapshot.id},data:{contentSha256:'0'.repeat(64)}});assert.equal((await app.inject({method:'POST',url:proposals,headers:owner,payload:{snapshotId:snapshot.id}})).statusCode,409)
 } finally {if(id){await prisma.jvProposalDraft.deleteMany({where:{orderId:id}});await prisma.jvCalculationSnapshot.deleteMany({where:{orderId:id}});await prisma.jvOrder.delete({where:{id}})}await app.close();await prisma.$disconnect()}
})
