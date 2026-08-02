import { useCallback, useEffect, useRef, useState } from "react"

export function useSpeechRecognition({ language = "en-US", onTranscript } = {}) {
  const recognitionRef = useRef(null)
  const onTranscriptRef = useRef(onTranscript)
  const [supported] = useState(
    () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
  )
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

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
    }

    recognition.onresult = (event) => {
      let nextTranscript = ""

      for (let index = 0; index < event.results.length; index += 1) {
        nextTranscript += event.results[index][0].transcript
      }

      const normalizedTranscript = nextTranscript.trimStart()
      setTranscript(normalizedTranscript)
      onTranscriptRef.current?.(normalizedTranscript)
    }

    recognition.onerror = (event) => {
      if (event.error !== "aborted") {
        setError(event.error === "not-allowed"
          ? "Microphone access was not allowed."
          : "I could not hear that clearly. Try again.")
      }
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
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
