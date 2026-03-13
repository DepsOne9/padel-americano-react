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
  return (
    <div className="tlist-card" onClick={() => onTap(t.code)} style={{ opacity: loading ? 0.5 : 1 }}>
      <div className="tlist-icon completed">✅</div>
      <div className="tlist-info">
        <div className="tlist-name">{t.name}</div>
        <div className="tlist-meta">{t.playerCount} players · {t.rounds} rounds · {fmtDate(t.createdAt)}</div>
        <div style={{ marginTop: 5, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <span className="badge-done">✓ Completed</span>
          {t.isCreator && <span className="badge-creator">Creator</span>}
        </div>
      </div>
      <div style={{ color: 'var(--border)', fontSize: 20 }}>›</div>
    </div>
  )
}

export default function AllGames() {
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
    upsertMyTournament(data, isCreator)
    navigate(`/tournament/${code}`)
  }

  const done = tournaments.filter(t => t.status === 'completed')

  return (
    <div className="screen">
      <TopBar title="games" subtitle="Completed tournaments" />

      <div style={{ padding: '0 16px 90px' }}>
        {done.length > 0 ? (
          <>
            <div className="sec" style={{ marginTop: 4 }}>Completed ({done.length})</div>
            {done.map(t => (
              <TournCard key={t.code} t={t} onTap={openTournament} loading={loadingCode === t.code} />
            ))}
          </>
        ) : (
          <div className="empty" style={{ marginTop: 20 }}>
            <div className="ei">🎾</div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>No completed games yet</div>
            <div style={{ fontSize: 13 }}>Finish a tournament to see it here</div>
          </div>
        )}
      </div>
    </div>
  )
}
