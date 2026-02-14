import { useEffect, useMemo, useState } from 'react'
import { client } from '../api/client'

export default function ReviewPage({ runId }) {
  const [events, setEvents] = useState([])
  const [decisions, setDecisions] = useState({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.start_time - b.start_time), [events])

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await client.get(`/api/runs/${runId}/events`)
        setEvents(resp.data.events || [])
      } catch (err) {
        setError(err?.response?.data?.detail || err.message)
      }
    }
    load()
  }, [runId])

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
          <p><b>Window:</b> {event.start_time.toFixed(2)}s - {event.end_time.toFixed(2)}s</p>
          <p><b>Confidence:</b> {event.confidence.toFixed(2)}</p>
          <p><b>Risk:</b> {event.risk_score.toFixed(1)}</p>
          <p><b>Summary:</b> {event.explanation_short}</p>
          <p><b>Uncertain:</b> {event.uncertain ? 'Yes' : 'No'}</p>

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
