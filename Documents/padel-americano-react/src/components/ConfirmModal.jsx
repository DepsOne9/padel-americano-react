import { useState, useEffect } from 'react'

// Global promise-based confirm
let _resolve = null
let _setModal = null

export function showConfirm(title, body, okLabel = 'Confirm', variant = 'default') {
  return new Promise(resolve => {
    _resolve = resolve
    _setModal && _setModal({ open: true, title, body, okLabel, variant })
  })
}

export default function ConfirmModal() {
  const [modal, setModal] = useState({ open: false, title: '', body: '', okLabel: 'Confirm', variant: 'default' })
  _setModal = setModal

  const close = (result) => {
    setModal(m => ({ ...m, open: false }))
    if (_resolve) { _resolve(result); _resolve = null }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(8,15,30,0.85)',
        zIndex: 300,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        opacity: modal.open ? 1 : 0,
        pointerEvents: modal.open ? 'all' : 'none',
        transition: 'opacity 0.2s',
      }}
      onClick={e => { if (e.target === e.currentTarget) close(false) }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '18px 18px 0 0',
        width: '100%', maxWidth: 480,
        padding: '24px 20px 36px',
        transform: modal.open ? 'translateY(0)' : 'translateY(20px)',
        transition: 'transform 0.25s',
      }}>
        <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 26, letterSpacing: 2, marginBottom: 6 }}>
          {modal.title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.5 }}>
          {modal.body}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => close(true)}
            style={{
              flex: 1, padding: '15px 20px', borderRadius: 14, border: 'none',
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
              background: modal.variant === 'danger' ? 'var(--accent2)' : 'var(--accent)',
              color: modal.variant === 'danger' ? '#fff' : 'var(--bg)',
            }}
          >
            {modal.okLabel}
          </button>
          <button
            onClick={() => close(false)}
            style={{
              flex: 1, padding: '15px 20px', borderRadius: 14,
              border: '1px solid var(--border)',
              background: 'var(--card)', color: 'var(--text)',
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}