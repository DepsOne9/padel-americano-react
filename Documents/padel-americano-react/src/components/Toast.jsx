import { useState, useEffect, useRef, useCallback } from 'react'

const listeners = new Set()

// isErr: true = error (red), 'warn' = warning (yellow), false/undefined = success (green)
export function toast(msg, isErr = false) {
  listeners.forEach(fn => fn({ msg, isErr }))
}

export default function Toast() {
  const [state, setState] = useState({ msg: '', isErr: false, show: false })
  const timerRef = useRef(null)

  const trigger = useCallback(({ msg, isErr }) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setState({ msg, isErr, show: true })
    timerRef.current = setTimeout(() => setState(s => ({ ...s, show: false })), 2600)
  }, [])

  useEffect(() => {
    listeners.add(trigger)
    return () => listeners.delete(trigger)
  }, [trigger])

  const cls = [
    'toast',
    state.show  ? 'show' : '',
    state.isErr === true    ? 'err'  : '',
    state.isErr === 'warn'  ? 'warn' : '',
  ].filter(Boolean).join(' ')

  return <div className={cls}>{state.msg}</div>
}