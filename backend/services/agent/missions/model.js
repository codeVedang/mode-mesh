import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  requestId: { type: String, required: true },
  objective: String, audience: String, revision: { type: String, default: '' },
  version: { type: Number, default: 1 },
  kind: { type: String, default: 'research' },
  status: { type: String, default: 'draft' },
  paid: { type: Boolean, default: false },
  completed: { type: [String], default: [] },
  sources: { type: [mongoose.Schema.Types.Mixed], default: [] },
  comparison: mongoose.Schema.Types.Mixed,
  files: { type: mongoose.Schema.Types.Mixed, default: {} },
  currentStep: String, error: String,
  leaseOwner: String, leaseUntil: Date,
}, { timestamps: true })
schema.index({ userId: 1, requestId: 1 }, { unique: true })
schema.index({ userId: 1, createdAt: -1 })
export default mongoose.model('Mission', schema)
