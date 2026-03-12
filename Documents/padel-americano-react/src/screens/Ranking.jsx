import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fbGet } from '../firebase'
import TopBar from '../components/TopBar'

const now = new Date()
const THIS_YEAR  = now.getFullYear()
const THIS_MONTH = now.getMonth()
const YEAR_LABEL  = String(THIS_YEAR)
const MONTH_LABEL = now.toLocaleString('en-GB', { month: 'long' })

function buildRows(allPlayers, period) {
  return allPlayers.map(p => {
    const history = p.tournaments || []
    let pts = 0, wins = 0, losses = 0, played = 0, count = 0
    history.forEach(th => {
      const d = th.date ? new Date(th.date) : null
      if (!d) return
      const inPeriod = period === 'yearly'
        ? d.getFullYear() === THIS_YEAR
        : d.getFullYear() === THIS_YEAR && d.getMonth() === THIS_MONTH
      if (!inPeriod) return
      pts += th.points || 0; wins += th.wins || 0; losses += th.losses || 0; played += th.played || 0; count++
    })
    if (period === 'yearly') pts += (p.legacy_points || 0)
    return { uid: p.uid, username: p.username, displayName: p.displayName || p.username, avatar: p.avatar || null, pts, wins, losses, played, count }
  })
  .filter(r => r.count > 0 || (period === 'yearly' && r.pts > 0))
  .sort((a, b) => b.pts - a.pts || b.wins - a.wins)
}

export default function Ranking() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [period, setPeriod]       = useState('yearly')
  const [allPlayers, setAllPlayers] = useState(null)
  const [error, setError]         = useState(false)

  useEffect(() => {
    fbGet('players')
      .then(data => {
        if (!data) { setAllPlayers([]); return }
        setAllPlayers(
          Object.entries(data)
            .filter(([, p]) => p.username && !p.redirectTo)
            .map(([uid, p]) => ({ ...p, uid }))
        )
      })
      .catch(() => setError(true))
  }, [])

  const openProfile = (uid) => navigate(`/profile?uid=${uid}&back=ranking`)

  if (error) {
    return (
      <div className="screen">
        <TopBar title="RANKING" subtitle="Global Leaderboard" />
        <div className="empty" style={{ marginTop: 40 }}><div className="ei">⚠️</div>Could not load data — check your connection</div>
      </div>
    )
  }

  if (allPlayers === null) {
    return (
      <div className="screen">
        <TopBar title="RANKING" subtitle="Global Leaderboard" />
        <div className="spinner" style={{ marginTop: 60 }} />
      </div>
    )
  }

  const rows = buildRows(allPlayers, period)
  const maxPts = rows.length && rows[0].pts > 0 ? rows[0].pts : 1
  const medals = ['🥇', '🥈', '🥉']
  const periodLabel = period === 'yearly' ? YEAR_LABEL : `${MONTH_LABEL} ${THIS_YEAR}`

  const top      = rows.slice(0, Math.min(3, rows.length))
  const podOrder = top.length >= 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : [top[0]]
  const podCls   = top.length >= 3 ? ['p2','p1','p3']         : top.length === 2 ? ['p2','p1']       : ['p1']
  const medalFor = { p1: '🥇', p2: '🥈', p3: '🥉' }

  return (
    <div className="screen">
      <TopBar title="RANKING" subtitle="Global Leaderboard" />

      {/* period tabs */}
      <div className="lb-tabs">
        <div className={`lb-tab${period === 'yearly'  ? ' on' : ''}`} onClick={() => setPeriod('yearly')}>📅 {YEAR_LABEL}</div>
        <div className={`lb-tab${period === 'monthly' ? ' on' : ''}`} onClick={() => setPeriod('monthly')}>🗓 {MONTH_LABEL}</div>
      </div>

      <div style={{ paddingBottom: 90, overflowY: 'auto' }}>
        {rows.length === 0 ? (
          <div className="empty" style={{ marginTop: 40 }}>
            <div className="ei">🎾</div>No tournament data for {periodLabel} yet
          </div>
        ) : (
          <>
            {/* podium */}
            <div className="podium-wrap">
              {podOrder.map((p, i) => {
                if (!p) return null
                const pc = podCls[i]
                return (
                  <div key={p.uid || p.username} className={`pod ${pc}`} onClick={() => openProfile(p.uid)}>
                    <div style={{ fontSize: pc === 'p1' ? 24 : 20, marginBottom: 4 }}>{medalFor[pc]}</div>
                    <div className="pod-avatar" style={{ overflow: 'hidden' }}>
                      {p.avatar
                        ? <img src={p.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="" />
                        : p.displayName[0].toUpperCase()
                      }
                    </div>
                    <div className="pod-name">{p.displayName}</div>
                    <div className="pod-pts">{p.pts}</div>
                    <div className="pod-lbl">pts</div>
                    <div className="pod-block" />
                  </div>
                )
              })}
            </div>

            {/* ranked list */}
            <div className="lb-section">
              <div className="lb-section-title">{periodLabel} · {rows.length} Players</div>
              {rows.map((p, i) => {
                const pct  = Math.round(p.pts / maxPts * 100)
                const isMe = currentUser && (currentUser.uid === p.uid || currentUser.username === p.username)
                const medal = medals[i] || null
                return (
                  <div
                    key={p.uid || p.username}
                    onClick={() => openProfile(p.uid)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px',
                      background: isMe ? 'rgba(0,229,160,0.07)' : i < 3 ? 'var(--card)' : 'var(--surface)',
                      border: `1px solid ${isMe ? 'rgba(0,229,160,0.3)' : i < 3 ? 'var(--border)' : 'transparent'}`,
                      borderRadius: 12, marginBottom: 7, cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: i < 3 ? 20 : 16, minWidth: 24, textAlign: 'center', color: i === 0 ? 'var(--accent3)' : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : 'var(--muted)' }}>
                      {medal || i + 1}
                    </div>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,229,160,0.08)', border: `2px solid ${isMe ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {p.avatar
                        ? <img src={p.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="" />
                        : <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 13, color: 'var(--accent)' }}>{p.displayName[0].toUpperCase()}</span>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                        {p.displayName}
                        {isMe && <span style={{ fontSize: 9, background: 'var(--accent)', color: 'var(--bg)', padding: '2px 5px', borderRadius: 4, fontWeight: 700 }}>YOU</span>}
                      </div>
                      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: i < 3 ? 'var(--accent)' : 'var(--muted)', borderRadius: 2 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 22, color: i < 3 ? 'var(--accent)' : 'var(--text)', lineHeight: 1 }}>{p.pts}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{p.wins}W · {p.losses}L</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}