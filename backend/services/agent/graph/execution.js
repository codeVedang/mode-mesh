const AVAILABLE_AGENTS = new Set([
  "chat",
  "search",
  "coding",
  "pdf",
  "ppt",
  "vision",
  "pdfRag",
  "imageAnalyzer",
])

const AGENT_ALIASES = {
  auto: "chat",
  code: "coding",
  image: "vision",
  presentation: "ppt",
  research: "search",
  web: "search",
}

export const normalizeAgent = (agent = "chat") => {
  const normalized = String(agent).trim()
  const candidate = AGENT_ALIASES[normalized] || AGENT_ALIASES[normalized.toLowerCase()] || normalized
  return AVAILABLE_AGENTS.has(candidate) ? candidate : "chat"
}

export const updateExecutionStep = (execution, stepId, updates) => ({
  ...execution,
  steps: (execution?.steps || []).map((step) => (
    step.id === stepId ? { ...step, ...updates } : step
  )),
})

export const getWorkerLabel = (agent) => ({
  chat: "Compose contextual response",
  search: "Research sources and synthesize findings",
  coding: "Generate or analyze code",
  pdf: "Generate PDF deliverable",
  ppt: "Generate presentation deliverable",
  vision: "Generate image deliverable",
  pdfRag: "Retrieve document context and answer",
  imageAnalyzer: "Analyze the uploaded image",
})[agent] || "Execute specialist task"

export const createExecution = ({ agent, objective, plan, startedAt }) => ({
  id: `run-${Date.now()}`,
  status: "running",
  objective,
  plan,
  selectedAgent: agent,
  startedAt,
  requiresApproval: false,
  steps: [
    {
      id: "plan",
      label: "Plan the request",
      agent: "Planner",
      status: "completed",
    },
    {
      id: "supervise",
      label: "Validate route and policy",
      agent: "Supervisor",
      status: "pending",
    },
    {
      id: "execute",
      label: getWorkerLabel(agent),
      agent,
      status: "pending",
    },
    {
      id: "verify",
      label: "Verify result and deliverables",
      agent: "Supervisor",
      status: "pending",
    },
  ],
})
