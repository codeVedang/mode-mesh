import Mission from './model.js'
import { kickMission } from './service.js'
import { checkAgentLimit } from '../config/agentLimit.js'
import { getFromS3 } from '../utils/getFromS3.js'
import { createMissionHandlers } from './handlers.js'

export const { list, create, get, edit, start, cancel, revise, download } = createMissionHandlers({
  Mission, kickMission, checkAgentLimit, getFromS3,
})
