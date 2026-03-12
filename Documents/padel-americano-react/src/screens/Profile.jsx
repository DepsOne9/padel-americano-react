import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signInWithGoogle, signOutUser, fbGet, fbSet } from '../firebase'
import { toast } from '../components/Toast'
import TopBar from '../components/TopBar'

function fmtDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch (e) { return '' }
}

function roundColor(sc, max = 24) {
  if (sc === null || sc === undefined) return { bg: '#1e3154', color: '#6b7fa3' }
  if (sc === 0) return { bg: '#1e3154', color: '#6b7fa3' }
  const half = max / 2
  if (sc > half)  return { bg: 'rgba(0,229,160,0.18)',  color: '#00e5a0' }
  if (sc === half) return { bg: 'rgba(255,209,102,0.14)', color: '#ffd166' }
  return { bg: 'rgba(255,92,92,0.14)', color: '#ff5c5c' }
}

// ── History entry row ─────────────────────────────────────
function HistoryEntry({ th, isMe, onRemove }) {
  const [open, setOpen] = useState(false)
  const rankColor = th.rank === 1 ? 'var(--accent3)' : th.rank === 2 ? '#aaa' : th.rank === 3 ? '#cd7f32' : 'var(--muted)'
  const rankMedal = th.rank === 1 ? '🥇' : th.rank === 2 ? '🥈' : th.rank === 3 ? '🥉' : ''
  const rankStr   = th.rank ? `#${th.rank} of ${th.totalPlayers || '?'}` : '?'

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{th.name || 'Tournament'}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{fmtDate(th.date)} · {th.ppg || 24}pts/game</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 26, color: 'var(--accent)', lineHeight: 1 }}>{th.points}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>pts</div>
        </div>
        <div style={{ fontSize: 18, flexShrink: 0, color: 'var(--muted)', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>›</div>
      </div>

      {/* stats row — always visible */}
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        {[
          { v: rankMedal || rankStr, l: 'Rank',    c: rankColor },
          { v: `${th.wins}W`,        l: 'Wins',    c: 'var(--accent)' },
          { v: `${th.losses}L`,      l: 'Losses',  c: 'var(--accent2)' },
          { v: th.played,            l: 'Matches', c: 'var(--text)' },
        ].map(cell => (
          <div key={cell.l} style={{ flex: 1, background: 'var(--surface)', borderRadius: 8, padding: '7px 6px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 18, color: cell.c }}>{cell.v}</div>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)' }}>{cell.l}</div>
          </div>
        ))}
      </div>

      {/* expandable detail */}
      {open && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          {th.roundScores?.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Round Scores</div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {th.roundScores.map((sc, i) => {
                  const c = roundColor(sc, th.ppg || 24)
                  return (
                    <div key={i} className="round-dot" style={{ background: c.bg, color: c.color, flex: 1 }}>
                      <span className="rn">{i + 1}</span>
                      {sc === 0 ? 'BYE' : sc}
                    </div>
                  )
                })}
              </div>
            </>
          )}
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Win rate: <strong style={{ color: 'var(--text)' }}>{th.played ? Math.round(th.wins / ((th.wins + th.losses) || 1) * 100) : 0}%</strong>
            {' · '} Avg/match: <strong style={{ color: 'var(--text)' }}>{th.played ? (th.points / th.played).toFixed(1) : 0}</strong>
            {' · '} Code: <strong style={{ color: 'var(--accent)', letterSpacing: 2 }}>{th.code || '—'}</strong>
          </div>
          {isMe && (
            <button
              onClick={e => { e.stopPropagation(); onRemove(th.code) }}
              style={{ width: '100%', marginTop: 10, padding: 9, background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.25)', borderRadius: 10, color: 'var(--accent2)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              🗑 Remove from my profile
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Username setup flow (new Google user) ─────────────────
function UsernameSetup({ googleUser, onDone }) {
  const suggested = (googleUser.displayName || 'player')
    .toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 20) || 'player'

  const [username, setUsername] = useState(suggested)
  const [displayName, setDisplayName] = useState('')
  const [legacy, setLegacy] = useState('')
  const [saving, setSaving] = useState(false)

  const charsOk = /^[a-z0-9_]+$/i.test(username) && username.length > 0
  const lenOk   = username.length >= 3 && username.length <= 30

  const finish = async () => {
    const uname = username.trim().toLowerCase().replace(/\s+/g, '_')
    if (!uname) { toast('Enter a username', true); return }
    if (!/^[a-z0-9_]{3,30}$/.test(uname)) { toast('Username: 3–30 chars, letters/numbers/_ only', true); return }
    if (!navigator.onLine) { toast('No internet connection', true); return }
    setSaving(true)
    try {
      const all = await fbGet('players')
      if (all && Object.values(all).some(p => p.username === uname && !p.redirectTo)) {
        toast('Username already taken', true); setSaving(false); return
      }
      const profile = {
        uid: googleUser.uid, username: uname, email: googleUser.email,
        displayName: displayName.trim() || uname,
        googleDisplayName: googleUser.displayName || '',
        photoURL: googleUser.photoURL || null,
        joinedAt: new Date().toISOString(),
        legacy_points: parseInt(legacy) || 0,
        tournaments: [],
      }
      await fbSet(`players/${googleUser.uid}`, profile)
      onDone(profile)
      toast(`Welcome, ${uname}! 🎾`)
    } catch (e) {
      toast('Setup failed — try again', true)
    }
    setSaving(false)
  }

  return (
    <div style={{ padding: '24px 16px 90px' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        {googleUser.photoURL
          ? <img src={googleUser.photoURL} style={{ width: 64, height: 64, borderRadius: '50%', border: '3px solid var(--accent)', display: 'block', margin: '0 auto 10px' }} alt="" />
          : <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,229,160,0.1)', border: '3px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 10px' }}>👤</div>
        }
        <div style={{ fontSize: 15, fontWeight: 700 }}>{googleUser.displayName || 'Google User'}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{googleUser.email}</div>
      </div>

      <div style={{ background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>One more step — choose your username</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>This is your public name in the app. It also links your name in tournament player lists to this account.</div>
      </div>

      <div className="fg">
        <label>Username</label>
        <input
          type="text" value={username} autoCapitalize="none" autoCorrect="off" spellCheck="false"
          onChange={e => setUsername(e.target.value.toLowerCase())}
          style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}
        />
        <div style={{ marginTop: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: charsOk ? 'var(--accent)' : 'var(--muted)', marginBottom: 5 }}>
            <span style={{ fontSize: 14 }}>{charsOk ? '✓' : '○'}</span>Only letters (a–z), numbers, and underscores _
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: lenOk ? 'var(--accent)' : 'var(--muted)' }}>
            <span style={{ fontSize: 14 }}>{lenOk ? '✓' : '○'}</span>Between 3 and 30 characters
          </div>
        </div>
      </div>

      <div className="fg">
        <label>Tournament Display Name <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 10, letterSpacing: 0 }}>(optional)</span></label>
        <input type="text" placeholder="e.g. Carlos" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>
          Enter this <strong style={{ color: 'var(--text)' }}>exactly</strong> as you type your name in tournament player lists — it auto-links results to your profile.
        </div>
      </div>

      <div className="fg">
        <label>Legacy Points <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 10, letterSpacing: 0 }}>(optional)</span></label>
        <input type="number" placeholder="0" min="0" value={legacy} onChange={e => setLegacy(e.target.value)} />
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Points earned before using this app</div>
      </div>

      <button className="btn btn-primary" onClick={finish} disabled={saving}>
        {saving ? 'Saving…' : 'FINISH SETUP →'}
      </button>
      <button
        onClick={async () => { await signOutUser() }}
        style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', padding: '8px 0' }}
      >
        ← Use a different Google account
      </button>
    </div>
  )
}

// ── Public profile view (by uid) ──────────────────────────
function PublicProfile({ uid, isMe, onBack }) {
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    const data = await fbGet(`players/${uid}`)
    setPlayer(data)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [uid])

  const handleRemove = async (code) => {
    if (!player) return
    const updated = (player.tournaments || []).filter(t => (t.code || '') !== String(code))
    await fbSet(`players/${uid}`, { ...player, tournaments: updated })
    setPlayer({ ...player, tournaments: updated })
    toast('Tournament removed ✓')
  }

  if (loading) return <div className="spinner" style={{ marginTop: 60 }} />
  if (!player) return <div className="empty"><div className="ei">👤</div>Profile not found</div>

  const history = player.tournaments || []
  let totalPts = player.legacy_points || 0, totalWins = 0, totalLosses = 0, totalPlayed = 0
  history.forEach(th => { totalPts += th.points || 0; totalWins += th.wins || 0; totalLosses += th.losses || 0; totalPlayed += th.played || 0 })
  const winRate = totalPlayed > 0 ? Math.round(totalWins / ((totalWins + totalLosses) || 1) * 100) : 0
  const avg     = totalPlayed > 0 ? (totalPts / totalPlayed).toFixed(1) : 0

  const avatarContent = player.avatar
    ? <img src={player.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="" />
    : (player.username || '?')[0].toUpperCase()

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '52px 16px 14px', background: 'linear-gradient(180deg,var(--surface) 0%,transparent 100%)' }}>
        <button onClick={onBack} style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 16px', borderRadius: 50, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>← Back</button>
      </div>

      <div style={{ background: 'linear-gradient(180deg,var(--surface),transparent)', padding: '4px 20px 16px', textAlign: 'center' }}>
        <div className="profile-avatar-big" style={{ overflow: 'hidden' }}>{avatarContent}</div>
        <div className="profile-name-big">{player.username}</div>
        <div className="profile-joined">Member since {fmtDate(player.joinedAt)}{player.legacy_points ? ` · +${player.legacy_points} legacy pts` : ''}</div>
      </div>

      <div className="psg-grid">
        <div className="psg-cell gold"><span className="pv">{totalPts}</span><span className="pl">Total Pts</span></div>
        <div className="psg-cell"><span className="pv">{totalWins}</span><span className="pl">Wins</span></div>
        <div className="psg-cell warn"><span className="pv">{totalLosses}</span><span className="pl">Losses</span></div>
      </div>
      <div className="psg-grid" style={{ marginBottom: 16 }}>
        <div className="psg-cell"><span className="pv">{winRate}%</span><span className="pl">Win Rate</span></div>
        <div className="psg-cell"><span className="pv">{avg}</span><span className="pl">Avg/Match</span></div>
        <div className="psg-cell"><span className="pv">{history.length}</span><span className="pl">Tourneys</span></div>
      </div>

      <div style={{ padding: '0 16px' }}>
        <div className="sec">Tournament History</div>
        {history.length === 0
          ? <div className="empty"><div className="ei">🎾</div>No tournaments recorded yet.</div>
          : [...history].reverse().slice(0, 10).map((th, i) => (
              <HistoryEntry key={i} th={th} isMe={isMe} onRemove={handleRemove} />
            ))
        }
        {isMe && player.legacy_points > 0 && (
          <div style={{ background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--accent3)', marginTop: 8 }}>
            ⭐ Includes {player.legacy_points} legacy points
          </div>
        )}
      </div>
    </div>
  )
}

// ── My account pane ───────────────────────────────────────
function MyAccount({ u, onSignOut }) {
  const { setCurrentUser } = useAuth()
  const [editingUsername, setEditingUsername] = useState(false)
  const [newUsername, setNewUsername]         = useState('')
  const [editingDisplay, setEditingDisplay]   = useState(false)
  const [newDisplay, setNewDisplay]           = useState('')
  const [savingUser, setSavingUser]           = useState(false)
  const [savingDisplay, setSavingDisplay]     = useState(false)
  const fileRef = useRef(null)

  const lastChange = u.lastUsernameChange ? new Date(u.lastUsernameChange) : null
  const daysSince  = lastChange ? Math.floor((Date.now() - lastChange) / (1000 * 60 * 60 * 24)) : 999
  const canChange  = daysSince >= 14
  const daysLeft   = 14 - daysSince

  const saveProfile = async (updates) => {
    const updated = { ...u, ...updates }
    await fbSet(`players/${u.uid}`, updated)
    setCurrentUser({ ...updated, email: u.email })
    return updated
  }

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0]; if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast('Image too large (max 5MB)', true); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 80; canvas.height = 80
        const ctx = canvas.getContext('2d')
        const size = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 80, 80)
        saveProfile({ avatar: canvas.toDataURL('image/jpeg', 0.82) })
          .then(() => toast('Profile photo updated ✓'))
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  const doUsernameChange = async () => {
    const uname = newUsername.trim().toLowerCase().replace(/\s+/g, '_')
    if (!uname) { toast('Enter a username', true); return }
    if (!/^[a-z0-9_]+$/.test(uname)) { toast('Letters, numbers, _ only', true); return }
    if (uname === u.username) { setEditingUsername(false); return }
    setSavingUser(true)
    const all = await fbGet('players')
    if (all && Object.values(all).some(p => p.username === uname && !p.redirectTo)) {
      toast('Username already taken', true); setSavingUser(false); return
    }
    await saveProfile({ username: uname, lastUsernameChange: new Date().toISOString() })
    setSavingUser(false)
    setEditingUsername(false)
    toast(`Username changed to ${uname} ✓`)
  }

  const doDisplayNameChange = async () => {
    const val = newDisplay.trim()
    if (!val) { toast('Enter a display name', true); return }
    setSavingDisplay(true)
    await saveProfile({ displayName: val })
    setSavingDisplay(false)
    setEditingDisplay(false)
    toast(`Display name set to "${val}" ✓`)
  }

  const avatarContent = u.avatar
    ? <img src={u.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="" />
    : u.photoURL
      ? <img src={u.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="" />
      : u.username[0].toUpperCase()

  return (
    <div style={{ paddingBottom: 90 }}>
      {/* avatar + username */}
      <div style={{ textAlign: 'center', padding: '20px 16px 16px' }}>
        <div style={{ position: 'relative', width: 82, margin: '0 auto 12px' }}>
          <div style={{ width: 82, height: 82, borderRadius: '50%', background: 'rgba(0,229,160,0.1)', border: '3px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', cursive", fontSize: 38, color: 'var(--accent)', overflow: 'hidden' }}>
            {avatarContent}
          </div>
          <label htmlFor="avatar-upload" style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, border: '2px solid var(--bg)' }}>📷</label>
          <input type="file" id="avatar-upload" accept="image/*" ref={fileRef} style={{ display: 'none' }} onChange={handleAvatarUpload} />
        </div>

        {/* Google badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 50, padding: '4px 10px', marginBottom: 10 }}>
          <svg width="13" height="13" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-3.58-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Signed in with Google</span>
        </div>

        {/* username */}
        {!editingUsername ? (
          <div>
            <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 32, letterSpacing: 2 }}>{u.username}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Member since {fmtDate(u.joinedAt)}</div>
            {canChange
              ? <button onClick={() => { setNewUsername(u.username); setEditingUsername(true) }} style={{ marginTop: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', padding: '5px 14px', borderRadius: 50, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✏️ Change username</button>
              : <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>Change available in <strong style={{ color: 'var(--accent3)' }}>{daysLeft}d</strong></div>
            }
          </div>
        ) : (
          <div style={{ marginTop: 10 }}>
            <input value={newUsername} onChange={e => setNewUsername(e.target.value.toLowerCase())} autoFocus autoCapitalize="none"
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 15, outline: 'none', textAlign: 'center', marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={doUsernameChange} disabled={savingUser}>{savingUser ? 'Saving…' : 'Save'}</button>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setEditingUsername(false)}>Cancel</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>You can change again in 14 days</div>
          </div>
        )}
      </div>

      {/* display name row */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,229,160,0.05)', border: '1px solid rgba(0,229,160,0.15)', borderRadius: 10, padding: '9px 12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 2 }}>Tournament Name</div>
            <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.displayName || u.username}</div>
          </div>
          <button onClick={() => { setNewDisplay(u.displayName || ''); setEditingDisplay(true) }} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>✏️ Edit</button>
        </div>
        {editingDisplay && (
          <div style={{ marginTop: 8, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
            <input type="text" placeholder="e.g. Carlos" value={newDisplay} onChange={e => setNewDisplay(e.target.value)}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 14, outline: 'none', marginBottom: 8 }}
            />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>Use this exact name when joining tournaments to auto-link results.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={doDisplayNameChange} disabled={savingDisplay}>{savingDisplay ? 'Saving…' : 'Save'}</button>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setEditingDisplay(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* stats */}
      <StatsSection uid={u.uid} />

      {/* sign out */}
      <div style={{ padding: '8px 16px 0' }}>
        <button className="btn btn-danger" onClick={onSignOut}>Sign Out</button>
      </div>
    </div>
  )
}

// Loads stats async from Firebase
function StatsSection({ uid }) {
  const [player, setPlayer] = useState(null)
  const { setCurrentUser, currentUser } = useAuth()

  useEffect(() => {
    fbGet(`players/${uid}`).then(p => setPlayer(p))
  }, [uid])

  const handleRemove = async (code) => {
    if (!player) return
    const updated = (player.tournaments || []).filter(t => (t.code || '') !== String(code))
    await fbSet(`players/${uid}`, { ...player, tournaments: updated })
    setPlayer({ ...player, tournaments: updated })
    if (currentUser?.uid === uid) {
      setCurrentUser(prev => ({ ...prev, tournaments: updated }))
    }
    toast('Tournament removed ✓')
  }

  if (!player) return <div className="spinner" style={{ margin: '20px auto' }} />

  const history = player.tournaments || []
  let totalPts = player.legacy_points || 0, totalWins = 0, totalLosses = 0, totalPlayed = 0
  history.forEach(th => { totalPts += th.points || 0; totalWins += th.wins || 0; totalLosses += th.losses || 0; totalPlayed += th.played || 0 })
  const winRate = totalPlayed > 0 ? Math.round(totalWins / ((totalWins + totalLosses) || 1) * 100) : 0
  const avg     = totalPlayed > 0 ? (totalPts / totalPlayed).toFixed(1) : 0

  return (
    <>
      <div className="psg-grid" style={{ marginTop: 4 }}>
        <div className="psg-cell gold"><span className="pv">{totalPts}</span><span className="pl">Total Pts</span></div>
        <div className="psg-cell"><span className="pv">{totalWins}</span><span className="pl">Wins</span></div>
        <div className="psg-cell warn"><span className="pv">{totalLosses}</span><span className="pl">Losses</span></div>
      </div>
      <div className="psg-grid" style={{ marginBottom: 16 }}>
        <div className="psg-cell"><span className="pv">{winRate}%</span><span className="pl">Win Rate</span></div>
        <div className="psg-cell"><span className="pv">{avg}</span><span className="pl">Avg/Match</span></div>
        <div className="psg-cell"><span className="pv">{history.length}</span><span className="pl">Tourneys</span></div>
      </div>

      <div style={{ padding: '0 16px' }}>
        <div className="sec">Tournament History</div>
        {history.length === 0
          ? <div className="empty"><div className="ei">🎾</div>No tournaments recorded yet.<br /><span style={{ fontSize: 12 }}>Finish a tournament to see it here!</span></div>
          : [...history].reverse().slice(0, 10).map((th, i) => (
              <HistoryEntry key={i} th={th} isMe={true} onRemove={handleRemove} />
            ))
        }
        {history.length >= 10 && <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', padding: '6px 0 4px' }}>Showing last 10 tournaments</div>}
        {player.legacy_points > 0 && (
          <div style={{ background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--accent3)', marginTop: 8 }}>
            ⭐ Includes {player.legacy_points} legacy points
          </div>
        )}
      </div>
    </>
  )
}

// ── Root Profile screen ───────────────────────────────────
export default function Profile() {
  const { currentUser, setCurrentUser, pendingGoogleUser, setPendingGoogleUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const viewUid = searchParams.get('uid')   // ?uid=XXX  → view public profile
  const backTo  = searchParams.get('back')  // ?back=tournament|ranking|games

  const handleSignIn = async () => {
    try { await signInWithGoogle() }
    catch (e) {
      const code = e.code || ''
      if (!['auth/popup-closed-by-user','auth/cancelled-popup-request','auth/popup-blocked'].includes(code)) {
        toast('Sign in failed: ' + code, true)
      }
      if (code === 'auth/popup-blocked') toast('Popup blocked — allow popups for this site', true)
    }
  }

  const handleSignOut = async () => {
    await signOutUser()
    setCurrentUser(null)
    setPendingGoogleUser(null)
    toast('Signed out')
  }

  const goBack = () => {
    if (viewUid) { navigate(-1); return }
    if (backTo === 'tournament') { navigate(-1); return }
    if (backTo === 'ranking') { navigate('/ranking'); return }
    if (backTo === 'games')   { navigate('/games'); return }
    navigate('/profile')
  }

  // ── Viewing someone else's profile ──
  if (viewUid) {
    const isMe = currentUser?.uid === viewUid
    return (
      <div className="screen" style={{ overflowY: 'auto' }}>
        <PublicProfile uid={viewUid} isMe={isMe} onBack={goBack} />
      </div>
    )
  }

  // ── Pending Google user — needs username setup ──
  if (pendingGoogleUser) {
    return (
      <div className="screen" style={{ overflowY: 'auto' }}>
        <TopBar title="PROFILE" hideAvatar />
        <UsernameSetup
          googleUser={pendingGoogleUser}
          onDone={(profile) => {
            setCurrentUser({ ...profile, email: pendingGoogleUser.email })
            setPendingGoogleUser(null)
          }}
        />
      </div>
    )
  }

  // ── Not signed in ──
  if (!currentUser) {
    return (
      <div className="screen">
        <TopBar title="PROFILE" hideAvatar />
        <div style={{ padding: '24px 16px 0' }}>
          <div style={{ background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent3)', marginBottom: 5 }}>👋 App updated to Google Sign-In</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>Old username/password accounts are no longer supported. Sign in with Google to create a new account.</div>
          </div>
          <button className="btn btn-google" onClick={handleSignIn}>
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-3.58-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Continue with Google
          </button>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 14 }}>Your Google account is only used for sign-in.<br />Choose any username after signing in.</div>
        </div>
      </div>
    )
  }

  // ── My account ──
  return (
    <div className="screen" style={{ overflowY: 'auto' }}>
      <TopBar title="PROFILE" />
      <MyAccount u={currentUser} onSignOut={handleSignOut} />
    </div>
  )
}