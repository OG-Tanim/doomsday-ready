import { useEffect, useState, type FormEvent } from 'react'
import { api, errorText, type BookingQuote, type Cinema } from '../api'

export default function Booking() {
  const [cinemas, setCinemas] = useState<Cinema[]>([])
  const [cinemaId, setCinemaId] = useState<number | null>(null)
  const [groupSize, setGroupSize] = useState('')
  const [quote, setQuote] = useState<BookingQuote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = (selectId?: number) =>
    api
      .listCinemas()
      .then((list) => {
        setCinemas(list)
        setCinemaId((cur) => selectId ?? cur ?? list[0]?.id ?? null)
      })
      .catch((e) => setError(errorText(e)))

  useEffect(() => {
    reload()
  }, [])

  async function getQuote(e: FormEvent) {
    e.preventDefault()
    if (!cinemaId) return
    setBusy(true)
    setError(null)
    setQuote(null)
    try {
      setQuote(await api.bookingQuote(cinemaId, Number(groupSize)))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const selected = cinemas.find((c) => c.id === cinemaId)

  return (
    <section>
      <h2>Booking</h2>
      <form className="card" onSubmit={getQuote}>
        <h3>Opening-night quote</h3>
        <div className="row">
          <label className="grow">
            Cinema
            <select
              value={cinemaId ?? ''}
              onChange={(e) => {
                setCinemaId(Number(e.target.value))
                setQuote(null)
              }}
              disabled={cinemas.length === 0}
            >
              {cinemas.length === 0 && <option value="">No cinemas yet</option>}
              {cinemas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Group size
            <input
              type="number"
              value={groupSize}
              onChange={(e) => setGroupSize(e.target.value)}
              min={1}
              max={10000}
              required
            />
          </label>
        </div>
        {selected && (
          <p className="muted">Sells bundles of {selected.bundleSizes.join(', ')} seats.</p>
        )}
        <button type="submit" disabled={busy || !cinemaId}>
          {busy ? 'Calculating…' : 'Get quote'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {quote && (
        <div className={quote.possible ? 'card result' : 'card result result-bad'}>
          {quote.possible ? (
            <>
              <p>
                Buy <strong>{quote.totalBundles}</strong> bundle{quote.totalBundles === 1 ? '' : 's'} for{' '}
                {quote.groupSize} people at {quote.cinema.name}:
              </p>
              <ul>
                {quote.bundles.map((b) => (
                  <li key={b.size}>
                    {b.count} × bundle of {b.size} seats
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              <strong>Not possible.</strong> No mix of {quote.cinema.bundleSizes.join(', ')}-seat bundles adds up to
              exactly {quote.groupSize}.
            </p>
          )}
        </div>
      )}

      <AddCinemaForm onAdded={(id) => reload(id)} />
    </section>
  )
}

function AddCinemaForm({ onAdded }: { onAdded: (id: number) => void }) {
  const [name, setName] = useState('')
  const [sizes, setSizes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const bundleSizes = sizes
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
    if (bundleSizes.length === 0 || bundleSizes.some((n) => !Number.isInteger(n))) {
      setError('Bundle sizes must be whole numbers separated by commas, e.g. 2, 5')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await api.createCinema({ name, bundleSizes })
      setName('')
      setSizes('')
      onAdded(created.id)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3>Add a cinema</h3>
      <div className="row">
        <label className="grow">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
        </label>
        <label className="grow">
          Bundle sizes
          <input value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="e.g. 2, 5" required />
        </label>
      </div>
      <p className="muted">1–10 different sizes, each 1–500 seats.</p>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Adding…' : 'Add cinema'}
      </button>
    </form>
  )
}
