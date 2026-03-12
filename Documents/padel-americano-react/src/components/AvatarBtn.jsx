import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
import AvatarDropdown from './AvatarDropdown'

export default function AvatarBtn() {
  const { currentUser } = useAuth()
  const [open, setOpen] = useState(false)

  const avatarContent = currentUser?.avatar
    ? <img src={currentUser.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="" />
    : currentUser?.username
      ? currentUser.username[0].toUpperCase()
      : '👤'

  const extraStyle = currentUser
    ? {}
    : { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted)' }

  return (
    <>
      <div
        className="avatar-btn"
        style={extraStyle}
        onClick={() => setOpen(true)}
      >
        {avatarContent}
      </div>
      {open && <AvatarDropdown onClose={() => setOpen(false)} />}
    </>
  )
}