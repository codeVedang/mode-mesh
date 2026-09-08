import { MISSION_COST } from '../../../shared/missionCosts.js'

export async function chargeMission(User, userId, operationId, kind) {
  const cost = MISSION_COST[kind]
  if (!cost) throw new Error('Unknown mission kind.')
  const receipt = `${operationId}:${kind}`
  const charged = await User.findOneAndUpdate({ _id: userId, credits: { $gte: cost },
    missionCharges: { $ne: receipt } },
    { $inc: { credits: -cost }, $addToSet: { missionCharges: receipt } }, { new: true })
  if (charged) return { user: charged, cost, alreadyCharged: false }
  const previous = await User.findOne({ _id: userId, missionCharges: receipt })
  return previous ? { user: previous, cost, alreadyCharged: true } : null
}
