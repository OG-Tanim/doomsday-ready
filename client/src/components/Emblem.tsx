/** Original shield emblem (hand-drawn SVG, not a Marvel logo). */
export default function Emblem() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="emblem-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e3b44f" />
          <stop offset="1" stopColor="#9c7424" />
        </linearGradient>
      </defs>
      <path d="M24 3 42 9v14c0 11-7.6 18.6-18 22C13.6 41.6 6 34 6 23V9z" fill="#101729" stroke="url(#emblem-rim)" strokeWidth="2.5" />
      <path d="M24 9.5 36.5 14v9.2c0 7.7-5.1 13.3-12.5 16.1-7.4-2.8-12.5-8.4-12.5-16.1V14z" fill="#c8303a" />
      <path d="M26.5 13 18 26h6l-2.5 10L30 22.5h-6z" fill="#e8ecf4" />
    </svg>
  )
}
