import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fbSet } from '../firebase'
import { toast } from '../components/Toast'
import TopBar from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { upsertMyTournament } from './Home'

function generateSchedule(players, numRounds) {
  const n = players.length, courts = Math.floor(n / 4), ppr = courts * 4, rounds = []
  let byePool = []
  for (let r = 0; r < numRounds; r++) {
    const round = { matches: [], byes: [] }
    let active
    if (n % 4 === 0) {
      active = [...players]
    } else {
      const need = n - ppr
      if (byePool.length < need) byePool = [...players]
      const sitting = byePool.splice(0, need)
      round.byes = sitting
      active = players.filter(p => !sitting.includes(p))
    }
    const arr = [active[0], ...active.slice(1).map((_, i) => active[1 + ((i + r) % (active.length - 1))])]
    const half = Math.floor(arr.length / 2), inter = []
    for (let i = 0; i < half; i++) { inter.push(arr[i]); inter.push(arr[i + half]) }
    for (let c = 0; c < courts; c++)
      round.matches.push({ teamA: [inter[c*4], inter[c*4+1]], teamB: [inter[c*4+2], inter[c*4+3]], scoreA: null, scoreB: null, saved: false })
    rounds.push(round)
  }
  return rounds
}

export default function Setup() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  const [name, setName] = useState('')
  const [ppg, setPpg] = useState('24')
  const [numRounds, setNumRounds] = useState('5')
  const [nPlayers, setNPlayers] = useState('8')
  const [playerNames, setPlayerNames] = useState(Array(8).fill(''))
  const [byeChoice, setByeChoice] = useState('half')
  const [loading, setLoading] = useState(false)

  const n = parseInt(nPlayers)
  const courts = Math.floor(n / 4)
  const byes = n - courts * 4
  const byePts = Math.round(parseInt(ppg) / 2)

  const handleNPlayersChange = (val) => {
    const newN = parseInt(val)
    setNPlayers(val)
    setPlayerNames(prev => {
      const next = [...prev]
      while (next.length < newN) next.push('')
      return next.slice(0, newN)
    })
  }

  const setPlayerName = (i, val) => {
    setPlayerNames(prev => { const n = [...prev]; n[i] = val; return n })
  }

  const create = async () => {
    if (!navigator.onLine) { toast('No internet connection', true); return }
    const players = playerNames.map((v, i) => v.trim() || `Player ${i + 1}`)
    if (players.length < 4) { toast('Need at least 4 players', true); return }
    const code = Math.random().toString(36).slice(2, 7).toUpperCase()
    const T = {
      code, name: name.trim() || 'Americano Tournament',
      pointsPerGame: parseInt(ppg), players,
      rounds: generateSchedule(players, parseInt(numRounds)),
      byeOption: players.length % 4 !== 0 ? byeChoice : null,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.username || null,
    }
    setLoading(true)
    try {
      await fbSet(`tournaments/${code}`, T)
    } catch (e) {
      setLoading(false)
      toast(e.message === 'timeout' ? 'Connection timed out, try again' : 'Save failed', true)
      return
    }
    setLoading(false)
    upsertMyTournament(T, true)
    toast(`Created! Code: ${T.code}`)
    navigate(`/tournament/${code}`)
  }

  return (
    <div className="screen">
      <TopBar title="new" subtitle="Configure your session" showBack onBack={() => navigate('/')} />

      <div className="wrap" style={{ paddingTop: 8 }}>
        <div className="fg">
          <label>Tournament Name</label>
          <input type="text" placeholder="e.g. Saturday Americano" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="row">
          <div className="fg" style={{ flex: 1 }}>
            <label>Points / Game</label>
            <select value={ppg} onChange={e => setPpg(e.target.value)}>
              <option value="16">16 pts</option>
              <option value="24">24 pts</option>
              <option value="32">32 pts</option>
              <option value="48">48 pts</option>
            </select>
          </div>
          <div className="fg" style={{ flex: 1 }}>
            <label>Rounds</label>
            <select value={numRounds} onChange={e => setNumRounds(e.target.value)}>
              {['3','4','5','6','7','8'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="fg">
          <label>Number of Players</label>
          <select value={nPlayers} onChange={e => handleNPlayersChange(e.target.value)}>
            {['4','5','6','7','8','10','12','16'].map(v => (
              <option key={v} value={v}>{v} players</option>
            ))}
          </select>
        </div>

        <div className="sec">Player Names</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {playerNames.map((val, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent)', minWidth: 24, textAlign: 'center' }}>{i + 1}</span>
              <input
                type="text"
                placeholder={`Player ${i + 1}`}
                value={val}
                onChange={e => setPlayerName(i, e.target.value)}
                style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 14px', color: 'var(--text)', fontSize: 15, fontWeight: 500, outline: 'none' }}
              />
            </div>
          ))}
        </div>

        {byes > 0 && (
          <div>
            <div className="bye-notice">
              ⚠ With {n} players, {byes} player{byes > 1 ? 's' : ''} sit out each round.
            </div>
            <div className="sec">Bye Compensation</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Players sitting out a round receive:</div>
            <div className="row" style={{ marginBottom: 16 }}>
              <button className={`bye-opt${byeChoice === 'half' ? ' sel' : ''}`} onClick={() => setByeChoice('half')}>
                Half points<br /><span style={{ fontSize: 11, opacity: 0.7 }}>{byePts} pts</span>
              </button>
              <button className={`bye-opt${byeChoice === 'zero' ? ' sel' : ''}`} onClick={() => setByeChoice('zero')}>
                Zero points<br /><span style={{ fontSize: 11, opacity: 0.7 }}>0 pts</span>
              </button>
            </div>
          </div>
        )}

        <button className="btn btn-primary" onClick={create} disabled={loading}>
          {loading ? 'Saving…' : '🎾 Start & Share'}
        </button>
      </div>
    </div>
  )
}
