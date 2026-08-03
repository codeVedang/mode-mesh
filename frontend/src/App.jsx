import { useEffect } from "react"
import { useDispatch } from "react-redux"
import Home from "./pages/Home"
import getCurrentUser from "./features/getCurrentUser"
import { setSelectedConversation } from "./redux/conversationSlice"
import { setMessages } from "./redux/messageSlice"
import { setUserdata } from "./redux/userSlice"

function App() {
  const dispatch = useDispatch()
  const designPreview = import.meta.env.DEV
    && new URLSearchParams(window.location.search).has("design-preview")

  useEffect(() => {
    const getUser = async () => {
      if (designPreview) {
        const previewType = new URLSearchParams(window.location.search).get("design-preview")
        dispatch(setUserdata({
          _id: "design-preview",
          avatar: "",
          credits: 12450,
          name: "Alex Morgan",
          plan: "pro",
          totalCredits: 20000,
        }))

        if (previewType === "voice-result") {
          dispatch(setSelectedConversation({
            _id: "design-preview-conversation",
            title: "New Chat",
          }))
          dispatch(setMessages([
            { role: "user", content: "Generate a PDF report about multi-agent systems." },
            {
              role: "assistant",
              content: "Your PDF is ready to download.",
              deliverables: [{
                type: "pdf",
                name: "agent-systems-report.pdf",
                label: "Multi-Agent Systems Report",
                url: "#preview",
              }],
              execution: {
                status: "completed",
                selectedAgent: "pdf",
                durationMs: 8420,
                objective: "Generate a PDF report about multi-agent systems.",
                steps: [
                  { id: "plan", label: "Plan the request", agent: "Planner", status: "completed" },
                  { id: "supervise", label: "Validate route and policy", agent: "Supervisor", status: "completed" },
                  { id: "execute", label: "Generate PDF deliverable", agent: "pdf", status: "completed" },
                  { id: "verify", label: "Verify result and deliverables", agent: "Supervisor", status: "completed" },
                ],
              },
            },
          ]))
        }
        return
      }

      const data = await getCurrentUser()
      dispatch(setUserdata(data))
    }

    getUser()
  }, [designPreview, dispatch])

  return (
    <Home designPreview={designPreview} />
  )
}

export default App
