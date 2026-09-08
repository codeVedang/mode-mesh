import mongoose from 'mongoose'
import { COST, STEPS, LABELS, inputText } from './domain.js'

export function createMissionHandlers({ Mission, kickMission, checkAgentLimit, getFromS3 }) {

const fail = (status, message) => { throw Object.assign(new Error(message), { status }) }
const userId = req => {
  const id = req.get('x-user-id')
  if (!id || !mongoose.isValidObjectId(id)) fail(401, 'Sign in to use Missions.')
  return id
}
const owned = async req => {
  if (!mongoose.isValidObjectId(req.params.id)) fail(404, 'Mission not found.')
  const mission = await Mission.findOne({ _id: req.params.id, userId: userId(req) }).lean()
  if (!mission) fail(404, 'Mission not found.')
  return mission
}
const publicMission = mission => ({
  id: String(mission._id), objective: mission.objective, audience: mission.audience,
  revision: mission.revision, status: mission.status, cost: COST[mission.kind], paid: mission.paid,
  createdAt: mission.createdAt, updatedAt: mission.updatedAt, error: mission.error,
  steps: STEPS.map(id => ({ id, label: LABELS[id], status: mission.completed.includes(id) ? 'completed'
    : mission.currentStep === id && mission.status === 'running' ? 'running'
      : mission.currentStep === id && mission.status === 'failed' ? 'failed' : 'pending' })),
  sources: mission.sources.map(({ id, title, url }) => ({ id, title, url })),
  comparison: mission.comparison,
  files: Object.values(mission.files || {}).map(({ type, name }) => ({ type, name })),
})
const handle = handler => async (req, res) => {
  try { req.body ||= {}; await handler(req, res) }
  catch (error) {
    if (!error.status) console.error('Mission API failed', error.message)
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Mission service unavailable. Please retry.' })
  }
}

async function createDraft(req, parent) {
  const uid = userId(req)
  const requestId = inputText(req.body.requestId, 'Request ID', 100)
  if (!/^[a-zA-Z0-9-]+$/.test(requestId)) fail(400, 'Invalid request ID.')
  const existing = await Mission.findOne({ userId: uid, requestId }).lean()
  if (existing) return existing
  await checkAgentLimit(uid, 'mission')
  const data = parent ? {
    objective: parent.objective, audience: parent.audience,
    revision: inputText(req.body.revision, 'Revision', 800), kind: 'revision',
    sources: parent.sources, completed: ['research'],
  } : { objective: inputText(req.body.objective, 'Objective'), audience: inputText(req.body.audience, 'Audience', 200) }
  try { return (await Mission.create({ ...data, userId: uid, requestId })).toObject() }
  catch (error) {
    if (error.code === 11000) return Mission.findOne({ userId: uid, requestId }).lean()
    throw error
  }
}

const list = handle(async (req, res) => {
  const missions = await Mission.find({ userId: userId(req) }).sort({ createdAt: -1 }).limit(30).lean()
  res.json(missions.map(publicMission))
})
const create = handle(async (req, res) => res.status(201).json(publicMission(await createDraft(req))))
const get = handle(async (req, res) => res.json(publicMission(await owned(req))))
const edit = handle(async (req, res) => {
  const mission = await owned(req)
  const patch = mission.kind === 'revision'
    ? { revision: inputText(req.body.revision, 'Revision', 800) }
    : { objective: inputText(req.body.objective, 'Objective'), audience: inputText(req.body.audience, 'Audience', 200) }
  const updated = await Mission.findOneAndUpdate({ _id: mission._id, status: 'draft' }, { $set: patch }, { new: true }).lean()
  if (!updated) fail(409, 'Only a draft can be edited. Create a revision for finished work.')
  res.json(publicMission(updated))
})
const start = handle(async (req, res) => {
  const mission = await owned(req)
  if (mission.status === 'running' || mission.status === 'completed') return res.json(publicMission(mission))
  if (!['draft', 'failed', 'cancelled'].includes(mission.status)) fail(409, 'This mission cannot be started.')
  await checkAgentLimit(userId(req), 'missionRun')
  const updated = await Mission.findOneAndUpdate({ _id: mission._id, status: mission.status },
    { $set: { status: 'running', error: '', leaseOwner: '', leaseUntil: null } }, { new: true }).lean()
  if (!updated) fail(409, 'Mission changed. Refresh and try again.')
  kickMission(updated._id)
  res.status(202).json(publicMission(updated))
})
const cancel = handle(async (req, res) => {
  const mission = await owned(req)
  const updated = await Mission.findOneAndUpdate({ _id: mission._id, status: 'running' },
    { $set: { status: 'cancelled', leaseOwner: '', leaseUntil: null } }, { new: true }).lean()
  res.json(publicMission(updated || mission))
})
const revise = handle(async (req, res) => {
  const parent = await owned(req)
  if (parent.status !== 'completed') fail(409, 'Finish the mission before creating a revision.')
  res.status(201).json(publicMission(await createDraft(req, parent)))
})
const download = handle(async (req, res) => {
  const mission = await owned(req)
  if (!['pdf', 'ppt'].includes(req.params.type)) fail(404, 'File not found.')
  const file = mission.files?.[req.params.type]
  if (!file) fail(404, 'File is not ready yet.')
  // Fresh signed URLs keep saved missions downloadable after the initial link expires.
  res.json({ url: await getFromS3(file.key, 600, file.name) })
})
return { list, create, get, edit, start, cancel, revise, download }
}
