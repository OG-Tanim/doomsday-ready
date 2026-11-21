export type Movie = {
  id: number
  title: string
  releaseYear: number
  runtimeMinutes: number
  watched: boolean
  prerequisiteIds: number[]
}

export type NewMovie = Omit<Movie, 'id' | 'watched'> & { watched?: boolean }

export type RewatchOrder = {
  target: Movie
  movies: Movie[]
  total: number
  watchedCount: number
  unwatchedRuntimeMinutes: number
}

export type Cinema = { id: number; name: string; bundleSizes: number[] }

export type BookingQuote =
  | { cinema: Cinema; groupSize: number; possible: false }
  | {
      cinema: Cinema
      groupSize: number
      possible: true
      totalBundles: number
      bundles: { size: number; count: number }[]
    }

/** Error thrown for any non-2xx response; `code` is the API's error code. */
export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: init?.method ?? 'GET',
      headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the API. Is the server running?')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? 'UNKNOWN', data?.message ?? `Request failed (${res.status})`)
  }
  return data as T
}

export const api = {
  listMovies: () => request<Movie[]>('/movies'),
  createMovie: (movie: NewMovie) => request<Movie>('/movies', { method: 'POST', body: movie }),
  updateMovie: (id: number, patch: Partial<Omit<Movie, 'id'>>) =>
    request<Movie>(`/movies/${id}`, { method: 'PATCH', body: patch }),
  deleteMovie: (id: number) =>
    request<{ deletedId: number; updatedMovies: Movie[] }>(`/movies/${id}`, { method: 'DELETE' }),
  rewatchOrder: (id: number) => request<RewatchOrder>(`/movies/${id}/rewatch-order`),
  listCinemas: () => request<Cinema[]>('/cinemas'),
  createCinema: (cinema: Omit<Cinema, 'id'>) => request<Cinema>('/cinemas', { method: 'POST', body: cinema }),
  bookingQuote: (cinemaId: number, groupSize: number) =>
    request<BookingQuote>(`/cinemas/${cinemaId}/booking?groupSize=${groupSize}`),
}

/** Friendly text for an error, with a clearer line for the cycle case. */
export function errorText(err: unknown): string {
  if (err instanceof ApiError && err.code === 'CIRCULAR_DEPENDENCY') {
    return 'That would create a loop: a movie can’t (even indirectly) be its own prerequisite.'
  }
  return err instanceof Error ? err.message : String(err)
}

export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
