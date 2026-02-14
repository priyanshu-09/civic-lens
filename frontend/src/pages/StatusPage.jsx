import { useEffect, useState } from 'react'
import { client } from '../api/client'

export default function StatusPage({ runId, onReviewReady }) {
  const [status, setStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let timer

    const poll = async () => {
      try {
        const [statusResp, logResp] = await Promise.all([
          client.get(`/api/runs/${runId}/status`),
          client.get(`/api/runs/${runId}/logs?tail=30`),
        ])
        setStatus(statusResp.data)
        setLogs(logResp.data.lines || [])
        if (statusResp.data.state === 'READY_FOR_REVIEW' || statusResp.data.state === 'EXPORTED') {
          onReviewReady()
          return
        }
      } catch (err) {
        setError(err?.response?.data?.detail || err.message)
      }
      timer = setTimeout(poll, 2000)
    }

    poll()
    return () => clearTimeout(timer)
  }, [runId, onReviewReady])

  return (
    <div className="panel">
      <h2>Run Status</h2>
      <p><b>Run ID:</b> {runId}</p>
      {status && (
        <>
          <p><b>State:</b> {status.state}</p>
          <p><b>Stage:</b> {status.stage}</p>
          <p><b>Progress:</b> {status.progress_pct}%</p>
          {status.error_message && <p className="error"><b>Error:</b> {status.error_message}</p>}
        </>
      )}
      {error && <p className="error">{error}</p>}

      <h3>Pipeline Logs</h3>
      <div className="logbox">
        {logs.map((line, idx) => (
          <div key={idx}>
            [{line.stage}] {line.event}: {line.message}
          </div>
        ))}
      </div>
    </div>
  )
}
