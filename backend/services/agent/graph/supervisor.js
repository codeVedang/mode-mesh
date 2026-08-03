import { getWorkerLabel, normalizeAgent, updateExecutionStep } from "./execution.js"

export const supervisor = async (state) => {
  const selectedAgent = normalizeAgent(state.proposedAgent)
  let execution = updateExecutionStep(state.execution, "supervise", {
    status: "completed",
    detail: `Approved ${selectedAgent} specialist`,
  })

  execution = updateExecutionStep(execution, "execute", {
    status: "running",
    agent: selectedAgent,
    label: getWorkerLabel(selectedAgent),
  })

  return {
    ...state,
    agent: selectedAgent,
    execution: {
      ...execution,
      selectedAgent,
    },
  }
}

const hasValidOutput = (state) => Boolean(
  state.aiResponse
  || state.images?.length
  || state.artifacts?.length
  || state.deliverables?.length
)

export const finalizeExecution = async (state) => {
  const failedResponse = /^failed\b/i.test(String(state.aiResponse || "").trim())
  const completed = hasValidOutput(state) && !failedResponse
  const finishedAt = Date.now()
  let execution = updateExecutionStep(state.execution, "execute", {
    status: completed ? "completed" : "failed",
  })

  execution = updateExecutionStep(execution, "verify", {
    status: completed ? "completed" : "failed",
    detail: completed
      ? "Response and structured outputs verified"
      : "No usable output was returned",
  })

  const deliverableType = state.deliverables?.[0]?.type
  const speechSummary = deliverableType === "pdf"
    ? "Your PDF is ready. Use the download button in the transcript."
    : deliverableType === "ppt"
      ? "Your presentation is ready. Use the download button in the transcript."
      : deliverableType === "image"
        ? "Your image is ready in the transcript."
        : state.artifacts?.length
          ? "Your generated project is ready. Open it in the text workspace."
          : state.aiResponse

  return {
    ...state,
    speechSummary,
    execution: {
      ...execution,
      status: completed ? "completed" : "failed",
      completedAt: new Date(finishedAt).toISOString(),
      durationMs: Math.max(0, finishedAt - (execution.startedAt || finishedAt)),
    },
  }
}
