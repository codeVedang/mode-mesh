import { useSelector } from "react-redux"
import { TbArrowLeft, TbMessage, TbWriting } from "react-icons/tb"

function Nav({ onBack }) {
  const { selectedConversation } = useSelector((state) => state.conversation)
  const { messages } = useSelector((state) => state.message)

  return (
    <header className="chat-nav">
      <button type="button" className="workspace-back" onClick={onBack}>
        <TbArrowLeft aria-hidden="true" />
        <span>Mode hub</span>
      </button>

      <div className="chat-nav-title">
        <TbMessage aria-hidden="true" />
        <div>
          <strong>{selectedConversation?.title || "New text session"}</strong>
          <span>{messages?.length || 0} messages</span>
        </div>
      </div>

      <div className="chat-mode-label">
        <TbWriting aria-hidden="true" />
        Text workspace
      </div>
    </header>
  )
}

export default Nav
