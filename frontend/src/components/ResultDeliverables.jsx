import {
  TbArrowUpRight,
  TbDownload,
  TbFileTypePdf,
  TbPhoto,
  TbPresentation,
  TbSparkles,
} from "react-icons/tb"

const deliverableMeta = {
  image: { action: "Download image", icon: TbPhoto },
  pdf: { action: "Download PDF", icon: TbFileTypePdf },
  ppt: { action: "Download presentation", icon: TbPresentation },
}

function ResultDeliverables({ artifacts = [], compact = false, deliverables = [], onOpenArtifact }) {
  if (deliverables.length === 0 && artifacts.length === 0) return null

  return (
    <div className={`result-deliverables ${compact ? "is-compact" : ""}`}>
      {deliverables.map((deliverable, index) => {
        const meta = deliverableMeta[deliverable.type] || {
          action: "Download file",
          icon: TbDownload,
        }
        const Icon = meta.icon

        return (
          <a
            className={`result-deliverable result-${deliverable.type || "file"}`}
            download={deliverable.name || true}
            href={deliverable.url}
            key={`${deliverable.name}-${index}`}
            rel="noreferrer"
            target="_blank"
          >
            <Icon aria-hidden="true" />
            <span>
              <strong>{meta.action}</strong>
              {!compact && <small>{deliverable.label || deliverable.name}</small>}
            </span>
            <TbDownload aria-hidden="true" />
          </a>
        )
      })}

      {artifacts.length > 0 && (onOpenArtifact ? (
        <button type="button" className="result-deliverable result-project" onClick={onOpenArtifact}>
          <TbSparkles aria-hidden="true" />
          <span>
            <strong>Open generated project</strong>
            {!compact && <small>{artifacts[0]?.title || "Code workspace"}</small>}
          </span>
          <TbArrowUpRight aria-hidden="true" />
        </button>
      ) : (
        <div className="result-deliverable result-project">
          <TbSparkles aria-hidden="true" />
          <span>
            <strong>Project ready in workspace</strong>
            {!compact && <small>{artifacts[0]?.title || "Code workspace"}</small>}
          </span>
          <TbArrowUpRight aria-hidden="true" />
        </div>
      ))}
    </div>
  )
}

export default ResultDeliverables
