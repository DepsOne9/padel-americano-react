import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fbGet } from '../firebase'
import { toast } from '../components/Toast'
import TopBar from '../components/TopBar'

// ── localStorage helpers ─────────────────────────────────
function loadMyTournaments() {
  try { const s = localStorage.getItem('pa_my_tourneys'); return s ? JSON.parse(s) : [] }
  catch (e) { return [] }
}
function saveMyTournaments(list) {
  try { localStorage.setItem('pa_my_tourneys', JSON.stringify(list)) } catch (e) {}
}
export function upsertMyTournament(t, isCreator) {
  const list = loadMyTournaments()
  const entry = {
    code: t.code, name: t.name, createdAt: t.createdAt,
    status: t.status || 'active', isCreator: !!isCreator,
    playerCount: t.players.length, rounds: t.rounds.length,
  }
  const idx = list.findIndex(x => x.code === t.code)
  if (idx >= 0) list[idx] = entry; else list.unshift(entry)
  const trimmed = list.slice(0, 30)
  saveMyTournaments(trimmed)
  return trimmed
}

function fmtDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch (e) { return '' }
}

const PadelSVG = ({ color = '#00e5a0' }) => (
  <svg width="24" height="28" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="42" rx="32" ry="36" fill="none" stroke={color} strokeWidth="6"/>
    <circle cx="38" cy="28" r="4" fill={color} opacity="0.4"/>
    <circle cx="50" cy="28" r="4" fill={color} opacity="0.4"/>
    <circle cx="62" cy="28" r="4" fill={color} opacity="0.4"/>
    <circle cx="32" cy="40" r="4" fill={color} opacity="0.4"/>
    <circle cx="44" cy="40" r="4" fill={color} opacity="0.4"/>
    <circle cx="56" cy="40" r="4" fill={color} opacity="0.4"/>
    <circle cx="68" cy="40" r="4" fill={color} opacity="0.4"/>
    <circle cx="38" cy="52" r="4" fill={color} opacity="0.4"/>
    <circle cx="50" cy="52" r="4" fill={color} opacity="0.4"/>
    <circle cx="62" cy="52" r="4" fill={color} opacity="0.4"/>
    <path d="M 40 74 Q 50 80 60 74" stroke={color} strokeWidth="4" fill="none"/>
    <rect x="44" y="78" width="12" height="28" rx="6" fill={color} opacity="0.9"/>
  </svg>
)

function TournCard({ t, onTap, loading }) {
  const isActive = t.status !== 'completed'
  const dateStr = fmtDate(t.createdAt)
  return (
    <div className="tlist-card" onClick={() => onTap(t.code)} style={{ opacity: loading ? 0.5 : 1 }}>
      <div className={`tlist-icon ${isActive ? 'active' : 'completed'}`}>
        {isActive ? <PadelSVG /> : '✅'}
      </div>
      <div className="tlist-info">
        <div className="tlist-name">{t.name}</div>
        <div className="tlist-meta">{t.playerCount} players · {t.rounds} rounds · {dateStr}</div>
        <div style={{ marginTop: 5, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {isActive
            ? <span className="badge-active">● Active</span>
            : <span className="badge-done">✓ Completed</span>
          }
          {t.isCreator && <span className="badge-creator">Creator</span>}
        </div>
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 20 }}>›</div>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [tournaments, setTournaments] = useState(loadMyTournaments)
  const [loadingCode, setLoadingCode] = useState(null)

  const location = useLocation()
  useEffect(() => {
    setTournaments(loadMyTournaments())
  }, [location.key])

  const openTournament = async (code) => {
    if (!navigator.onLine) { toast('No internet connection', true); return }
    setLoadingCode(code)
    const data = await fbGet(`tournaments/${code}`)
    setLoadingCode(null)
    if (!data) { toast('Tournament not found', true); return }
    const isCreator = !!(currentUser && data.createdBy && currentUser.username === data.createdBy)
    const updated = upsertMyTournament(data, isCreator)
    setTournaments(updated)
    navigate(`/tournament/${code}`)
  }

  // Quick stats from user profile
  const u = currentUser && !currentUser._pendingSetup ? currentUser : null
  let totalPts = 0, totalMatches = 0, winRate = 0
  if (u) {
    const history = u.tournaments || []
    let wins = 0, losses = 0
    const thisYear = new Date().getFullYear()
    u.legacy_points && (totalPts += u.legacy_points)
    history.forEach(th => {
      const y = th.date ? new Date(th.date).getFullYear() : 0
      if (y === thisYear) totalPts += th.points || 0
      wins += th.wins || 0
      losses += th.losses || 0
      totalMatches += th.played || 0
    })
    winRate = totalMatches > 0 ? Math.round(wins / ((wins + losses) || 1) * 100) : 0
  }

  // Only active tournaments on Home; completed go to All Games
  const active = tournaments.filter(t => t.status !== 'completed')

  return (
    <div className="screen">
      <TopBar title="PADEL" subtitle="Americano" />

      <div className="wrap" style={{ paddingTop: 8 }}>

        {/* Stats mini-grid */}
        {u && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[
              { v: winRate + '%', l: 'Win Rate',  c: 'var(--accent)' },
              { v: totalMatches,  l: 'Matches',   c: 'var(--text)' },
              { v: totalPts,      l: 'Total Pts', c: 'var(--accent3)' },
            ].map(cell => (
              <div key={cell.l} style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '12px 8px', textAlign: 'center',
              }}>
                <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 28, color: cell.c, lineHeight: 1 }}>{cell.v}</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 3 }}>{cell.l}</div>
              </div>
            ))}
          </div>
        )}

        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate('/setup')}>+ New</button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/join')}>Join</button>
        </div>

        {/* Active tournaments */}
        {active.length > 0 ? (
          <>
            <div className="sec" style={{ marginTop: 4 }}>Active ({active.length})</div>
            {active.map(t => (
              <TournCard key={t.code} t={t} onTap={openTournament} loading={loadingCode === t.code} />
            ))}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--muted)' }}>
            <svg width="42" height="50" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', margin: '0 auto 10px', opacity: 0.4 }}>
              <ellipse cx="50" cy="42" rx="32" ry="36" fill="#0f1d35" stroke="#00e5a0" strokeWidth="5"/>
              <circle cx="38" cy="28" r="3.5" fill="#00e5a0" opacity="0.35"/>
              <circle cx="50" cy="28" r="3.5" fill="#00e5a0" opacity="0.35"/>
              <circle cx="62" cy="28" r="3.5" fill="#00e5a0" opacity="0.35"/>
              <circle cx="44" cy="40" r="3.5" fill="#00e5a0" opacity="0.35"/>
              <circle cx="56" cy="40" r="3.5" fill="#00e5a0" opacity="0.35"/>
              <circle cx="50" cy="52" r="3.5" fill="#00e5a0" opacity="0.35"/>
              <path d="M 40 74 Q 50 80 60 74" stroke="#00e5a0" strokeWidth="4" fill="none"/>
              <rect x="44" y="78" width="12" height="30" rx="6" fill="#00e5a0" opacity="0.9"/>
            </svg>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>No active tournaments</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Start or join one to play</div>
          </div>
        )}
      </div>
    </div>
  )
}