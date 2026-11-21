import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, errorText, formatRuntime, type Movie, type RewatchOrder } from '../api'

export default function RewatchPlan() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [plan, setPlan] = useState<RewatchOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const targetId = Number(params.get('target')) || null

  useEffect(() => {
    api
      .listMovies()
      .then((list) => {
        setMovies(list)
        // Default to Doomsday (or the latest movie) so the page shows something useful.
        if (!targetId && list.length) {
          const pick = list.find((m) => /doomsday/i.test(m.title)) ?? list[list.length - 1]
          setParams({ target: String(pick.id) }, { replace: true })
        }
      })
      .catch((e) => setError(errorText(e)))
  }, [])

  const loadPlan = useCallback(() => {
    if (!targetId) return
    api
      .rewatchOrder(targetId)
      .then((p) => {
        setPlan(p)
        setError(null)
      })
      .catch((e) => {
        setPlan(null)
        setError(errorText(e))
      })
  }, [targetId])

  useEffect(loadPlan, [loadPlan])

  async function toggleWatched(m: Movie) {
    try {
      await api.updateMovie(m.id, { watched: !m.watched })
      loadPlan()
    } catch (e) {
      setError(errorText(e))
    }
  }

  const pct = plan && plan.total > 0 ? Math.round((plan.watchedCount / plan.total) * 100) : 0

  return (
    <section>
      <h2>Rewatch Plan</h2>
      <div className="card">
        <label>
          Target movie
          <select
            value={targetId ?? ''}
            onChange={(e) => setParams({ target: e.target.value })}
            disabled={movies.length === 0}
          >
            {movies.length === 0 && <option value="">No movies yet</option>}
            {movies.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      {plan && (
        <div className="card">
          {plan.total === 0 ? (
            <p>
              Nothing to catch up on: <strong>{plan.target.title}</strong> has no prerequisites.
            </p>
          ) : (
            <>
              <div className="progress-label">
                <span>
                  <strong>
                    {plan.watchedCount} of {plan.total}
                  </strong>{' '}
                  watched
                </span>
                <span>
                  {plan.unwatchedRuntimeMinutes === 0
                    ? 'All caught up!'
                    : `${formatRuntime(plan.unwatchedRuntimeMinutes)} left`}
                </span>
              </div>
              <div
                className="progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={plan.total}
                aria-valuenow={plan.watchedCount}
                aria-label="Rewatch progress"
              >
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>

              <ol className="plan">
                {plan.movies.map((m) => (
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
                Then watch <strong>{plan.target.title}</strong>.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  )
}
