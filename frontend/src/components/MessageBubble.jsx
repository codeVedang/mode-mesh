import { useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { TbCheck, TbCopy, TbExternalLink, TbSparkles, TbUser, TbX } from "react-icons/tb"

function MessageBubble({ role, content, images = [] }) {
  const isUser = role === "user"
  const [lightBox, setLightBox] = useState(null)
  const [copiedCode, setCopiedCode] = useState("")

  const copyCode = async (code) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(""), 2000)
  }

  return (
    <article className={`message-bubble ${isUser ? "is-user" : "is-assistant"}`}>
      <div className="message-speaker">
        <span>{isUser ? <TbUser aria-hidden="true" /> : <TbSparkles aria-hidden="true" />}</span>
        {isUser ? "You" : "ModeMesh AI"}
      </div>

      <div className="message-content">
        {images.length > 0 && (
          <div className="message-images">
            {images.map((image, index) => (
              <img
                key={`${image}-${index}`}
                src={image}
                alt=""
                onClick={() => setLightBox(image)}
                loading="lazy"
                onError={(event) => event.currentTarget.remove()}
              />
            ))}
          </div>
        )}

        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => <h1 className="message-h1">{children}</h1>,
            h2: ({ children }) => <h2 className="message-h2">{children}</h2>,
            h3: ({ children }) => <h3 className="message-h3">{children}</h3>,
            p: ({ children }) => <p>{children}</p>,
            ul: ({ children }) => <ul>{children}</ul>,
            ol: ({ children }) => <ol>{children}</ol>,
            table: ({ children }) => (
              <div className="message-table-wrap">
                <table>{children}</table>
              </div>
            ),
            th: ({ children }) => <th>{children}</th>,
            td: ({ children }) => <td>{children}</td>,
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
                <TbExternalLink aria-hidden="true" />
              </a>
            ),
            code: ({ className, children }) => {
              const value = String(children).trim()

              if (!className) {
                return <code className="message-inline-code">{value}</code>
              }

              const language = className.replace("language-", "")

              return (
                <div className="message-code">
                  <div className="message-code-head">
                    <span>{language}</span>
                    <button type="button" onClick={() => copyCode(value)}>
                      {copiedCode === value ? <TbCheck aria-hidden="true" /> : <TbCopy aria-hidden="true" />}
                      {copiedCode === value ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <SyntaxHighlighter
                    language={language}
                    style={oneDark}
                    wrapLongLines
                    showLineNumbers
                    customStyle={{
                      background: "#111111",
                      fontSize: "13px",
                      margin: 0,
                      padding: "16px",
                    }}
                  >
                    {value}
                  </SyntaxHighlighter>
                </div>
              )
            },
            img: ({ src }) => {
              if (!src) return null
              return (
                <img
                  src={src}
                  alt=""
                  onClick={() => setLightBox(src)}
                  loading="lazy"
                  onError={(event) => event.currentTarget.remove()}
                />
              )
            },
          }}
        >
          {content}
        </Markdown>
      </div>

      {lightBox && (
        <div className="message-lightbox">
          <button type="button" onClick={() => setLightBox(null)} aria-label="Close image">
            <TbX aria-hidden="true" />
          </button>
          <img src={lightBox} alt="" />
        </div>
      )}
    </article>
  )
}

export default MessageBubble
