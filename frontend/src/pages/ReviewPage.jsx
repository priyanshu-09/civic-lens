import { useEffect, useMemo, useState } from 'react'
import { client } from '../api/client'

export default function ReviewPage({ runId }) {
  const [events, setEvents] = useState([])
  const [trace, setTrace] = useState({ packets: [] })
  const [status, setStatus] = useState(null)
  const [decisions, setDecisions] = useState({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [provisional, setProvisional] = useState(true)

  const sortedEvents = useMemo(() => [...events].sort((a, b) => Number(a.start_time || 0) - Number(b.start_time || 0)), [events])

  useEffect(() => {
    let timer
    let stopped = false
    let lastKnownState = ''

    const poll = async () => {
      if (stopped) return
      try {
        const [statusResp, eventsResp, traceResp] = await Promise.all([
          client.get(`/api/runs/${runId}/status`),
          client.get(`/api/runs/${runId}/events`),
          client.get(`/api/runs/${runId}/trace`),
        ])
        lastKnownState = statusResp.data?.state || lastKnownState
        setStatus(statusResp.data)
        setEvents(eventsResp.data.events || [])
        setTrace(traceResp.data || { packets: [] })
        const isProv = Boolean(eventsResp.data?.provisional || traceResp.data?.provisional)
        setProvisional(isProv)
      } catch (err) {
        setError(err?.response?.data?.detail || err.message)
      }

      const done = ['READY_FOR_REVIEW', 'EXPORTED', 'FAILED'].includes(lastKnownState)
      timer = setTimeout(poll, done ? 5000 : 2000)
    }

    poll()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [runId])

  const traceByPacketId = useMemo(() => {
    const entries = Array.isArray(trace.packets) ? trace.packets : []
    const map = {}
    entries.forEach((entry) => {
      map[entry.packet_id] = entry
    })
    return map
  }, [trace])

  const livePackets = useMemo(() => {
    const entries = Array.isArray(trace.packets) ? trace.packets : []
    return [...entries].sort((a, b) => {
      const aScore = Number(a?.local?.local_score || 0)
      const bScore = Number(b?.local?.local_score || 0)
      return bScore - aScore
    })
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
      {status && (
        <p>
          <b>State:</b> {status.state} | <b>Stage:</b> {status.stage} | <b>Progress:</b> {status.progress_pct}%
        </p>
      )}
      <p><b>Mode:</b> {provisional ? 'LIVE (updating)' : 'FINAL'}</p>

      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      {sortedEvents.length === 0 && livePackets.length === 0 && <p>No events yet.</p>}

      {sortedEvents.length === 0 && livePackets.length > 0 && (
        <>
          <h3>Live Packet Monitor</h3>
          {livePackets.map((packet) => (
            <div key={packet.packet_id} className="event-card">
              <p><b>Packet:</b> {packet.packet_id}</p>
              <p><b>Local:</b> {packet.local?.proposed_event_type || 'N/A'} (score {Number(packet.local?.local_score || 0).toFixed(3)})</p>
              <p><b>Routing:</b> {(packet.routing?.routing_reason || []).join(', ') || 'pending'}</p>
              <p><b>Flash:</b> {packet.flash?.status || 'pending'} | <b>Pro:</b> {packet.pro?.status || 'pending'}</p>
              {Array.isArray(packet.anchor_frames) && packet.anchor_frames.length > 0 && (
                <div className="evidence-strip">
                  {packet.anchor_frames.slice(0, 3).map((frame, idx) => (
                    <a key={idx} href={artifactUrl(frame.path)} target="_blank" rel="noreferrer">
                      <img src={artifactUrl(frame.path)} alt={`${packet.packet_id}-${idx + 1}`} className="evidence-thumb" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {sortedEvents.map((event) => {
        const start = Number(event.start_time || 0)
        const end = Number(event.end_time || 0)
        const confidence = Number(event.confidence || 0)
        const risk = Number(event.risk_score || 0)
        return (
          <div key={event.event_id} className="event-card">
            <h3>{event.event_type}</h3>
            <p><b>ID:</b> {event.event_id}</p>
            <p><b>Packet ID:</b> {event.packet_id || 'N/A'}</p>
            <p><b>Source:</b> {event.source_stage || 'N/A'} {event.provisional ? '(live)' : ''}</p>
            <p><b>Window:</b> {start.toFixed(2)}s - {end.toFixed(2)}s</p>
            <p><b>Confidence:</b> {confidence.toFixed(2)}</p>
            <p><b>Risk:</b> {risk.toFixed(1)}</p>
            <p><b>Summary:</b> {event.explanation_short}</p>
            <p><b>Uncertain:</b> {event.uncertain ? 'Yes' : 'No'}</p>
            <p><b>Plate:</b> {event.plate_text || 'N/A'} {event.plate_confidence != null ? `(conf ${Number(event.plate_confidence).toFixed(2)})` : ''}</p>
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
                <p><b>Routing:</b> {(traceByPacketId[event.packet_id]?.routing?.routing_reason || []).join(', ') || 'N/A'}</p>
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
        )
      })}

      <button className="export-btn" onClick={exportPack}>Export Case Pack</button>
    </div>
  )
}
