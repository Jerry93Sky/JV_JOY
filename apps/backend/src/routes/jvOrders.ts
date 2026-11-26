import { FastifyInstance } from 'fastify'
import { createHash } from 'node:crypto'
import { calculateJvPreview, JvRequestError, serializeJvResult } from '../domain/jv/jvCalculationService'
import { createResultDto } from '../domain/jv/jvResultDto'
import { parseProposalTerms, stableJson } from '../domain/jv/jvProposalPayload'
import { Prisma } from '@prisma/client'
import { Role } from '@bms/shared'
import { prisma } from '../lib/prisma'
import { requireRole } from '../lib/auth'

const families = new Set(['LINE','ZIGZAG','SLIDER_L3','SLIDER_L5','SLIDER_X3','SLIDER_X5','FRONT'])
type Draft = { profile: 'COMPLETATION'|'RETAIL'; uiSchemaVersion: string; rulesVersion: string; positions: Array<{id:string;family:string;slot:number;quantity:string;inputs:Record<string,string|number|boolean>;configurationId?:string}>; contactId?:string|null; dealId?:string|null }
function validate(body: unknown): Draft | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const d = body as Record<string, unknown>
  if (!['COMPLETATION','RETAIL'].includes(String(d.profile)) || typeof d.uiSchemaVersion !== 'string' || !d.uiSchemaVersion || d.uiSchemaVersion.length>100 || typeof d.rulesVersion !== 'string' || !d.rulesVersion || d.rulesVersion.length>100 || !Array.isArray(d.positions) || d.positions.length>7) return null
  if ([d.contactId,d.dealId].some(v=>v!=null && (typeof v!=='string'||!v||v.length>100))) return null
  const ids=new Set<string>(),slots=new Set<number>()
  for(const raw of d.positions) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const p=raw as Record<string,unknown>
    if(typeof p.id!=='string'||!p.id||p.id.length>100||ids.has(p.id)||!families.has(String(p.family))||!Number.isInteger(p.slot)||Number(p.slot)<1||Number(p.slot)>7||slots.has(Number(p.slot))||typeof p.quantity!=='string'||!/^\d{1,9}$/.test(p.quantity)||Number(p.quantity)<1||!p.inputs||typeof p.inputs!=='object'||Array.isArray(p.inputs))return null
    if(p.configurationId!==undefined && (typeof p.configurationId!=='string'||p.configurationId.length>100))return null
    const inputs=Object.entries(p.inputs as Record<string,unknown>);if(inputs.length>200 || inputs.some(([k,v])=>!k||k.length>150||!['string','number','boolean'].includes(typeof v)||(typeof v==='string'&&v.length>1000)||(typeof v==='number'&&!Number.isFinite(v))))return null
    ids.add(p.id);slots.add(Number(p.slot))
  }
  return { profile:d.profile as Draft['profile'],uiSchemaVersion:d.uiSchemaVersion,rulesVersion:d.rulesVersion,positions:(d.positions as Draft['positions']).map(p=>({id:p.id,family:p.family,slot:p.slot,quantity:p.quantity,inputs:p.inputs,...(p.configurationId?{configurationId:p.configurationId}:{})})),...(d.contactId?{contactId:d.contactId as string}:{}),...(d.dealId?{dealId:d.dealId as string}:{}) }
}
type ProposalReviewEvent = Prisma.JvProposalReviewEventGetPayload<{}>
function proposalReview(events: ProposalReviewEvent[]) {
 return { status: events.at(-1)?.status ?? 'DRAFT', events }
}

const reviewTransitions = {
 SUBMIT: { from: 'DRAFT', to: 'IN_REVIEW' },
 APPROVE: { from: 'IN_REVIEW', to: 'APPROVED' },
 RETURN: { from: 'IN_REVIEW', to: 'CHANGES_REQUESTED' },
} as const

export async function jvOrderPersistenceRoutes(app: FastifyInstance) {
 const guard=requireRole(Role.OWNER,Role.ADMIN)
 async function links(d:Draft){return (!d.contactId || !!await prisma.contact.findUnique({where:{id:d.contactId},select:{id:true}})) && (!d.dealId || !!await prisma.deal.findUnique({where:{id:d.dealId},select:{id:true}}))}
 app.get('/orders',{preHandler:guard},()=>prisma.jvOrder.findMany({orderBy:{updatedAt:'desc'},take:100,select:{id:true,number:true,profile:true,version:true,createdAt:true,updatedAt:true,authorId:true,status:true}}))
 app.get<{Params:{id:string}}>('/orders/:id',{preHandler:guard},async(req,reply)=>{const order=await prisma.jvOrder.findUnique({where:{id:req.params.id}});return order??reply.status(404).send({error:{code:'NOT_FOUND',message:'Заказ не найден'}})})
 app.get<{Params:{id:string}}>('/orders/:id/revisions',{preHandler:guard},async(req,reply)=>{const exists=await prisma.jvOrder.findUnique({where:{id:req.params.id},select:{id:true}});if(!exists)return reply.status(404).send({error:{code:'NOT_FOUND',message:'Заказ не найден'}});return prisma.jvOrderRevision.findMany({where:{orderId:req.params.id},orderBy:{version:'desc'}})})
 app.post<{Body:unknown}>('/orders',{preHandler:guard,bodyLimit:262144},async(req,reply)=>{const d=validate(req.body);if(!d)return reply.status(400).send({error:{code:'INVALID_DRAFT',message:'Некорректный черновик'}});if(!await links(d))return reply.status(400).send({error:{code:'INVALID_LINK',message:'Клиент или сделка не найдены'}});const authorId=(req.user as {id:string}).id;const rawKey=req.headers['idempotency-key'];if(rawKey!==undefined && (typeof rawKey!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(rawKey)))return reply.status(400).send({error:{code:'INVALID_KEY'}});const creationKey=rawKey as string|undefined;const snapshot=d as unknown as Prisma.InputJsonValue;try{const order=await prisma.jvOrder.create({data:{authorId,creationKey,profile:d.profile,uiSchemaVersion:d.uiSchemaVersion,rulesVersion:d.rulesVersion,contactId:d.contactId,dealId:d.dealId,draft:snapshot,revisions:{create:{version:1,authorId,snapshot}}}});return reply.status(201).send(order)}catch(e){if(creationKey && e instanceof Prisma.PrismaClientKnownRequestError && e.code==='P2002'){const existing=await prisma.jvOrder.findUnique({where:{authorId_creationKey:{authorId,creationKey}}});if(existing)return reply.status(200).send(existing)}throw e}})
 app.put<{Params:{id:string};Body:unknown}>('/orders/:id',{preHandler:guard,bodyLimit:262144},async(req,reply)=>{const body=req.body as {version?:unknown;draft?:unknown}|null;const d=validate(body?.draft);if(!d||!Number.isSafeInteger(body?.version)||Number(body?.version)<1)return reply.status(400).send({error:{code:'INVALID_DRAFT',message:'Некорректный черновик или версия'}});if(!await links(d))return reply.status(400).send({error:{code:'INVALID_LINK',message:'Клиент или сделка не найдены'}});const authorId=(req.user as {id:string}).id;const snapshot=d as unknown as Prisma.InputJsonValue;const version=Number(body!.version);const updated=await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "JvOrder" WHERE id = ${req.params.id} FOR UPDATE`;const existing=await tx.jvOrder.findUnique({where:{id:req.params.id}});if(existing?.version===version && stableJson(existing.draft)===stableJson(snapshot))return existing;const changed=await tx.jvOrder.updateMany({where:{id:req.params.id,version},data:{version:{increment:1},profile:d.profile,uiSchemaVersion:d.uiSchemaVersion,rulesVersion:d.rulesVersion,contactId:d.contactId??null,dealId:d.dealId??null,draft:snapshot}});if(!changed.count)return null;await tx.jvOrderRevision.create({data:{orderId:req.params.id,version:version+1,authorId,snapshot}});return tx.jvOrder.findUnique({where:{id:req.params.id}})});if(!updated){const exists=await prisma.jvOrder.findUnique({where:{id:req.params.id},select:{id:true}});return reply.status(exists?409:404).send({error:{code:exists?'VERSION_CONFLICT':'NOT_FOUND',message:exists?'Заказ изменён в другой вкладке':'Заказ не найден'}})}return updated})
 app.post<{Params:{id:string;version:string};Body:{version:number}}>('/orders/:id/revisions/:version/restore',{preHandler:guard},async(req,reply)=>{
  const currentVersion=Number(req.body?.version),targetVersion=Number(req.params.version)
  if(!Number.isSafeInteger(currentVersion)||currentVersion<1||!Number.isSafeInteger(targetVersion)||targetVersion<1)return reply.status(400).send({error:{code:'INVALID_VERSION'}})
  const authorId=(req.user as {id:string}).id
  const restored=await prisma.$transaction(async tx=>{
   const revision=await tx.jvOrderRevision.findUnique({where:{orderId_version:{orderId:req.params.id,version:targetVersion}}})
   if(!revision)return {kind:'not_found' as const}
   const d=validate(revision.snapshot);if(!d)return {kind:'invalid' as const}
   const changed=await tx.jvOrder.updateMany({where:{id:req.params.id,version:currentVersion},data:{version:{increment:1},profile:d.profile,uiSchemaVersion:d.uiSchemaVersion,rulesVersion:d.rulesVersion,contactId:d.contactId??null,dealId:d.dealId??null,draft:revision.snapshot as Prisma.InputJsonValue}})
   if(!changed.count)return {kind:'conflict' as const}
   await tx.jvOrderRevision.create({data:{orderId:req.params.id,version:currentVersion+1,authorId,snapshot:revision.snapshot as Prisma.InputJsonValue}})
   return {kind:'ok' as const,order:await tx.jvOrder.findUnique({where:{id:req.params.id}})}
  })
  if(restored.kind==='not_found')return reply.status(404).send({error:{code:'NOT_FOUND'}})
  if(restored.kind==='invalid')return reply.status(422).send({error:{code:'INVALID_REVISION'}})
  if(restored.kind==='conflict')return reply.status(409).send({error:{code:'VERSION_CONFLICT'}})
  return restored.order
 })
 // A capture is generated exclusively from a saved order; callers cannot supply prices or results.
 app.post<{Params:{id:string};Body:{version?:unknown}}>('/orders/:id/calculation-snapshots',{preHandler:guard},async(req,reply)=>{
  const version=req.body?.version
  if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).some(k=>k!=='version'))return reply.status(400).send({error:{code:'INVALID_REQUEST'}})
  if(!Number.isSafeInteger(version)||Number(version)<1)return reply.status(400).send({error:{code:'INVALID_VERSION'}})
  const order=await prisma.jvOrder.findUnique({where:{id:req.params.id}})
  if(!order)return reply.status(404).send({error:{code:'NOT_FOUND'}})
  if(order.version!==version)return reply.status(409).send({error:{code:'VERSION_CONFLICT'}})
  const draft=validate(order.draft);if(!draft)return reply.status(422).send({error:{code:'INVALID_DRAFT'}})
  let result:ReturnType<typeof calculateJvPreview>
  try {result=calculateJvPreview({orderId:order.id,profile:draft.profile,uiSchemaVersion:draft.uiSchemaVersion,rulesVersion:draft.rulesVersion,positions:draft.positions.map(p=>({id:p.id,slot:p.slot,family:p.family,quantity:p.quantity,calculation:p.inputs,...(p.configurationId?{configurationId:p.configurationId}:{})}))})}
  catch(e){if(e instanceof JvRequestError)return reply.status(e.statusCode).send({error:{code:e.code,message:e.message,issues:e.issues}});throw e}
  if(result.status!=='COMPLETE'||result.calculation.status!=='COMPLETE'||!result.calculation.totalSalePrice)return reply.status(422).send({error:{code:'PARTIAL_CALCULATION',message:'Неполный расчёт нельзя зафиксировать'}})
  const input=JSON.parse(JSON.stringify(draft)) as Prisma.InputJsonValue
  const output=JSON.parse(JSON.stringify(serializeJvResult(result))) as Prisma.InputJsonValue
  const formatVersion='JV-CALCULATION-SNAPSHOT-1'
  const contentSha256=createHash('sha256').update(stableJson({formatVersion,orderId:order.id,orderVersion:version,input,result:output})).digest('hex')
  const saved=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "JvOrder" WHERE id = ${order.id} FOR UPDATE`
   const current=await tx.jvOrder.findUnique({where:{id:order.id},select:{version:true}})
   if(current?.version!==version)return null
   return tx.jvCalculationSnapshot.create({data:{orderId:order.id,orderVersion:Number(version),authorId:(req.user as {id:string}).id,formatVersion,input,result:output,contentSha256}})
  })
  if(!saved)return reply.status(409).send({error:{code:'VERSION_CONFLICT'}})
  return reply.status(201).send(saved)
 })
 app.get<{Params:{id:string}}>('/orders/:id/calculation-snapshots',{preHandler:guard},async(req,reply)=>{
  if(!await prisma.jvOrder.findUnique({where:{id:req.params.id},select:{id:true}}))return reply.status(404).send({error:{code:'NOT_FOUND'}})
  return prisma.jvCalculationSnapshot.findMany({where:{orderId:req.params.id},orderBy:{createdAt:'desc'},take:100,select:{id:true,orderId:true,orderVersion:true,authorId:true,createdAt:true,formatVersion:true,contentSha256:true}})
 })
 app.get<{Params:{id:string;snapshotId:string}}>('/orders/:id/calculation-snapshots/:snapshotId',{preHandler:guard},async(req,reply)=>{
  const snapshot=await prisma.jvCalculationSnapshot.findFirst({where:{id:req.params.snapshotId,orderId:req.params.id}})
  if(!snapshot)return reply.status(404).send({error:{code:'NOT_FOUND'}})
  const digest=createHash('sha256').update(stableJson({formatVersion:snapshot.formatVersion,orderId:snapshot.orderId,orderVersion:snapshot.orderVersion,input:snapshot.input,result:snapshot.result})).digest('hex')
  if(digest!==snapshot.contentSha256)return reply.status(409).send({error:{code:'SNAPSHOT_INTEGRITY_FAILED',message:'Содержимое снимка повреждено'}})
  reply.header('Cache-Control','no-store');return snapshot
 })
 // Proposal drafts contain server-derived, frozen values and are not issued documents.
 app.post<{Params:{id:string};Body:{snapshotId?:unknown}}>('/orders/:id/proposal-drafts',{preHandler:guard},async(req,reply)=>{
  if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).some(k=>k!=='snapshotId')||typeof req.body.snapshotId!=='string'||!req.body.snapshotId||req.body.snapshotId.length>100)return reply.status(400).send({error:{code:'INVALID_REQUEST'}})
  const snapshot=await prisma.jvCalculationSnapshot.findFirst({where:{id:req.body.snapshotId,orderId:req.params.id},include:{order:{select:{number:true}}}})
  if(!snapshot)return reply.status(404).send({error:{code:'NOT_FOUND'}})
  const digest=createHash('sha256').update(stableJson({formatVersion:snapshot.formatVersion,orderId:snapshot.orderId,orderVersion:snapshot.orderVersion,input:snapshot.input,result:snapshot.result})).digest('hex')
  if(digest!==snapshot.contentSha256)return reply.status(409).send({error:{code:'SNAPSHOT_INTEGRITY_FAILED'}})
  const sourceDraft=validate(snapshot.input)
  if(!sourceDraft)return reply.status(422).send({error:{code:'INVALID_DRAFT'}})
  if(sourceDraft.profile==='COMPLETATION' && sourceDraft.uiSchemaVersion!=='JV-UI-INPUTS-3')return reply.status(409).send({error:{code:'HISTORICAL_GLASS_POLICY',message:'Снимок использует прежние настройки включения стекла'}})
  const dto=createResultDto(snapshot.result) as unknown as {status:string;profile:string;versions:unknown;calculation:{status:string;totalSalePrice?:unknown;positions:Array<{id:string;slot:number;family:string;quantity:unknown;confirmedUnitAmount?:unknown}>}}
  if(dto.status!=='COMPLETE'||dto.calculation.status!=='COMPLETE'||!dto.calculation.totalSalePrice)return reply.status(422).send({error:{code:'PARTIAL_CALCULATION'}})
  const payload={kind:'JV_PROPOSAL_DRAFT',orderNumber:snapshot.order.number,orderVersion:snapshot.orderVersion,profile:dto.profile,versions:dto.versions,positions:dto.calculation.positions.map(p=>({id:p.id,slot:p.slot,family:p.family,quantity:p.quantity,confirmedUnitAmount:p.confirmedUnitAmount})),totalSalePrice:dto.calculation.totalSalePrice,snapshotSha256:snapshot.contentSha256}
  const formatVersion='JV-PROPOSAL-DRAFT-1';const contentSha256=createHash('sha256').update(stableJson({formatVersion,orderId:snapshot.orderId,snapshotId:snapshot.id,payload})).digest('hex')
  const proposal=await prisma.jvProposalDraft.create({data:{orderId:snapshot.orderId,snapshotId:snapshot.id,authorId:(req.user as {id:string}).id,formatVersion,payload:payload as unknown as Prisma.InputJsonValue,contentSha256}})
  return reply.status(201).send(proposal)
 })
 app.get<{Params:{id:string}}>('/orders/:id/proposal-drafts',{preHandler:guard},async(req,reply)=>{
  if(!await prisma.jvOrder.findUnique({where:{id:req.params.id},select:{id:true}}))return reply.status(404).send({error:{code:'NOT_FOUND'}})
  return prisma.jvProposalDraft.findMany({where:{orderId:req.params.id},orderBy:{createdAt:'desc'},take:100,select:{id:true,number:true,orderId:true,snapshotId:true,authorId:true,createdAt:true,formatVersion:true,contentSha256:true}})
 })
 app.get<{Params:{id:string;proposalId:string}}>('/orders/:id/proposal-drafts/:proposalId',{preHandler:guard},async(req,reply)=>{
  const found=await prisma.jvProposalDraft.findFirst({where:{id:req.params.proposalId,orderId:req.params.id},include:{reviewEvents:{orderBy:{sequence:'asc'}}}})
  if(!found)return reply.status(404).send({error:{code:'NOT_FOUND'}})
  const {reviewEvents,...proposal}=found
  const digest=createHash('sha256').update(stableJson({formatVersion:proposal.formatVersion,orderId:proposal.orderId,snapshotId:proposal.snapshotId,payload:proposal.payload})).digest('hex')
  if(digest!==proposal.contentSha256 || reviewEvents.some(event=>event.contentSha256!==digest))return reply.status(409).send({error:{code:'PROPOSAL_INTEGRITY_FAILED'}})
  reply.header('Cache-Control','no-store');return {...proposal,review:proposalReview(reviewEvents)}
 })
 app.post<{ Params: { id: string; proposalId: string }; Body: unknown }>('/orders/:id/proposal-drafts/:proposalId/review', { preHandler: guard, bodyLimit: 8192 }, async (req, reply) => {
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'action' && key !== 'comment')) {
   return reply.status(400).send({ error: { code: 'INVALID_REVIEW_ACTION' } })
  }
  const { action, comment } = body as { action?: unknown; comment?: unknown }
  if (action !== 'SUBMIT' && action !== 'APPROVE' && action !== 'RETURN') {
   return reply.status(400).send({ error: { code: 'INVALID_REVIEW_ACTION' } })
  }
  const actor = req.user as { id: string; role: Role }
  if (typeof actor.id !== 'string' || !actor.id) return reply.status(401).send({ error: { code: 'UNAUTHENTICATED' } })
  if (action !== 'SUBMIT' && actor.role !== Role.OWNER) {
   return reply.status(403).send({ error: { code: 'FORBIDDEN' } })
  }
  const returnComment = typeof comment === 'string' ? comment.trim() : ''
  if (action === 'RETURN' ? !returnComment || returnComment.length > 1000 : comment !== undefined) {
   return reply.status(400).send({ error: { code: 'INVALID_REVIEW_COMMENT' } })
  }
  const { id, proposalId } = req.params
  const transition = reviewTransitions[action]
  const result = await prisma.$transaction(async tx => {
   // Serialize decisions on the same immutable version, including two first submissions.
   const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "JvProposalDraft" WHERE id = ${proposalId} AND "orderId" = ${id} FOR UPDATE`
   if (!locked.length) return { status: 404, code: 'NOT_FOUND' }
   const proposal = await tx.jvProposalDraft.findUniqueOrThrow({
    where: { id: proposalId },
    include: { reviewEvents: { orderBy: { sequence: 'asc' } }, snapshot: true },
   })
   const { formatVersion, orderId, snapshotId, payload, contentSha256, reviewEvents, snapshot } = proposal
   const digest = createHash('sha256').update(stableJson({ formatVersion, orderId, snapshotId, payload })).digest('hex')
   if (formatVersion !== 'JV-PROPOSAL-DRAFT-1' || digest !== contentSha256 || reviewEvents.some(event => event.contentSha256 !== contentSha256)) {
    return { status: 409, code: 'PROPOSAL_INTEGRITY_FAILED' }
   }
   const state = proposalReview(reviewEvents)
   if (state.status !== transition.from) return { status: 409, code: 'PROPOSAL_REVIEW_CONFLICT', review: state }
   if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !parseProposalTerms(payload.terms)) {
    return { status: 422, code: 'PROPOSAL_TERMS_REQUIRED' }
   }
   const snapshotDigest = createHash('sha256').update(stableJson({
    formatVersion: snapshot.formatVersion, orderId: snapshot.orderId, orderVersion: snapshot.orderVersion,
    input: snapshot.input, result: snapshot.result,
   })).digest('hex')
   if (snapshot.orderId !== orderId || snapshotDigest !== snapshot.contentSha256 || payload.snapshotSha256 !== snapshot.contentSha256) {
    return { status: 409, code: 'SNAPSHOT_INTEGRITY_FAILED' }
   }
   const sourceDraft = validate(snapshot.input)
   if (!sourceDraft) return { status: 422, code: 'INVALID_DRAFT' }
   if (sourceDraft.profile === 'COMPLETATION' && sourceDraft.uiSchemaVersion !== 'JV-UI-INPUTS-3') {
    return { status: 409, code: 'HISTORICAL_GLASS_POLICY' }
   }
   if (!createResultDto(snapshot.result).calculation.totalSalePrice) {
    return { status: 422, code: 'PARTIAL_CALCULATION' }
   }
   const event = await tx.jvProposalReviewEvent.create({
    data: { proposalId, sequence: reviewEvents.length + 1, status: transition.to, actorId: actor.id,
     actorRole: actor.role, comment: returnComment || null, contentSha256 },
   })
   return { status: 201, review: proposalReview([...reviewEvents, event]) }
  })
  reply.header('Cache-Control', 'no-store')
  return result.code
   ? reply.status(result.status).send({ error: { code: result.code }, review: result.review })
   : reply.status(result.status).send(result.review)
 })
 // Terms create a new immutable draft; prices always come from its verified predecessor.
 app.post<{Params:{id:string;proposalId:string};Body:unknown}>('/orders/:id/proposal-drafts/:proposalId/revise',{preHandler:guard,bodyLimit:16384},async(req,reply)=>{
  if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).some(k=>k!=='terms'))return reply.status(400).send({error:{code:'INVALID_REQUEST'}})
  const clean=parseProposalTerms((req.body as {terms?:unknown}).terms)
  if(!clean)return reply.status(400).send({error:{code:'INVALID_TERMS',message:'Заполните все поля условий'}})
  const original=await prisma.jvProposalDraft.findFirst({where:{id:req.params.proposalId,orderId:req.params.id},include:{snapshot:true}})
  if(!original)return reply.status(404).send({error:{code:'NOT_FOUND'}})
  const digest=createHash('sha256').update(stableJson({formatVersion:original.formatVersion,orderId:original.orderId,snapshotId:original.snapshotId,payload:original.payload})).digest('hex')
  if(digest!==original.contentSha256)return reply.status(409).send({error:{code:'PROPOSAL_INTEGRITY_FAILED'}})
  const snap=original.snapshot,snapshotDigest=createHash('sha256').update(stableJson({formatVersion:snap.formatVersion,orderId:snap.orderId,orderVersion:snap.orderVersion,input:snap.input,result:snap.result})).digest('hex')
  if(snapshotDigest!==snap.contentSha256)return reply.status(409).send({error:{code:'SNAPSHOT_INTEGRITY_FAILED'}})
  const sourceDraft=validate(snap.input)
  if(!sourceDraft)return reply.status(422).send({error:{code:'INVALID_DRAFT'}})
  if(sourceDraft.profile==='COMPLETATION' && sourceDraft.uiSchemaVersion!=='JV-UI-INPUTS-3')return reply.status(409).send({error:{code:'HISTORICAL_GLASS_POLICY',message:'Снимок использует прежние настройки включения стекла'}})
  if(!original.payload||typeof original.payload!=='object'||Array.isArray(original.payload))return reply.status(422).send({error:{code:'INVALID_PROPOSAL'}})
  const payload={...original.payload,terms:clean,previousDraftId:original.id},formatVersion='JV-PROPOSAL-DRAFT-1'
  const contentSha256=createHash('sha256').update(stableJson({formatVersion,orderId:original.orderId,snapshotId:original.snapshotId,payload})).digest('hex')
  return reply.status(201).send(await prisma.jvProposalDraft.create({data:{orderId:original.orderId,snapshotId:original.snapshotId,authorId:(req.user as {id:string}).id,formatVersion,payload:payload as Prisma.InputJsonValue,contentSha256}}))
 })
 app.get('/templates',{preHandler:guard},()=>prisma.jvTemplate.findMany({orderBy:{updatedAt:'desc'},take:200}))
 app.post<{Body:{name?:unknown;draft?:unknown}}>('/templates',{preHandler:guard,bodyLimit:262144},async(req,reply)=>{
  const name=typeof req.body?.name==='string'?req.body.name.trim():'';const d=validate(req.body?.draft)
  if(!name||name.length>100||!d||!d.positions.length||d.contactId||d.dealId)return reply.status(400).send({error:{code:'INVALID_TEMPLATE'}})
  if(d.positions.some(p=>p.configurationId)){const expected=['LINE','ZIGZAG','SLIDER_L3','SLIDER_L5','SLIDER_X3','SLIDER_X5','FRONT'];if(d.positions.length!==7 || expected.some((family,i)=>{const p=d.positions.find(x=>x.slot===i+1);return !p||p.family!==family||p.quantity!=='1'||(i===6?p.configurationId!=='JV-FRONT-FITTINGS-I42-2-PR15A-1':!!p.configurationId)}))return reply.status(400).send({error:{code:'INVALID_TEMPLATE'}})}
  if(!d.positions.some(p=>p.configurationId)&&d.positions.length!==1)return reply.status(400).send({error:{code:'INVALID_TEMPLATE'}})
  return reply.status(201).send(await prisma.jvTemplate.create({data:{name,authorId:(req.user as {id:string}).id,draft:d as unknown as Prisma.InputJsonValue}}))
 })
 app.patch<{Params:{id:string};Body:{name?:unknown}}>('/templates/:id',{preHandler:guard},async(req,reply)=>{const name=typeof req.body?.name==='string'?req.body.name.trim():'';if(!name||name.length>100)return reply.status(400).send({error:{code:'INVALID_TEMPLATE'}});const result=await prisma.jvTemplate.updateMany({where:{id:req.params.id},data:{name}});if(!result.count)return reply.status(404).send({error:{code:'NOT_FOUND'}});return prisma.jvTemplate.findUnique({where:{id:req.params.id}})})
 app.delete<{Params:{id:string}}>('/templates/:id',{preHandler:guard},async(req,reply)=>{const result=await prisma.jvTemplate.deleteMany({where:{id:req.params.id}});return result.count?reply.status(204).send():reply.status(404).send({error:{code:'NOT_FOUND'}})})

}
