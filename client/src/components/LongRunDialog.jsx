import { useEffect, useRef, useState } from 'react'
import { RUN_LIMIT_MS } from '../api'

function LongRunDialog({ startedAt, onStop, onKeep }) {
  const [now, setNow] = useState(() => Date.now())
  const stopRef = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  useEffect(() => stopRef.current?.focus(), [startedAt])

  if (startedAt == null) return null
  const left = Math.max(0, Math.ceil((RUN_LIMIT_MS - (now - startedAt)) / 1000))
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/80"
      onKeyDown={(e) => e.key === 'Escape' && onKeep()}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="longrun-title" className="frame p-6 w-80 text-center">
        <h2 id="longrun-title" className="font-heading font-bold text-bone mb-2">This is taking longer than usual</h2>
        <p className="text-mute mb-1">The run is stopped automatically after 1 minute.</p>
        <p data-testid="longrun-countdown" className="font-mono text-2xl text-brass mb-4">
          {left > 0 ? clock : 'Finishing up…'}
        </p>
        <div className="flex gap-2 justify-center">
          <button ref={stopRef} onClick={onStop} className="btn btn-primary">
            Stop
          </button>
          <button onClick={onKeep} className="btn btn-quiet">
            Keep waiting
          </button>
        </div>
      </div>
    </div>
  )
}

export default LongRunDialog
