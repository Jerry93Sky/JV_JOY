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
  const context = await browser.newContext()
  const page = await context.newPage()
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
  assert.equal(await button('Передать на согласование').isDisabled(), true)
  const terms = [
    ['Получатель', 'Тестовая компания'],
    ['Реквизиты', 'Тестовые реквизиты\nВторая строка'],
    ['Условия оплаты', 'Оплата по договору'],
    ['Сроки', 'По графику проекта'],
    ['Условия доставки', 'Самовывоз'],
  ]
  for (const [label, value] of terms) await page.getByLabel(label, { exact: true }).fill(value)
  const revised = await post('Сохранить условия новой версией', '/revise', 201)
  await page.getByRole('heading', { name: `Черновик коммерческого предложения №${revised.number}` }).waitFor()
  await page.getByLabel('Получатель', { exact: true }).fill('Изменение только в форме')
  assert.equal(await button('Передать на согласование').isDisabled(), true)
  const newPage = page.context().waitForEvent('page')
  await page.getByRole('link', { name: 'Печатная форма сохранённой версии' }).click()
  const printable = await newPage
  printable.on('pageerror', error => errors.push(error.message))
  const document = printable.getByRole('article')
  await document.getByRole('heading', { name: `Коммерческое предложение №${revised.number}` }).waitFor()
  for (const [, value] of terms) await document.getByText(value.replace('\n', ' '), { exact: true }).waitFor()
  assert.equal(await document.getByText('Изменение только в форме').count(), 0)
  assert.equal(await document.getByRole('row').count(), 8)
  await document.getByText(/Итого по заказу 656778,58 ₽/).waitFor()
  await document.getByText('Черновик · не утверждён').waitFor()

  const printButton = printable.getByRole('button', { name: 'Печать / сохранить PDF' })
  await printable.evaluate(() => { window.print = () => { document.body.dataset.printCalled = 'yes' } })
  await printButton.click()
  assert.equal(await printable.locator('body').getAttribute('data-print-called'), 'yes')
  await printable.setViewportSize({ width: 390, height: 844 })
  const overflow = await printable.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('*')].filter(node=>node.getBoundingClientRect().right>innerWidth+1).slice(0,10).map(node=>[node.tagName,node.className,Math.round(node.getBoundingClientRect().right)]),
  }))
  assert.ok(overflow.scrollWidth <= overflow.width, JSON.stringify(overflow))
  await printable.emulateMedia({ media: 'print' })
  assert.equal(await printButton.isVisible(), false)
  const pdf = await printable.pdf({ path: process.env.JV_TEST_PRINT_PDF, preferCSSPageSize: true })
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
  const printUrl = printable.url()
  const anonymous = await browser.newPage()
  await anonymous.goto(printUrl)
  await anonymous.waitForURL(url => url.pathname === '/login')
  await anonymous.close()

  await printable.goto(`${base}/jv/orders/missing/proposal-drafts/${revised.id}/print`)
  await printable.getByRole('alert').getByText('Черновик КП не найден.').waitFor()
  assert.equal(await printButton.count(), 0)
  await printable.close()
  await page.getByLabel('Получатель', { exact: true }).fill(terms[0][1])

  const submitted = await post('Передать на согласование', '/review', 201)
  assert.equal(submitted.status, 'IN_REVIEW')
  await page.getByText('Статус КП: На согласовании', { exact: true }).waitFor()
  assert.equal(await button('Вернуть на доработку').isDisabled(), true)
  await page.getByLabel('Комментарий для возврата').fill('Уточните условия доставки')
  const returned = await post('Вернуть на доработку', '/review', 201)
  assert.equal(returned.status, 'CHANGES_REQUESTED')
  await page.getByRole('list', { name: 'История согласования' }).getByText('Уточните условия доставки', { exact: true }).waitFor()
  await page.getByLabel('Условия доставки', { exact: true }).fill('Доставка по договору')
  const corrected = await post('Сохранить условия новой версией', '/revise', 201)
  assert.deepEqual(corrected.payload.totalSalePrice, revised.payload.totalSalePrice)
  await page.getByText('Статус КП: Черновик', { exact: true }).waitFor()
  await post('Передать на согласование', '/review', 201)
  const approved = await post('Согласовать КП', '/review', 201)
  assert.equal(approved.status, 'APPROVED')
  await page.getByText('Статус КП: Согласовано', { exact: true }).waitFor()
  assert.equal(await page.getByRole('list', { name: 'История согласования' }).getByRole('listitem').count(), 2)
  const reopenedPrint = await context.newPage()
  await reopenedPrint.goto(printUrl.replace(revised.id, corrected.id))
  await reopenedPrint.getByText('Черновик · согласован внутри', { exact: true }).waitFor()
  await reopenedPrint.getByText('Доставка по договору', { exact: true }).waitFor()
  await reopenedPrint.getByText(/Итого по заказу 656778,58 ₽/).waitFor()
  assert.equal(await reopenedPrint.getByText('Уточните условия доставки', { exact: true }).count(), 0)
  await reopenedPrint.close()

  await page.getByLabel('Ширина, мм', { exact: true }).fill('4001')
  const unverified = await post('Рассчитать', '/calculate-preview-v1', 200)
  assert.equal(unverified.status, 'PARTIAL')
  assert.equal(unverified.calculation.totalSalePrice, undefined)
  await page.getByRole('status').filter({ hasText: 'версия 2' }).waitFor()
  await post('Зафиксировать расчёт', '/calculation-snapshots', 422)
  assert.deepEqual(errors, [])
  console.log('PASS proposal review, return, revision and approval, stored terms, print preview and PDF, authentication and PARTIAL')
} finally {
  await browser?.close()
  await vite.close()
}
