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
  const terms={recipient:'Получатель',requisites:'Реквизиты',payment:'Условия оплаты',timeframe:'Сроки',delivery:'Доставка'};const revisionRoute=`${proposals}/${proposal.id}/revise`
  assert.equal((await app.inject({method:'POST',url:revisionRoute,headers:user,payload:{terms}})).statusCode,403)
  assert.equal((await app.inject({method:'POST',url:revisionRoute,headers:owner,payload:{terms:{...terms,delivery:''}}})).statusCode,400)
  assert.equal((await app.inject({method:'POST',url:revisionRoute,headers:owner,payload:{terms,totalSalePrice:'0'}})).statusCode,400)
  const revised=await app.inject({method:'POST',url:revisionRoute,headers:owner,payload:{terms}});assert.equal(revised.statusCode,201,revised.body);const rev=revised.json();assert.equal(rev.payload.previousDraftId,proposal.id);assert.deepEqual(rev.payload.terms,terms);assert.deepEqual(rev.payload.totalSalePrice,proposal.payload.totalSalePrice);assert.equal(rev.snapshotId,snapshot.id)
  const revisionRead=await app.inject({method:'GET',url:`${proposals}/${rev.id}`,headers:owner});assert.equal(revisionRead.statusCode,200);assert.deepEqual(revisionRead.json().payload.terms,terms)
  const updated={...draft,positions:[{...draft.positions[0],quantity:'2'}]};assert.equal((await app.inject({method:'PUT',url:`/api/jv/orders/${id}`,headers:owner,payload:{version:1,draft:updated}})).statusCode,200)
  const read=await app.inject({method:'GET',url:`${proposals}/${proposal.id}`,headers:owner});assert.equal(read.statusCode,200);assert.deepEqual(read.json().payload,proposal.payload)
  await prisma.jvProposalDraft.update({where:{id:proposal.id},data:{contentSha256:'0'.repeat(64)}});assert.equal((await app.inject({method:'GET',url:`${proposals}/${proposal.id}`,headers:owner})).statusCode,409)
  await prisma.jvCalculationSnapshot.update({where:{id:snapshot.id},data:{contentSha256:'0'.repeat(64)}});assert.equal((await app.inject({method:'POST',url:proposals,headers:owner,payload:{snapshotId:snapshot.id}})).statusCode,409)
 } finally {if(id){await prisma.jvProposalDraft.deleteMany({where:{orderId:id}});await prisma.jvCalculationSnapshot.deleteMany({where:{orderId:id}});await prisma.jvOrder.delete({where:{id}})}await app.close();await prisma.$disconnect()}
})

test('proposal review protects immutable terms and serializes decisions per saved version', async () => {
 process.env.JWT_SECRET = 'r55-isolated-only'
 const app = Fastify()
 await registerPlugins(app)
 await app.register(jvOrderPersistenceRoutes, { prefix: '/api/jv' })
 await app.ready()
 const headers = (role: 'OWNER' | 'ADMIN' | 'USER') =>
  ({ authorization: `Bearer ${app.jwt.sign({ id: `r55-${role}`, role })}` })
 const owner = headers('OWNER'), admin = headers('ADMIN'), user = headers('USER')
 const config = getJvUiFormConfig('RETAIL')
 const draft = {
  profile: 'RETAIL', uiSchemaVersion: config.schemaVersion, rulesVersion: config.rulesVersion,
  positions: [{ id: 'one', family: 'LINE', slot: 1, quantity: '1', inputs: config.families.LINE }],
 }
 const terms = { recipient: 'Получатель', requisites: 'Реквизиты', payment: 'Предоплата', timeframe: 'Два дня', delivery: 'Самовывоз' }
 let orderId = ''
 try {
  const post = async (url: string, payload: object, status: number, auth = owner) => {
   const response = await app.inject({ method: 'POST', url, headers: auth, payload })
   assert.equal(response.statusCode, status, response.body)
   return response.json()
  }
  orderId = (await post('/api/jv/orders', draft, 201)).id
  const order = `/api/jv/orders/${orderId}`
  const snapshot = await post(`${order}/calculation-snapshots`, { version: 1 }, 201)
  const pending = `${order}/proposal-drafts`
  const blank = await post(pending, { snapshotId: snapshot.id }, 201)
  const noTerms = await post(`${pending}/${blank.id}/review`, { action: 'SUBMIT' }, 422)
  assert.equal(noTerms.error.code, 'PROPOSAL_TERMS_REQUIRED')
  const original = await post(`${pending}/${blank.id}/revise`, { terms }, 201)
  const url = `${pending}/${original.id}`
  const reviewUrl = `${url}/review`
  const read = async (path: string) => {
   const response = await app.inject({ method: 'GET', url: path, headers: owner })
   assert.equal(response.statusCode, 200, response.body)
   return response.json()
  }
  assert.deepEqual((await read(url)).review, { status: 'DRAFT', events: [] })
  await post(reviewUrl, { action: 'SUBMIT' }, 403, user)
  await post(reviewUrl, { action: 'SUBMIT', actorId: 'forged' }, 400)
  await post(reviewUrl, { action: 'APPROVE' }, 409)
  await post(`/api/jv/orders/other/proposal-drafts/${original.id}/review`, { action: 'SUBMIT' }, 404)
  const submits = await Promise.all([admin, admin].map(auth =>
   app.inject({ method: 'POST', url: reviewUrl, headers: auth, payload: { action: 'SUBMIT' } }),
  ))
  assert.deepEqual(submits.map(r => r.statusCode).sort(), [201, 409])
  const conflict = submits.find(r => r.statusCode === 409)?.json()
  assert.equal(conflict.error.code, 'PROPOSAL_REVIEW_CONFLICT')
  assert.equal(conflict.review.status, 'IN_REVIEW')
  assert.equal(conflict.review.events.length, 1)
  await post(reviewUrl, { action: 'APPROVE' }, 403, admin)
  await post(reviewUrl, { action: 'RETURN', comment: 'Чужое решение' }, 403, admin)
  await post(reviewUrl, { action: 'RETURN', comment: '   ' }, 400)
  await post(reviewUrl, { action: 'RETURN', comment: 'о'.repeat(1001) }, 400)
  const returned = await post(reviewUrl, { action: 'RETURN', comment: '  Уточнить срок  ' }, 201)
  assert.equal(returned.status, 'CHANGES_REQUESTED')
  assert.deepEqual(returned.events.map((event: { sequence: number; status: string; actorId: string; actorRole: string; comment: string | null; contentSha256: string; createdAt: string }) => {
   assert.equal(event.contentSha256, original.contentSha256)
   assert.ok(Number.isFinite(Date.parse(event.createdAt)))
   return [event.sequence, event.status, event.actorId, event.actorRole, event.comment]
  }), [[1, 'IN_REVIEW', 'r55-ADMIN', 'ADMIN', null], [2, 'CHANGES_REQUESTED', 'r55-OWNER', 'OWNER', 'Уточнить срок']])
  await post(reviewUrl, { action: 'SUBMIT' }, 409)

  const revised = await post(`${url}/revise`, { terms: { ...terms, timeframe: 'Три дня' } }, 201)
  const revisedUrl = `${pending}/${revised.id}`
  assert.deepEqual((await read(revisedUrl)).review, { status: 'DRAFT', events: [] })
  await post(`${revisedUrl}/review`, { action: 'SUBMIT' }, 201)
  await prisma.jvProposalDraft.update({ where: { id: revised.id }, data: { contentSha256: '0'.repeat(64) } })
  const corruptProposal = await post(`${revisedUrl}/review`, { action: 'APPROVE' }, 409)
  assert.equal(corruptProposal.error.code, 'PROPOSAL_INTEGRITY_FAILED')
  await prisma.jvProposalDraft.update({ where: { id: revised.id }, data: { contentSha256: revised.contentSha256 } })
  await prisma.jvCalculationSnapshot.update({ where: { id: snapshot.id }, data: { contentSha256: '0'.repeat(64) } })
  const corruptSnapshot = await post(`${revisedUrl}/review`, { action: 'APPROVE' }, 409)
  assert.equal(corruptSnapshot.error.code, 'SNAPSHOT_INTEGRITY_FAILED')
  await prisma.jvCalculationSnapshot.update({ where: { id: snapshot.id }, data: { contentSha256: snapshot.contentSha256 } })
  const approved = await post(`${revisedUrl}/review`, { action: 'APPROVE' }, 201)
  assert.equal(approved.status, 'APPROVED')
  await post(`${revisedUrl}/review`, { action: 'RETURN', comment: 'Запоздалое решение' }, 409)
  const saved = await read(revisedUrl), predecessor = await read(url)
  assert.deepEqual(saved.review, approved)
  assert.deepEqual(predecessor.review, returned)
  assert.deepEqual(saved.payload.totalSalePrice, original.payload.totalSalePrice)
  assert.deepEqual(saved.payload.terms, { ...terms, timeframe: 'Три дня' })
  assert.equal(saved.contentSha256, revised.contentSha256)
  assert.equal(predecessor.contentSha256, original.contentSha256)
  assert.deepEqual(predecessor.payload, original.payload)
  await prisma.jvProposalReviewEvent.update({
   where: { proposalId_sequence: { proposalId: revised.id, sequence: 2 } },
   data: { contentSha256: '0'.repeat(64) },
  })
  const corruptEvent = await app.inject({ method: 'GET', url: revisedUrl, headers: owner })
  assert.equal(corruptEvent.statusCode, 409)
  assert.equal(corruptEvent.json().error.code, 'PROPOSAL_INTEGRITY_FAILED')
 } finally {
  if (orderId) {
   await prisma.jvProposalDraft.deleteMany({ where: { orderId } })
   await prisma.jvCalculationSnapshot.deleteMany({ where: { orderId } })
   await prisma.jvOrder.delete({ where: { id: orderId } })
  }
  await app.close()
  await prisma.$disconnect()
 }
})
