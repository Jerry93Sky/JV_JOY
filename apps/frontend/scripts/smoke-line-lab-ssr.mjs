import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const vite = await createServer({ configFile: 'vite.config.ts', root: '.', server: { middlewareMode: true }, appType: 'custom' })
try {
  const module = await vite.ssrLoadModule('/src/modules/jv-line/JVLineLabPage.tsx')
  const html = renderToStaticMarkup(React.createElement(module.default))
  for (const required of ['Калькулятор JV-Line', 'Параметры конструкции', 'Рассчитать в JV Engine', 'Расчёт ещё не запущен']) {
    if (!html.includes(required)) throw new Error(`JV-Line Lab SSR output is missing: ${required}`)
  }
  console.log(`JV-Line Lab component SSR smoke passed (${html.length} HTML characters).`)
} finally {
  await vite.close()
}
