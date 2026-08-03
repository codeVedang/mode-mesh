import { useCallback, useEffect, useRef, useState } from "react"

const recognitionErrors = {
  "audio-capture": "No microphone was detected. Check your audio input and try again.",
  network: "The browser voice service lost its connection. Reconnecting…",
  "no-speech": "I didn't hear anything. Listening again…",
  "not-allowed": "Microphone access was not allowed.",
  "service-not-allowed": "Voice recognition is blocked by this browser or device.",
}

export function useSpeechRecognition({
  language = "en-US",
  onEnd,
  onError,
  onFinalTranscript,
  onStart,
  onTranscript,
} = {}) {
  const recognitionRef = useRef(null)
  const onEndRef = useRef(onEnd)
  const onErrorRef = useRef(onError)
  const onFinalTranscriptRef = useRef(onFinalTranscript)
  const onStartRef = useRef(onStart)
  const onTranscriptRef = useRef(onTranscript)
  const [supported] = useState(
    () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
  )
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    onEndRef.current = onEnd
    onErrorRef.current = onError
    onFinalTranscriptRef.current = onFinalTranscript
    onStartRef.current = onStart
    onTranscriptRef.current = onTranscript
  }, [onEnd, onError, onFinalTranscript, onStart, onTranscript])

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!Recognition) return undefined

    const recognition = new Recognition()
    recognition.lang = language
    recognition.interimResults = true
    recognition.continuous = true

    recognition.onstart = () => {
      setError("")
      setListening(true)
      onStartRef.current?.()
    }

    recognition.onresult = (event) => {
      let nextTranscript = ""
      let hasFinalResult = false

      for (let index = 0; index < event.results.length; index += 1) {
        nextTranscript += `${event.results[index][0].transcript} `
        hasFinalResult ||= event.results[index].isFinal
      }

      const normalizedTranscript = nextTranscript.trim()
      setTranscript(normalizedTranscript)
      onTranscriptRef.current?.(normalizedTranscript)

      if (hasFinalResult) {
        onFinalTranscriptRef.current?.(normalizedTranscript)
      }
    }

    recognition.onerror = (event) => {
      if (event.error !== "aborted") {
        setError(recognitionErrors[event.error]
          || "I could not hear that clearly. Listening again…")
      }
      setListening(false)
      onErrorRef.current?.(event.error)
    }

    recognition.onend = () => {
      setListening(false)
      onEndRef.current?.()
    }

    recognitionRef.current = recognition

    return () => {
      recognition.abort()
      recognitionRef.current = null
    }
  }, [language])

  const start = useCallback(() => {
    if (!recognitionRef.current || listening) return

    try {
      recognitionRef.current.start()
    } catch {
      setError("The microphone is already starting.")
    }
  }, [listening])

  const stop = useCallback(() => {
    if (!recognitionRef.current || !listening) return
    recognitionRef.current.stop()
  }, [listening])

  const toggle = useCallback(() => {
    if (listening) {
      stop()
    } else {
      start()
    }
  }, [listening, start, stop])

  const clear = useCallback(() => {
    setTranscript("")
    setError("")
  }, [])

  return {
    clear,
    error,
    listening,
    setTranscript,
    start,
    stop,
    supported,
    toggle,
    transcript,
  }
}
