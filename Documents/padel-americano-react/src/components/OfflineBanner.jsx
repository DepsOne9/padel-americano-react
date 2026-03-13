import { useState, useEffect } from 'react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const on  = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  if (!offline) return null
  return (
    <div style={{
      background: 'rgba(255,92,92,0.12)',
      borderBottom: '1px solid rgba(255,92,92,0.25)',
      padding: '8px 16px',
      textAlign: 'center',
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--accent2)',
      position: 'sticky',
      top: 0,
      zIndex: 200,
    }}>
      ⚠ No internet connection — changes won't save until you're back online
    </div>
  )
}