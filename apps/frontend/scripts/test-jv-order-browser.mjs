import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const backendRequire = createRequire(resolve('../backend/package.json'))
const Fastify = backendRequire('fastify')
const { registerPlugins } = backendRequire('./dist/apps/backend/src/plugins/index.js')
const { registerRoutes } = backendRequire('./dist/apps/backend/src/routes/index.js')
process.env.JWT_SECRET = randomBytes(32).toString('hex')
const app = Fastify({ logger: false })
await registerPlugins(app)
await registerRoutes(app)
await app.listen({ port: 0, host: '127.0.0.1' })
const backendUrl = `http://127.0.0.1:${app.server.address().port}`
const vite = await createServer({ configFile: 'vite.config.ts', root: '.', server: { host: '127.0.0.1', port: 0, strictPort: false, proxy: { '/api': { target: backendUrl, changeOrigin: true } } } })
let browser
try {
  await vite.listen()
  const frontUrl = `http://127.0.0.1:${vite.httpServer.address().port}`
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  async function contextFor(role) {
    const context = await browser.newContext()
    const token = app.jwt.sign({ id: `e2e-${role}`, role })
    await context.addInitScript(({ signedToken, userRole }) => {
      localStorage.setItem('bms-auth', JSON.stringify({ state: { token: signedToken, user: { id: 'e2e', login: 'test', firstName: 'Test', lastName: 'User', role: userRole } }, version: 0 }))
    }, { signedToken: token, userRole: role })
    return context
  }
  const deniedContext = await contextFor('USER')
  const denied = await deniedContext.newPage()
  await denied.goto(`${frontUrl}/jv/orders/new`)
  await denied.getByText('Раздел JV-заказов доступен владельцу и администратору.').waitFor()
  await deniedContext.close()

  const context = await contextFor('ADMIN')
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${frontUrl}/jv/orders/new`)
  await page.getByRole('heading', { name: 'Новый JV-заказ' }).waitFor()
  const add = page.getByRole('button', { name: 'Добавить конструкцию' })
  await add.waitFor({ state: 'visible' })
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(button => button.textContent === 'Добавить конструкцию')?.disabled)
  const list = page.locator('section')
  for (const [i, family] of ['LINE','FRONT','ZIGZAG','SLIDER_L3','SLIDER_L5','SLIDER_X3','SLIDER_X5'].entries()) {
    await add.click()
    await list.nth(i).getByLabel('Семейство').selectOption(family)
  }
  assert.equal(await list.count(), 7)
  assert.equal(await add.isDisabled(), true)
  const line = list.nth(0), front = list.nth(1)
  await line.getByLabel('Ширина, мм').fill('4200')
  assert.equal(await front.getByLabel('Выбор ширины двери').isDisabled(), true)
  assert.equal(await front.getByLabel('Вариант открывания').locator('option[value="1"]').isDisabled(), true)
  await line.getByLabel('Транспортная опция').selectOption('2')
  assert.equal(await front.getByLabel('Транспортная опция').inputValue(), '2')
  async function calculate() {
    const response = page.waitForResponse(resp => resp.url().includes('/api/jv/orders/calculate-preview') && resp.request().method() === 'POST')
    await page.getByRole('button', { name: 'Рассчитать', exact: true }).click()
    const result = await response
    assert.equal(result.status(), 200, await result.text())
  }
  await calculate()
  await page.getByText('Расчёт завершён', { exact: true }).waitFor()
  await page.getByText(/^Итог:/).waitFor()
  await line.getByLabel('Ширина, мм').fill('4400')
  assert.equal(await page.getByText(/^Итог:/).count(), 0)
  await calculate()
  await page.getByText(/^Итог:/).waitFor()
  await page.getByLabel('Ценовой профиль').selectOption('RETAIL')
  assert.equal(await page.getByText(/^Итог:/).count(), 0)
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(button => button.textContent === 'Рассчитать')?.disabled)
  await calculate()
  await page.getByText('Расчёт завершён', { exact: true }).waitFor()
  await front.getByLabel('Стекло', { exact: true }).uncheck()
  await front.getByLabel('Отделка', { exact: true }).uncheck()
  await calculate()
  await page.getByText('Частичный расчёт', { exact: true }).waitFor()
  assert.equal(await page.getByText(/^Итог:/).count(), 0)
  await front.getByLabel('Стекло', { exact: true }).check()
  await front.getByLabel('Отделка', { exact: true }).check()
  await list.nth(6).getByLabel('Семейство').selectOption('FRONT')
  await calculate()
  await page.getByText('Расчёт завершён', { exact: true }).waitFor()
  await list.nth(6).getByLabel('Семейство').selectOption('SLIDER_X5')
  await page.route('**/api/jv/orders/calculate-preview', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"TEST"}}' }))
  await page.getByRole('button', { name: 'Рассчитать', exact: true }).click()
  await page.getByText('Ошибка сервера расчёта.').waitFor()
  const doorPage = await context.newPage()
  await doorPage.goto(`${frontUrl}/jv/orders/new`)
  await doorPage.getByRole('button',{name:'Front с дверью — проверенный заказ из 7 систем'}).click()
  assert.equal(await doorPage.locator('section').count(),7)
  async function calculateDoor() {
    const response=doorPage.waitForResponse(resp=>resp.url().includes('/api/jv/orders/calculate-preview')&&resp.request().method()==='POST')
    await doorPage.getByRole('button',{name:'Рассчитать',exact:true}).click()
    const result=await response;assert.equal(result.status(),200,await result.text())
    const data=await result.json();assert.equal(data.status,'COMPLETE');assert.ok(data.versions.configurationProfiles.includes('JV-FRONT-FITTINGS-I42-2-PR15A-1'))
    await doorPage.getByText(/^Итог:/).waitFor()
  }
  await calculateDoor()
  await doorPage.locator('section').nth(0).getByLabel('Транспортная опция').selectOption('2')
  assert.equal(await doorPage.getByText(/^Итог:/).count(),0)
  await calculateDoor()
  await doorPage.getByLabel('Ценовой профиль').selectOption('RETAIL')
  assert.equal(await doorPage.getByText(/^Итог:/).count(),0)
  await doorPage.waitForFunction(() => ![...document.querySelectorAll('button')].find(button => button.textContent === 'Рассчитать')?.disabled)
  await calculateDoor()
  await doorPage.close()
  assert.equal(errors.length, 0, errors.join('\n'))
  await context.close()
  console.log('Browser E2E passed: role access, seven families, slots, transport, both profiles, COMPLETE/PARTIAL, recalculation and API error')
} finally {
  if (browser) await browser.close()
  await vite.close()
  await app.close()
}
