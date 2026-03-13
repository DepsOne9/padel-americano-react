import AvatarBtn from './AvatarBtn'

export default function TopBar({ title, subtitle, showBack, onBack, hideAvatar }) {
  return (
    <div className="top-bar" style={{ position: 'relative' }}>
      {/* invisible spacer */}
      <div style={{ visibility: 'hidden' }}>
        <div className="avatar-btn" />
      </div>

      {/* centered title */}
      <div style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', pointerEvents: 'none',
      }}>
        <div className="top-bar-logo">
          {title}<span>.</span>
        </div>
        {subtitle && (
          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* right: back or avatar */}
      {showBack ? (
        <button onClick={onBack} className="btn-back">← Back</button>
      ) : hideAvatar ? (
        <div style={{ visibility: 'hidden' }}><div className="avatar-btn" /></div>
      ) : (
        <AvatarBtn />
      )}
    </div>
  )
}
