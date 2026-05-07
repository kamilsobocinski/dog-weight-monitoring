import { useState, useCallback } from 'react'

export function useToast() {
  const [toast, setToast] = useState(null)
  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }, [])
  return { toast, showToast }
}

export function Toast({ message }) {
  if (!message) return null
  return <div className="toast">{message}</div>
}
