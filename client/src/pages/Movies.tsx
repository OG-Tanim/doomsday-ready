import { useEffect, useState, type FormEvent } from 'react'
import { api, errorText, formatRuntime, type Movie } from '../api'
import PrereqPicker from '../components/PrereqPicker'

export default function Movies() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const reload = () =>
    api
      .listMovies()
      .then((list) => {
        setMovies(list)
        setLoadError(null)
      })
      .catch((e) => setLoadError(errorText(e)))

  useEffect(() => {
    reload()
  }, [])

  const titleOf = (id: number) => movies.find((m) => m.id === id)?.title ?? `#${id}`

  return (
    <section>
      <h2>Movies</h2>
      <AddMovieForm movies={movies} onAdded={reload} />

      {loadError && <p className="error">{loadError}</p>}
      {!loadError && movies.length === 0 && <p className="muted">No movies yet. Add one above.</p>}

      <ul className="movie-list">
        {movies.map((m) => (
          <MovieRow
            key={m.id}
            movie={m}
            movies={movies}
            titleOf={titleOf}
            editing={editingId === m.id}
            onEdit={() => setEditingId(m.id)}
            onDone={() => {
              setEditingId(null)
              reload()
            }}
            onCancel={() => setEditingId(null)}
            onChanged={reload}
          />
        ))}
      </ul>
    </section>
  )
}

function AddMovieForm({ movies, onAdded }: { movies: Movie[]; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [releaseYear, setReleaseYear] = useState('')
  const [runtimeMinutes, setRuntimeMinutes] = useState('')
  const [prerequisiteIds, setPrerequisiteIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.createMovie({
        title,
        releaseYear: Number(releaseYear),
        runtimeMinutes: Number(runtimeMinutes),
        prerequisiteIds,
      })
      setTitle('')
      setReleaseYear('')
      setRuntimeMinutes('')
      setPrerequisiteIds([])
      onAdded()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3>Add a movie</h3>
      <div className="row">
        <label className="grow">
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </label>
        <label>
          Year
          <input
            type="number"
            value={releaseYear}
            onChange={(e) => setReleaseYear(e.target.value)}
            min={1900}
            max={2100}
            required
          />
        </label>
        <label>
          Runtime (min)
          <input
            type="number"
            value={runtimeMinutes}
            onChange={(e) => setRuntimeMinutes(e.target.value)}
            min={1}
            max={300}
            required
          />
        </label>
      </div>
      <fieldset>
        <legend>Watch these first (optional)</legend>
        <PrereqPicker movies={movies} value={prerequisiteIds} onChange={setPrerequisiteIds} />
      </fieldset>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Adding…' : 'Add movie'}
      </button>
    </form>
  )
}

type RowProps = {
  movie: Movie
  movies: Movie[]
  titleOf: (id: number) => string
  editing: boolean
  onEdit: () => void
  onDone: () => void
  onCancel: () => void
  onChanged: () => void
}

function MovieRow({ movie, movies, titleOf, editing, onEdit, onDone, onCancel, onChanged }: RowProps) {
  const [draft, setDraft] = useState<number[]>(movie.prerequisiteIds)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Start the draft from the saved list only when the editor opens. List reloads
  // (e.g. ticking another movie as watched) create new arrays and must not wipe it.
  useEffect(() => {
    if (editing) {
      setDraft(movie.prerequisiteIds)
      setError(null)
    }
  }, [editing])

  async function toggleWatched() {
    setError(null)
    try {
      await api.updateMovie(movie.id, { watched: !movie.watched })
      onChanged()
    } catch (err) {
      setError(errorText(err))
    }
  }

  async function savePrereqs() {
    setBusy(true)
    setError(null)
    try {
      await api.updateMovie(movie.id, { prerequisiteIds: draft })
      onDone()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="card movie">
      <div className="movie-head">
        <label className="watched">
          <input type="checkbox" checked={movie.watched} onChange={toggleWatched} />
          <span className="sr-only">Watched</span>
        </label>
        <div className="grow">
          <strong>{movie.title}</strong>
          <span className="muted">
            {' '}
            · {movie.releaseYear} · {formatRuntime(movie.runtimeMinutes)}
          </span>
          {!editing && (
            <div className="prereqs">
              {movie.prerequisiteIds.length === 0 ? (
                <span className="muted">No prerequisites</span>
              ) : (
                <>
                  <span className="muted">After: </span>
                  {movie.prerequisiteIds.map((id) => (
                    <span key={id} className="tag">
                      {titleOf(id)}
                    </span>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        {!editing && (
          <button type="button" className="secondary" onClick={onEdit}>
            Edit prerequisites
          </button>
        )}
      </div>

      {editing && (
        <div className="editor">
          <PrereqPicker movies={movies} value={draft} onChange={setDraft} excludeId={movie.id} />
          <div className="row">
            <button type="button" onClick={savePrereqs} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </li>
  )
}
