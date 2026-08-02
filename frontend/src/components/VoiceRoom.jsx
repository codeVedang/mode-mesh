import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
  TbArrowLeft,
  TbMicrophone,
  TbPlayerStopFilled,
  TbSend,
  TbSparkles,
  TbVolume,
  TbVolumeOff,
  TbWaveSine,
} from "react-icons/tb"
import getMessages from "../features/getMessages"
import { submitPrompt } from "../features/submitPrompt"
import { useSpeechRecognition } from "../hooks/useSpeechRecognition"
import { setArtifacts, setMessages } from "../redux/messageSlice"

function VoiceRoom({ initialPrompt = "", onBack }) {
  const dispatch = useDispatch()
  const initialHandledRef = useRef(false)
  const { selectedConversation } = useSelector((state) => state.conversation)
  const { isLoading, messages } = useSelector((state) => state.message)
  const [typedFallback, setTypedFallback] = useState("")
  const [speaking, setSpeaking] = useState(false)
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true)
  const selectedConversationId = selectedConversation?._id
  const selectedConversationTitle = selectedConversation?.title
  const {
    clear,
    error,
    listening,
    supported,
    toggle,
    transcript,
  } = useSpeechRecognition()

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  )

  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedConversationId || selectedConversationTitle === "New Chat") return
      const data = await getMessages(selectedConversationId)
      dispatch(setMessages(data || []))
      const latestArtifactMessage = [...(data || [])]
        .reverse()
        .find((message) => message.artifacts?.length > 0)
      dispatch(setArtifacts(latestArtifactMessage?.artifacts || []))
    }

    loadMessages()
  }, [dispatch, selectedConversationId, selectedConversationTitle])

  useEffect(() => () => {
    window.speechSynthesis?.cancel()
  }, [])

  const speak = useCallback((text) => {
    if (!voiceReplyEnabled || !text || !window.speechSynthesis) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [voiceReplyEnabled])

  const handleSend = useCallback(async (overridePrompt) => {
    const prompt = (overridePrompt ?? transcript ?? typedFallback).trim()
    if (!prompt || isLoading) return

    try {
      const result = await submitPrompt({
        agent: "Auto",
        conversation: selectedConversation,
        dispatch,
        prompt,
      })
      clear()
      setTypedFallback("")
      speak(result?.data?.answer)
    } catch (submitError) {
      console.error(submitError)
    }
  }, [
    clear,
    dispatch,
    isLoading,
    selectedConversation,
    speak,
    transcript,
    typedFallback,
  ])

  useEffect(() => {
    if (!initialPrompt?.trim() || initialHandledRef.current) return
    initialHandledRef.current = true
    const timeout = window.setTimeout(() => handleSend(initialPrompt), 0)
    return () => window.clearTimeout(timeout)
  }, [handleSend, initialPrompt])

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }

  return (
    <section className="voice-room">
      <header className="voice-room-header">
        <button type="button" onClick={onBack} className="workspace-back">
          <TbArrowLeft aria-hidden="true" />
          <span>Mode hub</span>
        </button>
        <div className="voice-room-title">
          <TbWaveSine aria-hidden="true" />
          <span>Live voice room</span>
        </div>
        <button
          type="button"
          className="voice-output-toggle"
          onClick={() => {
            if (speaking) stopSpeaking()
            setVoiceReplyEnabled((value) => !value)
          }}
          aria-label={voiceReplyEnabled ? "Mute spoken replies" : "Enable spoken replies"}
        >
          {voiceReplyEnabled ? <TbVolume aria-hidden="true" /> : <TbVolumeOff aria-hidden="true" />}
          <span>{voiceReplyEnabled ? "Voice reply on" : "Voice reply off"}</span>
        </button>
      </header>

      <div className="voice-room-layout">
        <div className={`voice-stage ${listening ? "is-listening" : ""}`}>
          <div className="voice-stage-label">VOICE / AUTO AGENT</div>
          <h1>{listening ? "I’m listening." : isLoading ? "Thinking it through." : "Say what’s on your mind."}</h1>
          <p className="voice-stage-copy">
            {supported
              ? "Speak naturally. ModeMesh AI will route your request to the right specialist and answer out loud."
              : "Speech recognition is not available in this browser. Use the fallback field below."}
          </p>

          <button
            type="button"
            className="room-mic"
            onClick={toggle}
            disabled={!supported || isLoading}
            aria-label={listening ? "Stop recording" : "Start recording"}
          >
            {listening ? <TbPlayerStopFilled aria-hidden="true" /> : <TbMicrophone aria-hidden="true" />}
          </button>

          <div className="room-mic-status">
            <span className="voice-status-dot" />
            {error || (listening ? "Recording — tap to stop" : "Mic ready")}
          </div>

          <div className="live-transcript" aria-live="polite">
            <span>LIVE TRANSCRIPT</span>
            <p>{transcript || "Your words will appear here as you speak."}</p>
          </div>

          <button
            type="button"
            className="send-voice-prompt"
            onClick={() => handleSend()}
            disabled={!transcript.trim() || isLoading}
          >
            <span>{isLoading ? "ModeMesh AI is thinking" : "Send to ModeMesh AI"}</span>
            <TbSend aria-hidden="true" />
          </button>
        </div>

        <aside className="voice-response">
          <div className="response-kicker">
            <TbSparkles aria-hidden="true" />
            MODEMESH RESPONSE
          </div>
          <h2>{speaking ? "Speaking now" : latestAssistantMessage ? "Here’s what I found" : "Ready for your first thought"}</h2>
          <div className="response-copy">
            {latestAssistantMessage?.content || "Your response will appear here and play aloud when ModeMesh AI finishes thinking."}
          </div>

          {speaking && (
            <button type="button" className="stop-response" onClick={stopSpeaking}>
              <TbPlayerStopFilled aria-hidden="true" />
              Stop speaking
            </button>
          )}

          {!supported && (
            <div className="voice-fallback">
              <label htmlFor="voice-fallback-input">Type instead</label>
              <textarea
                id="voice-fallback-input"
                value={typedFallback}
                onChange={(event) => setTypedFallback(event.target.value)}
                placeholder="Describe what you need"
              />
              <button type="button" onClick={() => handleSend(typedFallback)} disabled={!typedFallback.trim()}>
                Send
              </button>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

export default VoiceRoom
