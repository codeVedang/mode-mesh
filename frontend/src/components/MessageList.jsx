import { useEffect, useRef } from "react"
import { useSelector } from "react-redux"
import { TbArrowUpRight, TbBraces, TbBulb, TbChartDots } from "react-icons/tb"
import LoadingAnimation from "./LoadingAnimation"
import MessageBubble from "./MessageBubble"

function MessageList() {
  const { selectedConversation } = useSelector((state) => state.conversation)
  const { messages, isLoading } = useSelector((state) => state.message)
  const bottomRef = useRef(null)

  useEffect(() => {
    requestAnimationFrame(() => {
      bottomRef?.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      })
    })
  }, [messages?.length, isLoading])

  return (
    <div className="message-list">
      {messages.length === 0 || !selectedConversation ? (
        <div className="chat-empty-state">
          <div className="empty-index">TEXT / 01</div>
          <h1>Write it into motion.</h1>
          <p>Start with a rough thought. ModeMesh AI will route it to the right specialist and help shape the next move.</p>
          <div className="empty-prompts">
            <button type="button">
              <TbBraces aria-hidden="true" />
              <span>Prototype an API</span>
              <TbArrowUpRight aria-hidden="true" />
            </button>
            <button type="button">
              <TbBulb aria-hidden="true" />
              <span>Pressure-test an idea</span>
              <TbArrowUpRight aria-hidden="true" />
            </button>
            <button type="button">
              <TbChartDots aria-hidden="true" />
              <span>Analyze a dataset</span>
              <TbArrowUpRight aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <div className="message-thread">
          {messages?.map((message, index) => (
            <MessageBubble
              key={`${message?.role}-${index}`}
              role={message?.role}
              content={message?.content}
              images={message.images || []}
            />
          ))}
          {isLoading && <LoadingAnimation />}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

export default MessageList
