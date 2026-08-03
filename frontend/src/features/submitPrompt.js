import { addConversation, setConvTitle, setSelectedConversation, touchConversation } from "../redux/conversationSlice"
import { addMessage, setArtifacts, setIsLoading, setMessages } from "../redux/messageSlice"
import { createConversation } from "./createConversation"
import sendMessage from "./sendMessage"
import { updateConversation } from "./updateConversation"

export async function submitPrompt({
  prompt,
  agent = "Auto",
  file = null,
  conversation,
  dispatch,
}) {
  const cleanPrompt = prompt?.trim() || ""

  if (!cleanPrompt && !file) {
    return null
  }

  dispatch(setIsLoading(true))

  try {
    let activeConversation = conversation

    if (!activeConversation) {
      dispatch(setMessages([]))
      activeConversation = await createConversation()

      if (!activeConversation) {
        throw new Error("Unable to create a conversation")
      }

      dispatch(setSelectedConversation(activeConversation))
      dispatch(addConversation(activeConversation))
    }

    const displayPrompt = cleanPrompt || `Review ${file?.name || "this file"}`

    if (activeConversation.title === "New Chat") {
      const title = displayPrompt.slice(0, 40)
      await updateConversation({ id: activeConversation?._id, title })
      dispatch(setConvTitle({ conversationId: activeConversation?._id, title }))
    }

    const formData = new FormData()
    formData.append("prompt", displayPrompt)
    formData.append("conversationId", activeConversation?._id)
    formData.append("agent", agent.toLowerCase())

    if (file) {
      formData.append("file", file)
    }

    dispatch(addMessage({ role: "user", content: displayPrompt }))
    dispatch(touchConversation({
      conversationId: activeConversation?._id,
      updatedAt: new Date().toISOString(),
    }))

    const data = await sendMessage(formData)

    if (!data) {
      throw new Error("ModeMesh AI did not return a response")
    }

    dispatch(setArtifacts(data.artifacts || []))
    dispatch(addMessage({
      role: "assistant",
      content: data?.answer || "I completed the request.",
      images: data?.images || [],
    }))

    return { data, conversation: activeConversation }
  } finally {
    dispatch(setIsLoading(false))
  }
}
