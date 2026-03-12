import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fbGet } from '../firebase'
import { toast } from '../components/Toast'
import TopBar from '../components/TopBar'
import { upsertMyTournament } from './Home'

function loadMyTournaments() {
  try { const s = localStorage.getItem('pa_my_tourneys'); return s ? JSON.parse(s) : [] }
  catch (e) { return [] }
}

function fmtDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch (e) { return '' }
}

function TournCard({ t, onTap, loading }) {
  const dateStr = fmtDate(t.createdAt)
  return (
    <div className="tlist-card" onClick={() => onTap(t.code)} style={{ opacity: loading ? 0.5 : 1 }}>
      <div className="tlist-icon completed">✅</div>
      <div className="tlist-info">
        <div className="tlist-name">{t.name}</div>
        <div className="tlist-meta">{t.playerCount} players · {t.rounds} rounds · {dateStr}</div>
        <div style={{ marginTop: 5, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <span className="badge-done">✓ Completed</span>
          {t.isCreator && <span className="badge-creator">Creator</span>}
        </div>
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 20 }}>›</div>
    </div>
  )
}

export default function AllGames() {
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
    upsertMyTournament(data, isCreator)
    navigate(`/tournament/${code}`)
  }

  const done = tournaments.filter(t => t.status === 'completed')

  return (
    <div className="screen">
      <TopBar title="ALL GAMES" subtitle="Completed tournaments" />

      <div style={{ padding: '0 16px 90px' }}>
        {done.length > 0 ? (
          <>
            <div className="sec" style={{ marginTop: 4 }}>Completed ({done.length})</div>
            {done.map(t => (
              <TournCard key={t.code} t={t} onTap={openTournament} loading={loadingCode === t.code} />
            ))}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--muted)' }}>
            <svg width="52" height="62" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', margin: '0 auto 10px', opacity: 0.4 }}>
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
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>No completed games yet</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Finish a tournament to see it here</div>
          </div>
        )}
      </div>
    </div>
  )
}