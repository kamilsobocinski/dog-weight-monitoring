import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { format, parseISO, differenceInDays } from 'date-fns'
import {
  getVaccinations, addVaccination, deleteVaccination,
  getDewormings, addDeworming, deleteDeworming,
  getParasitePrevention, addParasitePrevention, deleteParasitePrevention,
} from '../utils/db'
import { PRODUCT_NAMES, getProduct, checkCrossReaction, VACCINE_TYPES, REACTION_TYPES } from '../data/products'
import { Toast, useToast } from '../components/Toast'

const TODAY = () => new Date().toISOString().slice(0, 10)

// ─── Small helpers ────────────────────────────────────────────────────────────

function VaccineStatus({ validUntil, t }) {
  if (!validUntil) return null
  const days = differenceInDays(parseISO(validUntil), new Date())
  if (days < 0)  return <span className="status-high">{t('health.vaccinations.expired')}</span>
  if (days < 30) return <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{t('health.vaccinations.expiresSoon', { days })}</span>
  return <span className="status-good">{t('health.vaccinations.valid')}</span>
}

function ReactionBadge({ reaction, t }) {
  if (!reaction || reaction === 'none') return null
  return (
    <span style={{ background: 'var(--orange-light)', color: 'var(--orange)', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
      ⚠️ {t(`health.reactions.${reaction}`)}
    </span>
  )
}

function CrossReactionWarning({ warning, dog, t }) {
  if (!warning) return null
  const msg = warning.level === 'high'
    ? t('health.crossReactionHigh', { name: dog?.name })
    : t('health.crossReactionMedium', {
        name: dog?.name,
        prior: warning.priorProduct,
        ingredient: warning.priorIngredient,
        class: warning.sharedClass,
      })
  return (
    <div style={{ background: 'var(--orange-light)', border: '1px solid var(--orange)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13 }}>
      {msg}
    </div>
  )
}

function ConfirmDelete({ onConfirm, onCancel, t }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <button className="btn btn-danger" style={{ flex: 1, padding: '6px' }} onClick={onConfirm}>{t('settings.confirmYes')}</button>
      <button className="btn btn-secondary" style={{ flex: 1, padding: '6px' }} onClick={onCancel}>{t('settings.confirmNo')}</button>
    </div>
  )
}

// ─── Vaccinations Tab ─────────────────────────────────────────────────────────

function VaccinationsTab({ dog, t, showToast }) {
  const [records, setRecords] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [form, setForm] = useState({
    date: TODAY(), vaccineType: 'rabies', vaccineName: '', batchNumber: '', validUntil: '', vetName: '', note: '',
  })

  const load = useCallback(async () => {
    if (!dog) return
    setRecords((await getVaccinations(dog.id)).reverse())
  }, [dog])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!form.date || !form.vaccineName.trim()) return
    await addVaccination({ dogId: dog.id, ...form })
    showToast(t('health.saved'))
    setShowForm(false)
    setForm({ date: TODAY(), vaccineType: 'rabies', vaccineName: '', batchNumber: '', validUntil: '', vetName: '', note: '' })
    load()
  }

  const handleDelete = async (id) => {
    await deleteVaccination(id)
    setDeleteId(null)
    load()
  }

  return (
    <div>
      {/* Records list */}
      {records.length === 0 && !showForm && (
        <div className="empty-state" style={{ paddingTop: 40 }}>
          <div className="empty-state-icon">💉</div>
          <div className="empty-state-text">{t('health.noData')}</div>
        </div>
      )}

      {records.map(r => (
        <div key={r.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{r.vaccineName}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                {t(`health.vaccineTypes.${r.vaccineType}`)} · {format(parseISO(r.date), 'dd.MM.yyyy')}
              </div>
              {r.validUntil && (
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {t('health.vaccinations.validUntil')}: {format(parseISO(r.validUntil), 'dd.MM.yyyy')} · <VaccineStatus validUntil={r.validUntil} t={t} />
                </div>
              )}
              {r.vetName && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>🏥 {r.vetName}</div>}
              {r.batchNumber && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Nr serii: {r.batchNumber}</div>}
              {r.note && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4, fontStyle: 'italic' }}>{r.note}</div>}
            </div>
            <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12, marginLeft: 8 }}
              onClick={() => setDeleteId(r.id)}>🗑</button>
          </div>
          {deleteId === r.id && (
            <ConfirmDelete onConfirm={() => handleDelete(r.id)} onCancel={() => setDeleteId(null)} t={t} />
          )}
        </div>
      ))}

      {/* Add form */}
      {showForm ? (
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>+ {t('health.vaccinations.add')}</div>

          <div className="form-group">
            <label className="form-label">{t('health.date')}</label>
            <input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('health.vaccinations.vaccineType')}</label>
            <select className="form-select" value={form.vaccineType} onChange={e => setForm(f => ({ ...f, vaccineType: e.target.value }))}>
              {VACCINE_TYPES.map(vt => <option key={vt.value} value={vt.value}>{t(vt.labelKey)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('health.vaccinations.vaccineName')} *</label>
            <input type="text" className="form-input" placeholder="np. Biocan R, Nobivac" value={form.vaccineName}
              onChange={e => setForm(f => ({ ...f, vaccineName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('health.vaccinations.validUntil')}</label>
            <input type="date" className="form-input" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('health.vaccinations.batchNumber')}</label>
            <input type="text" className="form-input" value={form.batchNumber} onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('health.vetName')}</label>
            <input type="text" className="form-input" value={form.vetName} onChange={e => setForm(f => ({ ...f, vetName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('health.note')}</label>
            <input type="text" className="form-input" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>{t('health.save')}</button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>{t('settings.confirmNo')}</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setShowForm(true)}>
          + {t('health.vaccinations.add')}
        </button>
      )}
    </div>
  )
}

// ─── Antiparasitic Tab (shared for deworming + parasite prevention) ───────────

function AntiparasiticTab({ dog, type, t, showToast }) {
  // type: 'deworming' | 'parasites'
  const isParasite = type === 'parasites'
  const [records, setRecords]       = useState([])
  const [allRecords, setAllRecords] = useState([])   // for cross-reaction check
  const [showForm, setShowForm]     = useState(false)
  const [deleteId, setDeleteId]     = useState(null)
  const [warning, setWarning]       = useState(null)
  const [form, setForm] = useState({
    date: TODAY(), product: '', activeIngredient: '', dose: '',
    weightAtDose: '', reaction: 'none', reactionNote: '', vetName: '', note: '',
  })

  const load = useCallback(async () => {
    if (!dog) return
    const fn = isParasite ? getParasitePrevention : getDewormings
    const all = await fn(dog.id)
    setAllRecords(all)
    setRecords([...all].reverse())
  }, [dog, isParasite])

  useEffect(() => { load() }, [load])

  // Auto-fill active ingredient when product is selected + cross-reaction check
  const handleProductChange = (name) => {
    const info = getProduct(name)
    const ingredient = info?.activeIngredient ?? ''
    setForm(f => ({ ...f, product: name, activeIngredient: ingredient }))

    if (isParasite && name) {
      const pastWithReactions = allRecords.filter(r => r.reaction && r.reaction !== 'none')
      setWarning(checkCrossReaction(name, pastWithReactions))
    } else {
      setWarning(null)
    }
  }

  const handleSave = async () => {
    if (!form.date || !form.product.trim()) return
    const fn = isParasite ? addParasitePrevention : addDeworming
    await fn({ dogId: dog.id, ...form })
    showToast(t('health.saved'))
    setShowForm(false)
    setWarning(null)
    setForm({ date: TODAY(), product: '', activeIngredient: '', dose: '', weightAtDose: '', reaction: 'none', reactionNote: '', vetName: '', note: '' })
    load()
  }

  const handleDelete = async (id) => {
    const fn = isParasite ? deleteParasitePrevention : deleteDeworming
    await fn(id)
    setDeleteId(null)
    load()
  }

  const addLabel = isParasite ? t('health.tabs.parasites') : t('health.tabs.deworming')

  return (
    <div>
      {records.length === 0 && !showForm && (
        <div className="empty-state" style={{ paddingTop: 40 }}>
          <div className="empty-state-icon">{isParasite ? '🐛' : '💊'}</div>
          <div className="empty-state-text">{t('health.noData')}</div>
        </div>
      )}

      {records.map(r => (
        <div key={r.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{r.product}</div>
              {r.activeIngredient && (
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 1 }}>{r.activeIngredient}</div>
              )}
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                {format(parseISO(r.date), 'dd.MM.yyyy')}
                {r.weightAtDose ? ` · ${r.weightAtDose} kg` : ''}
                {r.dose ? ` · ${r.dose}` : ''}
              </div>
              <div style={{ marginTop: 6 }}>
                <ReactionBadge reaction={r.reaction} t={t} />
              </div>
              {r.reactionNote && <div style={{ fontSize: 12, color: 'var(--orange)', marginTop: 4 }}>{r.reactionNote}</div>}
              {r.vetName && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>🏥 {r.vetName}</div>}
              {r.note && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4, fontStyle: 'italic' }}>{r.note}</div>}
            </div>
            <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12, marginLeft: 8 }}
              onClick={() => setDeleteId(r.id)}>🗑</button>
          </div>
          {deleteId === r.id && (
            <ConfirmDelete onConfirm={() => handleDelete(r.id)} onCancel={() => setDeleteId(null)} t={t} />
          )}
        </div>
      ))}

      {showForm ? (
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>+ {addLabel}</div>

          <CrossReactionWarning warning={warning} dog={dog} t={t} />

          <div className="form-group">
            <label className="form-label">{t('health.date')}</label>
            <input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">{t('health.product')} *</label>
            <input
              type="text" className="form-input"
              placeholder={isParasite ? 'np. NexGard, Simparica, Bravecto' : 'np. Drontal Junior, Milbemax'}
              list={`products-${type}`}
              value={form.product}
              onChange={e => handleProductChange(e.target.value)}
            />
            <datalist id={`products-${type}`}>
              {PRODUCT_NAMES.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>

          {form.activeIngredient && (
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 10, marginTop: -8 }}>
              Substancja czynna: <strong>{form.activeIngredient}</strong>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('health.dose')}</label>
            <input type="text" className="form-input" placeholder="np. 1 tabletka, 2 ml" value={form.dose}
              onChange={e => setForm(f => ({ ...f, dose: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('health.weightAtDose')}</label>
            <input type="number" step="0.1" className="form-input" value={form.weightAtDose}
              onChange={e => setForm(f => ({ ...f, weightAtDose: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">{t('health.reaction')}</label>
            <select className="form-select" value={form.reaction} onChange={e => setForm(f => ({ ...f, reaction: e.target.value }))}>
              {REACTION_TYPES.map(rt => <option key={rt.value} value={rt.value}>{t(rt.labelKey)}</option>)}
            </select>
          </div>

          {form.reaction && form.reaction !== 'none' && (
            <div className="form-group">
              <label className="form-label">{t('health.reactionNote')}</label>
              <input type="text" className="form-input" value={form.reactionNote}
                onChange={e => setForm(f => ({ ...f, reactionNote: e.target.value }))} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('health.vetName')}</label>
            <input type="text" className="form-input" value={form.vetName}
              onChange={e => setForm(f => ({ ...f, vetName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('health.note')}</label>
            <input type="text" className="form-input" value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>{t('health.save')}</button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowForm(false); setWarning(null) }}>{t('settings.confirmNo')}</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setShowForm(true)}>
          + {addLabel}
        </button>
      )}
    </div>
  )
}

// ─── Main HealthScreen ────────────────────────────────────────────────────────

export function HealthScreen({ dog }) {
  const { t } = useTranslation()
  const { toast, showToast } = useToast()
  const [activeTab, setActiveTab] = useState('vaccinations')

  const TABS = [
    { id: 'vaccinations', label: t('health.tabs.vaccinations'), icon: '💉' },
    { id: 'deworming',    label: t('health.tabs.deworming'),    icon: '💊' },
    { id: 'parasites',    label: t('health.tabs.parasites'),    icon: '🐛' },
  ]

  if (!dog) {
    return (
      <div className="screen">
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <div className="empty-state-icon">🏥</div>
          <div className="empty-state-text">{t('dashboard.noData')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="page-header">
        <h1 className="page-title">🏥 {t('health.title')} — {dog.name}</h1>
      </div>

      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
              background: activeTab === tab.id ? 'var(--blue)' : 'var(--gray-100)',
              color: activeTab === tab.id ? '#fff' : 'var(--gray-600)',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'vaccinations' && <VaccinationsTab dog={dog} t={t} showToast={showToast} />}
      {activeTab === 'deworming'    && <AntiparasiticTab dog={dog} type="deworming" t={t} showToast={showToast} />}
      {activeTab === 'parasites'    && <AntiparasiticTab dog={dog} type="parasites" t={t} showToast={showToast} />}

      <Toast message={toast} />
    </div>
  )
}
