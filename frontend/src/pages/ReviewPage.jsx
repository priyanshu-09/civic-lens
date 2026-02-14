import { useEffect, useMemo, useState } from 'react'
import { client } from '../api/client'

export default function ReviewPage({ runId }) {
  const [events, setEvents] = useState([])
  const [trace, setTrace] = useState({ packets: [] })
  const [decisions, setDecisions] = useState({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.start_time - b.start_time), [events])

  useEffect(() => {
    const load = async () => {
      try {
        const [eventsResp, traceResp] = await Promise.all([
          client.get(`/api/runs/${runId}/events`),
          client.get(`/api/runs/${runId}/trace`),
        ])
        setEvents(eventsResp.data.events || [])
        setTrace(traceResp.data || { packets: [] })
      } catch (err) {
        setError(err?.response?.data?.detail || err.message)
      }
    }
    load()
  }, [runId])

  const traceByPacketId = useMemo(() => {
    const entries = Array.isArray(trace.packets) ? trace.packets : []
    const map = {}
    entries.forEach((entry) => {
      map[entry.packet_id] = entry
    })
    return map
  }, [trace])

  const saveDecision = async (eventId) => {
    const decision = decisions[eventId] || { decision: 'ACCEPT', reviewer_notes: '', include_plate: false }
    try {
      await client.post(`/api/runs/${runId}/events/${eventId}/review`, decision)
      setMessage(`Saved decision for ${eventId}`)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    }
  }

  const exportPack = async () => {
    try {
      const resp = await client.get(`/api/runs/${runId}/export`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(resp.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `case_pack_${runId}.zip`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    }
  }

  const artifactUrl = (path) => {
    if (!path) return ''
    const encoded = encodeURIComponent(path)
    return `${client.defaults.baseURL}/api/runs/${runId}/artifact?path=${encoded}`
  }

  return (
    <div className="panel">
      <h2>Review Violations</h2>
      <p><b>Run ID:</b> {runId}</p>

      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      {sortedEvents.length === 0 && <p>No events yet.</p>}
      {sortedEvents.map((event) => (
        <div key={event.event_id} className="event-card">
          <h3>{event.event_type}</h3>
          <p><b>ID:</b> {event.event_id}</p>
          <p><b>Packet ID:</b> {event.packet_id || 'N/A'}</p>
          <p><b>Source:</b> {event.source_stage || 'N/A'}</p>
          <p><b>Window:</b> {event.start_time.toFixed(2)}s - {event.end_time.toFixed(2)}s</p>
          <p><b>Confidence:</b> {event.confidence.toFixed(2)}</p>
          <p><b>Risk:</b> {event.risk_score.toFixed(1)}</p>
          <p><b>Summary:</b> {event.explanation_short}</p>
          <p><b>Uncertain:</b> {event.uncertain ? 'Yes' : 'No'}</p>
          {Array.isArray(event.evidence_frames) && event.evidence_frames.length > 0 && (
            <div className="evidence-strip">
              {event.evidence_frames.slice(0, 3).map((img, idx) => (
                <a key={idx} href={artifactUrl(img)} target="_blank" rel="noreferrer">
                  <img src={artifactUrl(img)} alt={`${event.event_id}-${idx + 1}`} className="evidence-thumb" />
                </a>
              ))}
            </div>
          )}

          {traceByPacketId[event.packet_id] && (
            <details className="trace-panel">
              <summary>Lineage Trace</summary>
              <p><b>Local:</b> {traceByPacketId[event.packet_id]?.local?.proposed_event_type} (score {traceByPacketId[event.packet_id]?.local?.local_score})</p>
              <p><b>Flash:</b> {traceByPacketId[event.packet_id]?.flash?.status || 'N/A'}</p>
              <p><b>Pro:</b> {traceByPacketId[event.packet_id]?.pro?.status || 'N/A'}</p>
              {Array.isArray(traceByPacketId[event.packet_id]?.local?.reason_codes) && (
                <p><b>Reasons:</b> {traceByPacketId[event.packet_id].local.reason_codes.join(', ')}</p>
              )}
            </details>
          )}

          <label className="field">
            <span>Decision</span>
            <select
              value={(decisions[event.event_id] || {}).decision || 'ACCEPT'}
              onChange={(e) => setDecisions((d) => ({ ...d, [event.event_id]: { ...(d[event.event_id] || {}), decision: e.target.value } }))}
            >
              <option value="ACCEPT">ACCEPT</option>
              <option value="REJECT">REJECT</option>
            </select>
          </label>

          <label className="field">
            <span>Reviewer Notes</span>
            <textarea
              rows={3}
              value={(decisions[event.event_id] || {}).reviewer_notes || ''}
              onChange={(e) => setDecisions((d) => ({ ...d, [event.event_id]: { ...(d[event.event_id] || {}), reviewer_notes: e.target.value } }))}
            />
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={(decisions[event.event_id] || {}).include_plate || false}
              onChange={(e) => setDecisions((d) => ({ ...d, [event.event_id]: { ...(d[event.event_id] || {}), include_plate: e.target.checked } }))}
            />
            Include plate in report
          </label>

          <button onClick={() => saveDecision(event.event_id)}>Save Decision</button>
        </div>
      ))}

      <button className="export-btn" onClick={exportPack}>Export Case Pack</button>
    </div>
  )
}
