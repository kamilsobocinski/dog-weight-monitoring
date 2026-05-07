import { useState, useRef, useEffect } from 'react'

export function DogSelector({ dogs, selectedDog, onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler) }
  }, [])

  if (!selectedDog) return null

  return (
    <div className="dog-selector" ref={ref}>
      <button className="dog-selector-btn" onClick={() => setOpen(o => !o)}>
        <span>{selectedDog.name}</span>
        <span className={`dog-selector-arrow${open ? ' open' : ''}`}>▼</span>
      </button>
      {open && dogs.length > 1 && (
        <div className="dog-selector-list">
          {dogs.map(d => (
            <div
              key={d.id}
              className={`dog-selector-option${d.id === selectedDog.id ? ' active' : ''}`}
              onMouseDown={() => { onSelect(d.id); setOpen(false) }}
              onTouchEnd={() => { onSelect(d.id); setOpen(false) }}
            >
              🐾 {d.name}
              {d.id === selectedDog.id && <span style={{ marginLeft: 'auto', color: 'var(--blue)' }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
