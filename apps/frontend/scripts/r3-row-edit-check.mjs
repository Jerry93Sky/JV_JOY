import { chromium } from 'playwright'
import { createServer } from 'vite'
import assert from 'node:assert/strict'

const vite = await createServer({ configFile: 'vite.config.ts', root: '.', server: { host: '127.0.0.1', port: 0 } })
await vite.listen()
const base = `http://127.0.0.1:${vite.httpServer.address().port}`
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const category = { id: 'cat1', name: 'Категория R3', _count: { vendors: 1 } }
const data = {
  '/vendors/categories': [category], '/vendors': [{ id: 'v1', name: 'Поставщик R3', categoryId: 'cat1', category, isPainting: false, isDefault: false, isActive: true }, { id: 'v2', name: 'Другой поставщик', categoryId: 'cat1', category, isPainting: false, isDefault: false, isActive: true }],
  '/contacts': [{ id: 'c1', firstName: 'Контакт', lastName: 'Тестовый', phone: '+70000000000', companies: [] }],
  '/companies': [{ id: 'c2', name: 'Компания R3', type: 'OOO', contacts: [] }],
  '/products/types': [{ id: 't1', name: 'Профиль' }], '/products': [{ id: 'p1', sku: 'R3-PRODUCT', name: 'Товар R3', typeId: 't1', type: { id: 't1', name: 'Профиль' }, unit: 'шт', priceRetail: 10, priceWholesale: 10, quantity: 2, reservedQty: 0, isActive: true }],
  '/users': [{ id: 'u2', login: 'r3-test-user', firstName: 'Тест', lastName: 'Пользователь', role: 'ADMIN', isActive: true }],
}
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await context.addInitScript(() => { if (!localStorage.getItem('bms-auth')) localStorage.setItem('bms-auth', JSON.stringify({ state: { token: 'isolated-fixture', user: { id: 'owner', login: 'owner', firstName: 'Test', lastName: 'Owner', role: 'OWNER' } }, version: 0 })) })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => { errors.push(error.message); console.error('PAGE ERROR', error.message) })
page.on('console', message => { if (message.type() === 'error') console.error('CONSOLE', message.text()) })
page.on('requestfailed', request => console.error('REQUEST FAILED', request.url(), request.failure()?.errorText))
let writes = 0
await page.route('**/api/**', async route => {
  const request = route.request(), key = new URL(request.url()).pathname.slice(4)
  if (!new URL(request.url()).pathname.startsWith('/api/')) return route.continue()
  if (request.method() !== 'GET') { writes++; return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Test failure' }) }) }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data[key] ?? []) })
})
try {
  const scenarios = [
    ['/clients', 'Тестовый Контакт', 'Редактировать контакт', 'input[name="lastName"]', 'Тестовый'],
    ['/warehouse', 'R3-PRODUCT', 'Редактировать товар', 'input[name="sku"]', 'R3-PRODUCT'],
    ['/settings', 'r3-test-user', 'Редактировать пользователя', 'input:disabled', 'r3-test-user'],
    ['/vendors', 'Поставщик R3', 'Редактировать поставщика', '#vendor-name', 'Поставщик R3'],
  ]
  for (const [path, needle, title, selector, value] of scenarios) {
    await page.goto(base + path)
    const row = page.getByRole('row').filter({ hasText: needle }).first()
    await row.waitFor()
    await row.locator('td').first().click()
    assert.equal(await page.getByRole('dialog').count(), 0, `${path}: single click opens edit`)
    await row.locator('td').first().dblclick()
    const dialog = page.getByRole('dialog', { name: title })
    await dialog.waitFor()
    assert.equal(await dialog.locator(selector).first().inputValue(), value)
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(writes, 0, `${path}: cancelling must not write`)
    const editButton = row.locator('button').first()
    await editButton.focus()
    await editButton.click()
    await dialog.waitFor()
    await dialog.getByRole('button', { name: 'Отмена' }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.waitForTimeout(250)
    assert.equal(await editButton.evaluate(el => el === document.activeElement), true, `${path}: focus must return to edit button`)
    console.log(`PASS double-click, selected values, single-click, pencil, Escape and Cancel: ${path}`)
  }
  await page.goto(base + '/clients')
  await page.getByRole('button', { name: 'Компании' }).click()
  const company = page.getByRole('row').filter({ hasText: 'Компания R3' })
  await company.locator('td').first().dblclick({ delay: 100 })
  const companyDialog = page.getByRole('dialog', { name: 'Редактировать компанию' })
  await companyDialog.waitFor()
  await companyDialog.getByRole('button', { name: 'Отмена' }).click()
  await companyDialog.waitFor({ state: 'hidden' })
  await page.waitForTimeout(1100)
  assert.equal(await company.isVisible(), true, 'company card must not open after editing')
  await company.locator('td').first().dblclick({ delay: 200 })
  await companyDialog.waitFor()
  await page.keyboard.press('Escape'); await companyDialog.waitFor({ state: 'hidden' })
  await page.waitForTimeout(1100)
  assert.equal(await company.isVisible(), true, 'double click must not leave pending navigation')
  console.log('PASS company double-click with 200ms input delay and cancelled navigation')
  await page.goto(base + '/vendors')
  const vendor = page.getByRole('row').filter({ hasText: 'Поставщик R3' })
  await vendor.getByRole('button', { name: 'Удалить поставщика' }).dispatchEvent('dblclick', { button: 0, bubbles: true })
  assert.equal(await page.getByRole('dialog').count(), 0, 'double-click on a nested button must not edit')
  await vendor.locator('td').first().dispatchEvent('pointerdown', { pointerType: 'touch', bubbles: true })
  await vendor.locator('td').first().dispatchEvent('dblclick', { button: 0, bubbles: true })
  assert.equal(await page.getByRole('dialog').count(), 0, 'touch must not trigger double-click edit')
  const otherVendor = page.getByRole('row').filter({ hasText: 'Другой поставщик' })
  await otherVendor.locator('td').first().dispatchEvent('dblclick', { button: 0, bubbles: true })
  const otherDialog = page.getByRole('dialog', { name: 'Редактировать поставщика' })
  await otherDialog.waitFor()
  assert.equal(await otherDialog.getByLabel('Название *').inputValue(), 'Другой поставщик')
  await page.keyboard.press('Escape'); await otherDialog.waitFor({ state: 'hidden' })
  await vendor.locator('td').first().dblclick()
  const dialog = page.getByRole('dialog', { name: 'Редактировать поставщика' })
  await dialog.getByLabel('Название *').fill('Изменено R3')
  await dialog.getByRole('button', { name: 'Сохранить' }).click()
  await dialog.getByRole('alert').waitFor()
  assert.equal(await dialog.isVisible(), true)
  assert.equal(writes, 1)
  await page.keyboard.press('Escape')
  assert.deepEqual(errors, [])
  console.log('PASS mocked server error stays visible in vendor dialog')
  await page.evaluate(() => { const auth = JSON.parse(localStorage.getItem('bms-auth')); auth.state.user.role = 'GUEST'; localStorage.setItem('bms-auth', JSON.stringify(auth)) })
  await page.reload()
  const guestVendor = page.getByRole('row').filter({ hasText: 'Поставщик R3' })
  await guestVendor.locator('td').first().dblclick()
  assert.equal(await page.getByRole('dialog').count(), 0, 'GUEST must not open vendor edit by double-click')
  console.log('PASS guest cannot open privileged vendor edit by double-click')
  await page.setViewportSize({ width: 390, height: 400 })
  await page.goto(base + '/clients')
  await page.getByRole('button', { name: 'Добавить контакт' }).click()
  const smallDialog = page.getByRole('dialog', { name: 'Новый контакт' })
  await smallDialog.waitFor()
  await page.waitForTimeout(300)
  const bounds = await smallDialog.boundingBox()
  assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 391 && bounds.y + bounds.height <= 401, 'dialog must fit a small viewport')
  await smallDialog.getByRole('button', { name: 'Отмена' }).scrollIntoViewIfNeeded()
  assert.equal(await smallDialog.getByRole('button', { name: 'Отмена' }).isVisible(), true)
  await smallDialog.getByRole('button', { name: 'Отмена' }).click()
  console.log('PASS dialog scroll and controls in a small viewport')
} finally { await context.close(); await browser.close(); await vite.close() }
