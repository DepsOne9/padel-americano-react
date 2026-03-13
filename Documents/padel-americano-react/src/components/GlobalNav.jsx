import { useLocation, useNavigate } from 'react-router-dom'

const HIDE_ON = ['/setup', '/join', '/tournament']

export default function GlobalNav() {
  const location = useLocation()
  const navigate = useNavigate()

  const hide = HIDE_ON.some(p => location.pathname.startsWith(p))
  if (hide) return null

  const active = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const btn = (path, icon, label) => (
    <button
      className={`gnav-btn${active(path) ? ' on' : ''}`}
      onClick={() => navigate(path)}
    >
      <span className="gnav-icon">{icon}</span>
      {label}
    </button>
  )

  return (
    <nav className="gnav">
      {btn('/', '🏠', 'Home')}
      {btn('/ranking', '🏆', 'Rank')}
      {btn('/games', '🎾', 'Games')}
      {btn('/profile', '👤', 'Profile')}
    </nav>
  )
}
