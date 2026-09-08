import mongoose from 'mongoose'
import User from '../models/user.model.js'
import redis from '../../../shared/redis/redis.js'
import { chargeMission } from './chargeMission.js'

const reply = async (res, user, cost, alreadyCharged = false) => {
  try {
    const sessionId = await redis.get(`user-session-${user._id}`)
    if (sessionId) await redis.set(`session-${sessionId}`, JSON.stringify({
      userId: user._id, name: user.name, email: user.email, avatar: user.avatar,
      plan: user.plan, credits: user.credits, totalCredits: user.totalCredits, planExpiresAt: user.planExpiresAt,
    }), 'EX', 7 * 24 * 60 * 60)
  } catch (error) { console.warn('Mission session balance refresh failed', error.message) }
  return res.json({ success: true, credits: user.credits, cost, alreadyCharged })
}

export const missionCredits = async (req, res) => {
  const userId = req.get('x-user-id')
  const { operationId, kind } = req.body
  if (!mongoose.isValidObjectId(userId) || typeof operationId !== 'string'
    || !/^[a-f0-9]{24}:v[1-9][0-9]{0,3}$/.test(operationId) || !['research', 'revision'].includes(kind)) {
    return res.status(400).json({ message: 'Invalid mission charge.' })
  }
  try {
    // Receipt and decrement are one atomic write, including when the response is lost.
    const result = await chargeMission(User, userId, operationId, kind)
    if (result) return reply(res, result.user, result.cost, result.alreadyCharged)
    return res.status(402).json({ message: 'Not enough credits.' })
  } catch (error) {
    console.error('Mission credits failed', error.message)
    return res.status(503).json({ message: 'Could not confirm credits. Retry with the same operation ID.' })
  }
}
