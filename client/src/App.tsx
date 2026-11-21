import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Emblem from './components/Emblem'
import Movies from './pages/Movies'
import RewatchPlan from './pages/RewatchPlan'
import Booking from './pages/Booking'

export default function App() {
  return (
    <div className="app">
      <header>
        <div className="brand">
          <Emblem />
          <div>
            <h1>
              Doomsday <span>Ready</span>
            </h1>
            <p className="tagline">Assemble your rewatch before opening night</p>
          </div>
        </div>
        <nav>
          <NavLink to="/movies">Movies</NavLink>
          <NavLink to="/rewatch">Rewatch Plan</NavLink>
          <NavLink to="/booking">Booking</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/movies" replace />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/rewatch" element={<RewatchPlan />} />
          <Route path="/booking" element={<Booking />} />
        </Routes>
      </main>
      <footer>
        Fan project, not affiliated with Marvel or Disney.
      </footer>
    </div>
  )
}
