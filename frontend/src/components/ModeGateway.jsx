import { useRef, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
  TbArrowRight,
  TbBraces,
  TbClock,
  TbCoins,
  TbFile,
  TbHistory,
  TbLayersIntersect,
  TbLogout,
  TbMessage,
  TbMicrophone,
  TbPaperclip,
  TbPhoto,
  TbSearch,
  TbSend,
  TbSparkles,
  TbUser,
  TbWaveSine,
} from "react-icons/tb"
import logOut from "../features/logOut"
import { setSelectedConversation } from "../redux/conversationSlice"
import { setUserdata } from "../redux/userSlice"
import { useSpeechRecognition } from "../hooks/useSpeechRecognition"

const agents = [
  { label: "Auto", icon: TbSparkles },
  { label: "Code", icon: TbBraces },
  { label: "Research", icon: TbSearch },
  { label: "Vision", icon: TbPhoto },
]

function ModeGateway({ onEnterText, onEnterVoice, onOpenBilling }) {
  const dispatch = useDispatch()
  const fileRef = useRef(null)
  const { conversations } = useSelector((state) => state.conversation)
  const { userData } = useSelector((state) => state.user)
  const [prompt, setPrompt] = useState("")
  const [selectedAgent, setSelectedAgent] = useState("Auto")
  const [selectedFile, setSelectedFile] = useState(null)
  const [imageError, setImageError] = useState(false)
  const {
    error: speechError,
    listening,
    supported,
    toggle,
    transcript,
  } = useSpeechRecognition()

  const recentConversation = conversations?.[0]

  const openRecent = () => {
    if (!recentConversation) return
    dispatch(setSelectedConversation(recentConversation))
    onEnterText({ agent: "Auto" })
  }

  const handleTextSubmit = () => {
    if (!prompt.trim() && !selectedFile) return
    onEnterText({
      agent: selectedAgent,
      file: selectedFile,
      prompt,
    })
  }

  const handleVoiceEntry = () => {
    onEnterVoice({ prompt: transcript.trim() })
  }

  const handleLogout = async () => {
    await logOut()
    dispatch(setUserdata(null))
  }

  return (
    <main className="gateway-shell">
      <aside className="gateway-rail" aria-label="ModeMesh AI utility navigation">
        <div className="gateway-logo" aria-label="ModeMesh AI">
          <TbLayersIntersect aria-hidden="true" />
          <span>ModeMesh AI</span>
        </div>

        <div className="gateway-rail-nav">
          <button type="button" className="rail-item rail-item-active" title="New session">
            <TbMessage aria-hidden="true" />
            <span>New session</span>
          </button>
          <button type="button" className="rail-item" title="Recent conversations" onClick={openRecent}>
            <TbHistory aria-hidden="true" />
            <span>Recent</span>
          </button>
          <button type="button" className="rail-item" title="Files">
            <TbFile aria-hidden="true" />
            <span>Files</span>
          </button>
          <button type="button" className="rail-item" title="Credits" onClick={onOpenBilling}>
            <TbCoins aria-hidden="true" />
            <span>Credits</span>
          </button>
        </div>

        <div className="gateway-account">
          <button type="button" className="gateway-avatar" onClick={onOpenBilling} title="Account and billing">
            {userData?.avatar && !imageError ? (
              <img src={userData.avatar} alt={userData?.name || "Profile"} onError={() => setImageError(true)} />
            ) : (
              <TbUser aria-hidden="true" />
            )}
            <span className="presence-dot" />
          </button>
          <button type="button" className="rail-logout" onClick={handleLogout} title="Log out">
            <TbLogout aria-hidden="true" />
          </button>
        </div>
      </aside>

      <section className={`voice-gateway ${listening ? "is-listening" : ""}`}>
        <div className="gateway-kicker">Choose your mode</div>
        <div className="gateway-mode-heading">
          <TbWaveSine aria-hidden="true" />
          <h1>VOICE</h1>
        </div>

        <div className="voice-backdrop-copy" aria-hidden="true">
          <span>Speak</span>
          <span>Think</span>
        </div>

        <div className="voice-control-wrap">
          <button
            type="button"
            className="voice-control"
            onClick={toggle}
            aria-label={listening ? "Stop listening" : "Start listening"}
          >
            <TbMicrophone aria-hidden="true" />
          </button>
          <div className="voice-status">
            <span className="voice-status-dot" />
            {listening ? "Listening now" : supported ? "Tap to talk" : "Voice unavailable"}
          </div>
          {(transcript || speechError) && (
            <p className={`voice-transcript ${speechError ? "voice-error" : ""}`}>
              {speechError || `“${transcript}”`}
            </p>
          )}
        </div>

        <button type="button" className="voice-enter" onClick={handleVoiceEntry}>
          <span>Enter voice room</span>
          <TbArrowRight aria-hidden="true" />
        </button>
      </section>

      <section className="text-gateway">
        <div className="text-gateway-topline">
          <span>TEXT</span>
        </div>

        <div className="text-gateway-content">
          <h2>Start with a thought.</h2>

          <div className="gateway-composer">
            <textarea
              aria-label="Start a text conversation"
              placeholder="Ask anything. Plan, create, or analyze."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  handleTextSubmit()
                }
              }}
            />

            {selectedFile && (
              <div className="gateway-file">
                <TbFile aria-hidden="true" />
                <span>{selectedFile.name}</span>
                <button type="button" onClick={() => setSelectedFile(null)}>Remove</button>
              </div>
            )}

            <div className="gateway-composer-actions">
              <input
                ref={fileRef}
                hidden
                type="file"
                accept=".pdf,image/*"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              />
              <button
                type="button"
                className="composer-icon-button"
                onClick={() => fileRef.current?.click()}
                aria-label="Attach a file"
              >
                <TbPaperclip aria-hidden="true" />
              </button>
              <button
                type="button"
                className="gateway-send"
                onClick={handleTextSubmit}
                disabled={!prompt.trim() && !selectedFile}
                aria-label="Start text session"
              >
                <TbSend aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="gateway-agents" aria-label="Choose an agent">
            {agents.map(({ label, icon: Icon }) => (
              <button
                type="button"
                key={label}
                className={selectedAgent === label ? "active" : ""}
                onClick={() => setSelectedAgent(label)}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="gateway-recent" onClick={openRecent} disabled={!recentConversation}>
          <TbClock aria-hidden="true" />
          <span>Recent</span>
          <strong>{recentConversation?.title || "Your conversations will appear here"}</strong>
          <TbArrowRight aria-hidden="true" />
        </button>
      </section>
    </main>
  )
}

export default ModeGateway
