import test from 'node:test'
import assert from 'node:assert/strict'
import { STEPS, normalizeSources, parseComparison, inputText, reportData, slideData } from './domain.js'
import { createRunner } from './runner.js'
import { runGraph } from './workflow.js'
import { generatePdf } from '../utils/generatePdf.js'
import { generatePpt } from '../utils/generatePpt.js'
import { chargeMission } from '../../auth/controllers/chargeMission.js'

const sources = [{ id: 'S1', title: 'First source', url: 'https://example.com/one', content: 'Evidence one' },
  { id: 'S2', title: 'Second source', url: 'https://example.com/two', content: 'Evidence two' }]
const comparison = { title: 'Team tools', summary: 'Two documented options.',
  rows: ['Tool A', 'Tool B'].map(name => ({ name, offering: 'Task management', strength: 'Board view',
    limitation: 'Pricing not established by these sources', sourceIds: ['S1', 'S2'] })),
  recommendation: 'Evaluate both tools with your team.', sourceIds: ['S1', 'S2'], caveats: 'Research uses search excerpts; verify current details.' }

function fixture(overrides = {}) {
  const doc = { _id: 'mission-1', userId: 'user-1', version: 1, kind: 'research', status: 'running', paid: false,
    completed: [], sources: [], files: {}, ...overrides }
  const copy = () => structuredClone(doc)
  const repository = {
    claim: async (_id, owner) => {
      if (doc.status !== 'running' || doc.leaseOwner) return null
      doc.leaseOwner = owner
      return copy()
    },
    renew: async (_id, owner) => doc.status === 'running' && doc.leaseOwner === owner,
    save: async (_id, owner, patch) => {
      if (doc.status !== 'running' || doc.leaseOwner !== owner) return null
      Object.assign(doc, structuredClone(patch))
      return copy()
    },
  }
  const calls = []
  const payments = new Set()
  const charge = async mission => { payments.add(`${mission._id}:v${mission.version}`) }
  const workers = Object.fromEntries(STEPS.map(step => [step, async mission => {
    calls.push(step)
    if (step === 'research') return { sources }
    assert.equal(mission.sources.length, 2, 'downstream worker receives saved research')
    if (step === 'compare') return { comparison }
    assert.equal(mission.comparison.title, comparison.title, 'files consume the comparison')
    return { files: { ...mission.files, [step]: { name: step } } }
  }]))
  return { doc, repository, calls, payments, charge, workers,
    run: () => createRunner({ repository, charge, workers, runGraph })(doc._id) }
}

test('graph feeds research into comparison and both deliverables', async () => {
  const f = fixture()
  await f.run()
  assert.deepEqual(f.calls, STEPS)
  assert.equal(f.doc.status, 'completed')
  assert.deepEqual(f.doc.completed, STEPS)
  assert.equal(f.payments.size, 1)
  assert.ok(f.doc.files.pdf && f.doc.files.slides)
})

test('concurrent starts claim one execution', async () => {
  const f = fixture()
  await Promise.all([f.run(), f.run(), f.run()])
  assert.deepEqual(f.calls, STEPS)
  assert.equal(f.payments.size, 1)
})

test('failed file generation resumes only unfinished steps', async () => {
  const f = fixture()
  const original = f.workers.pdf
  f.workers.pdf = async () => { throw new Error('simulated upload outage') }
  await f.run()
  assert.equal(f.doc.status, 'failed')
  assert.deepEqual(f.doc.completed, ['research', 'compare'])
  f.workers.pdf = original
  f.doc.status = 'running'
  await f.run()
  assert.deepEqual(f.calls, STEPS)
  assert.equal(f.payments.size, 1)
  assert.equal(f.doc.status, 'completed')
})

test('cancellation fences a late result and prevents downstream work', async () => {
  const f = fixture()
  const original = f.workers.research
  f.workers.research = async mission => {
    f.doc.status = 'cancelled'
    f.doc.leaseOwner = ''
    return original(mission)
  }
  await f.run()
  assert.equal(f.doc.status, 'cancelled')
  assert.deepEqual(f.doc.completed, [])
  assert.deepEqual(f.calls, ['research'])
})

test('a restarted worker uses saved sources and comparison', async () => {
  const f = fixture({ completed: ['research', 'compare'], sources, comparison, paid: true })
  await f.run()
  assert.deepEqual(f.calls, ['pdf', 'slides'])
  assert.equal(f.payments.size, 0)
})

test('revision skips research and regenerates comparison and files', async () => {
  const f = fixture({ kind: 'revision', completed: ['research'], sources, revision: 'For students' })
  await f.run()
  assert.deepEqual(f.calls, ['compare', 'pdf', 'slides'])
  assert.equal(f.doc.status, 'completed')
})

test('failed credit confirmation never runs model or file workers', async () => {
  const f = fixture()
  await createRunner({ repository: f.repository, workers: f.workers, runGraph,
    charge: async () => { throw new Error('Not enough credits') } })(f.doc._id)
  assert.deepEqual(f.calls, [])
  assert.equal(f.doc.paid, false)
  assert.equal(f.doc.status, 'failed')
})

test('sources reject unsafe URLs and deduplicate evidence', () => {
  const result = normalizeSources({ results: [
    { url: 'javascript:alert(1)', content: 'bad' }, { url: 'https://example.com/', content: 'valid' },
    { url: 'https://example.com/', content: 'duplicate' }, { url: 'file:///etc/passwd', content: 'bad' },
  ] })
  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'S1')
})

test('comparison validation rejects invented citations and empty rows', () => {
  assert.deepEqual(parseComparison(JSON.stringify(comparison), sources), comparison)
  assert.throws(() => parseComparison(JSON.stringify({ ...comparison, sourceIds: ['S999'] }), sources))
  assert.throws(() => parseComparison(JSON.stringify({ ...comparison, rows: [] }), sources))
  assert.throws(() => inputText(' '.repeat(10), 'Objective'))
  assert.throws(() => inputText('x'.repeat(1201), 'Objective'))
})

test('real renderers produce a PDF and exactly five slides with evidence', async () => {
  const mission = { comparison, sources, audience: 'Student teams' }
  const report = reportData(mission)
  assert.ok(report.sections.at(-1).points[0].includes(sources[0].url))
  const pdf = await generatePdf(report)
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
  const ppt = await generatePpt(slideData(mission), { includeClosing: false })
  assert.equal(ppt._slides.length, 5)
  const buffer = await ppt.write({ outputType: 'nodebuffer' })
  assert.equal(buffer.subarray(0, 2).toString(), 'PK')
  const legacy = await generatePpt({ title: 'Original', subtitle: 'Kept', slides: [] })
  assert.equal(legacy._slides.length, 2, 'existing decks still have their closing slide')
})

function creditStore(credits) {
  const user = { _id: 'u1', credits, missionCharges: [] }
  return { user, model: {
    findOneAndUpdate: async (query, update) => {
      if (query._id !== user._id || user.credits < query.credits.$gte || user.missionCharges.includes(query.missionCharges.$ne)) return null
      user.credits += update.$inc.credits
      user.missionCharges.push(update.$addToSet.missionCharges)
      return structuredClone(user)
    },
    findOne: async query => query._id === user._id && user.missionCharges.includes(query.missionCharges) ? structuredClone(user) : null,
  } }
}
test('duplicate and concurrent charge requests debit once', async () => {
  const { user, model } = creditStore(100)
  const results = await Promise.all(Array.from({ length: 5 }, () => chargeMission(model, 'u1', 'job:v1', 'research')))
  assert.equal(user.credits, 74)
  assert.equal(results.filter(result => !result.alreadyCharged).length, 1)
  assert.equal((await chargeMission(model, 'u1', 'job:v1', 'research')).alreadyCharged, true)
})
test('insufficient credits and another user cannot debit an account', async () => {
  const { user, model } = creditStore(25)
  assert.equal(await chargeMission(model, 'u1', 'job:v1', 'research'), null)
  assert.equal(await chargeMission(model, 'other', 'job:v1', 'revision'), null)
  assert.equal(user.credits, 25)
  assert.equal((await chargeMission(model, 'u1', 'job:v1', 'revision')).cost, 21)
  assert.equal(user.credits, 4)
})
