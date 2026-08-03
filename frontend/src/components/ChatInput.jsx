import { useCallback, useEffect, useRef, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
  TbBraces,
  TbFile,
  TbFileTypePdf,
  TbGlobe,
  TbMicrophone,
  TbMicrophoneOff,
  TbPaperclip,
  TbPhoto,
  TbPresentation,
  TbSearch,
  TbSend,
  TbSparkles,
  TbX,
} from "react-icons/tb"
import { submitPrompt } from "../features/submitPrompt"
import { useSpeechRecognition } from "../hooks/useSpeechRecognition"
import { addMessage } from "../redux/messageSlice"

const agents = [
  { id: "auto", icon: TbSparkles, label: "Auto" },
  { id: "coding", icon: TbBraces, label: "Coding" },
  { id: "pdf", icon: TbFileTypePdf, label: "PDF" },
  { id: "ppt", icon: TbPresentation, label: "PPT" },
  { id: "vision", icon: TbPhoto, label: "Vision" },
  { id: "search", icon: TbSearch, label: "Search" },
  { id: "web", icon: TbGlobe, label: "Web" },
]

function ChatInput({
  autoSend = false,
  initialAgent = "Auto",
  initialFile = null,
  initialPrompt = "",
}) {
  const dispatch = useDispatch()
  const fileRef = useRef(null)
  const initialHandledRef = useRef(false)
  const { selectedConversation } = useSelector((state) => state.conversation)
  const { isLoading } = useSelector((state) => state.message)
  const [value, setValue] = useState(initialPrompt || "")
  const [selectedAgent, setSelectedAgent] = useState(initialAgent || "Auto")
  const [selectedFile, setSelectedFile] = useState(initialFile)
  const {
    clear: clearTranscript,
    listening,
    supported,
    toggle,
  } = useSpeechRecognition({ onTranscript: setValue })

  const handleSendMessage = useCallback(async (override = {}) => {
    const prompt = override.prompt ?? value
    const file = override.file ?? selectedFile
    const agent = override.agent ?? selectedAgent

    if ((!prompt.trim() && !file) || isLoading) return

    try {
      await submitPrompt({
        agent,
        conversation: selectedConversation,
        dispatch,
        file,
        prompt,
      })
      setValue("")
      clearTranscript()
      setSelectedFile(null)
      if (fileRef.current) fileRef.current.value = ""
    } catch (error) {
      console.error(error)
      const message = error.response?.status === 503
        ? "ModeMesh services are still starting. Your message was not sent—please try again in a moment."
        : "I couldn't reach ModeMesh. Your message was not sent, so please try again."
      dispatch(addMessage({ role: "assistant", content: message }))
    }
  }, [
    clearTranscript,
    dispatch,
    isLoading,
    selectedAgent,
    selectedConversation,
    selectedFile,
    value,
  ])

  useEffect(() => {
    if (initialHandledRef.current || (!initialPrompt?.trim() && !initialFile)) return
    initialHandledRef.current = true

    if (autoSend) {
      const timeout = window.setTimeout(() => {
        handleSendMessage({
          agent: initialAgent || "Auto",
          file: initialFile,
          prompt: initialPrompt || "",
        })
      }, 0)
      return () => window.clearTimeout(timeout)
    }
    return undefined
  }, [autoSend, handleSendMessage, initialAgent, initialFile, initialPrompt])

  return (
    <div className="chat-input-dock">
      <div className="chat-agent-row" aria-label="Choose an agent">
        {agents.map((agent) => {
          const active = selectedAgent === agent.label
          const Icon = agent.icon
          return (
            <button
              type="button"
              key={agent.id}
              className={active ? "active" : ""}
              onClick={() => setSelectedAgent(agent.label)}
            >
              <Icon aria-hidden="true" />
              {agent.label}
            </button>
          )
        })}
      </div>

      <div className="chat-composer">
        {selectedFile && (
          <div className="chat-file">
            <TbFile aria-hidden="true" />
            <span>
              <strong>{selectedFile.name}</strong>
              <small>{Math.ceil(selectedFile.size / 1024)} KB</small>
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null)
                if (fileRef.current) fileRef.current.value = ""
              }}
              aria-label="Remove attachment"
            >
              <TbX aria-hidden="true" />
            </button>
          </div>
        )}

        <textarea
          placeholder="Ask, draft, research, or build…"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              handleSendMessage()
            }
          }}
          value={value}
          rows={2}
        />

        <div className="chat-composer-actions">
          <div>
            <input
              type="file"
              accept=".pdf,image/*"
              hidden
              ref={fileRef}
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            />
            <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach a file">
              <TbPaperclip aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={toggle}
              disabled={!supported}
              className={listening ? "is-listening" : ""}
              aria-label={listening ? "Stop listening" : "Dictate message"}
            >
              {listening ? <TbMicrophone aria-hidden="true" /> : <TbMicrophoneOff aria-hidden="true" />}
            </button>
          </div>
          <button
            type="button"
            className="chat-send"
            disabled={(!value.trim() && !selectedFile) || isLoading}
            onClick={() => handleSendMessage()}
            aria-label="Send message"
          >
            <TbSend aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatInput
