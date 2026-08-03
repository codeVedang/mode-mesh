import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
  TbArrowLeft,
  TbMicrophone,
  TbPlayerStopFilled,
  TbPower,
  TbSend,
  TbSparkles,
  TbVolume,
  TbVolumeOff,
  TbWaveSine,
} from "react-icons/tb"
import getMessages from "../features/getMessages"
import { submitPrompt } from "../features/submitPrompt"
import { useSpeechRecognition } from "../hooks/useSpeechRecognition"
import { setSelectedConversation } from "../redux/conversationSlice"
import { setArtifacts, setMessages } from "../redux/messageSlice"
import ExecutionTimeline from "./ExecutionTimeline"
import ResultDeliverables from "./ResultDeliverables"

const GREETING = "ModeMesh voice core online. I'm ready. What would you like me to handle?"
const SILENCE_BEFORE_SEND_MS = 1200
const WAKE_PHRASE = /^(?:hey\s+)?(?:mode\s*mesh|jarvis)[,\s:]*/i

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
  return `${normalized.slice(0, 1800)}. The complete response is available in the transcript.`
}

const getPreferredVoice = () => {
  const voices = window.speechSynthesis?.getVoices?.() || []
  return voices.find((voice) => (
    voice.lang?.toLowerCase().startsWith("en")
    && /natural|google|samantha|microsoft/i.test(voice.name)
  )) || voices.find((voice) => voice.lang?.toLowerCase().startsWith("en"))
}

function VoiceRoom({ initialPrompt = "", onBack, onOpenText }) {
  const dispatch = useDispatch()
  const autoStartRef = useRef(false)
  const beginListeningRef = useRef(null)
  const commandHandlerRef = useRef(null)
  const endSessionRef = useRef(null)
  const handleSendRef = useRef(null)
  const isLoadingRef = useRef(false)
  const lastSpokenTextRef = useRef(GREETING)
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
  const transcriptStreamRef = useRef(null)
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
    window.setTimeout(() => beginListeningRef.current?.(), 300)
  }, [])

  const handleRecognitionError = useCallback((errorCode) => {
    resumeOnRecognitionEndRef.current = ![
      "not-allowed",
      "service-not-allowed",
    ].includes(errorCode)
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
    lastSpokenTextRef.current = lastSpokenText
    sessionActiveRef.current = sessionActive
    speakingRef.current = speaking
    transcriptRef.current = transcript
    voiceReplyEnabledRef.current = voiceReplyEnabled
  }, [isLoading, lastSpokenText, sessionActive, speaking, transcript, voiceReplyEnabled])

  const recentTranscript = useMemo(() => messages.slice(-16), [messages])

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
    }, 180)
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
    utterance.rate = 1.04
    utterance.pitch = 0.96

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

    lastSpokenTextRef.current = text
    setLastSpokenText(text)
    window.speechSynthesis.speak(utterance)
    return true
  }, [])

  const handleSend = useCallback(async (overridePrompt) => {
    const rawPrompt = (overridePrompt ?? transcriptRef.current ?? typedFallback).trim()
    if (!rawPrompt || submitInFlightRef.current || isLoadingRef.current) return

    if (commandHandlerRef.current?.(rawPrompt)) {
      clear()
      setTypedFallback("")
      return
    }

    const promptWithoutWakePhrase = rawPrompt.replace(WAKE_PHRASE, "").trim()
    const prompt = promptWithoutWakePhrase || rawPrompt

    submitInFlightRef.current = true
    stopListeningRef.current?.(false)
    setConversationError("")
    setLastHeard(rawPrompt)
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
        result?.data?.speechSummary || result?.data?.answer || "I completed the request.",
        { resumeListening: true },
      ) || false
    } catch (submitError) {
      console.error(submitError)
      const serviceIsStarting = submitError.response?.status === 503
      const message = serviceIsStarting
        ? "My agent network is still coming online. Please try once more in a moment."
        : "I couldn't complete that request. Please try again."
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
    setLastSpokenText("Voice core offline. Start a new session whenever you're ready.")
  }, [clear, stopSpeaking])

  const handleVoiceCommand = useCallback((rawPrompt) => {
    const command = rawPrompt.replace(WAKE_PHRASE, "").trim().toLowerCase()

    if (/^(repeat|repeat that|say that again)$/.test(command)) {
      setLastHeard(rawPrompt)
      speakRef.current?.(lastSpokenTextRef.current, { resumeListening: true })
      return true
    }

    if (/^(new|start a new) (chat|conversation|session)$/.test(command)) {
      dispatch(setSelectedConversation(null))
      dispatch(setMessages([]))
      dispatch(setArtifacts([]))
      setLastHeard(rawPrompt)
      speakRef.current?.("New conversation ready. What should we work on?", { resumeListening: true })
      return true
    }

    if (/^(mute|mute voice|turn voice off)$/.test(command)) {
      voiceReplyEnabledRef.current = false
      setVoiceReplyEnabled(false)
      setLastHeard(rawPrompt)
      setLastSpokenText("Spoken replies are muted. I'm still listening.")
      beginListeningRef.current?.()
      return true
    }

    if (/^(unmute|unmute voice|turn voice on)$/.test(command)) {
      voiceReplyEnabledRef.current = true
      setVoiceReplyEnabled(true)
      setLastHeard(rawPrompt)
      speakRef.current?.("Spoken replies are back on.", { resumeListening: true })
      return true
    }

    if (/^(stop|end|close) (voice|session|conversation)$/.test(command) || command === "goodbye") {
      endSessionRef.current?.()
      return true
    }

    return false
  }, [dispatch])

  useEffect(() => {
    beginListeningRef.current = beginListening
    commandHandlerRef.current = handleVoiceCommand
    endSessionRef.current = endSession
    stopListeningRef.current = stopListening
    speakRef.current = speak
    handleSendRef.current = handleSend
  }, [beginListening, endSession, handleSend, handleVoiceCommand, speak, stopListening])

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

    void loadMessages()
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
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [initialPrompt, startSession])

  useEffect(() => {
    const stream = transcriptStreamRef.current
    if (stream) stream.scrollTop = stream.scrollHeight
  }, [isLoading, messages, speaking, transcript])

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
    idle: "Voice core offline",
    listening: "Listening",
    ready: "Standing by",
    speaking: "Responding",
    thinking: "Orchestrating agents",
  }[phase]

  const micStatus = conversationError
    || error
    || (listening
      ? "Speak naturally — I'll act after a short pause"
      : speaking
        ? "Tap the core to interrupt"
        : isLoading
          ? "Routing through the ModeMesh agent network"
          : sessionActive
            ? "Hands-free session active"
            : "Tap the core to reconnect")

  return (
    <section className={`voice-room voice-phase-${phase}`}>
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
          <span className="voice-core-status" />
          <div>
            <strong>ModeMesh Voice</strong>
            <small>{sessionActive ? "Core online" : "Core offline"}</small>
          </div>
        </div>

        <div className="voice-header-actions">
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
            <span>{voiceReplyEnabled ? "Audio on" : "Audio off"}</span>
          </button>
          {sessionActive && (
            <button type="button" className="voice-end-control" onClick={endSession}>
              <TbPower aria-hidden="true" />
              <span>End</span>
            </button>
          )}
        </div>
      </header>

      <main className="voice-console">
        <section className="voice-core-panel" aria-label="Voice assistant controls">
          <div className="voice-core-kicker">
            <TbSparkles aria-hidden="true" />
            AUTONOMOUS AGENT INTERFACE
          </div>

          <button
            type="button"
            className="voice-core-button"
            onClick={handlePrimaryAction}
            disabled={!supported || isLoading}
            aria-label={speaking
              ? "Interrupt and speak"
              : listening
                ? "Finish speaking now"
                : sessionActive
                  ? "Start listening"
                  : "Start voice session"}
          >
            <span className="voice-core-ring voice-core-ring-one" />
            <span className="voice-core-ring voice-core-ring-two" />
            <span className="voice-core-center">
              {listening ? <TbPlayerStopFilled aria-hidden="true" /> : <TbMicrophone aria-hidden="true" />}
            </span>
          </button>

          <div className="voice-waveform" aria-hidden="true">
            {Array.from({ length: 13 }, (_, index) => <span key={index} />)}
          </div>

          <h1>{phaseHeading}</h1>
          <p className="voice-core-copy" aria-live="polite">{micStatus}</p>

          <div className="voice-capabilities" aria-label="Voice capabilities">
            <span>Auto routing</span>
            <span>Continuous listening</span>
            <span>Voice commands</span>
          </div>
        </section>

        <section className="voice-transcript-console" aria-label="Conversation transcript">
          <header>
            <div>
              <TbWaveSine aria-hidden="true" />
              <span>LIVE TRANSCRIPT</span>
            </div>
            <small>{selectedConversationTitle && selectedConversationTitle !== "New Chat"
              ? selectedConversationTitle
              : "Auto agent session"}</small>
          </header>

          <div className="voice-transcript-stream" ref={transcriptStreamRef} aria-live="polite">
            {recentTranscript.length === 0 && !lastHeard && (
              <article className="voice-turn assistant">
                <span>MODEMESH</span>
                <p>{lastSpokenText}</p>
              </article>
            )}

            {recentTranscript.map((message, index) => (
              <article
                className={`voice-turn ${message.role === "user" ? "user" : "assistant"}`}
                key={message._id || `${message.role}-${index}-${message.content?.slice(0, 16)}`}
              >
                <span>{message.role === "user" ? "YOU" : "MODEMESH"}</span>
                {message.role === "user" ? (
                  <p>{message.content}</p>
                ) : (
                  <>
                    {!(message.deliverables?.length > 0) && <p>{toSpokenText(message.content)}</p>}
                    {message.images?.length > 0 && (
                      <div className="voice-result-images">
                        {message.images.map((image) => <img src={image} alt="Generated result" key={image} />)}
                      </div>
                    )}
                    <ResultDeliverables
                      artifacts={message.artifacts || []}
                      compact
                      deliverables={message.deliverables || []}
                      onOpenArtifact={onOpenText}
                    />
                    <ExecutionTimeline execution={message.execution} />
                  </>
                )}
              </article>
            ))}

            {listening && transcript && (
              <article className="voice-turn user live">
                <span>YOU · LIVE</span>
                <p>{transcript}</p>
              </article>
            )}

            {isLoading && (
              <article className="voice-turn assistant processing">
                <span>MODEMESH</span>
                <p>Coordinating the best agent for your request<span className="voice-thinking-dots">...</span></p>
                <ExecutionTimeline pending />
              </article>
            )}

            {conversationError && (
              <article className="voice-turn system-error">
                <span>SYSTEM</span>
                <p>{conversationError}</p>
              </article>
            )}
          </div>

          {!supported && (
            <form
              className="voice-fallback"
              onSubmit={(event) => {
                event.preventDefault()
                handleSend(typedFallback)
              }}
            >
              <label htmlFor="voice-fallback-input">Voice unavailable — type a command</label>
              <div>
                <input
                  id="voice-fallback-input"
                  value={typedFallback}
                  onChange={(event) => setTypedFallback(event.target.value)}
                  placeholder="What should ModeMesh do?"
                />
                <button type="submit" disabled={!typedFallback.trim()} aria-label="Send command">
                  <TbSend aria-hidden="true" />
                </button>
              </div>
            </form>
          )}

          <footer className="voice-command-hints">
            Try “Hey ModeMesh, research today's AI news”, “repeat that”, or “start a new conversation”.
          </footer>
        </section>
      </main>
    </section>
  )
}

export default VoiceRoom
