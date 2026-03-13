import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fbGet } from '../firebase'
import { toast } from '../components/Toast'
import TopBar from '../components/TopBar'

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
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }
  catch (e) { return '' }
}

function LiveDot() {
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%',
      background: 'var(--accent)',
      display: 'inline-block',
      boxShadow: '0 0 6px rgba(0,229,160,0.5)',
      animation: 'pulse 2s ease infinite',
      flexShrink: 0,
    }} />
  )
}

function TournCard({ t, onTap, loading }) {
  return (
    <div className="tlist-card" onClick={() => onTap(t.code)} style={{ opacity: loading ? 0.5 : 1 }}>
      <LiveDot />
      <div className="tlist-info">
        <div className="tlist-name">{t.name}</div>
        <div className="tlist-meta">{t.playerCount} players · {t.rounds} rounds · {fmtDate(t.createdAt)}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        {t.isCreator && <span className="badge-creator">Creator</span>}
        <span style={{ color: 'var(--border)', fontSize: 20 }}>›</span>
      </div>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [tournaments, setTournaments] = useState(loadMyTournaments)
  const [loadingCode, setLoadingCode] = useState(null)
  const location = useLocation()

  useEffect(() => { setTournaments(loadMyTournaments()) }, [location.key])

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
      wins += th.wins || 0; losses += th.losses || 0
      totalMatches += th.played || 0
    })
    winRate = totalMatches > 0 ? Math.round(wins / ((wins + losses) || 1) * 100) : 0
  }

  const active = tournaments.filter(t => t.status !== 'completed')

  return (
    <div className="screen">
      <TopBar title="padel" subtitle="Americano" />

      <div className="wrap" style={{ paddingTop: 8 }}>

        {/* Stats */}
        {u && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[
              { v: winRate + '%', l: 'Win Rate',  c: 'var(--accent)' },
              { v: totalMatches,  l: 'Matches',   c: 'var(--text)' },
              { v: totalPts,      l: 'Total Pts', c: 'var(--accent3)' },
            ].map(cell => (
              <div key={cell.l} className="psg-cell" style={{ marginBottom: 0 }}>
                <div className="pv" style={{ color: cell.c }}>{cell.v}</div>
                <div className="pl">{cell.l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 20 }}>
          <button className="btn btn-primary" onClick={() => navigate('/setup')}>+ New Tournament</button>
          <button className="btn btn-secondary" onClick={() => navigate('/join')}>Join</button>
        </div>

        {/* Active tournaments */}
        {active.length > 0 ? (
          <>
            <div className="sec" style={{ marginTop: 0 }}>Active ({active.length})</div>
            {active.map(t => (
              <TournCard key={t.code} t={t} onTap={openTournament} loading={loadingCode === t.code} />
            ))}
          </>
        ) : (
          <div className="empty">
            <div className="ei">🎾</div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>No active tournaments</div>
            <div style={{ fontSize: 13 }}>Start or join one to play</div>
          </div>
        )}
      </div>
    </div>
  )
}
