import {
  TbCheck,
  TbCircleDashed,
  TbLoader2,
  TbRoute,
  TbX,
} from "react-icons/tb"

const pendingSteps = [
  { id: "plan", label: "Plan the request", agent: "Planner", status: "running" },
  { id: "supervise", label: "Validate route and policy", agent: "Supervisor", status: "pending" },
  { id: "execute", label: "Run the specialist workflow", agent: "Worker", status: "pending" },
  { id: "verify", label: "Verify result and deliverables", agent: "Supervisor", status: "pending" },
]

const StepIcon = ({ status }) => {
  if (status === "completed") return <TbCheck aria-hidden="true" />
  if (status === "failed") return <TbX aria-hidden="true" />
  if (status === "running") return <TbLoader2 className="execution-spinner" aria-hidden="true" />
  return <TbCircleDashed aria-hidden="true" />
}

function ExecutionTimeline({ execution, pending = false }) {
  if (!execution && !pending) return null

  const steps = execution?.steps?.length ? execution.steps : pendingSteps
  const status = execution?.status || "running"
  const duration = Number.isFinite(execution?.durationMs)
    ? `${(execution.durationMs / 1000).toFixed(1)}s`
    : "Live"

  return (
    <section className={`execution-timeline execution-${status}`}>
      <header>
        <div>
          <TbRoute aria-hidden="true" />
          <span>Agent execution</span>
        </div>
        <small>{execution?.selectedAgent || "Auto routing"} · {duration}</small>
      </header>

      {execution?.plan?.length > 0 && (
        <p className="execution-objective">{execution.objective}</p>
      )}

      <div className="execution-steps">
        {steps.map((step) => (
          <div className={`execution-step is-${step.status}`} key={step.id}>
            <span className="execution-step-icon"><StepIcon status={step.status} /></span>
            <span>
              <strong>{step.label}</strong>
              <small>{step.detail || step.agent}</small>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default ExecutionTimeline
