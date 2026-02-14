import { useState } from 'react'
import UploadPage from './pages/UploadPage'
import StatusPage from './pages/StatusPage'
import ReviewPage from './pages/ReviewPage'

export default function App() {
  const [runId, setRunId] = useState('')
  const [screen, setScreen] = useState('upload')

  return (
    <div className="app">
      <header>
        <h1>Civic Lens</h1>
        <p>Hackathon PoC: local proposal engine + Gemini verification + manual review</p>
      </header>

      {screen === 'upload' && (
        <UploadPage
          onRunCreated={(id) => {
            setRunId(id)
            setScreen('status')
          }}
        />
      )}

      {screen === 'status' && runId && (
        <StatusPage
          runId={runId}
          onReviewReady={() => setScreen('review')}
        />
      )}

      {screen === 'review' && runId && <ReviewPage runId={runId} />}

      {screen !== 'upload' && (
        <div className="actions">
          <button onClick={() => setScreen('upload')}>New Run</button>
          {runId && <button onClick={() => setScreen('status')}>Status</button>}
          {runId && <button onClick={() => setScreen('review')}>Review</button>}
        </div>
      )}
    </div>
  )
}
