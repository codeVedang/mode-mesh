import { useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import getMessages from "../features/getMessages"
import { setArtifacts, setMessages } from "../redux/messageSlice"
import ChatInput from "./ChatInput"
import MessageList from "./MessageList"
import Nav from "./Nav"

function ChatArea({ initialAgent, initialFile, initialPrompt, onBack }) {
  const { selectedConversation } = useSelector((state) => state.conversation)
  const dispatch = useDispatch()
  const selectedConversationId = selectedConversation?._id
  const selectedConversationTitle = selectedConversation?.title

  useEffect(() => {
    const getMesg = async () => {
      if (!selectedConversationId || selectedConversationTitle === "New Chat") return
      const data = await getMessages(selectedConversationId)
      dispatch(setMessages(data || []))
      const latestArtifactMessage = [...(data || [])]
        .reverse()
        .find((message) => message.artifacts?.length > 0)
      dispatch(setArtifacts(latestArtifactMessage?.artifacts || []))
    }

    getMesg()
  }, [dispatch, selectedConversationId, selectedConversationTitle])

  return (
    <section className="chat-area">
      <Nav onBack={onBack} />
      <MessageList />
      <ChatInput
        autoSend={Boolean(initialPrompt?.trim() || initialFile)}
        initialAgent={initialAgent}
        initialFile={initialFile}
        initialPrompt={initialPrompt}
      />
    </section>
  )
}

export default ChatArea
