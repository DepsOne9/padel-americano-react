import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fbGet, fbSet, fbListen } from '../firebase'
import { toast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { upsertMyTournament } from './Home'
import { showConfirm } from '../components/ConfirmModal'
import AvatarBtn from '../components/AvatarBtn'

function fmtDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) } catch (e) { return '' }
}

function roundColor(sc, max = 24) {
  if (sc === null || sc === undefined) return { bg: '#1e3154', color: '#6b7fa3' }
  if (sc === 0) return { bg: '#1e3154', color: '#6b7fa3' }
  const half = max / 2
  if (sc > half)  return { bg: 'rgba(0,229,160,0.18)',  color: '#00e5a0' }
  if (sc === half) return { bg: 'rgba(255,209,102,0.14)', color: '#ffd166' }
  return { bg: 'rgba(255,92,92,0.14)', color: '#ff5c5c' }
}

function computeStandings(T) {
  const st = {}
  T.players.forEach(p => st[p] = { points: 0, wins: 0, losses: 0, played: 0, byePts: 0, roundScores: [] })
  T.rounds.forEach(round => {
    round.matches.forEach(m => {
      if (!m.saved) return
      m.teamA.forEach(p => { st[p].points += m.scoreA; st[p].played++; st[p].roundScores.push(m.scoreA) })
      m.teamB.forEach(p => { st[p].points += m.scoreB; st[p].played++; st[p].roundScores.push(m.scoreB) })
      if (m.scoreA > m.scoreB) { m.teamA.forEach(p => st[p].wins++); m.teamB.forEach(p => st[p].losses++) }
      else if (m.scoreB > m.scoreA) { m.teamB.forEach(p => st[p].wins++); m.teamA.forEach(p => st[p].losses++) }
    })
    if (round.byes) round.byes.forEach(p => { if (st[p]) st[p].roundScores.push(0) })
  })
  const totalM = T.rounds.reduce((a, r) => a + r.matches.length, 0)
  const savedM = T.rounds.reduce((a, r) => a + r.matches.filter(m => m.saved).length, 0)
  if (savedM === totalM && totalM > 0 && T.byeOption === 'half') {
    const maxP = Math.max(...Object.values(st).map(s => s.played))
    const bp = Math.round(T.pointsPerGame / 2)
    T.players.forEach(p => { const s = maxP - st[p].played; if (s > 0) { st[p].byePts = s * bp; st[p].points += st[p].byePts } })
  }
  return Object.entries(st).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.points - a.points || b.wins - a.wins)
}

async function commitTournamentToProfiles(T, currentUser) {
  if (!navigator.onLine) return
  const standings = computeStandings(T)
  let allPlayers = {}
  try { const d = await fbGet('players'); if (d) allPlayers = d } catch (e) { return }
  const byDisplayName = {}, byUsername = {}
  Object.entries(allPlayers).forEach(([uid, p]) => {
    if (!p.username) return
    byUsername[p.username] = { uid, p }
    const dn = (p.displayName || p.username).toLowerCase().trim()
    byDisplayName[dn] = { uid, p }
  })
  let linked = 0
  for (const st of standings) {
    const nameNorm = st.name.toLowerCase().trim()
    const usernameGuess = nameNorm.replace(/\s+/g, '_')
    const match = byDisplayName[nameNorm] || byUsername[usernameGuess]
    if (!match) continue
    const { uid, p: player } = match
    const existing = player.tournaments || []
    if (existing.some(t => t.code === T.code)) continue
    const entry = {
      code: T.code, name: T.name,
      date: T.completedAt || new Date().toISOString(),
      points: st.points, wins: st.wins, losses: st.losses, played: st.played,
      rank: standings.indexOf(st) + 1, totalPlayers: standings.length,
      roundScores: st.roundScores || [], ppg: T.pointsPerGame,
    }
    const updated = [...existing, entry]
    if (updated.length > 10) updated.splice(0, updated.length - 10)
    const savedPlayer = { ...player, tournaments: updated }
    await fbSet(`players/${uid}`, savedPlayer)
    if (currentUser?.uid === uid) {
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: savedPlayer }))
    }
    linked++
  }
  if (linked > 0) toast(`Linked results to ${linked} player account${linked > 1 ? 's' : ''}! 🔗`)
}

// ── Match Card ────────────────────────────────────────────
function MatchCard({ match, ri, mi, ppg, isCompleted, onSave, onEdit, onPlayerTap }) {
  const [sA, setSA] = useState(match.scoreA ?? '')
  const [sB, setSB] = useState(match.scoreB ?? '')
  const [entryOpen, setEntryOpen] = useState(match.scoreA !== null && !match.saved)

  useEffect(() => {
    setSA(match.scoreA ?? '')
    setSB(match.scoreB ?? '')
    setEntryOpen(match.scoreA !== null && !match.saved)
  }, [match])

  const tot = (parseInt(sA) || 0) + (parseInt(sB) || 0)
  const over = tot > ppg

  const handleInputA = (v) => { const val = Math.max(0, parseInt(v) || 0); setSA(val); const rem = ppg - val; if (rem >= 0) setSB(rem) }
  const handleInputB = (v) => { const val = Math.max(0, parseInt(v) || 0); setSB(val); const rem = ppg - val; if (rem >= 0) setSA(rem) }

  const save = () => {
    const a = parseInt(sA) || 0, b = parseInt(sB) || 0
    if (a + b > ppg) { toast(`Total can't exceed ${ppg} pts`, true); return }
    onSave(ri, mi, a, b)
  }

  const teamNames = (team) => team.map(p => (
    <span key={p} className="pname" onClick={() => onPlayerTap(p)}>{p}</span>
  ))

  if (match.saved) {
    const wA = match.scoreA > match.scoreB
    return (
      <div className="match-card">
        <div className="court-lbl">Court {mi + 1}</div>
        <div className="teams-row">
          <div className="team" style={wA ? { color: 'var(--accent)' } : {}}>
            {teamNames(match.teamA)}
          </div>
          <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 80 }}>
            <div className="saved-score">
              <span style={{ color: wA ? 'var(--accent)' : 'var(--muted)' }}>{match.scoreA}</span>
              <span style={{ color: 'var(--muted)', fontSize: 22, fontWeight: 400 }}> – </span>
              <span style={{ color: !wA ? 'var(--accent2)' : 'var(--muted)' }}>{match.scoreB}</span>
            </div>
          </div>
          <div className="team" style={!wA ? { color: 'var(--accent2)' } : {}}>
            {teamNames(match.teamB)}
          </div>
        </div>
        {isCompleted
          ? <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 4 }}>🔒 Locked</div>
          : <button className="edit-btn" onClick={() => onEdit(ri, mi)}>Edit score</button>
        }
      </div>
    )
  }

  if (isCompleted) {
    return (
      <div className="match-card">
        <div className="court-lbl">Court {mi + 1}</div>
        <div className="teams-row">
          <div className="team">{teamNames(match.teamA)}</div>
          <div className="vs-lbl">VS</div>
          <div className="team">{teamNames(match.teamB)}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '6px 0', fontSize: 13, color: 'var(--muted)' }}>— not recorded —</div>
      </div>
    )
  }

  if (!entryOpen) {
    return (
      <div className="match-card">
        <div className="court-lbl">Court {mi + 1}</div>
        <div className="teams-row">
          <div className="team">{teamNames(match.teamA)}</div>
          <div className="vs-lbl">VS</div>
          <div className="team">{teamNames(match.teamB)}</div>
        </div>
        <button className="enter-score-btn" onClick={() => setEntryOpen(true)}>+ Enter Score</button>
      </div>
    )
  }

  return (
    <div className="match-card">
      <div className="court-lbl">Court {mi + 1}</div>
      <div className="teams-row">
        <div className="team">{teamNames(match.teamA)}</div>
        <div className="vs-lbl">VS</div>
        <div className="team">{teamNames(match.teamB)}</div>
      </div>
      <div className={`score-hint${over ? ' over' : ''}`}>
        {over ? `⚠ Total ${tot} exceeds ${ppg} max` : `${tot} / ${ppg} pts · ${ppg - tot} left`}
      </div>
      <div className="score-row">
        <input className={`score-inp${over ? ' over' : ''}`} type="number" placeholder="0" value={sA === '' ? '' : sA} onChange={e => handleInputA(e.target.value)} />
        <div className="score-dash">–</div>
        <input className={`score-inp${over ? ' over' : ''}`} type="number" placeholder="0" value={sB === '' ? '' : sB} onChange={e => handleInputB(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={save}>Save Score</button>
        <button className="btn btn-secondary btn-sm" onClick={() => setEntryOpen(false)} style={{ padding: '9px 14px' }}>✕</button>
      </div>
    </div>
  )
}

// ── Ranking Pane ──────────────────────────────────────────
function RankingPane({ T, onPlayerTap }) {
  const [lbTab, setLbTab] = useState('points')
  const standings = computeStandings(T)
  const maxPts = standings.length && standings[0].points > 0 ? standings[0].points : 1
  const totalM = T.rounds.reduce((a, r) => a + r.matches.length, 0)
  const savedM = T.rounds.reduce((a, r) => a + r.matches.filter(m => m.saved).length, 0)
  const allDone = savedM === totalM && totalM > 0

  if (standings.every(s => s.played === 0)) {
    return <div className="empty"><div className="ei">🏆</div>Play some matches to see the ranking!</div>
  }

  const top = standings.slice(0, Math.min(3, standings.length))
  const order = top.length >= 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : [top[0]]
  const cls   = top.length >= 3 ? ['p2','p1','p3']          : top.length === 2 ? ['p2','p1']         : ['p1']

  const val = (p) => lbTab === 'points' ? p.points
    : lbTab === 'winrate' ? `${p.played ? Math.round(p.wins / ((p.wins + p.losses) || 1) * 100) : 0}%`
    : `${p.played ? (p.points / p.played).toFixed(1) : 0}`

  const lbl = lbTab === 'points' ? 'pts' : lbTab === 'winrate' ? 'win rate' : 'avg'

  return (
    <div>
      <div className="lb-tabs">
        {[['points','Points'],['winrate','Win Rate'],['avg','Avg/Match']].map(([k,l]) => (
          <div key={k} className={`lb-tab${lbTab===k?' on':''}`} onClick={() => setLbTab(k)}>{l}</div>
        ))}
      </div>

      <div className="podium-wrap">
        {order.map((p, i) => p && (
          <div key={p.name} className={`pod ${cls[i]}`} onClick={() => onPlayerTap(p.name)}>
            {cls[i] === 'p1' && <div style={{ fontSize: 20, marginBottom: 4 }}>🥇</div>}
            <div className="pod-avatar">{p.name[0].toUpperCase()}</div>
            <div className="pod-name">{p.name}</div>
            <div className="pod-pts">{val(p)}</div>
            <div className="pod-lbl">{lbl}</div>
            <div className="pod-block" />
          </div>
        ))}
      </div>

      <div className="lb-section">
        <div className="lb-section-title">
          {lbTab === 'points' ? 'Points per Player' : lbTab === 'winrate' ? 'Win Rate' : 'Avg Points / Match'}
        </div>
        {standings.map((p, i) => {
          const raw = lbTab === 'points' ? p.points
            : lbTab === 'winrate' ? (p.played ? Math.round(p.wins / ((p.wins + p.losses) || 1) * 100) : 0)
            : (p.played ? p.points / p.played : 0)
          const maxVal = lbTab === 'points' ? maxPts : lbTab === 'winrate' ? 100
            : Math.max(...standings.map(s => s.played ? s.points / s.played : 0)) || 1
          const pct = maxVal > 0 ? Math.round(raw / maxVal * 100) : 0
          const disp = lbTab === 'winrate' ? `${raw}%` : lbTab === 'avg' ? Number(raw).toFixed(1) : raw
          return (
            <div key={p.name} className="bar-row" onClick={() => onPlayerTap(p.name)}>
              <div className="bar-name">{p.name}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${pct}%`, background: i < 3 ? 'var(--accent)' : 'var(--muted)' }}>
                  <span>{disp}</span>
                </div>
              </div>
              <div className="bar-total">{disp}</div>
            </div>
          )
        })}
      </div>

      {lbTab === 'points' && (
        <div className="lb-section">
          <div className="lb-section-title">Win / Loss</div>
          {standings.slice(0, 5).map(p => {
            const total = p.wins + p.losses || 1
            const wPct = Math.round(p.wins / total * 100)
            return (
              <div key={p.name} className="win-strip" onClick={() => onPlayerTap(p.name)}>
                <div className="ws-name">{p.name}</div>
                <div className="ws-bar">
                  <div className="ws-w" style={{ width: `${wPct}%` }} />
                  <div className="ws-l" style={{ width: `${100 - wPct}%` }} />
                </div>
                <div className="ws-ratio">{p.wins}W · {p.losses}L</div>
              </div>
            )
          })}
        </div>
      )}

      <div className="lb-footer">
        <div className="lb-footer-cell"><span className="fv">{T.rounds.length}</span><span className="fl">Rounds</span></div>
        <div className="lb-footer-cell"><span className="fv">{T.pointsPerGame}</span><span className="fl">Pts/Game</span></div>
        <div className="lb-footer-cell"><span className="fv">{T.players.length}</span><span className="fl">Players</span></div>
      </div>

      {T.byeOption && (
        <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '0 16px 16px' }}>
          {allDone
            ? `✓ Bye bonus applied (+${Math.round(T.pointsPerGame / 2)}pts/missed round)`
            : `⏳ Bye bonus (+${Math.round(T.pointsPerGame / 2)}pts) added when all matches saved`}
        </div>
      )}
    </div>
  )
}

// ── Partners Pane ─────────────────────────────────────────
function PartnersPane({ T, onPlayerTap }) {
  const partners = {}, upcoming = {}
  T.players.forEach(p => { partners[p] = new Set(); upcoming[p] = new Set() })
  T.rounds.forEach(round => {
    round.matches.forEach(m => {
      m.teamA.forEach(p => m.teamA.forEach(q => { if (p !== q) upcoming[p].add(q) }))
      m.teamB.forEach(p => m.teamB.forEach(q => { if (p !== q) upcoming[p].add(q) }))
      if (m.saved) {
        m.teamA.forEach(p => m.teamA.forEach(q => { if (p !== q) partners[p].add(q) }))
        m.teamB.forEach(p => m.teamB.forEach(q => { if (p !== q) partners[p].add(q) }))
      }
    })
  })
  return (
    <div>
      <div className="sec">Partner History</div>
      {T.players.map(p => {
        const played = Array.from(partners[p])
        const notYet = Array.from(upcoming[p]).filter(x => !played.includes(x))
        return (
          <div key={p} className="card fade-up">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, cursor: 'pointer', letterSpacing: '-0.3px' }} onClick={() => onPlayerTap(p)}>{p}</div>
            {played.length
              ? <>
                  <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>Played with</div>
                  <div className="tags-wrap">{played.map(q => <span key={q} className="ptag">✓ {q}</span>)}</div>
                </>
              : <div style={{ color: 'var(--muted)', fontSize: 13 }}>No matches yet</div>
            }
            {notYet.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase', margin: '8px 0 4px', fontWeight: 700 }}>Scheduled with</div>
                <div className="tags-wrap">{notYet.map(q => <span key={q} className="ptag-sched">{q}</span>)}</div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────
export default function Tournament() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [T, setT] = useState(null)
  const [activeTab, setActiveTab] = useState('rounds')
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const unsubRef = useRef(null)

  useEffect(() => {
    let mounted = true
    fbGet(`tournaments/${code}`).then(data => {
      if (!mounted) return
      if (!data) { toast('Tournament not found', true); navigate('/'); return }
      setT(data)
    })
    unsubRef.current = fbListen(`tournaments/${code}`, d => { if (mounted) setT(d) })
    return () => { mounted = false; if (unsubRef.current) try { unsubRef.current() } catch (e) {} }
  }, [code])

  if (!T) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>

  const totalM = T.rounds.reduce((a, r) => a + r.matches.length, 0)
  const savedM = T.rounds.reduce((a, r) => a + r.matches.filter(m => m.saved).length, 0)
  const pct = totalM ? Math.round(savedM / totalM * 100) : 0
  const isCreator = !!(currentUser && T.createdBy && currentUser.username === T.createdBy)
  const isCompleted = T.status === 'completed'

  const saveT = async (updated) => {
    if (!navigator.onLine) { toast('No internet — score saved locally only', true) }
    setT(updated)
    try { await fbSet(`tournaments/${updated.code}`, updated) }
    catch (e) { toast(e.message === 'timeout' ? 'Connection timed out, try again' : 'Save failed — check your connection', true) }
  }

  const handleSaveScore = async (ri, mi, sA, sB) => {
    const updated = JSON.parse(JSON.stringify(T))
    updated.rounds[ri].matches[mi] = { ...updated.rounds[ri].matches[mi], scoreA: sA, scoreB: sB, saved: true }
    await saveT(updated)
    toast('Score saved! 🎾')
    const newTotal = updated.rounds.reduce((a, r) => a + r.matches.length, 0)
    const newSaved = updated.rounds.reduce((a, r) => a + r.matches.filter(m => m.saved).length, 0)
    if (newSaved === newTotal) await commitTournamentToProfiles(updated, currentUser)
  }

  const handleEditScore = async (ri, mi) => {
    const updated = JSON.parse(JSON.stringify(T))
    updated.rounds[ri].matches[mi].saved = false
    await saveT(updated)
  }

  const handleMarkComplete = async () => {
    const confirmed = await showConfirm('Mark as Complete', 'This will lock scoring and save results to player profiles. Continue?', 'Complete 🏁')
    if (!confirmed) return
    const updated = { ...T, status: 'completed', completedAt: new Date().toISOString() }
    await saveT(updated); upsertMyTournament(updated, true)
    await commitTournamentToProfiles(updated, currentUser)
    toast('Tournament completed! Results saved 🏆')
  }

  const handleReopen = async () => {
    const confirmed = await showConfirm('Reopen Tournament', 'This will unlock scoring so matches can be edited again.', 'Reopen 🔓')
    if (!confirmed) return
    const updated = { ...T, status: 'active' }
    delete updated.completedAt
    await saveT(updated); upsertMyTournament(updated, true)
    toast('Tournament reopened — scoring unlocked 🔓')
  }

  const handleDelete = async () => {
    const confirmed = await showConfirm('Delete Tournament', 'This permanently deletes the tournament for everyone. This cannot be undone.', 'Delete 🗑', 'danger')
    if (!confirmed) return
    try { await fbSet(`tournaments/${T.code}`, null) } catch (e) {}
    const list = JSON.parse(localStorage.getItem('pa_my_tourneys') || '[]').filter(t => t.code !== T.code)
    localStorage.setItem('pa_my_tourneys', JSON.stringify(list))
    if (unsubRef.current) try { unsubRef.current() } catch (e) {}
    navigate('/games'); toast('Tournament deleted')
  }

  const copyCode = () => {
    navigator.clipboard.writeText(T.code).catch(() => {})
    setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000)
  }

  const shareLink = () => {
    const url = `${window.location.origin}${window.location.pathname.split('?')[0].replace(/\/tournament.*$/, '')}?join=${T.code}`
    if (navigator.share) {
      navigator.share({ title: T.name, text: `Join my Padel Americano tournament "${T.name}"! 🎾 Code: ${T.code}`, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).catch(() => {})
      setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  const onPlayerTap = async (name) => {
    if (!navigator.onLine) return
    try {
      const all = await fbGet('players')
      if (all) {
        const nameNorm = name.toLowerCase().trim()
        const entry = Object.entries(all).find(([, p]) =>
          !p.redirectTo && (
            (p.displayName || '').toLowerCase().trim() === nameNorm ||
            (p.username || '').toLowerCase() === nameNorm.replace(/\s+/g, '_')
          )
        )
        if (entry) { navigate(`/profile?uid=${entry[0]}&back=tournament`); return }
      }
    } catch (e) {}
  }

  const TopBarArea = () => (
    <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 2, letterSpacing: '-0.5px' }}>{T.name}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{T.players.length} players · {T.pointsPerGame}pts · {T.rounds.length} rounds</div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <AvatarBtn />
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', lineHeight: 1, letterSpacing: '-1px' }}>{pct}%</div>
          <div style={{ color: 'var(--muted)', fontSize: 11 }}>{savedM}/{totalM} played</div>
        </div>
      </div>
      <div className="prog-wrap"><div className="prog-fill" style={{ width: `${pct}%` }} /></div>
      <div className="share-bar">
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2, fontWeight: 700 }}>Share Code</div>
          <div className="share-code">{T.code}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className={`copy-btn${copiedCode ? ' done' : ''}`} onClick={copyCode}>{copiedCode ? '✓ Copied!' : '📋 Copy'}</button>
          <button className={`copy-btn${copiedLink ? ' done' : ''}`} onClick={shareLink}>{copiedLink ? '✓ Copied!' : '🔗 Share'}</button>
        </div>
      </div>
      {isCreator && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {isCompleted ? (
            <>
              <div style={{ flex: 1, padding: '9px 10px', background: 'rgba(107,127,163,0.08)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                ✅ Completed
              </div>
              <button onClick={handleReopen} style={{ flex: 1, padding: '9px 10px', background: 'rgba(0,229,160,0.07)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 12, color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                🔓 Reopen
              </button>
            </>
          ) : (
            <button onClick={handleMarkComplete} style={{ flex: 1, padding: '9px 10px', background: 'rgba(255,209,102,0.07)', border: '1px solid rgba(255,209,102,0.2)', borderRadius: 12, color: 'var(--accent3)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              🏁 Complete
            </button>
          )}
          <button onClick={handleDelete} style={{ padding: '9px 14px', background: 'rgba(255,92,92,0.07)', border: '1px solid rgba(255,92,92,0.2)', borderRadius: 12, color: 'var(--accent2)', fontSize: 18, cursor: 'pointer' }}>🗑</button>
        </div>
      )}
      {!isCreator && isCompleted && (
        <div style={{ background: 'rgba(107,127,163,0.08)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 14px', textAlign: 'center', marginBottom: 8, fontSize: 12, color: 'var(--muted)' }}>
          ✅ Tournament Completed
        </div>
      )}
    </div>
  )

  const RoundsPane = () => (
    <div style={{ padding: '0 0 90px' }}>
      {T.rounds.map((round, ri) => {
        const allSaved = round.matches.every(m => m.saved)
        const byePts = T.byeOption === 'half' ? Math.round(T.pointsPerGame / 2) : 0
        return (
          <div key={ri} style={{ margin: '10px 16px 0', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px' }}>Round {ri + 1}</div>
              <div className="round-badge">{allSaved ? '✓ Complete' : `${round.matches.length} Court${round.matches.length > 1 ? 's' : ''}`}</div>
            </div>
            {round.byes?.length > 0 && (
              <div style={{ background: 'rgba(255,209,102,0.07)', border: '1px solid rgba(255,209,102,0.2)', borderRadius: 10, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: 'var(--accent3)' }}>
                🪑 Sitting out: <strong>{round.byes.join(', ')}</strong> · +{byePts} pts
              </div>
            )}
            {round.matches.map((match, mi) => (
              <MatchCard
                key={`${ri}-${mi}`} match={match} ri={ri} mi={mi}
                ppg={T.pointsPerGame} isCompleted={isCompleted}
                onSave={handleSaveScore} onEdit={handleEditScore} onPlayerTap={onPlayerTap}
              />
            ))}
          </div>
        )
      })}
      <div style={{ height: 10 }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBarArea />
      {activeTab === 'rounds'   && <RoundsPane />}
      {activeTab === 'ranking'  && <div style={{ padding: '0 0 90px' }}><RankingPane T={T} onPlayerTap={onPlayerTap} /></div>}
      {activeTab === 'partners' && <div style={{ padding: '12px 16px 90px' }}><PartnersPane T={T} onPlayerTap={onPlayerTap} /></div>}

      <div className="tab-bar">
        <button className="tab-btn" onClick={() => navigate('/games')}>
          <span className="tab-icon">🏠</span>All Games
        </button>
        {['rounds','ranking','partners'].map(tab => (
          <button key={tab} className={`tab-btn${activeTab === tab ? ' active' : ''}`} onClick={() => setActiveTab(tab)}>
            <span className="tab-icon">{tab === 'rounds' ? '📋' : tab === 'ranking' ? '🏆' : '👥'}</span>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )
}
