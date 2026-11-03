import { FastifyInstance } from 'fastify'
import { authRoutes } from './auth'
import { userRoutes } from './users'
import { dealRoutes } from './deals'
import { leadRoutes } from './leads'
import { contactRoutes } from './contacts'
import { companyRoutes } from './companies'
import { productRoutes } from './products'
import { receiptRoutes } from './receipts'
import { writeoffRoutes } from './writeoffs'
import { supplierRoutes } from './suppliers'
import { systemRoutes } from './systems'
import { financeRoutes } from './finance'
import { settingsRoutes } from './settings'
import { fileRoutes } from './files'
import { glassRoutes } from './glass'
import { vendorRoutes } from './vendors'

export async function registerRoutes(app: FastifyInstance) {
  app.register(authRoutes, { prefix: '/api/auth' })
  app.register(userRoutes, { prefix: '/api/users' })
  app.register(dealRoutes, { prefix: '/api/deals' })
  app.register(leadRoutes, { prefix: '/api/leads' })
  app.register(contactRoutes, { prefix: '/api/contacts' })
  app.register(companyRoutes, { prefix: '/api/companies' })
  app.register(productRoutes, { prefix: '/api/products' })
  app.register(receiptRoutes, { prefix: '/api/receipts' })
  app.register(writeoffRoutes, { prefix: '/api/writeoffs' })
  app.register(supplierRoutes, { prefix: '/api/suppliers' })
  app.register(systemRoutes, { prefix: '/api/systems' })
  app.register(financeRoutes, { prefix: '/api/finance' })
  app.register(settingsRoutes, { prefix: '/api/settings' })
  app.register(fileRoutes, { prefix: '/api' })
  app.register(glassRoutes, { prefix: '/api/glass-types' })
  app.register(vendorRoutes, { prefix: '/api/vendors' })
}
