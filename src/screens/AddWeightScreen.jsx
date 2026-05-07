import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Toast, useToast } from '../components/Toast'

export function AddWeightScreen({ dog, onAdd, onNavigate }) {
  const { t } = useTranslation()
  const { toast, showToast } = useToast()
  const [value, setValue] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    const v = parseFloat(value.replace(',', '.'))
    if (isNaN(v) || v <= 0) e.value = t('errors.weightInvalid')
    else if (v < 0.5) e.value = t('errors.weightTooLow')
    else if (v > 120) e.value = t('errors.weightTooHigh')
    if (!date) e.date = t('errors.dateRequired')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    const v = parseFloat(value.replace(',', '.'))
    await onAdd(v, date, note.trim())
    showToast(t('weight.saved'))
    setValue('')
    setNote('')
    setTimeout(() => onNavigate('dashboard'), 1200)
  }

  if (!dog) {
    return (
      <div className="screen">
        <div className="empty-state">
          <div className="empty-state-icon">🐶</div>
          <div className="empty-state-text">{t('setup.title')}</div>
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}
              onClick={() => onNavigate('settings')}>
              {t('settings.dogProfile')} →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="page-header">
        <h1 className="page-title">⚖️ {t('weight.title')}</h1>
        {/* Current dog badge top-right */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--blue-light)', borderRadius: 99,
          padding: '4px 12px', fontSize: 13, fontWeight: 700, color: 'var(--blue)'
        }}>
          🐾 {dog.name}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">{t('weight.value')}</label>
        <input
          className="form-input"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0.1"
          max="120"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={t('weight.valuePlaceholder')}
          style={{ fontSize: 32, fontWeight: 700, textAlign: 'center', letterSpacing: 1 }}
        />
        {errors.value && <div className="form-error">{errors.value}</div>}
      </div>

      <div className="form-group">
        <label className="form-label">{t('weight.date')}</label>
        <input
          className="form-input"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
        />
        {errors.date && <div className="form-error">{errors.date}</div>}
      </div>

      <div className="form-group">
        <label className="form-label">{t('weight.note')}</label>
        <input
          className="form-input"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={t('weight.notePlaceholder')}
          maxLength={100}
        />
      </div>

      <button className="btn btn-primary" onClick={handleSave}>
        ✓ {t('weight.save')}
      </button>

      <Toast message={toast} />
    </div>
  )
}
