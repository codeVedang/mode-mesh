// Run against Vite with Playwright installed, or set PLAYWRIGHT_MODULE to its module path.
// All backend/model/storage calls are mocked; this test never spends live credits.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const path = require('node:path')
const os = require('node:os')

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true })
  const page = await context.newPage()
  const failures = []
  page.on('pageerror', error => failures.push(error.message))
  const docs = []
  let tick = 0
  let downloadRequests = 0
  let nextId = 1
  const plan = ['research', 'compare', 'pdf', 'slides']
  const labels = ['Research sources', 'Build comparison', 'Create PDF report', 'Create five-slide deck']
  const sources = [
    { id: 'S1', title: 'Notion for teams', url: 'https://example.com/notion' },
    { id: 'S2', title: 'Trello project boards', url: 'https://example.com/trello' },
    { id: 'S3', title: 'Asana project planning', url: 'https://example.com/asana' },
  ]
  const comparison = { title: 'A clearer starting point for your student team', summary: 'Three approaches to planning group projects, compared against a student team brief.',
    rows: ['Notion', 'Trello', 'Asana'].map((name, index) => ({ name, offering: 'Shared project planning', strength: 'A visible place to track team work',
      limitation: 'Current pricing needs confirmation', sourceIds: [`S${index + 1}`] })),
    recommendation: 'Trial a shared board with your team before choosing a subscription.', sourceIds: ['S1', 'S2', 'S3'], caveats: 'Test fixture. Verify provider details before deciding.' }
  const make = body => ({ id: String(nextId++).padStart(24, '0'), objective: body.objective, audience: body.audience,
    revision: '', status: 'draft', cost: 26, paid: false, sources: [], files: [], createdAt: new Date().toISOString(),
    steps: plan.map((id, index) => ({ id, label: labels[index], status: 'pending' })) })

  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.pathname === '/test-report.pdf') return route.fulfill({ contentType: 'application/pdf', headers: { 'content-disposition': 'attachment; filename="report.pdf"' }, body: '%PDF-1.4\n%%EOF' })
    if (url.pathname.includes('/api/agent/missions')) {
      const parts = url.pathname.split('/').filter(Boolean)
      const id = parts[3]
      const action = parts[4]
      const body = request.postData() ? JSON.parse(request.postData()) : {}
      if (!id) {
        if (request.method() === 'GET') return json(docs)
        const doc = make(body); docs.unshift(doc); return json(doc, 201)
      }
      const doc = docs.find(item => item.id === id)
      if (!doc) return json({ message: 'Mission not found.' }, 404)
      if (action === 'start') { doc.status = 'running'; doc.paid = true; tick = 0; return json(doc, 202) }
      if (action === 'cancel') { doc.status = 'cancelled'; return json(doc) }
      if (action === 'revise') {
        const revised = { ...make(doc), revision: body.revision, cost: 21, sources }
        revised.steps[0].status = 'completed'; docs.unshift(revised); return json(revised, 201)
      }
      if (action === 'files') { downloadRequests++; return json({ url: 'http://127.0.0.1:5173/test-report.pdf' }) }
      if (request.method() === 'PATCH') { Object.assign(doc, body); return json(doc) }
      if (doc.status === 'running') {
        tick++
        doc.steps = plan.map((id, index) => ({ id, label: labels[index], status: index < tick - 1 ? 'completed' : index === tick - 1 ? 'running' : 'pending' }))
        if (tick >= 2) doc.sources = sources
        if (tick >= 3) doc.comparison = comparison
        if (tick >= 5) {
          doc.status = 'completed'; doc.steps.forEach(step => { step.status = 'completed' })
          doc.files = [{ type: 'pdf', name: 'report.pdf' }, { type: 'ppt', name: 'presentation.pptx' }]
        }
      }
      return json(doc)
    }
    if (url.pathname.startsWith('/api/')) return json([])
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue()
    // Block external health checks and analytics while keeping the test offline.
    return json({})
  })

  try {
    await page.goto('http://127.0.0.1:5173/?design-preview=1', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Try a Mission/ }).click()
    await page.getByRole('heading', { name: 'Give your idea a team.' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Review mission' }).isDisabled(), true)
    await page.getByRole('button', { name: 'Try an example', exact: true }).click()
    await page.getByRole('button', { name: 'Review mission' }).click()
    await page.getByRole('button', { name: 'Approve & start' }).waitFor()
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Approve & start' }).waitFor()
    assert.ok((await page.getByLabel('Who is this for?').inputValue()).includes('College students'))
    assert.equal(await page.getByRole('button', { name: 'Approve & start' }).isDisabled(), false)
    await page.getByLabel('Who is this for?').fill('Student founders')
    assert.equal(await page.getByRole('button', { name: 'Approve & start' }).isDisabled(), true)
    await page.getByRole('button', { name: 'Save brief', exact: true }).click()
    await page.getByRole('button', { name: 'Approve & start' }).click()
    await page.getByRole('button', { name: 'Cancel mission' }).waitFor()
    await page.getByRole('button', { name: 'Cancel mission' }).click()
    await page.getByRole('button', { name: 'Resume unfinished steps' }).click()
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Download PDF report/ }).waitFor({ timeout: 25000 })
    assert.equal(await page.getByRole('link', { name: '[S1]', exact: true }).count() > 0, true)
    await page.screenshot({ path: path.join(os.tmpdir(), 'modemesh-mission-desktop.png'), fullPage: true })
    const downloading = page.waitForEvent('download')
    await page.getByRole('button', { name: /Download PDF report/ }).click()
    await downloading
    assert.equal(downloadRequests, 1)
    await page.getByLabel('Make it yours').fill('Focus on a student budget')
    await page.getByRole('button', { name: /Review revision/ }).click()
    await page.getByRole('button', { name: 'Approve & start' }).waitFor()
    assert.equal(docs[0].sources.length, 3)
    assert.equal(docs[1].files.length, 2)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: path.join(os.tmpdir(), 'modemesh-mission-mobile.png'), fullPage: true })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    assert.deepEqual(failures, [])
    console.log('PASS: entry, approval, editing, refresh recovery, cancel/resume, results, citations, download, revision, mobile layout; no browser exceptions.')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
