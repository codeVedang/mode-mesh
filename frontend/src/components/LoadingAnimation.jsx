import { useEffect, useState } from "react"
import { TbSparkles } from "react-icons/tb"

const thinkingLabels = ["Thinking", "Analyzing", "Reasoning", "Generating"]

function LoadingAnimation() {
  const [labelIndex, setLabelIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setLabelIndex((previous) => (previous + 1) % thinkingLabels.length)
    }, 1800)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="cortex-thinking" role="status" aria-live="polite">
      <span>
        <TbSparkles aria-hidden="true" />
      </span>
      <div>
        <strong>ModeMesh AI</strong>
        <small>{thinkingLabels[labelIndex]}…</small>
      </div>
    </div>
  )
}

export default LoadingAnimation
