import { useState } from 'react'
import { client } from '../api/client'

const defaultRoi = {
  stop_line_polygon: [[0.15, 0.7], [0.85, 0.7], [0.85, 0.74], [0.15, 0.74]],
  signal_roi_polygon: [[0.75, 0.05], [0.95, 0.05], [0.95, 0.25], [0.75, 0.25]],
  wrong_side_lane_polygon: [[0.0, 0.55], [0.45, 0.55], [0.45, 1.0], [0.0, 1.0]],
  expected_direction_vector: [1.0, 0.0],
}

export default function UploadPage({ onRunCreated }) {
  const [file, setFile] = useState(null)
  const [roiText, setRoiText] = useState(JSON.stringify(defaultRoi, null, 2))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!file) {
      setError('Select a video file first')
      return
    }
    setLoading(true)
    setError('')

    try {
      const form = new FormData()
      form.append('video', file)
      form.append('roi_config_json', roiText)
      const createResp = await client.post('/api/runs', form)
      const runId = createResp.data.run_id
      await client.post(`/api/runs/${runId}/start`)
      onRunCreated(runId)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel">
      <h2>Upload Video</h2>
      <p>Upload a 30-90s daytime dashcam clip and start analysis.</p>

      <label className="field">
        <span>Video File</span>
        <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>

      <label className="field">
        <span>ROI Config (JSON)</span>
        <textarea value={roiText} onChange={(e) => setRoiText(e.target.value)} rows={12} />
      </label>

      {error && <p className="error">{error}</p>}
      <button onClick={submit} disabled={loading}>{loading ? 'Starting...' : 'Analyze'}</button>
    </div>
  )
}
