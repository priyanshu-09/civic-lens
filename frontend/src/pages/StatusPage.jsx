import { useEffect, useState } from 'react'
import { client } from '../api/client'

export default function StatusPage({ runId, onReviewReady }) {
  const [status, setStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let statusTimer
    let logsTimer
    let stopped = false

    const pollStatus = async () => {
      if (stopped) return
      try {
        const statusResp = await client.get(`/api/runs/${runId}/status`)
        setStatus(statusResp.data)
        if (statusResp.data.state === 'READY_FOR_REVIEW' || statusResp.data.state === 'EXPORTED') {
          stopped = true
          onReviewReady()
          return
        }
        if (statusResp.data.state === 'FAILED') {
          stopped = true
          return
        }
      } catch (err) {
        setError(err?.response?.data?.detail || err.message)
        stopped = true
        return
      }
      statusTimer = setTimeout(pollStatus, 2000)
    }

    const pollLogs = async () => {
      if (stopped) return
      try {
        const logResp = await client.get(`/api/runs/${runId}/logs?tail=40`)
        setLogs(logResp.data.lines || [])
      } catch (err) {
        setError(err?.response?.data?.detail || err.message)
      }
      logsTimer = setTimeout(pollLogs, 6000)
    }

    pollStatus()
    pollLogs()
    return () => {
      stopped = true
      clearTimeout(statusTimer)
      clearTimeout(logsTimer)
    }
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
          {status.stage_message && <p><b>Details:</b> {status.stage_message}</p>}
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
