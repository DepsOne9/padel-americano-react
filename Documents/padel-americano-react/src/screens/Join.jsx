import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fbGet } from '../firebase'
import { toast } from '../components/Toast'
import TopBar from '../components/TopBar'
import { upsertMyTournament } from './Home'

export default function Join() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const doJoin = async () => {
    const c = code.trim().toUpperCase()
    if (c.length < 3) { toast('Enter a valid code', true); return }
    if (!navigator.onLine) { toast('No internet connection', true); return }
    setLoading(true)
    const data = await fbGet(`tournaments/${c}`)
    setLoading(false)
    if (!data) { toast('Tournament not found', true); return }
    upsertMyTournament(data, false)
    toast(`Joined ${data.name}!`)
    navigate(`/tournament/${c}`)
  }

  return (
    <div className="screen">
      <TopBar title="JOIN" subtitle="Enter tournament code" showBack onBack={() => navigate('/')} />

      <div className="wrap" style={{ paddingTop: 8 }}>
        <div className="card">
          <div className="fg">
            <label>Tournament Code</label>
            <input
              type="text"
              maxLength={5}
              placeholder="XXXXX"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && doJoin()}
              style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', letterSpacing: 8, textTransform: 'uppercase' }}
            />
          </div>
          <button className="btn btn-primary" onClick={doJoin} disabled={loading}>
            {loading ? 'Searching…' : 'JOIN →'}
          </button>
        </div>
      </div>
    </div>
  )
}