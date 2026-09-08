export const STEPS = ['research', 'compare', 'pdf', 'slides']
export const LABELS = { research: 'Research sources', compare: 'Build comparison', pdf: 'Create PDF report', slides: 'Create five-slide deck' }
export { MISSION_COST as COST } from '../../../shared/missionCosts.js'

export function inputText(value, name, max = 1200) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw Object.assign(new Error(`${name} is required (maximum ${max} characters).`), { status: 400 })
  }
  return value.trim()
}

export function normalizeSources(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw
  const seen = new Set()
  return (Array.isArray(data) ? data : data?.results || []).flatMap(item => {
    try {
      const url = new URL(item.url)
      if (!['http:', 'https:'].includes(url.protocol) || seen.has(url.href) || !item.content) return []
      seen.add(url.href)
      return [{ id: `S${seen.size}`, title: String(item.title || url.hostname).slice(0, 200), url: url.href,
        content: String(item.content).slice(0, 4500) }]
    } catch { return [] }
  }).slice(0, 8)
}

export function parseComparison(content, sources) {
  const data = JSON.parse(String(content).replace(/^```(?:json)?\s*|\s*```$/g, '').trim())
  const sourceIds = new Set(sources.map(source => source.id))
  const text = (value, max) => inputText(value, 'Generated content', max)
  const evidence = refs => {
    if (!Array.isArray(refs) || refs.length === 0 || refs.some(ref => !sourceIds.has(ref))) {
      throw new Error('The comparison included missing or unknown source references. Retry the comparison step.')
    }
    return [...new Set(refs)]
  }
  if (!Array.isArray(data.rows) || data.rows.length < 2 || data.rows.length > 5) throw new Error('Expected two to five comparison entries.')
  return {
    title: text(data.title, 120), summary: text(data.summary, 1200),
    rows: data.rows.map(row => ({ name: text(row.name, 100), offering: text(row.offering, 400),
      strength: text(row.strength, 400), limitation: text(row.limitation, 400), sourceIds: evidence(row.sourceIds) })),
    recommendation: text(data.recommendation, 1200), sourceIds: evidence(data.sourceIds),
    caveats: text(data.caveats, 800),
  }
}

export function reportData(mission) {
  const c = mission.comparison
  return {
    title: c.title, subtitle: `Prepared for ${mission.audience}`,
    sections: [
      { heading: 'Executive summary', points: [c.summary] },
      ...c.rows.map(row => ({ heading: row.name, points: [row.offering, `Strength: ${row.strength}`,
        `Limitation: ${row.limitation}`, `Sources: ${row.sourceIds.join(', ')}`] })),
      { heading: 'Recommendation', points: [c.recommendation, `Sources: ${c.sourceIds.join(', ')}`] },
      { heading: 'Evidence limitations', points: [c.caveats] },
      { heading: 'Sources', points: mission.sources.map(s => `[${s.id}] ${s.title}: ${s.url}`) },
    ],
  }
}

export function slideData(mission) {
  const c = mission.comparison
  return { title: c.title, subtitle: `Prepared for ${mission.audience}`, slides: [
    { title: 'The opportunity', points: [c.summary] },
    { title: 'Comparison', points: c.rows.map(row => `${row.name}: ${row.offering} [${row.sourceIds.join(', ')}]`) },
    { title: 'Recommendation', points: [c.recommendation, `Evidence limits: ${c.caveats}`] },
    { title: 'Sources', points: mission.sources.slice(0, 5).map(s => `[${s.id}] ${s.url}`) },
  ] }
}
