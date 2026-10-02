import { spawn } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
const artifacts = await mkdtemp(join(tmpdir(), 'erjv-table-type-'))
console.log(JSON.stringify({ artifacts }))
const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9231', `--user-data-dir=${join(artifacts, 'profile')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
let socket
try {
  let targets
  for (let i = 0; i < 60; i++) { try { targets = await (await fetch('http://127.0.0.1:9231/json/list')).json(); break } catch { await pause(200) } }
  assert.ok(targets)
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  let id = 0
  const pending = new Map()
  const errors = []
  const send = (method, params = {}) => new Promise((resolve, reject) => { const requestId = ++id; const timeout = setTimeout(() => reject(new Error(`Timeout: ${method}`)), 10000); pending.set(requestId, { resolve: value => { clearTimeout(timeout); resolve(value) }, reject }); socket.send(JSON.stringify({ id: requestId, method, params })) })
  const stamp = '2026-10-02T10:00:00+08:00'
  const orders = ['DRAFT', 'CONFIRMED'].map((status, index) => ({ id: index + 1, orderNumber: `SO-00000${index + 1}`, status, clientId: 1, deliveryAddress: 'Matina, Davao City', orderedAt: stamp, createdAt: stamp, updatedAt: stamp, completedAt: null, cancelledAt: null, items: [{ id: index + 1, inventoryItemId: 1, quantity: '5', unitPrice: '95', totalAmount: '475', allocations: [] }] }))
  const fixture = {
    '/auth/profile': { id: 1, email: 'preview@example.test', fullName: 'UI Preview', role: 'ADMIN', isActive: true },
    '/sales-orders': orders,
    '/clients': [{ id: 1, name: 'City Grocer - Matina', contactPerson: 'Maria Santos', address: 'Matina, Davao City', phone: '09171234567', email: 'customer@example.test', isActive: true }],
    '/suppliers': [{ id: 1, code: 'SUP-001', name: 'Davao Fresh Produce', contactPerson: 'Juan Cruz', address: 'Davao City', phone: '09181234567', email: 'supplier@example.test', isActive: true }],
    '/inventory-items': [{ id: 1, name: 'Lakatan Banana', variety: null, description: 'Fresh bananas', unitPrice: '95', isActive: true, createdAt: stamp, updatedAt: stamp }],
    '/outgoing-deliveries': [{ id: 1, salesOrderId: 2, deliveryNumber: 'DO-000001', status: 'SCHEDULED', scheduledAt: '2026-10-05T09:00:00+08:00', createdAt: stamp, items: [] }],
  }
  socket.onmessage = event => { const message = JSON.parse(event.data); if (message.id) { const request = pending.get(message.id); if (request) { pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result) } } else if (message.method === 'Fetch.requestPaused') { const path = new URL(message.params.request.url).pathname.replace(/^\/api/, ''); void send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(JSON.stringify(fixture[path] ?? [])).toString('base64') }) } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text) }
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Fetch.enable', { patterns: [{ resourceType: 'XHR' }, { resourceType: 'Fetch' }] })
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('erjv_access_token','ui-preview-fixture')" })
  await send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Manila' })
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: 'http://127.0.0.1:5175/' })
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value }
  const waitFor = async expression => { for (let i = 0; i < 70; i++) { if (await evaluate(expression)) return; await pause(100) } throw new Error(`Not ready: ${expression}`) }
  const click = label => evaluate(`Array.from(document.querySelectorAll('[data-sidebar] button, aside button')).find(button => button.textContent.trim() === ${JSON.stringify(label)})?.click()`)
  const metrics = () => evaluate(`(() => { const table = document.querySelector('table'); const style = element => { const value = getComputedStyle(element); return {size:value.fontSize,weight:value.fontWeight,lineHeight:value.lineHeight,padding:value.padding} }; return {headers: Array.from(table.querySelectorAll('th')).map(element => ({text:element.textContent,...style(element),sortWeight:element.querySelector('button') ? getComputedStyle(element.querySelector('button')).fontWeight : null})), cells:Array.from(table.querySelectorAll('tbody tr:first-child > td')).map(element => ({text:element.textContent,...style(element),labels:Array.from(element.querySelectorAll('span,div')).filter(child => child.childElementCount === 0).map(child=>({text:child.textContent,...style(child)}))})), badges:Array.from(table.querySelectorAll('tbody [data-slot=badge]')).map(element=>({text:element.textContent,...style(element),height:element.getBoundingClientRect().height})), buttons:Array.from(table.querySelectorAll('tbody td button')).map(element=>({text:element.textContent,...style(element)})),documentWidth:document.documentElement.scrollWidth,viewport:innerWidth} })()`)
  const capture = async name => { const screenshot = await send('Page.captureScreenshot', { format: 'png' }); const path = join(artifacts, `${name}.png`); await writeFile(path, Buffer.from(screenshot.data, 'base64')); return path }
  await waitFor("Boolean(document.querySelector('table tbody tr'))")
  const results = {}
  for (const [label, text] of [['Inventory', 'Lakatan Banana'], ['Customers', 'City Grocer - Matina'], ['Suppliers', 'Davao Fresh Produce'], ['Sales Orders', 'SO-000001']]) {
    await click(label)
    await waitFor(`Boolean(document.querySelector('table tbody')?.textContent.includes(${JSON.stringify(text)}))`)
    const values = await metrics()
    assert.ok(values.headers.every(header => header.size === '12px' && header.weight === '600' && (!header.sortWeight || header.sortWeight === '600')))
    assert.ok(values.cells.every(cell => cell.size === '12px'))
    assert.ok(values.badges.every(badge => badge.size === '12px' && badge.weight === '600' && badge.lineHeight === '16px' && badge.height === 22))
    assert.ok(values.buttons.every(button => button.size === '12px' && button.weight === '500'))
    results[label] = { ...values, screenshot: await capture(label.replaceAll(' ', '-').toLowerCase()) }
  }
  const salesLabels = results['Sales Orders'].cells.flatMap(cell => cell.labels)
  assert.ok(salesLabels.filter(label => /SO-|City Grocer|Lakatan/.test(label.text)).every(label => label.size === '12px'))
  assert.ok(salesLabels.filter(label => /Oct 2|Matina, Davao|No delivery|Oct 5/.test(label.text)).every(label => label.size === '11px'))
  const totals = await evaluate("Array.from(document.querySelectorAll('tbody tr td:nth-child(4)')).map(cell=>({size:getComputedStyle(cell).fontSize,weight:getComputedStyle(cell).fontWeight,align:getComputedStyle(cell).textAlign}))")
  assert.ok(totals.every(total => total.size === '12px' && total.weight === '600' && total.align === 'right'))
  const controlsOutside = await evaluate("Array.from(document.querySelectorAll('button')).filter(button=>button.textContent.includes('Create Sales Order')).map(button=>({text:button.textContent,size:getComputedStyle(button).fontSize,height:button.getBoundingClientRect().height}))")
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false })
  await pause(150)
  const mobile = await metrics()
  assert.ok(mobile.documentWidth <= mobile.viewport)
  const mobileCapture = await capture('sales-orders-mobile')
  const scroll = await evaluate("(() => {let parent = document.querySelector('table').parentElement;while(parent && parent.scrollWidth <= parent.clientWidth) parent=parent.parentElement;if(!parent)return false;parent.scrollLeft=parent.scrollWidth;return parent.scrollLeft>0})()")
  assert.ok(scroll)
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 })
  await pause(150)
  const zoomedCapture = await capture('sales-orders-zoomed')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ artifacts, results, totals, controlsOutside, mobile: {viewport:mobile.viewport,documentWidth:mobile.documentWidth,screenshot:mobileCapture},zoomedCapture,errors }, null, 2))
} finally { socket?.close(); browser.kill() }
