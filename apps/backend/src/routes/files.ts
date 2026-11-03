import { FastifyInstance } from 'fastify'
import { requireAuth } from '../lib/auth'
import { prisma } from '../lib/prisma'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads')

// Создаём папку если нет
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

export async function fileRoutes(app: FastifyInstance) {
  // Загрузка файла для сделки
  app.post<{ Params: { dealId: string }; Querystring: { type: string } }>(
    '/deals/:dealId/upload',
    { preHandler: requireAuth },
    async (req, reply) => {
      const data = await req.file()
      if (!data) return reply.status(400).send({ error: 'Файл не найден' })

      const deal = await prisma.deal.findUnique({ where: { id: req.params.dealId } })
      if (!deal) return reply.status(404).send({ error: 'Сделка не найдена' })

      const fileType = req.query.type || 'ATTACHMENT'
      const ext = path.extname(data.filename)
      const uniqueName = `${crypto.randomUUID()}${ext}`
      const subDir = path.join(UPLOAD_DIR, 'deals', req.params.dealId)
      if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true })

      const filePath = path.join(subDir, uniqueName)
      const buffer = await data.toBuffer()
      fs.writeFileSync(filePath, buffer)

      const url = `/uploads/deals/${req.params.dealId}/${uniqueName}`

      // Для счёта — обновляем поле invoiceUrl
      if (fileType === 'INVOICE') {
        await prisma.deal.update({ where: { id: req.params.dealId }, data: { invoiceUrl: url } })
      }
      // Для чертежей стекла — обновляем glassDrawingUrl
      if (fileType === 'GLASS_DRAWING') {
        await prisma.deal.update({ where: { id: req.params.dealId }, data: { glassDrawingUrl: url } })
      }

      // Сохраняем в DealFile — только для поддерживаемых типов
      const validTypes = ['ATTACHMENT', 'INVOICE', 'SHIPMENT_PHOTO', 'SHIPMENT_DOC', 'GLASS_DRAWING']
      const safeType = validTypes.includes(fileType) ? fileType : 'ATTACHMENT'
      const file = await prisma.dealFile.create({
        data: { dealId: req.params.dealId, url, name: data.filename, type: safeType as never },
      })

      return { ok: true, file }
    }
  )

  // Загрузка файла для компании
  app.post<{ Params: { companyId: string }; Querystring: { type: string } }>(
    '/companies/:companyId/upload',
    { preHandler: requireAuth },
    async (req, reply) => {
      const data = await req.file()
      if (!data) return reply.status(400).send({ error: 'Файл не найден' })

      const ext = path.extname(data.filename)
      const uniqueName = `${crypto.randomUUID()}${ext}`
      const subDir = path.join(UPLOAD_DIR, 'companies', req.params.companyId)
      if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true })

      const filePath = path.join(subDir, uniqueName)
      fs.writeFileSync(filePath, await data.toBuffer())

      const url = `/uploads/companies/${req.params.companyId}/${uniqueName}`
      const fileType = req.query.type || 'PARTNER_CARD'

      const file = await prisma.companyFile.create({
        data: { companyId: req.params.companyId, url, name: data.filename, type: fileType as never },
      })

      return { ok: true, file }
    }
  )

  // Загрузка файла для прихода
  app.post<{ Params: { receiptId: string } }>(
    '/receipts/:receiptId/upload',
    { preHandler: requireAuth },
    async (req, reply) => {
      const data = await req.file()
      if (!data) return reply.status(400).send({ error: 'Файл не найден' })

      const ext = path.extname(data.filename)
      const uniqueName = `${crypto.randomUUID()}${ext}`
      const subDir = path.join(UPLOAD_DIR, 'receipts')
      if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true })

      const filePath = path.join(subDir, uniqueName)
      fs.writeFileSync(filePath, await data.toBuffer())

      const url = `/uploads/receipts/${uniqueName}`
      await prisma.receipt.update({ where: { id: req.params.receiptId }, data: { photoUrl: url } })

      return { ok: true, url }
    }
  )
}
