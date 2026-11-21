import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, errorText, formatRuntime, type Movie, type RewatchOrder } from '../api'

/** Doomsday if present, otherwise the latest movie. */
const defaultTarget = (list: Movie[]) => list.find((m) => /doomsday/i.test(m.title)) ?? list[list.length - 1]

export default function RewatchPlan() {
  const [movies, setMovies] = useState<Movie[] | null>(null)
  const [plan, setPlan] = useState<RewatchOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [params, setParams] = useSearchParams()
  const targetId = Number(params.get('target')) || null

  useEffect(() => {
    api
      .listMovies()
      .then(setMovies)
      .catch((e) => setError(errorText(e)))
  }, [])

  // Keep the URL pointing at a real movie: fills in a default when ?target is
  // missing (first visit, or re-clicking the nav tab) or doesn't exist.
  useEffect(() => {
    if (!movies || movies.length === 0) return
    if (targetId && movies.some((m) => m.id === targetId)) return
    setParams({ target: String(defaultTarget(movies).id) }, { replace: true })
  }, [movies, targetId, setParams])

  useEffect(() => {
    if (!targetId || !movies?.some((m) => m.id === targetId)) return
    // Ignore responses that arrive after the target changed (or a newer refresh started).
    let cancelled = false
    api
      .rewatchOrder(targetId)
      .then((p) => {
        if (cancelled) return
        setPlan(p)
        setError(null)
      })
      .catch((e) => {
        if (!cancelled) setError(errorText(e))
      })
    return () => {
      cancelled = true
    }
  }, [targetId, movies, refresh])

  async function toggleWatched(m: Movie) {
    try {
      await api.updateMovie(m.id, { watched: !m.watched })
      setRefresh((n) => n + 1)
    } catch (e) {
      setError(errorText(e))
    }
  }

  // Only ever show the plan that belongs to the selected target. A refresh keeps
  // the current list on screen (no flicker), while a different target hides it.
  const shown = plan && plan.target.id === targetId ? plan : null
  const pct = shown && shown.total > 0 ? Math.round((shown.watchedCount / shown.total) * 100) : 0
  const list = movies ?? []

  return (
    <section>
      <h2>Rewatch Plan</h2>
      <div className="card">
        <label>
          Target movie
          <select
            value={targetId ?? ''}
            onChange={(e) => setParams({ target: e.target.value })}
            disabled={list.length === 0}
          >
            {list.length === 0 && <option value="">No movies yet</option>}
            {list.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      {shown && (
        <div className="card">
          {shown.total === 0 ? (
            <p>
              Nothing to catch up on: <strong>{shown.target.title}</strong> has no prerequisites.
            </p>
          ) : (
            <>
              <div className="progress-label">
                <span>
                  <strong>
                    {shown.watchedCount} of {shown.total}
                  </strong>{' '}
                  watched
                </span>
                <span>
                  {shown.unwatchedRuntimeMinutes === 0
                    ? 'All caught up!'
                    : `${formatRuntime(shown.unwatchedRuntimeMinutes)} left`}
                </span>
              </div>
              <div
                className="progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={shown.total}
                aria-valuenow={shown.watchedCount}
                aria-label="Rewatch progress"
              >
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>

              <ol className="plan">
                {shown.movies.map((m) => (
                  <li key={m.id} className={m.watched ? 'done' : ''}>
                    <label>
                      <input type="checkbox" checked={m.watched} onChange={() => toggleWatched(m)} />
                      <span className="grow">{m.title}</span>
                      <span className="muted">{formatRuntime(m.runtimeMinutes)}</span>
                    </label>
                  </li>
                ))}
              </ol>
              <p className="muted">
                Then watch <strong>{shown.target.title}</strong>.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  )
}
