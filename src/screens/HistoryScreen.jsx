import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'

export function HistoryScreen({ dog, weights, onDelete }) {
  const { t } = useTranslation()
  const [confirmId, setConfirmId] = useState(null)

  if (!dog || weights.length === 0) {
    return (
      <div className="screen">
        <div className="page-header">
          <h1 className="page-title">📋 {t('history.title')}</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">{t('history.noData')}</div>
        </div>
      </div>
    )
  }

  const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date))

  const handleDelete = async (id) => {
    await onDelete(id)
    setConfirmId(null)
  }

  return (
    <div className="screen">
      <div className="page-header">
        <h1 className="page-title">📋 {t('history.title')}</h1>
        <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>{dog.name}</span>
      </div>

      <div className="card">
        {sorted.map((w, i) => {
          const prev = sorted[i + 1]
          let delta = null
          if (prev) {
            const d = w.value - prev.value
            delta = d
          }

          return (
            <div key={w.id}>
              {confirmId === w.id ? (
                <div className="weight-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t('weight.confirmDelete')}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-danger" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => handleDelete(w.id)}>
                      {t('weight.delete')}
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => setConfirmId(null)}>
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <div className="weight-row">
                  <div className="weight-date">{format(parseISO(w.date), 'dd.MM.yyyy')}</div>
                  <div>
                    <div className="weight-val">{w.value} kg</div>
                    {w.note && <div className="weight-note">{w.note}</div>}
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {delta !== null && (
                      <span className={delta > 0.05 ? 'weight-delta-up' : delta < -0.05 ? 'weight-delta-down' : 'weight-delta-same'}>
                        {delta > 0.05 ? `+${delta.toFixed(1)}` : delta < -0.05 ? delta.toFixed(1) : '±0'}
                      </span>
                    )}
                    <button
                      onClick={() => setConfirmId(w.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-300)', fontSize: 18, padding: '4px', lineHeight: 1 }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
