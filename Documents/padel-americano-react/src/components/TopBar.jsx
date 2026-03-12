import AvatarBtn from './AvatarBtn'

export default function TopBar({ title, subtitle, showBack, onBack, hideAvatar }) {
  return (
    <div className="top-bar" style={{ position: 'relative' }}>
      {/* invisible spacer to balance the avatar on the right */}
      <div style={{ visibility: 'hidden' }}>
        <div className="avatar-btn" />
      </div>

      {/* centered title */}
      <div style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', pointerEvents: 'none',
      }}>
        <div className="top-bar-logo">{title}</div>
        {subtitle && (
          <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)' }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* right side: back button or avatar */}
      {showBack ? (
        <button
          onClick={onBack}
          style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            color: 'var(--text)', padding: '8px 16px', borderRadius: 50,
            fontSize: 13, cursor: 'pointer',
          }}
        >
          ← Back
        </button>
      ) : hideAvatar ? (
        <div style={{ visibility: 'hidden' }}><div className="avatar-btn" /></div>
      ) : (
        <AvatarBtn />
      )}
    </div>
  )
}