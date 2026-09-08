import { randomUUID } from 'node:crypto'
import { STEPS } from './domain.js'

// The repository fences writes by lease owner. Finished steps are durable checkpoints.
export function createRunner({ repository, charge, workers, runGraph, leaseMs = 180000 }) {
  return async function run(id) {
    const owner = randomUUID()
    let mission = await repository.claim(id, owner, leaseMs)
    if (!mission) return
    const controller = new AbortController()
    let renewing = false
    const heartbeat = setInterval(async () => {
      if (renewing) return
      renewing = true
      try {
        if (!await repository.renew(id, owner, leaseMs)) controller.abort()
      } catch { controller.abort() }
      finally { renewing = false }
    }, Math.min(10000, leaseMs / 3))
    heartbeat.unref?.()
    const save = async patch => {
      const updated = await repository.save(id, owner, patch)
      if (!updated) { controller.abort(); throw new Error('Mission stopped or lease lost.') }
      mission = updated
    }
    try {
      if (!mission.paid) {
        await charge(mission, controller.signal)
        await save({ paid: true })
      }
      await runGraph(async step => {
        if (mission.completed.includes(step)) return
        if (controller.signal.aborted) throw new Error('Mission stopped.')
        await save({ currentStep: step, error: '' })
        const output = await workers[step](mission, controller.signal)
        if (controller.signal.aborted) throw new Error('Mission stopped.')
        await save({ ...output, completed: [...mission.completed, step] })
      })
      if (STEPS.every(step => mission.completed.includes(step))) {
        await save({ status: 'completed', currentStep: '', error: '', leaseOwner: '', leaseUntil: null })
      }
    } catch (error) {
      // Cancellation or another worker taking the lease must never be overwritten.
      await repository.save(id, owner, { status: 'failed', error: error.userMessage ||
        'This step could not finish. Retry to keep completed work. If it repeats, try a more specific brief.',
        leaseOwner: '', leaseUntil: null }).catch(() => {})
      if (!controller.signal.aborted) console.error('Mission step failed', id, mission.currentStep, error.message)
    } finally { clearInterval(heartbeat) }
  }
}
