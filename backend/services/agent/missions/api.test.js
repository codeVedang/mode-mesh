import test from 'node:test'
import assert from 'node:assert/strict'
import { createMissionHandlers } from './handlers.js'

const uid = '111111111111111111111111'
const id = '222222222222222222222222'
function fixture() {
  const docs = [{ _id: id, userId: uid, requestId: 'first', objective: 'Compare team tools', audience: 'Students',
    kind: 'research', version: 1, status: 'draft', completed: [], sources: [], files: {}, paid: false }]
  const kicks = []
  const signed = []
  const matches = (doc, query) => Object.entries(query).every(([key, value]) => doc[key] === value)
  const query = value => ({ lean: async () => structuredClone(value) })
  const Mission = {
    findOne: where => query(docs.find(doc => matches(doc, where)) || null),
    findOneAndUpdate: (where, update) => {
      const doc = docs.find(doc => matches(doc, where))
      if (doc) Object.assign(doc, update.$set)
      return query(doc || null)
    },
    create: async data => {
      const doc = { status: 'draft', completed: [], sources: [], files: {}, kind: 'research', paid: false,
        ...data, _id: '333333333333333333333333' }
      docs.push(doc)
      return { toObject: () => structuredClone(doc) }
    },
  }
  const handlers = createMissionHandlers({ Mission, kickMission: job => kicks.push(job),
    checkAgentLimit: async () => {}, getFromS3: async key => { signed.push(key); return 'https://example.com/signed' } })
  async function call(name, { user = uid, params = {}, body = {} } = {}) {
    const response = { code: 200, status(code) { this.code = code; return this }, json(data) { this.body = data; return this } }
    await handlers[name]({ get: () => user, params: { id, ...params }, body }, response)
    return response
  }
  return { doc: docs[0], docs, call, kicks, signed }
}

test('every per-mission operation enforces owner identity', async () => {
  const f = fixture()
  for (const name of ['get', 'edit', 'start', 'cancel', 'revise', 'download']) {
    const response = await f.call(name, { user: '444444444444444444444444' })
    assert.equal(response.code, 404, name)
  }
  assert.equal(f.kicks.length, 0)
  assert.equal(f.signed.length, 0)
  assert.equal(f.doc.status, 'draft')
})
test('missing identity and malformed mission IDs are rejected', async () => {
  const f = fixture()
  assert.equal((await f.call('get', { user: '' })).code, 401)
  assert.equal((await f.call('get', { params: { id: 'invalid' } })).code, 404)
})
test('draft validation, approval and repeated starts are safe', async () => {
  const f = fixture()
  assert.equal((await f.call('create', { body: { requestId: 'new', objective: '', audience: 'Team' } })).code, 400)
  const first = await f.call('create', { body: { requestId: 'new', objective: 'Compare tools', audience: 'Team' } })
  const repeated = await f.call('create', { body: { requestId: 'new', objective: 'Compare tools', audience: 'Team' } })
  assert.equal(first.body.id, repeated.body.id)
  assert.equal(f.docs.length, 2)
  assert.equal((await f.call('start')).code, 202)
  assert.equal((await f.call('start')).code, 200)
  assert.equal(f.kicks.length, 1)
  assert.equal((await f.call('edit', { body: { objective: 'Changed', audience: 'Team' } })).code, 409)
})
test('cancellation invalidates the running lease; retry preserves checkpoints', async () => {
  const f = fixture()
  Object.assign(f.doc, { status: 'running', paid: true, leaseOwner: 'worker', completed: ['research'] })
  assert.equal((await f.call('cancel')).body.status, 'cancelled')
  assert.equal(f.doc.leaseOwner, '')
  assert.equal((await f.call('start')).body.paid, true)
  assert.deepEqual(f.doc.completed, ['research'])
})
test('downloads sign only owned stored keys and do not expose internal fields', async () => {
  const f = fixture()
  f.doc.files = { pdf: { key: 'private/file.pdf', type: 'pdf', name: 'report.pdf' } }
  const visible = (await f.call('get')).body
  assert.equal(visible.userId, undefined)
  assert.equal(visible.leaseOwner, undefined)
  assert.equal(visible.files[0].key, undefined)
  assert.equal((await f.call('download', { params: { type: '../other' } })).code, 404)
  assert.equal((await f.call('download', { params: { type: 'ppt' } })).code, 404)
  assert.equal((await f.call('download', { params: { type: 'pdf' } })).code, 200)
  assert.deepEqual(f.signed, ['private/file.pdf'])
})
test('revision creates a new draft with saved research and preserves original files', async () => {
  const f = fixture()
  Object.assign(f.doc, { status: 'completed', files: { pdf: { name: 'original.pdf', type: 'pdf' } },
    sources: [{ id: 'S1', title: 'Source', url: 'https://example.com', content: 'Evidence' }] })
  const response = await f.call('revise', { body: { requestId: 'revision', revision: 'Focus on students' } })
  assert.equal(response.code, 201)
  assert.equal(response.body.cost, 21)
  assert.equal(response.body.steps[0].status, 'completed')
  assert.equal(response.body.files.length, 0)
  assert.equal(f.doc.files.pdf.name, 'original.pdf')
  assert.equal(f.docs[1].sources[0].content, 'Evidence')
})
