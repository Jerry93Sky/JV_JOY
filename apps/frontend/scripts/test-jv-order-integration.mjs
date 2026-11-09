import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { createServer } from 'vite'

const backendRequire = createRequire(resolve('../backend/package.json'))
const Fastify = backendRequire('fastify')
const { registerPlugins } = backendRequire('./dist/apps/backend/src/plugins/index.js')
const { registerRoutes } = backendRequire('./dist/apps/backend/src/routes/index.js')
process.env.JWT_SECRET = 'jv-ui-integration-test-only'
const app = Fastify({ logger: false })
await registerPlugins(app)
await registerRoutes(app)
await app.listen({ port: 0, host: '127.0.0.1' })
const port = app.server.address().port
const vite = await createServer({ configFile: 'vite.config.ts', root: '.', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
let renderer
try {
  const { default: client } = await vite.ssrLoadModule('/src/api/client.ts')
  const { useAuthStore } = await vite.ssrLoadModule('/src/store/authStore.ts')
  const { default: Page } = await vite.ssrLoadModule('/src/modules/jv-order/JVOrderPage.tsx')
  client.defaults.baseURL = `http://127.0.0.1:${port}/api`
  useAuthStore.setState({ token: app.jwt.sign({ id: 'ui-test', role: 'ADMIN' }), user: { id: 'ui-test', login: 'test', firstName: 'Test', lastName: 'User', role: 'ADMIN' } })
  const waitFor = async predicate => {
    for (let i = 0; i < 120; i++) {
      if (predicate()) return
      await act(async () => { await new Promise(resolveWait => setTimeout(resolveWait, 50)) })
    }
    throw new Error('Timed out waiting for UI state')
  }
  const button = text => renderer.root.findAllByType('button').find(b => b.props.children === text)
  const sections = () => renderer.root.findAllByType('section')
  const contents = () => JSON.stringify(renderer.toJSON())
  const sent = []
  const requestObserver = client.interceptors.request.use(request => { if (request.url === '/jv/orders/calculate-preview') sent.push(structuredClone(request.data)); return request })
  await act(async () => { renderer = TestRenderer.create(React.createElement(Page)) })
  await waitFor(() => button('Добавить конструкцию') && !button('Добавить конструкцию').props.disabled)
  await act(async () => { button('Добавить конструкцию').props.onClick() })
  await act(async () => { sections()[0].findAllByType('button').find(b => b.props.children === 'Дублировать').props.onClick() })
  assert.equal(sections().length, 2)
  await act(async () => { sections()[1].findAllByType('button').find(b => b.props.children === 'Удалить').props.onClick() })
  assert.equal(sections().length, 1)
  await act(async () => { sections()[0].findAllByType('input')[0].props.onChange({ target: { value: '2' } }) })
  for (const family of ['ZIGZAG','SLIDER_L3','SLIDER_L5','SLIDER_X3','SLIDER_X5','FRONT']) {
    await act(async () => { button('Добавить конструкцию').props.onClick() })
    const section = sections().at(-1)
    const familySelect = section.findAllByType('select')[0]
    await act(async () => { familySelect.props.onChange({ target: { value: family } }) })
  }
  assert.equal(sections().length, 7)
  assert.equal(button('Добавить конструкцию').props.disabled, true)
  await act(async () => { button('Рассчитать').props.onClick() })
  await waitFor(() => contents().includes('Расчёт завершён') || contents().includes('Частичный расчёт') || contents().includes('сервер отклонил'))
  assert.ok(contents().includes('Расчёт завершён'), contents().slice(-2000))
  assert.ok(contents().includes('Итог:'), 'COMPLETE must show a confirmed total')
  assert.equal(sent[0].positions.length, 7)
  assert.equal(new Set(sent[0].positions.map(position => position.slot)).size, 7)
  assert.equal(sent[0].positions[0].quantity, '2')
  assert.equal(sent[0].profile, 'COMPLETATION')
  assert.ok(!JSON.stringify(sent[0]).includes('priceSnapshot'))
  assert.ok(!Object.keys(sent[0].positions[0].calculation).some(key => key.startsWith('settings.')))

  const first = sections()[0]
  const widthLabel = first.findAllByType('label').find(label => label.findAllByType('span').some(span => span.children.includes('Ширина, мм')))
  const widthInput = widthLabel.findByType('input')
  await act(async () => { widthInput.props.onChange({ target: { value: '4200' } }) })
  assert.ok(!contents().includes('Итог:'), 'editing must invalidate the prior total')
  await act(async () => { button('Рассчитать').props.onClick() })
  await waitFor(() => contents().includes('Расчёт завершён') || contents().includes('Частичный расчёт') || contents().includes('сервер отклонил'))
  assert.ok(contents().includes('Расчёт завершён'), 'edited order must recalculate through the real API')

  const front = sections()[6]
  const toggle = text => front.findAllByType('label').find(label => label.findAllByType('span').some(span => span.children.includes(text)) && label.findAllByType('input').some(input => input.props.type === 'checkbox')).findByType('input')
  await act(async () => { toggle('Стекло').props.onChange({ target: { checked: false } }) })
  await act(async () => { toggle('Отделка').props.onChange({ target: { checked: false } }) })
  assert.ok(!contents().includes('Итог:'), 'editing a Front option must invalidate the prior total')
  await act(async () => { button('Рассчитать').props.onClick() })
  await waitFor(() => contents().includes('Расчёт завершён') || contents().includes('Частичный расчёт') || contents().includes('сервер отклонил'))
  assert.ok(contents().includes('Частичный расчёт'), 'unsupported Front branch must be PARTIAL')
  assert.ok(!contents().includes('Итог:'), 'PARTIAL must not display an order total')

  const profileSelect = renderer.root.findAllByType('select')[0]
  await act(async () => { profileSelect.props.onChange({ target: { value: 'RETAIL' } }) })
  await waitFor(() => button('Рассчитать') && !button('Рассчитать').props.disabled)
  assert.equal(sections().length, 7, 'profile switch must retain positions')
  assert.ok(!contents().includes('Частичный расчёт'), 'profile switch must invalidate old result')
  await act(async () => { toggle('Стекло').props.onChange({ target: { checked: true } }) })
  await act(async () => { toggle('Отделка').props.onChange({ target: { checked: true } }) })
  await act(async () => { button('Рассчитать').props.onClick() })
  await waitFor(() => contents().includes('Расчёт завершён') || contents().includes('Частичный расчёт') || contents().includes('сервер отклонил'))
  assert.ok(contents().includes('Расчёт завершён'), 'RETAIL order must recalculate through the real API')

  let releaseOld
  const oldResponseGate = new Promise(resolveGate => { releaseOld = resolveGate })
  let delayed = false
  const interceptor = client.interceptors.response.use(async response => {
    if (response.config.url === '/jv/orders/calculate-preview' && !delayed) { delayed = true; await oldResponseGate }
    return response
  })
  await act(async () => { widthInput.props.onChange({ target: { value: '4300' } }) })
  await act(async () => { button('Рассчитать').props.onClick() })
  await waitFor(() => delayed)
  await act(async () => { widthInput.props.onChange({ target: { value: '4500' } }) })
  await act(async () => { button('Рассчитать').props.onClick() })
  await waitFor(() => contents().includes('Расчёт завершён'))
  const newestResult = contents()
  await act(async () => { releaseOld(); await new Promise(resolveWait => setTimeout(resolveWait, 50)) })
  assert.equal(contents(), newestResult, 'late response must not overwrite the newer calculation')
  client.interceptors.response.eject(interceptor)
  const errors = [[400, 'сервер отклонил ввод'], [401, 'Сессия истекла'], [403, 'Недостаточно прав'], [409, 'Версия правил'], [500, 'Ошибка сервера'], [null, 'Нет соединения']]
  for (const [status, message] of errors) {
    const errorInterceptor = client.interceptors.response.use(response => {
      if (response.config.url === '/jv/orders/calculate-preview') throw Object.assign(new Error('simulated test error'), { isAxiosError: true, response: status ? { status, data: { error: { issues: [] } } } : undefined })
      return response
    })
    await act(async () => { button('Рассчитать').props.onClick() })
    await waitFor(() => contents().includes(message))
    assert.ok(!contents().includes('Итог:'), `error ${status} must not retain an old total`)
    client.interceptors.response.eject(errorInterceptor)
  }
  client.interceptors.request.eject(requestObserver)
  console.log('JV UI → authenticated Fastify HTTP → JV Engine: all seven families, both profiles, quantity, duplicate/delete, COMPLETE, PARTIAL, edit/recalculate, stale response and error handling passed')
} finally {
  if (renderer) await act(async () => renderer.unmount())
  await vite.close()
  await app.close()
}
