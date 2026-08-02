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

const GREETING = "Hi, I'm ModeMesh. What would you like to know, create, or get done?"
const SILENCE_BEFORE_SEND_MS = 1500

const toSpokenText = (value = "") => {
  const normalized = value
    .replace(/```[\s\S]*?```/g, " The code is available on screen. ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>|~]/g, "")
    .replace(/^[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()

  if (normalized.length <= 1800) return normalized
  return `${normalized.slice(0, 1800)}. The complete response is available on screen.`
}

const getPreferredVoice = () => {
  const voices = window.speechSynthesis?.getVoices?.() || []
  return voices.find((voice) => (
    voice.lang?.toLowerCase().startsWith("en")
    && /natural|google|samantha|microsoft/i.test(voice.name)
  )) || voices.find((voice) => voice.lang?.toLowerCase().startsWith("en"))
}

function VoiceRoom({ initialPrompt = "", onBack }) {
  const dispatch = useDispatch()
  const autoStartRef = useRef(false)
  const beginListeningRef = useRef(null)
  const handleSendRef = useRef(null)
  const isLoadingRef = useRef(false)
  const listenStartTimerRef = useRef(null)
  const resumeOnRecognitionEndRef = useRef(false)
  const sessionActiveRef = useRef(false)
  const silenceTimerRef = useRef(null)
  const speakingRef = useRef(false)
  const speechGenerationRef = useRef(0)
  const speakRef = useRef(null)
  const stopListeningRef = useRef(null)
  const submitInFlightRef = useRef(false)
  const transcriptRef = useRef("")
  const voiceReplyEnabledRef = useRef(true)

  const { selectedConversation } = useSelector((state) => state.conversation)
  const { isLoading, messages } = useSelector((state) => state.message)
  const [conversationError, setConversationError] = useState("")
  const [lastHeard, setLastHeard] = useState("")
  const [lastSpokenText, setLastSpokenText] = useState(GREETING)
  const [sessionActive, setSessionActive] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [typedFallback, setTypedFallback] = useState("")
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true)
  const selectedConversationId = selectedConversation?._id
  const selectedConversationTitle = selectedConversation?.title

  const handleRecognitionEnd = useCallback(() => {
    if (!resumeOnRecognitionEndRef.current || !sessionActiveRef.current) return
    window.setTimeout(() => beginListeningRef.current?.(), 350)
  }, [])

  const handleRecognitionError = useCallback(() => {
    resumeOnRecognitionEndRef.current = false
  }, [])

  const {
    clear,
    error,
    listening,
    start,
    stop,
    supported,
    transcript,
  } = useSpeechRecognition({
    onEnd: handleRecognitionEnd,
    onError: handleRecognitionError,
  })

  useEffect(() => {
    isLoadingRef.current = isLoading
    sessionActiveRef.current = sessionActive
    speakingRef.current = speaking
    transcriptRef.current = transcript
    voiceReplyEnabledRef.current = voiceReplyEnabled
  }, [isLoading, sessionActive, speaking, transcript, voiceReplyEnabled])

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  )

  const clearSilenceTimer = useCallback(() => {
    if (!silenceTimerRef.current) return
    window.clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = null
  }, [])

  const clearListenStartTimer = useCallback(() => {
    if (!listenStartTimerRef.current) return
    window.clearTimeout(listenStartTimerRef.current)
    listenStartTimerRef.current = null
  }, [])

  const beginListening = useCallback(() => {
    clearListenStartTimer()
    clearSilenceTimer()

    if (
      !sessionActiveRef.current
      || !supported
      || submitInFlightRef.current
      || isLoadingRef.current
      || speakingRef.current
    ) return

    setConversationError("")
    clear()
    resumeOnRecognitionEndRef.current = true
    listenStartTimerRef.current = window.setTimeout(() => {
      listenStartTimerRef.current = null
      if (
        sessionActiveRef.current
        && !submitInFlightRef.current
        && !isLoadingRef.current
        && !speakingRef.current
      ) {
        start()
      }
    }, 250)
  }, [clear, clearListenStartTimer, clearSilenceTimer, start, supported])

  const stopListening = useCallback((resumeAfterEnd = false) => {
    clearListenStartTimer()
    clearSilenceTimer()
    resumeOnRecognitionEndRef.current = resumeAfterEnd
    stop()
  }, [clearListenStartTimer, clearSilenceTimer, stop])

  const stopSpeaking = useCallback((resumeListening = false) => {
    speechGenerationRef.current += 1
    window.speechSynthesis?.cancel()
    speakingRef.current = false
    setSpeaking(false)

    if (resumeListening && sessionActiveRef.current) {
      beginListeningRef.current?.()
    }
  }, [])

  const speak = useCallback((text, { resumeListening = true } = {}) => {
    const spokenText = toSpokenText(text)

    if (!spokenText || !voiceReplyEnabledRef.current || !window.speechSynthesis) {
      return false
    }

    stopListeningRef.current?.(false)
    const speechGeneration = speechGenerationRef.current + 1
    speechGenerationRef.current = speechGeneration
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(spokenText)
    const preferredVoice = getPreferredVoice()
    if (preferredVoice) utterance.voice = preferredVoice
    utterance.rate = 1.02
    utterance.pitch = 1

    const finishSpeaking = () => {
      if (speechGeneration !== speechGenerationRef.current) return
      speakingRef.current = false
      setSpeaking(false)

      if (resumeListening && sessionActiveRef.current) {
        beginListeningRef.current?.()
      }
    }

    utterance.onstart = () => {
      if (speechGeneration !== speechGenerationRef.current) return
      speakingRef.current = true
      setSpeaking(true)
    }
    utterance.onend = finishSpeaking
    utterance.onerror = finishSpeaking

    setLastSpokenText(text)
    window.speechSynthesis.speak(utterance)
    return true
  }, [])

  const handleSend = useCallback(async (overridePrompt) => {
    const prompt = (overridePrompt ?? transcriptRef.current ?? typedFallback).trim()
    if (!prompt || submitInFlightRef.current || isLoadingRef.current) return

    submitInFlightRef.current = true
    stopListeningRef.current?.(false)
    setConversationError("")
    setLastHeard(prompt)
    clear()
    setTypedFallback("")

    let responseScheduled = false

    try {
      const result = await submitPrompt({
        agent: "Auto",
        conversation: selectedConversation,
        dispatch,
        prompt,
      })
      responseScheduled = speakRef.current?.(
        result?.data?.answer || "I completed the request.",
        { resumeListening: true },
      ) || false
    } catch (submitError) {
      console.error(submitError)
      const message = "I hit a connection problem. Please try that again."
      setConversationError(message)
      responseScheduled = speakRef.current?.(message, { resumeListening: true }) || false
    } finally {
      submitInFlightRef.current = false

      if (!responseScheduled && sessionActiveRef.current) {
        beginListeningRef.current?.()
      }
    }
  }, [clear, dispatch, selectedConversation, typedFallback])

  const startSession = useCallback((prompt = "") => {
    if (sessionActiveRef.current) {
      beginListeningRef.current?.()
      return
    }

    sessionActiveRef.current = true
    setSessionActive(true)
    setConversationError("")
    clear()

    if (prompt.trim()) {
      window.setTimeout(() => handleSendRef.current?.(prompt), 0)
      return
    }

    const greetingScheduled = speakRef.current?.(GREETING, { resumeListening: true })
    if (!greetingScheduled) beginListeningRef.current?.()
  }, [clear])

  const endSession = useCallback(() => {
    sessionActiveRef.current = false
    setSessionActive(false)
    stopListeningRef.current?.(false)
    stopSpeaking(false)
    clear()
    setConversationError("")
    setLastHeard("")
    setLastSpokenText("Voice session ended. Start again whenever you're ready.")
  }, [clear, stopSpeaking])

  useEffect(() => {
    beginListeningRef.current = beginListening
    stopListeningRef.current = stopListening
    speakRef.current = speak
    handleSendRef.current = handleSend
  }, [beginListening, handleSend, speak, stopListening])

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

  useEffect(() => {
    clearSilenceTimer()

    if (
      !sessionActive
      || !listening
      || isLoading
      || submitInFlightRef.current
      || !transcript.trim()
    ) return undefined

    silenceTimerRef.current = window.setTimeout(() => {
      silenceTimerRef.current = null
      const prompt = transcriptRef.current.trim()
      if (!prompt || !sessionActiveRef.current || submitInFlightRef.current) return
      resumeOnRecognitionEndRef.current = false
      stop()
      handleSendRef.current?.(prompt)
    }, SILENCE_BEFORE_SEND_MS)

    return clearSilenceTimer
  }, [clearSilenceTimer, isLoading, listening, sessionActive, stop, transcript])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (autoStartRef.current) return
      autoStartRef.current = true
      startSession(initialPrompt)
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [initialPrompt, startSession])

  useEffect(() => () => {
    sessionActiveRef.current = false
    clearListenStartTimer()
    clearSilenceTimer()
    speechGenerationRef.current += 1
    window.speechSynthesis?.cancel()
  }, [clearListenStartTimer, clearSilenceTimer])

  const handlePrimaryAction = () => {
    if (isLoading) return

    if (speaking) {
      stopSpeaking(true)
      return
    }

    if (listening) {
      if (transcript.trim()) {
        handleSend(transcript)
      } else {
        stopListening(false)
      }
      return
    }

    if (!sessionActive) {
      startSession()
      return
    }

    beginListening()
  }

  const phase = isLoading
    ? "thinking"
    : speaking
      ? "speaking"
      : listening
        ? "listening"
        : sessionActive
          ? "ready"
          : "idle"

  const phaseHeading = {
    idle: "Start a voice conversation.",
    listening: "I'm listening.",
    ready: "Your turn when you're ready.",
    speaking: "Speaking now.",
    thinking: "Thinking it through.",
  }[phase]

  const micStatus = conversationError
    || error
    || (listening
      ? "Listening — I'll respond after a short pause"
      : speaking
        ? "Tap the microphone to interrupt"
        : isLoading
          ? "Routing your request to the right agent"
          : sessionActive
            ? "Conversation active"
            : "Tap to begin")

  return (
    <section className="voice-room">
      <header className="voice-room-header">
        <button
          type="button"
          onClick={() => {
            endSession()
            onBack()
          }}
          className="workspace-back"
        >
          <TbArrowLeft aria-hidden="true" />
          <span>Mode hub</span>
        </button>
        <div className="voice-room-title">
          <TbWaveSine aria-hidden="true" />
          <span>Conversational voice</span>
        </div>
        <button
          type="button"
          className="voice-output-toggle"
          onClick={() => {
            const nextEnabled = !voiceReplyEnabledRef.current
            voiceReplyEnabledRef.current = nextEnabled
            setVoiceReplyEnabled(nextEnabled)
            if (!nextEnabled && speakingRef.current) stopSpeaking(true)
          }}
          aria-label={voiceReplyEnabled ? "Mute spoken replies" : "Enable spoken replies"}
        >
          {voiceReplyEnabled ? <TbVolume aria-hidden="true" /> : <TbVolumeOff aria-hidden="true" />}
          <span>{voiceReplyEnabled ? "Voice reply on" : "Voice reply off"}</span>
        </button>
      </header>

      <div className="voice-room-layout">
        <div className={`voice-stage is-${phase} ${sessionActive ? "is-session-active" : ""}`}>
          <div className="voice-stage-label">VOICE / AUTO AGENT</div>
          <h1>{phaseHeading}</h1>
          <p className="voice-stage-copy">
            {supported
              ? "Speak naturally. ModeMesh will listen, respond aloud, and keep the conversation going hands-free."
              : "Speech recognition is not available in this browser. Use the fallback field below."}
          </p>

          <button
            type="button"
            className="room-mic"
            onClick={handlePrimaryAction}
            disabled={!supported || isLoading}
            aria-label={speaking
              ? "Interrupt and speak"
              : listening
                ? "Finish speaking now"
                : sessionActive
                  ? "Start listening"
                  : "Start voice conversation"}
          >
            {listening ? <TbPlayerStopFilled aria-hidden="true" /> : <TbMicrophone aria-hidden="true" />}
          </button>

          <div className="room-mic-status" aria-live="polite">
            <span className="voice-status-dot" />
            {micStatus}
          </div>

          <div className="live-transcript" aria-live="polite">
            <span>{listening ? "LIVE TRANSCRIPT" : lastHeard ? "LAST HEARD" : "CONVERSATION"}</span>
            <p>{transcript || lastHeard || "ModeMesh will greet you, then listen for your first request."}</p>
          </div>

          <div className="voice-session-actions">
            <button
              type="button"
              className="send-voice-prompt"
              onClick={() => handleSend()}
              disabled={!transcript.trim() || isLoading}
            >
              <span>{isLoading ? "ModeMesh is thinking" : "Send now"}</span>
              <TbSend aria-hidden="true" />
            </button>

            {sessionActive && (
              <button type="button" className="end-voice-session" onClick={endSession}>
                <TbPlayerStopFilled aria-hidden="true" />
                End session
              </button>
            )}
          </div>
        </div>

        <aside className="voice-response">
          <div className="response-kicker">
            <TbSparkles aria-hidden="true" />
            MODEMESH RESPONSE
          </div>
          <h2>{speaking
            ? "Speaking now"
            : latestAssistantMessage
              ? "Here's what I found"
              : sessionActive
                ? "Conversation started"
                : "Ready when you are"}</h2>
          <div className="response-copy">
            {latestAssistantMessage?.content || lastSpokenText}
          </div>

          {speaking && (
            <button type="button" className="stop-response" onClick={() => stopSpeaking(true)}>
              <TbMicrophone aria-hidden="true" />
              Interrupt and speak
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
