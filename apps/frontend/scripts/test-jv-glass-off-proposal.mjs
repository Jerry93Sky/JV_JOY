import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const backend = process.env.JV_TEST_BACKEND ?? 'http://127.0.0.1:3318'
const password = process.env.JV_TEST_PASSWORD
assert.ok(password, 'Set JV_TEST_PASSWORD for the isolated backend')
const vite = await createServer({
  configFile: 'vite.config.ts',
  server: { host: '127.0.0.1', port: 0, proxy: { '/api': { target: backend } } },
})
await vite.listen()
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage()
  const base = `http://127.0.0.1:${vite.httpServer.address().port}`
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const button = name => page.getByRole('button', { name, exact: true })
  async function post(name, path, status) {
    const pending = page.waitForResponse(r => new URL(r.url()).pathname.endsWith(path) && r.request().method() === 'POST')
    await button(name).click()
    const response = await pending
    assert.equal(response.status(), status, await response.text())
    return response.json()
  }
  await page.goto(base + '/login')
  await page.getByLabel('Логин', { exact: true }).fill('admin')
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await button('Войти').click()
  await page.waitForURL(url => url.pathname !== '/login')
  await page.goto(base + '/jv/orders/new')
  await button('Загрузить проверенный заказ без стекла').click()
  await page.getByText('Конструкции (7/7)').waitFor()
  await page.getByRole('status').filter({ hasText: 'версия 1' }).waitFor()
  const preview = await post('Рассчитать', '/calculate-preview-v1', 200)
  assert.equal(preview.status, 'COMPLETE')
  const snapshot = await post('Зафиксировать расчёт', '/calculation-snapshots', 201)
  assert.deepEqual(snapshot.result.calculation.totalSalePrice, preview.calculation.totalSalePrice)
  const proposal = await post('Создать черновик КП', '/proposal-drafts', 201)
  assert.equal(proposal.snapshotId, snapshot.id)
  assert.equal(proposal.payload.positions.length, 7)
  assert.deepEqual(proposal.payload.totalSalePrice, preview.calculation.totalSalePrice)
  await page.getByRole('heading', { name: `Черновик коммерческого предложения №${proposal.number}` }).waitFor()
  await page.getByText('Итого: 656778,58 ₽ (округлено)', { exact: true }).waitFor()
  await page.getByLabel('Ширина, мм', { exact: true }).fill('4001')
  const unverified = await post('Рассчитать', '/calculate-preview-v1', 200)
  assert.equal(unverified.status, 'PARTIAL')
  assert.equal(unverified.calculation.totalSalePrice, undefined)
  await page.getByRole('status').filter({ hasText: 'версия 2' }).waitFor()
  await post('Зафиксировать расчёт', '/calculation-snapshots', 422)
  assert.deepEqual(errors, [])
  console.log('PASS seven-system example, snapshot, frozen proposal total and PARTIAL after changing width')
} finally {
  await browser?.close()
  await vite.close()
}
