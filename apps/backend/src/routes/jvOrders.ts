import { FastifyInstance } from 'fastify'
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
export async function jvOrderPersistenceRoutes(app: FastifyInstance) {
 const guard=requireRole(Role.OWNER,Role.ADMIN)
 async function links(d:Draft){return (!d.contactId || !!await prisma.contact.findUnique({where:{id:d.contactId},select:{id:true}})) && (!d.dealId || !!await prisma.deal.findUnique({where:{id:d.dealId},select:{id:true}}))}
 app.get('/orders',{preHandler:guard},()=>prisma.jvOrder.findMany({orderBy:{updatedAt:'desc'},take:100,select:{id:true,number:true,profile:true,version:true,createdAt:true,updatedAt:true,authorId:true,status:true}}))
 app.get<{Params:{id:string}}>('/orders/:id',{preHandler:guard},async(req,reply)=>{const order=await prisma.jvOrder.findUnique({where:{id:req.params.id}});return order??reply.status(404).send({error:{code:'NOT_FOUND',message:'Заказ не найден'}})})
 app.get<{Params:{id:string}}>('/orders/:id/revisions',{preHandler:guard},async(req,reply)=>{const exists=await prisma.jvOrder.findUnique({where:{id:req.params.id},select:{id:true}});if(!exists)return reply.status(404).send({error:{code:'NOT_FOUND',message:'Заказ не найден'}});return prisma.jvOrderRevision.findMany({where:{orderId:req.params.id},orderBy:{version:'desc'}})})
 app.post<{Body:unknown}>('/orders',{preHandler:guard,bodyLimit:262144},async(req,reply)=>{const d=validate(req.body);if(!d)return reply.status(400).send({error:{code:'INVALID_DRAFT',message:'Некорректный черновик'}});if(!await links(d))return reply.status(400).send({error:{code:'INVALID_LINK',message:'Клиент или сделка не найдены'}});const authorId=(req.user as {id:string}).id;const snapshot=d as unknown as Prisma.InputJsonValue;const order=await prisma.jvOrder.create({data:{authorId,profile:d.profile,uiSchemaVersion:d.uiSchemaVersion,rulesVersion:d.rulesVersion,contactId:d.contactId,dealId:d.dealId,draft:snapshot,revisions:{create:{version:1,authorId,snapshot}}}});return reply.status(201).send(order)})
 app.put<{Params:{id:string};Body:unknown}>('/orders/:id',{preHandler:guard,bodyLimit:262144},async(req,reply)=>{const body=req.body as {version?:unknown;draft?:unknown}|null;const d=validate(body?.draft);if(!d||!Number.isSafeInteger(body?.version)||Number(body?.version)<1)return reply.status(400).send({error:{code:'INVALID_DRAFT',message:'Некорректный черновик или версия'}});if(!await links(d))return reply.status(400).send({error:{code:'INVALID_LINK',message:'Клиент или сделка не найдены'}});const authorId=(req.user as {id:string}).id;const snapshot=d as unknown as Prisma.InputJsonValue;const version=Number(body!.version);const updated=await prisma.$transaction(async tx=>{const changed=await tx.jvOrder.updateMany({where:{id:req.params.id,version},data:{version:{increment:1},profile:d.profile,uiSchemaVersion:d.uiSchemaVersion,rulesVersion:d.rulesVersion,contactId:d.contactId??null,dealId:d.dealId??null,draft:snapshot}});if(!changed.count)return null;await tx.jvOrderRevision.create({data:{orderId:req.params.id,version:version+1,authorId,snapshot}});return tx.jvOrder.findUnique({where:{id:req.params.id}})});if(!updated){const exists=await prisma.jvOrder.findUnique({where:{id:req.params.id},select:{id:true}});return reply.status(exists?409:404).send({error:{code:exists?'VERSION_CONFLICT':'NOT_FOUND',message:exists?'Заказ изменён в другой вкладке':'Заказ не найден'}})}return updated})
}
