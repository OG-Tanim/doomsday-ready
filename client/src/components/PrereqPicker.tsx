import type { Movie } from '../api'

type Props = {
  movies: Movie[]
  value: number[]
  onChange: (ids: number[]) => void
  /** Hide this movie from the options (a movie can't be its own prerequisite). */
  excludeId?: number
}

export default function PrereqPicker({ movies, value, onChange, excludeId }: Props) {
  const options = movies.filter((m) => m.id !== excludeId)
  if (options.length === 0) return <p className="muted">No other movies yet.</p>

  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  return (
    <div className="picker" role="group" aria-label="Prerequisites">
      {options.map((m) => (
        <label key={m.id} className={value.includes(m.id) ? 'chip chip-on' : 'chip'}>
          <input type="checkbox" checked={value.includes(m.id)} onChange={() => toggle(m.id)} />
          {m.title}
        </label>
      ))}
    </div>
  )
}
