import { useLocation, useNavigate } from 'react-router-dom'

const HIDE_ON = ['/setup', '/join', '/tournament']

const PadelSVG = () => (
  <svg width="24" height="28" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', margin: '0 auto' }}>
    <ellipse cx="50" cy="42" rx="32" ry="36" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="6"/>
    <circle cx="38" cy="28" r="4" fill="currentColor" opacity="0.5"/>
    <circle cx="50" cy="28" r="4" fill="currentColor" opacity="0.5"/>
    <circle cx="62" cy="28" r="4" fill="currentColor" opacity="0.5"/>
    <circle cx="32" cy="40" r="4" fill="currentColor" opacity="0.5"/>
    <circle cx="44" cy="40" r="4" fill="currentColor" opacity="0.5"/>
    <circle cx="56" cy="40" r="4" fill="currentColor" opacity="0.5"/>
    <circle cx="68" cy="40" r="4" fill="currentColor" opacity="0.5"/>
    <circle cx="38" cy="52" r="4" fill="currentColor" opacity="0.5"/>
    <circle cx="50" cy="52" r="4" fill="currentColor" opacity="0.5"/>
    <circle cx="62" cy="52" r="4" fill="currentColor" opacity="0.5"/>
    <path d="M 40 74 Q 50 80 60 74" stroke="currentColor" strokeWidth="5" fill="none"/>
    <rect x="44" y="78" width="12" height="28" rx="5" fill="currentColor" opacity="0.7"/>
  </svg>
)

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
      <span className="gnav-icon" style={label === 'All Games' ? { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24 } : {}}>
        {label === 'All Games' ? <PadelSVG /> : icon}
      </span>
      {label}
    </button>
  )

  return (
    <nav className="gnav">
      {btn('/', '🏠', 'Home')}
      {btn('/ranking', '🏆', 'Rank')}
      {btn('/games', null, 'All Games')}
      {btn('/profile', '👤', 'Profile')}
    </nav>
  )
}