import { getModel } from "../config/llmModels.js"
import { createExecution, normalizeAgent } from "./execution.js"

const ROUTE_HINTS = [
  ["pdf", /\b(pdf|document)\b.*\b(create|generate|make|prepare|write)\b|\b(create|generate|make|prepare|write)\b.*\b(pdf|document)\b/i],
  ["ppt", /\b(ppt|pptx|presentation|slide deck|slides)\b/i],
  ["vision", /\b(generate|create|make|draw)\b.*\b(image|photo|illustration|poster|logo)\b/i],
  ["coding", /\b(code|coding|debug|program|website|api|component|function|refactor)\b/i],
  ["search", /\b(latest|today|current|recent|news|search|research|look up|find online)\b/i],
]

const inferAgent = (prompt = "") => (
  ROUTE_HINTS.find(([, pattern]) => pattern.test(prompt))?.[0] || "chat"
)

const parsePlannerResponse = (content = "") => {
  try {
    const json = String(content)
      .replace(/```json|```/gi, "")
      .match(/\{[\s\S]*\}/)?.[0]
    return json ? JSON.parse(json) : null
  } catch {
    return null
  }
}

const getFileAgent = (file) => {
  if (file?.mimetype === "application/pdf") return "pdfRag"
  if (file?.mimetype?.startsWith("image/")) return "imageAnalyzer"
  return null
}

const defaultPlan = (agent) => ({
  chat: ["Understand the request", "Use conversation context", "Compose and verify the response"],
  search: ["Clarify the research objective", "Retrieve current sources", "Synthesize evidence", "Verify the final answer"],
  coding: ["Identify the coding intent", "Generate or analyze the implementation", "Validate the output"],
  pdf: ["Design the document structure", "Generate the content", "Build and upload the PDF", "Verify the download"],
  ppt: ["Design the slide narrative", "Generate slide content", "Build and upload the presentation", "Verify the download"],
  vision: ["Refine the visual brief", "Generate the image", "Upload and verify the result"],
  pdfRag: ["Extract document content", "Retrieve relevant passages", "Answer from document evidence"],
  imageAnalyzer: ["Inspect the uploaded image", "Identify relevant visual evidence", "Return the analysis"],
})[agent]

export const planner = async (state) => {
  const startedAt = Date.now()
  const requestedAgent = String(state.agent || "auto").toLowerCase()
  const fileAgent = getFileAgent(state.file)
  let selectedAgent = fileAgent || (requestedAgent !== "auto" ? normalizeAgent(requestedAgent) : null)
  let objective = String(state.prompt || "Complete the requested task").trim().slice(0, 180)
  let plan

  if (!selectedAgent) {
    try {
      const llm = await getModel("router")
      const response = await llm.invoke(`You are the Planner for ModeMesh, a multi-agent execution platform.

Choose exactly one primary specialist: chat, search, coding, pdf, ppt, or vision.
Return only valid JSON using this schema:
{"agent":"chat","objective":"short objective","steps":["step one","step two","step three"]}

Routing rules:
- search: current, recent, live, news, or web research
- coding: programming, debugging, architecture, or application generation
- pdf: create or generate a PDF/document
- ppt: create a presentation or slide deck
- vision: create an image
- chat: explanations, planning, learning, or general conversation

User request: ${state.prompt}`)
      const planned = parsePlannerResponse(response.content)
      selectedAgent = normalizeAgent(planned?.agent || inferAgent(state.prompt))
      objective = String(planned?.objective || objective).slice(0, 180)
      plan = Array.isArray(planned?.steps)
        ? planned.steps.map((step) => String(step).slice(0, 140)).slice(0, 5)
        : undefined
    } catch (error) {
      console.warn("planner fallback", error.message)
      selectedAgent = inferAgent(state.prompt)
    }
  }

  selectedAgent = normalizeAgent(selectedAgent || "chat")
  plan = plan?.length ? plan : defaultPlan(selectedAgent)

  return {
    ...state,
    proposedAgent: selectedAgent,
    execution: createExecution({
      agent: selectedAgent,
      objective,
      plan,
      startedAt,
    }),
  }
}
