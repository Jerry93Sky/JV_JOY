import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const vite = await createServer({ configFile: 'vite.config.ts', root: '.', server: { middlewareMode: true }, appType: 'custom' })
try {
  const page = await vite.ssrLoadModule('/src/modules/jv-order/JVOrderPage.tsx')
  const api = await vite.ssrLoadModule('/src/api/jv.ts')
  const html = renderToStaticMarkup(React.createElement(page.default))
  if (!html.includes('Раздел JV-заказов доступен владельцу и администратору.')) throw new Error('Unauthenticated role was not denied')
  if (!api.canCalculateJv('OWNER') || !api.canCalculateJv('ADMIN') || api.canCalculateJv('USER') || api.canCalculateJv(undefined)) throw new Error('JV role policy mismatch')
  console.log('JV order SSR access guard smoke passed')
} finally {
  await vite.close()
}
