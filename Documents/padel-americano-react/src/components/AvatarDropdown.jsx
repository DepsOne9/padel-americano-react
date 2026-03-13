import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signInWithGoogle, signOutUser } from '../firebase'
import { toast } from './Toast'

export default function AvatarDropdown({ onClose }) {
  const { currentUser, setCurrentUser } = useAuth()
  const navigate = useNavigate()
  const overlayRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (overlayRef.current && e.target === overlayRef.current) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleSignIn = async () => {
    try { await signInWithGoogle(); onClose() }
    catch (e) { toast('Sign in failed', true) }
  }

  const handleSignOut = async () => {
    await signOutUser()
    setCurrentUser(null)
    onClose()
    toast('Signed out')
  }

  const avatarSrc = currentUser?.avatar || currentUser?.photoURL

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(8,15,30,0.75)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
        padding: '60px 16px 0',
      }}
    >
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 18, padding: 16, minWidth: 220, maxWidth: 280,
        animation: 'fadeUp 0.2s ease forwards',
      }}>
        {currentUser && !currentUser._pendingSetup ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%',
                background: 'rgba(0,229,160,0.08)', border: '1.5px solid rgba(0,229,160,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 800, color: 'var(--accent)',
                overflow: 'hidden', flexShrink: 0,
              }}>
                {avatarSrc
                  ? <img src={avatarSrc} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="" />
                  : (currentUser.displayName || currentUser.username || '?')[0].toUpperCase()
                }
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.3px' }}>{currentUser.displayName || currentUser.username}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{currentUser.email || ''}</div>
              </div>
            </div>
            <button className="btn btn-secondary" style={{ marginBottom: 8, fontSize: 14, padding: '10px 16px' }} onClick={() => { onClose(); navigate('/profile') }}>
              📊 View Profile
            </button>
            <button className="btn btn-danger" style={{ fontSize: 14, padding: '10px 16px' }} onClick={handleSignOut}>
              Sign Out
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, textAlign: 'center', lineHeight: 1.5 }}>
              Sign in to track your stats across all tournaments
            </div>
            <button className="btn btn-primary" style={{ fontSize: 14, padding: '12px 16px' }} onClick={handleSignIn}>
              Sign in with Google
            </button>
          </>
        )}
      </div>
    </div>
  )
}
