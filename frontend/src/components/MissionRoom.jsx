import { useEffect, useRef, useState } from 'react'
import { TbArrowLeft, TbArrowRight, TbCheck, TbDownload, TbMicrophone, TbPlayerStop, TbRoute, TbSearch, TbSparkles } from 'react-icons/tb'
import api from '../../utils/axios'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import './missions.css'

const EXAMPLE = 'Compare Notion, Trello, and Asana for a student project team. Research their strengths and limitations, then prepare a recommendation report and a five-slide presentation.'
const PLAN = ['Research sources', 'Build comparison', 'Create PDF report', 'Create five-slide deck']
const errorMessage = error => error.response?.data?.message || 'Connection interrupted. Your saved work is safe. Please retry.'

function MissionRoom({ onBack, initialPrompt = '' }) {
  const [selectedId, setSelectedId] = useState(() => {
    const id = new URLSearchParams(window.location.search).get('mission')
    return /^[a-f0-9]{24}$/.test(id || '') ? id : null
  })
  const [mission, setMission] = useState(null)
  const [recent, setRecent] = useState([])
  const [objective, setObjective] = useState(initialPrompt)
  const [audience, setAudience] = useState('')
  const [revision, setRevision] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [connection, setConnection] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [voiceTarget, setVoiceTarget] = useState('objective')
  const requestId = useRef(crypto.randomUUID())
  const revisionId = useRef(crypto.randomUUID())
  const locked = useRef(false)
  const hydratedId = useRef(null)
  const roomRef = useRef(null)
  const speech = useSpeechRecognition({ onTranscript: text => {
    if (voiceTarget === 'revision') setRevision(text)
    else setObjective(text)
  } })

  useEffect(() => {
    const controller = new AbortController()
    api.get('/api/agent/missions', { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) { setRecent(data); setConnection('') } })
      .catch(() => { if (!controller.signal.aborted) setConnection('Recent missions could not be loaded. Use Refresh to retry.') })
    return () => controller.abort()
  }, [refresh])

  useEffect(() => {
    if (!selectedId) return undefined
    const controller = new AbortController()
    let timer
    const poll = async () => {
      let again = true
      try {
        const { data } = await api.get(`/api/agent/missions/${selectedId}`, { signal: controller.signal })
        if (controller.signal.aborted) return
        if (hydratedId.current !== selectedId) {
          hydratedId.current = selectedId
          setObjective(data.objective)
          setAudience(data.audience)
          setRevision(data.revision || '')
        }
        setMission(data)
        setRecent(previous => [data, ...previous.filter(item => item.id !== data.id)].slice(0, 30))
        setConnection('')
        again = data.status === 'running'
      } catch (err) {
        if (controller.signal.aborted) return
        setConnection(errorMessage(err))
        if ([401, 403, 404].includes(err.response?.status)) again = false
      }
      if (again && !controller.signal.aborted) timer = window.setTimeout(poll, 2500)
    }
    void poll()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [selectedId, refresh])

  const select = item => {
    roomRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    speech.stop()
    setSelectedId(item?.id || null)
    hydratedId.current = item?.id || null
    setMission(item)
    setError('')
    setRevision(item?.revision || '')
    setObjective(item?.objective || '')
    setAudience(item?.audience || '')
    requestId.current = crypto.randomUUID()
    revisionId.current = crypto.randomUUID()
    const url = new URL(window.location.href)
    url.searchParams.set('mission', item?.id || 'new')
    window.history.replaceState(null, '', url)
  }
  const perform = async action => {
    if (locked.current) return
    locked.current = true
    speech.stop()
    setBusy(true)
    setError('')
    try { await action(); setRefresh(value => value + 1) }
    catch (err) { setError(errorMessage(err)) }
    finally { locked.current = false; setBusy(false) }
  }
  const draft = () => perform(async () => {
    const { data } = await api.post('/api/agent/missions', { objective, audience, requestId: requestId.current })
    select(data)
  })
  const saveDraft = () => perform(async () => {
    const { data } = await api.patch(`/api/agent/missions/${selectedId}`, { objective, audience, revision })
    setMission(data)
  })
  const transition = action => perform(async () => {
    const { data } = await api.post(`/api/agent/missions/${selectedId}/${action}`)
    setMission(data)
  })
  const revise = () => perform(async () => {
    const { data } = await api.post(`/api/agent/missions/${selectedId}/revise`, { revision, requestId: revisionId.current })
    select(data)
  })
  const download = type => perform(async () => {
    const { data } = await api.get(`/api/agent/missions/${selectedId}/files/${type}`)
    const anchor = document.createElement('a')
    anchor.href = data.url
    anchor.rel = 'noreferrer'
    anchor.download = type === 'pdf' ? 'report.pdf' : 'presentation.pptx'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  })
  const record = target => {
    setVoiceTarget(target)
    speech.toggle()
  }
  const editable = !selectedId || mission?.status === 'draft'
  const dirty = mission?.status === 'draft' && (mission.revision
    ? revision !== mission.revision : objective !== mission.objective || audience !== mission.audience)
  const comparison = mission?.comparison
  const citations = ids => ids?.map(id => {
    const source = mission.sources.find(item => item.id === id)
    return source ? <a className="mission-citation" key={id} href={source.url} target="_blank" rel="noreferrer">[{id}]</a> : null
  })

  return (
    <main className="mission-room" ref={roomRef}>
      <header className="mission-topbar">
        <button className="mission-back" onClick={onBack}><TbArrowLeft /> Workspace</button>
        <span><TbRoute /> MODEMESH / MISSIONS</span>
        <button className="mission-secondary" disabled={busy} onClick={() => select(null)}>New mission</button>
      </header>
      <div className="mission-layout">
        <aside className="mission-history" aria-label="Recent missions">
          <div className="mission-eyebrow">YOUR MISSIONS</div>
          <button className="mission-refresh" disabled={busy} onClick={() => setRefresh(value => value + 1)}>Refresh</button>
          {recent.length === 0 && <p>Your research and results will be saved here.</p>}
          {recent.map(item => <button key={item.id} disabled={busy} className={`mission-history-item ${item.id === selectedId ? 'active' : ''}`} onClick={() => select(item)}>
            <strong>{item.objective}</strong><span>{item.status} · {new Date(item.createdAt).toLocaleDateString()}</span>
          </button>)}
        </aside>
        <div className="mission-main">
          <div className="mission-eyebrow">ONE BRIEF. A COMPLETE RESULT.</div>
          <h1>{mission ? 'Your mission, in motion.' : 'Give your idea a team.'}</h1>
          <p className="mission-intro">Research the options. See the evidence. Leave with a report and a five-slide deck.</p>
          {(error || connection || speech.error) && <div role="alert" className="mission-error">{error || connection || speech.error}</div>}
          {selectedId && !mission && <p role="status">Loading your saved mission…</p>}

          {editable && <section className="mission-brief" aria-label="Mission brief">
            {mission?.revision ? <>
              <label htmlFor="mission-revision-draft">Revision instructions</label>
              <textarea id="mission-revision-draft" value={revision} onChange={event => setRevision(event.target.value)} maxLength={800} disabled={busy} />
              <p>Original brief: {mission.objective}</p>
            </> : <>
              <label htmlFor="mission-objective">What should we research and compare?</label>
              <textarea id="mission-objective" placeholder="Compare three tools for my team and prepare a recommendation…" value={objective} onChange={event => setObjective(event.target.value)} maxLength={1200} disabled={busy} />
              <label htmlFor="mission-audience">Who is this for?</label>
              <input id="mission-audience" placeholder="For example: college students building their first startup" value={audience} onChange={event => setAudience(event.target.value)} maxLength={200} disabled={busy} />
            </>}
            <div className="mission-actions">
              <button className="mission-secondary" disabled={!speech.supported || busy} onClick={() => record(mission?.revision ? 'revision' : 'objective')}><TbMicrophone /> {speech.listening ? 'Stop dictation' : 'Speak your brief'}</button>
              {!mission && <button className="mission-example" disabled={busy} onClick={() => { setObjective(EXAMPLE); setAudience('College students managing a group project') }}>Try an example</button>}
              <button className="mission-primary" disabled={busy || (!mission?.revision && (!objective.trim() || !audience.trim())) || (mission?.revision && !revision.trim())}
                onClick={mission ? saveDraft : draft}>{busy ? 'Saving…' : mission ? 'Save brief' : 'Review mission'} <TbArrowRight /></button>
            </div>
          </section>}

          {(mission || !selectedId) && <section className="mission-plan" aria-label="Mission plan">
            <div className="mission-section-head"><h2>{mission?.status === 'draft' || !mission ? 'The plan' : 'Execution'}</h2>
              <span aria-live="polite">{mission?.status || 'Ready when you are'}</span></div>
            <ol>{(mission?.steps || PLAN.map((label, index) => ({ id: index, label, status: 'pending' }))).map((step, index) => <li key={step.id} className={`mission-step ${step.status}`}>
              <span className="mission-step-number">{step.status === 'completed' ? <TbCheck /> : `0${index + 1}`}</span>
              <div><strong>{step.label}</strong><small>{step.status === 'running' ? 'Working now…' : step.status === 'completed' ? 'Saved' : step.status}</small></div>
            </li>)}</ol>
            {mission && <div className="mission-plan-footer">
              <p>{mission.paid ? `${mission.cost} credits charged. Retries use this payment.` : `${mission.cost} credits on start. Review and approve first.`}<br /><small>Cancellation stops further steps; started work is not refunded.</small></p>
              {['draft', 'failed', 'cancelled'].includes(mission.status) && <button className="mission-primary" disabled={busy || dirty} onClick={() => transition('start')}>
                {mission.status === 'draft' ? 'Approve & start' : 'Resume unfinished steps'} <TbArrowRight />
              </button>}
              {mission.status === 'running' && <button className="mission-secondary" disabled={busy} onClick={() => transition('cancel')}><TbPlayerStop /> Cancel mission</button>}
            </div>}
            {dirty && <p className="mission-note">Save your changes before approving the plan.</p>}
            {mission?.error && <p role="alert" className="mission-error">{mission.error}</p>}
            {mission?.status === 'running' && <p role="status" className="mission-note">{mission.paid ? 'Progress updates automatically. You can leave and return to this mission.' : 'Confirming credits before work begins…'}</p>}
          </section>}

          {mission?.sources?.length > 0 && <section className="mission-sources">
            <div className="mission-section-head"><h2><TbSearch /> Research collected</h2><span>{mission.sources.length} sources</span></div>
            <div className="mission-source-grid">{mission.sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer"><span>{source.id} · {new URL(source.url).hostname}</span><strong>{source.title}</strong><TbArrowRight /></a>)}</div>
          </section>}

          {comparison && <section className="mission-result">
            <div className="mission-eyebrow">THE FINDINGS</div><h2>{comparison.title}</h2><p>{comparison.summary} {citations(comparison.sourceIds)}</p>
            <div className="mission-table-scroll"><table><caption>Comparison for {mission.audience}</caption><thead><tr><th>Option</th><th>Offering</th><th>Strength</th><th>Limitation</th></tr></thead>
              <tbody>{comparison.rows.map((row, index) => <tr key={index}><th scope="row">{row.name}<div>{citations(row.sourceIds)}</div></th><td>{row.offering}</td><td>{row.strength}</td><td>{row.limitation}</td></tr>)}</tbody></table></div>
            <div className="mission-recommendation"><h3>Recommendation</h3><p>{comparison.recommendation} {citations(comparison.sourceIds)}</p></div>
            <p className="mission-note">Evidence limits: {comparison.caveats} Source links are checked against retrieved results; claims still need your review.</p>
          </section>}
          {mission?.files?.length > 0 && <section className="mission-downloads" aria-label="Download results">{mission.files.map(file => <button className="mission-download" key={file.type} disabled={busy} onClick={() => download(file.type)}><TbDownload /><span><strong>{file.type === 'pdf' ? 'Download PDF report' : 'Download five-slide deck'}</strong><small>{file.name}</small></span><TbArrowRight /></button>)}</section>}
          {mission?.status === 'completed' && <section className="mission-brief">
            <label htmlFor="mission-revision">Make it yours</label><p>Refine the audience or emphasis using the same research. Your original results stay saved.</p>
            <textarea id="mission-revision" placeholder="Make the recommendation suitable for college students on a small budget…" value={revision} onChange={event => setRevision(event.target.value)} maxLength={800} disabled={busy} />
            <div className="mission-actions"><button className="mission-secondary" disabled={!speech.supported || busy} onClick={() => record('revision')}><TbMicrophone /> {speech.listening ? 'Stop dictation' : 'Speak a revision'}</button>
              <button className="mission-primary" disabled={busy || !revision.trim()} onClick={revise}>Review revision · 21 credits <TbSparkles /></button></div>
          </section>}
        </div>
      </div>
    </main>
  )
}
export default MissionRoom
