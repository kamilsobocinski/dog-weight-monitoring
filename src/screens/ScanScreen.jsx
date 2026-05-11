import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { runOCR, parseDogProfile, parseVaccinations, parseAntiparasitic } from '../utils/ocr'
import { addVaccination, addDeworming, addParasitePrevention, updateDog } from '../utils/db'
import { getBreedByName } from '../data/breeds'
import { PRODUCT_NAMES, getProduct } from '../data/products'

// Hidden datalist for product autocomplete
function ProductDatalist() {
  return (
    <datalist id="scan-products">
      {PRODUCT_NAMES.map(n => <option key={n} value={n} />)}
    </datalist>
  )
}
import { resizeImage } from '../utils/imageUtils'
import { Toast, useToast } from '../components/Toast'

const SCAN_TYPES = [
  { id: 'profile',      icon: '🐶', labelKey: 'scan.typeProfile' },
  { id: 'vaccination',  icon: '💉', labelKey: 'scan.typeVaccination' },
  { id: 'antiparasitic',icon: '💊', labelKey: 'scan.typeAntiparasitic' },
]

// ─── Step indicators ──────────────────────────────────────────────────────────

function Steps({ current }) {
  const steps = ['scan.step1', 'scan.step2', 'scan.step3']
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
      {steps.map((_, i) => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: '50%',
          background: i === current ? 'var(--blue)' : 'var(--gray-200)',
          transition: 'background 0.2s',
        }} />
      ))}
    </div>
  )
}

// ─── Profile review form ──────────────────────────────────────────────────────

function ProfileForm({ data, onChange }) {
  const { t } = useTranslation()
  const fields = [
    { key: 'name',      label: t('setup.name'),       type: 'text' },
    { key: 'breed',     label: t('setup.breed'),      type: 'text' },
    { key: 'birthdate', label: t('setup.birthdate'),  type: 'date' },
    { key: 'sex',       label: t('setup.sex'),        type: 'select', options: [
        { value: 'female', label: t('setup.female') },
        { value: 'male',   label: t('setup.male') },
      ]},
    { key: 'colour',    label: t('scan.colour'),      type: 'text' },
    { key: 'chip',      label: t('scan.chip'),        type: 'text' },
  ]

  return (
    <div>
      {fields.map(f => (
        <div key={f.key} className="form-group">
          <label className="form-label">{f.label}</label>
          {f.type === 'select' ? (
            <select className="form-select" value={data[f.key] || ''} onChange={e => onChange(f.key, e.target.value)}>
              {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input
              type={f.type}
              className={`form-input${!data[f.key] ? ' form-input-empty' : ''}`}
              value={data[f.key] || ''}
              onChange={e => onChange(f.key, e.target.value)}
              placeholder={!data[f.key] ? t('scan.notDetected') : ''}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Vaccination review form ──────────────────────────────────────────────────

function VaccinationForm({ entries, onChange, onAdd, onRemove }) {
  const { t } = useTranslation()
  return (
    <div>
      {entries.map((e, i) => (
        <div key={i} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>#{i + 1}</div>
            {entries.length > 1 && (
              <button className="btn btn-danger" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => onRemove(i)}>✕</button>
            )}
          </div>
          {[
            { key: 'date',        label: t('health.date'),                        type: 'date' },
            { key: 'vaccineName', label: t('health.vaccinations.vaccineName'),    type: 'text' },
            { key: 'validUntil',  label: t('health.vaccinations.validUntil'),     type: 'date' },
            { key: 'batchNumber', label: t('health.vaccinations.batchNumber'),    type: 'text' },
            { key: 'vetName',     label: t('health.vetName'),                     type: 'text' },
          ].map(f => (
            <div key={f.key} className="form-group">
              <label className="form-label">{f.label}</label>
              <input type={f.type} className={`form-input${!e[f.key] ? ' form-input-empty' : ''}`}
                value={e[f.key] || ''} onChange={ev => onChange(i, f.key, ev.target.value)}
                placeholder={!e[f.key] ? t('scan.notDetected') : ''} />
            </div>
          ))}
        </div>
      ))}
      <button className="btn btn-secondary" onClick={onAdd} style={{ marginBottom: 8 }}>
        + {t('scan.addEntry')}
      </button>
    </div>
  )
}

// ─── Antiparasitic review form ────────────────────────────────────────────────

function AntiparasiticForm({ entries, onChange, onAdd, onRemove, type, onTypeChange }) {
  const { t } = useTranslation()
  return (
    <div>
      {/* Type selector */}
      <div className="form-group">
        <label className="form-label">{t('scan.entryType')}</label>
        <select className="form-select" value={type} onChange={e => onTypeChange(e.target.value)}>
          <option value="deworming">{t('health.tabs.deworming')}</option>
          <option value="parasites">{t('health.tabs.parasites')}</option>
        </select>
      </div>

      {entries.map((e, i) => (
        <div key={i} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>
              {e.product || `#${i + 1}`}
              {e.activeIngredient && <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 6 }}>{e.activeIngredient}</span>}
            </div>
            {entries.length > 1 && (
              <button className="btn btn-danger" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => onRemove(i)}>✕</button>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{t('health.date')}</label>
            <input type="date" className={`form-input${!e.date ? ' form-input-empty' : ''}`}
              value={e.date || ''} onChange={ev => onChange(i, 'date', ev.target.value)}
              placeholder={!e.date ? t('scan.notDetected') : ''} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('health.product')}</label>
            <input type="text" className={`form-input${!e.product ? ' form-input-empty' : ''}`}
              list="scan-products" value={e.product || ''}
              onChange={ev => {
                const info = getProduct(ev.target.value)
                onChange(i, 'product', ev.target.value)
                onChange(i, 'activeIngredient', info?.activeIngredient || '')
              }}
              placeholder={!e.product ? t('scan.notDetected') : ''} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('health.dose')}</label>
            <input type="text" className="form-input" value={e.dose || ''} onChange={ev => onChange(i, 'dose', ev.target.value)} />
          </div>
        </div>
      ))}
      <button className="btn btn-secondary" onClick={onAdd} style={{ marginBottom: 8 }}>
        + {t('scan.addEntry')}
      </button>
    </div>
  )
}

// ─── Main ScanScreen ──────────────────────────────────────────────────────────

export function ScanScreen({ dog, onClose, onSaved }) {
  const { t } = useTranslation()
  const { toast, showToast } = useToast()

  const [step, setStep]         = useState(0)   // 0=type, 1=photo+ocr, 2=review
  const [scanType, setScanType] = useState(null)
  const [progress, setProgress] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [ocrText, setOcrText]   = useState('')

  // Reviewed data
  const [profileData, setProfileData]     = useState({})
  const [vaccinEntries, setVaccinEntries] = useState([{}])
  const [antiEntries, setAntiEntries]     = useState([{}])
  const [antiType, setAntiType]           = useState('deworming')

  const galleryRef = useRef(null)
  const cameraRef  = useRef(null)

  // ── Photo chosen → run OCR ──────────────────────────────────────────────────
  const handleFile = async (file) => {
    if (!file) return
    setProcessing(true)
    setStep(1)
    setProgress(0)

    try {
      // Resize first (improves OCR speed + accuracy)
      const resized = await resizeImage(file, 1600, 0.92)
      // Convert base64 to blob for Tesseract
      const blob = await (await fetch(resized)).blob()

      const text = await runOCR(blob, setProgress)
      setOcrText(text)

      // Parse according to type
      if (scanType === 'profile') {
        setProfileData(parseDogProfile(text))
      } else if (scanType === 'vaccination') {
        const entries = parseVaccinations(text)
        setVaccinEntries(entries.length ? entries : [{ vaccineType: 'rabies', vaccineName: '', date: '', validUntil: '', batchNumber: '', vetName: '' }])
      } else {
        const entries = parseAntiparasitic(text)
        setAntiEntries(entries.length ? entries.map(e => ({
          ...e,
          activeIngredient: getProduct(e.product)?.activeIngredient || '',
          dose: '',
        })) : [{ date: '', product: '', activeIngredient: '', dose: '' }])
      }

      setStep(2)
    } catch (err) {
      console.error('OCR error', err)
      showToast(t('scan.error'))
      setStep(0)
    } finally {
      setProcessing(false)
    }
  }

  // ── Save reviewed data ──────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      if (scanType === 'profile') {
        // Update dog profile fields (chip, colour etc.)
        const breedMatch = getBreedByName(profileData.breed)
        const patch = {
          ...(profileData.name      && { name: profileData.name }),
          ...(profileData.birthdate && { birthdate: profileData.birthdate }),
          ...(profileData.sex       && { sex: profileData.sex }),
          ...(profileData.chip      && { chipNumber: profileData.chip }),
          ...(profileData.colour    && { colour: profileData.colour }),
          ...(breedMatch            && { breedId: breedMatch.id, breedName: breedMatch.name }),
        }
        if (Object.keys(patch).length) await updateDog(dog.id, patch)

      } else if (scanType === 'vaccination') {
        for (const e of vaccinEntries) {
          if (!e.date && !e.vaccineName) continue
          await addVaccination({ dogId: dog.id, vaccineType: e.vaccineType || 'rabies', ...e })
        }

      } else {
        const fn = antiType === 'deworming' ? addDeworming : addParasitePrevention
        for (const e of antiEntries) {
          if (!e.date && !e.product) continue
          await fn({ dogId: dog.id, reaction: 'none', ...e })
        }
      }

      showToast(t('scan.saved'))
      setTimeout(() => onSaved(), 800)
    } catch (err) {
      console.error('Save error', err)
      showToast(t('scan.error'))
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="screen">
      <div className="page-header">
        <h1 className="page-title">📷 {t('scan.title')}</h1>
        <button className="btn btn-ghost" onClick={onClose}>✕</button>
      </div>

      <Steps current={step} />

      {/* ── Step 0: choose scan type ── */}
      {step === 0 && (
        <div>
          <div style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 16, textAlign: 'center' }}>
            {t('scan.chooseType')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SCAN_TYPES.map(st => (
              <button key={st.id}
                className={`card${scanType === st.id ? ' card-selected' : ''}`}
                style={{
                  textAlign: 'left', cursor: 'pointer', border: scanType === st.id ? '2px solid var(--blue)' : '1px solid var(--gray-200)',
                  background: scanType === st.id ? 'var(--blue-light)' : undefined,
                  fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 12,
                }}
                onClick={() => setScanType(st.id)}>
                <span style={{ fontSize: 28 }}>{st.icon}</span>
                {t(st.labelKey)}
              </button>
            ))}
          </div>

          {scanType && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 12, textAlign: 'center' }}>
                {t('scan.choosePhoto')}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => cameraRef.current?.click()}>
                  📷 {t('setup.photoCamera')}
                </button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => galleryRef.current?.click()}>
                  🖼 {t('setup.photoGallery')}
                </button>
              </div>
              <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files?.[0])} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files?.[0])} />
            </div>
          )}
        </div>
      )}

      {/* ── Step 1: OCR processing ── */}
      {step === 1 && (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <div className="spinner" style={{ width: 48, height: 48, margin: '0 auto 20px' }} />
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{t('scan.processing')}</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>{t('scan.processingNote')}</div>
          {progress > 0 && (
            <div style={{ background: 'var(--gray-100)', borderRadius: 8, height: 8, overflow: 'hidden', maxWidth: 300, margin: '0 auto' }}>
              <div style={{ background: 'var(--blue)', height: '100%', width: `${progress}%`, transition: 'width 0.3s' }} />
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gray-400)' }}>{progress}%</div>
        </div>
      )}

      {/* ── Step 2: review & edit ── */}
      {step === 2 && (
        <div>
          <div className="card" style={{ background: 'var(--blue-light)', border: '1px solid var(--blue)', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--blue-dark)' }}>
              ✏️ {t('scan.reviewNote')}
            </div>
          </div>

          {scanType === 'profile' && (
            <ProfileForm
              data={profileData}
              onChange={(key, val) => setProfileData(d => ({ ...d, [key]: val }))}
            />
          )}

          {scanType === 'vaccination' && (
            <VaccinationForm
              entries={vaccinEntries}
              onChange={(i, key, val) => setVaccinEntries(es => es.map((e, idx) => idx === i ? { ...e, [key]: val } : e))}
              onAdd={() => setVaccinEntries(es => [...es, { vaccineType: 'rabies', vaccineName: '', date: '', validUntil: '', batchNumber: '', vetName: '' }])}
              onRemove={i => setVaccinEntries(es => es.filter((_, idx) => idx !== i))}
            />
          )}

          {scanType === 'antiparasitic' && (
            <AntiparasiticForm
              entries={antiEntries}
              type={antiType}
              onTypeChange={setAntiType}
              onChange={(i, key, val) => setAntiEntries(es => es.map((e, idx) => idx === i ? { ...e, [key]: val } : e))}
              onAdd={() => setAntiEntries(es => [...es, { date: '', product: '', activeIngredient: '', dose: '' }])}
              onRemove={i => setAntiEntries(es => es.filter((_, idx) => idx !== i))}
            />
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave}>
              💾 {t('scan.save')}
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(0)}>
              {t('scan.scanAgain')}
            </button>
          </div>

          {/* Raw OCR text (collapsed, for debugging) */}
          {ocrText && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ fontSize: 12, color: 'var(--gray-400)', cursor: 'pointer' }}>
                {t('scan.rawText')}
              </summary>
              <pre style={{ fontSize: 10, color: 'var(--gray-500)', whiteSpace: 'pre-wrap', marginTop: 8, background: 'var(--gray-100)', padding: 8, borderRadius: 6 }}>
                {ocrText}
              </pre>
            </details>
          )}
        </div>
      )}

      <ProductDatalist />
      <Toast message={toast} />
    </div>
  )
}
