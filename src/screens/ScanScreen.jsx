import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { runOCR, parseDogProfile, parseVaccinations, parseAntiparasitic } from '../utils/ocr'
import { addVaccination, addDeworming, addParasitePrevention, updateDog } from '../utils/db'
import { getBreedByName } from '../data/breeds'
import { PRODUCT_NAMES, getProduct } from '../data/products'
import { resizeImage } from '../utils/imageUtils'
import { Toast, useToast } from '../components/Toast'

// ─── Document / page guide database ──────────────────────────────────────────
//
// Każdy wpis = jeden rodzaj dokumentu.
// steps = kolejne sekcje do skanowania (w kolejności jak w dokumencie).
//
const DOCUMENT_GUIDE = [
  {
    id: 'eu',
    flag: '🇪🇺',
    name: 'Paszport EU',
    subtitle: 'Niemcy · Austria · Hiszpania · cała UE',
    color: '#1d4ed8',
    bgColor: '#eff6ff',
    steps: [
      {
        id: 'profile',
        icon: '🐶',
        label: 'Dane psa (opis)',
        section: 'Sekcja II',
        page: 'str. 3–6',
        sectionAlts: 'Section II / Abschnitt II / Sección II',
        tip: 'Otwórz na rozkładówce z opisem zwierzęcia — tabelka z gatunkiem, rasą, kolorem i numerem czipu.',
        fields: [
          { symbol: '📛', text: 'Imię / Name / Nombre' },
          { symbol: '🐕', text: 'Rasa / Rasse / Raza' },
          { symbol: '🎂', text: 'Data ur. / Geburtsdatum / Fecha nac.' },
          { symbol: '🎨', text: 'Kolor / Farbe / Color' },
          { symbol: '📡', text: 'Nr czipu (15 cyfr) / Transponder-Nr. / Microchip' },
        ],
        scanType: 'profile',
      },
      {
        id: 'rabies',
        icon: '💉',
        label: 'Wścieklizna',
        section: 'Sekcja IV',
        page: 'str. 8–9',
        sectionAlts: 'Section IV / Abschnitt IV / Sección IV',
        tip: '📱 OBRÓĆ TELEFON POZIOMO przed zrobieniem zdjęcia! Ta strona jest drukowana w układzie poziomym. Nagłówek: "Rabies / Tollwut / Rabia". Zwykle 2–4 wiersze.',
        landscape: true,
        fields: [
          { symbol: '📅', text: 'Data / Datum / Fecha' },
          { symbol: '💊', text: 'Nazwa preparatu / Impfstoff / Nombre vacuna' },
          { symbol: '#️⃣', text: 'Nr serii / Charge / Lote' },
          { symbol: '⏰', text: 'Ważne do / Gültig bis / Válida hasta' },
          { symbol: '🩺', text: 'Weterynarz / Tierarzt / Veterinario' },
        ],
        scanType: 'vaccination',
        vaccineType: 'rabies',
      },
      {
        id: 'other-vax',
        icon: '💉',
        label: 'Inne szczepienia',
        section: 'Sekcja V',
        page: 'str. 10–11',
        sectionAlts: 'Section V / Abschnitt V / Sección V',
        tip: '📱 OBRÓĆ TELEFON POZIOMO! Nagłówek: "Other vaccinations / Sonstige Impfungen / Otras vacunaciones". DHPPI, leptospiroza, parvowirus itp.',
        landscape: true,
        fields: [
          { symbol: '📅', text: 'Data / Datum / Fecha' },
          { symbol: '💊', text: 'Nazwa preparatu / Impfstoff' },
          { symbol: '#️⃣', text: 'Nr serii / Charge / Lote' },
          { symbol: '⏰', text: 'Ważne do / Gültig bis' },
          { symbol: '🩺', text: 'Weterynarz / Tierarzt' },
        ],
        scanType: 'vaccination',
        vaccineType: 'combined',
      },
      {
        id: 'antiparasitic',
        icon: '💊',
        label: 'Odrobaczanie (Echinokokoza)',
        section: 'Sekcja VI',
        page: 'str. 12–13',
        sectionAlts: 'Section VI / Abschnitt VI / Sección VI',
        tip: 'Nagłówek: "Antiparasitic treatment against Echinococcus / Echinokokken-Behandlung / Tratamiento antiparasitario". Wymagane przy wjeździe do niektórych krajów.',
        fields: [
          { symbol: '📅', text: 'Data / Datum / Fecha' },
          { symbol: '💊', text: 'Preparat / Wirkstoff / Producto' },
          { symbol: '🩺', text: 'Weterynarz / Tierarzt / Veterinario' },
        ],
        scanType: 'antiparasitic',
        antiType: 'deworming',
      },
    ],
  },
  {
    id: 'de-impfpass',
    flag: '🇩🇪',
    name: 'Impfpass (Niemcy)',
    subtitle: 'Tiergesundheitsausweis · krajowy zeszyt szczepień',
    color: '#dc2626',
    bgColor: '#fef2f2',
    steps: [
      {
        id: 'profile',
        icon: '🐶',
        label: 'Opis psa',
        section: 'Str. 1 / okładka',
        page: 'str. 1',
        sectionAlts: 'Tierbeschreibung / Impfbuch',
        tip: 'Otwórz na pierwszej stronie lub wewnętrznej okładce. Widoczny formularz z danymi zwierzęcia.',
        fields: [
          { symbol: '📛', text: 'Name des Tieres → imię' },
          { symbol: '🐕', text: 'Rasse → rasa' },
          { symbol: '🎂', text: 'Geburtsdatum → data urodzenia' },
          { symbol: '🎨', text: 'Farbe / Abzeichen → kolor / oznaczenia' },
          { symbol: '📡', text: 'Microchip-Nr. / Chip → numer czipu' },
        ],
        scanType: 'profile',
      },
      {
        id: 'vaccinations',
        icon: '💉',
        label: 'Szczepienia (Impfungen)',
        section: 'Str. 2–5',
        page: 'str. 2–5',
        sectionAlts: 'Impfungen / Schutzimpfungen',
        tip: 'Sfotografuj stronę z tabelą szczepień — każdy wiersz to jedno szczepienie. Kolumny: Datum, Impfstoff, Charge, gültig bis, Unterschrift.',
        fields: [
          { symbol: '📅', text: 'Datum → data' },
          { symbol: '💊', text: 'Impfstoff → preparat' },
          { symbol: '#️⃣', text: 'Charge → nr serii' },
          { symbol: '⏰', text: 'Gültig bis → ważne do' },
          { symbol: '🩺', text: 'Tierarzt → weterynarz' },
        ],
        scanType: 'vaccination',
        vaccineType: 'combined',
      },
      {
        id: 'deworming',
        icon: '💊',
        label: 'Odrobaczanie (Entwurmung)',
        section: 'Str. 6–8',
        page: 'str. 6–8',
        sectionAlts: 'Entwurmung / Parasitenbehandlung',
        tip: 'Tabela odrobaczania i ochrony przed kleszczami. Nagłówek: "Entwurmung" lub "Parasitenbehandlung".',
        fields: [
          { symbol: '📅', text: 'Datum → data' },
          { symbol: '💊', text: 'Präparat → preparat' },
          { symbol: '🩺', text: 'Tierarzt → weterynarz' },
        ],
        scanType: 'antiparasitic',
        antiType: 'deworming',
      },
    ],
  },
  {
    id: 'at-heimtier',
    flag: '🇦🇹',
    name: 'Heimtierausweis (Austria)',
    subtitle: 'Österreichischer Impfpass',
    color: '#dc2626',
    bgColor: '#fef2f2',
    steps: [
      {
        id: 'profile',
        icon: '🐶',
        label: 'Tierbeschreibung',
        section: 'Str. 1–2',
        page: 'str. 1–2',
        sectionAlts: 'Tierbeschreibung / Heimtierausweis',
        tip: 'Pierwsza rozkładówka z opisem zwierzęcia. Pola w tabeli: Name, Rasse, Geburtsdatum, Farbe, Chip-Nummer.',
        fields: [
          { symbol: '📛', text: 'Name → imię' },
          { symbol: '🐕', text: 'Rasse → rasa' },
          { symbol: '🎂', text: 'Geburtsdatum → data urodzenia' },
          { symbol: '🎨', text: 'Farbe → kolor' },
          { symbol: '📡', text: 'Chip-Nr. → numer czipu' },
        ],
        scanType: 'profile',
      },
      {
        id: 'vaccinations',
        icon: '💉',
        label: 'Impfungen (szczepienia)',
        section: 'Str. 3–5',
        page: 'str. 3–5',
        sectionAlts: 'Impfungen / Schutzimpfungen',
        tip: 'Tabela szczepień. Kolumny: Datum, Impfstoff, Chargennummer, gültig bis, Stempel/Unterschrift Tierarzt.',
        fields: [
          { symbol: '📅', text: 'Datum' },
          { symbol: '💊', text: 'Impfstoff' },
          { symbol: '#️⃣', text: 'Chargennummer' },
          { symbol: '⏰', text: 'Gültig bis' },
          { symbol: '🩺', text: 'Tierarzt-Stempel' },
        ],
        scanType: 'vaccination',
        vaccineType: 'combined',
      },
      {
        id: 'deworming',
        icon: '💊',
        label: 'Entwurmung (odrobaczanie)',
        section: 'Str. 6–8',
        page: 'str. 6–8',
        sectionAlts: 'Entwurmung / Parasitenbehandlung',
        tip: 'Tabela odrobaczania i ochrony przed pasożytami. Nagłówek: "Entwurmung".',
        fields: [
          { symbol: '📅', text: 'Datum' },
          { symbol: '💊', text: 'Präparat' },
          { symbol: '🩺', text: 'Tierarzt' },
        ],
        scanType: 'antiparasitic',
        antiType: 'deworming',
      },
    ],
  },
  {
    id: 'es-cartilla',
    flag: '🇪🇸',
    name: 'Cartilla sanitaria (Hiszpania)',
    subtitle: 'Documento sanitario canino',
    color: '#dc2626',
    bgColor: '#fef2f2',
    steps: [
      {
        id: 'profile',
        icon: '🐶',
        label: 'Identificación del animal',
        section: 'Str. 1–2',
        page: 'str. 1–2',
        sectionAlts: 'Datos del animal / Identificación',
        tip: 'Pierwsza strona — dane identyfikacyjne psa. Pola: Nombre, Raza, Sexo, Fecha de nacimiento, Color, Microchip.',
        fields: [
          { symbol: '📛', text: 'Nombre → imię' },
          { symbol: '🐕', text: 'Raza → rasa' },
          { symbol: '🎂', text: 'Fecha de nacimiento → data urodzenia' },
          { symbol: '🎨', text: 'Color → kolor' },
          { symbol: '📡', text: 'Microchip → numer czipu (15 cyfr)' },
        ],
        scanType: 'profile',
      },
      {
        id: 'rabies',
        icon: '💉',
        label: '⚠️ Rabia (wścieklizna — obowiązkowa)',
        section: 'Str. 3–4',
        page: 'str. 3–4',
        sectionAlts: 'Vacunación antirrábica / Rabia',
        tip: 'WAŻNE: w Hiszpanii szczepienie na wściekliznę jest obowiązkowe przez cały rok — wpisywane osobno na dedykowanej stronie. Nagłówek: "Vacunación antirrábica".',
        fields: [
          { symbol: '📅', text: 'Fecha → data' },
          { symbol: '💊', text: 'Nombre vacuna → nazwa preparatu' },
          { symbol: '#️⃣', text: 'Lote → nr serii' },
          { symbol: '⏰', text: 'Válida hasta → ważne do' },
          { symbol: '🩺', text: 'Veterinario → weterynarz' },
        ],
        scanType: 'vaccination',
        vaccineType: 'rabies',
      },
      {
        id: 'other-vax',
        icon: '💉',
        label: 'Otras vacunas (inne szczepienia)',
        section: 'Str. 4–5',
        page: 'str. 4–5',
        sectionAlts: 'Otras vacunaciones / Vacunas',
        tip: 'Tabela innych szczepień: DHPPI, leishmania, leptospiroza itp. Nagłówek: "Otras vacunaciones".',
        fields: [
          { symbol: '📅', text: 'Fecha → data' },
          { symbol: '💊', text: 'Nombre vacuna → nazwa' },
          { symbol: '#️⃣', text: 'Lote → nr serii' },
          { symbol: '⏰', text: 'Caducidad → ważne do' },
          { symbol: '🩺', text: 'Veterinario → weterynarz' },
        ],
        scanType: 'vaccination',
        vaccineType: 'combined',
      },
      {
        id: 'deworming',
        icon: '💊',
        label: 'Desparasitación (odrobaczanie)',
        section: 'Str. 6–7',
        page: 'str. 6–7',
        sectionAlts: 'Desparasitación / Antiparasitario',
        tip: 'Tabela odrobaczania i ochrony przed kleszczami i pchłami. Nagłówek: "Desparasitación".',
        fields: [
          { symbol: '📅', text: 'Fecha → data' },
          { symbol: '💊', text: 'Producto → preparat' },
          { symbol: '🩺', text: 'Veterinario → weterynarz' },
        ],
        scanType: 'antiparasitic',
        antiType: 'deworming',
      },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ProductDatalist() {
  return (
    <datalist id="scan-products">
      {PRODUCT_NAMES.map(n => <option key={n} value={n} />)}
    </datalist>
  )
}

// Phase progress bar (top of screen)
function PhaseBar({ phase }) {
  const phases = ['doc', 'section', 'guide', 'ocr', 'review']
  const idx    = phases.indexOf(phase)
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
      {phases.map((p, i) => (
        <div key={p} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: i <= idx ? 'var(--blue)' : 'var(--gray-200)',
          transition: 'background 0.2s',
        }} />
      ))}
    </div>
  )
}

// ─── Review forms (unchanged from v1) ────────────────────────────────────────

function ProfileForm({ data, onChange }) {
  const { t } = useTranslation()
  const fields = [
    { key: 'name',      label: t('setup.name'),      type: 'text' },
    { key: 'breed',     label: t('setup.breed'),     type: 'text' },
    { key: 'birthdate', label: t('setup.birthdate'), type: 'date' },
    { key: 'sex',       label: t('setup.sex'),       type: 'select', options: [
      { value: 'female', label: t('setup.female') },
      { value: 'male',   label: t('setup.male') },
    ]},
    { key: 'colour', label: t('scan.colour'), type: 'text' },
    { key: 'chip',   label: t('scan.chip'),   type: 'text' },
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
            <input type={f.type}
              className={`form-input${!data[f.key] ? ' form-input-empty' : ''}`}
              value={data[f.key] || ''}
              onChange={e => onChange(f.key, e.target.value)}
              placeholder={!data[f.key] ? t('scan.notDetected') : ''} />
          )}
        </div>
      ))}
    </div>
  )
}

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
            { key: 'date',        label: t('health.date'),                     type: 'date' },
            { key: 'vaccineName', label: t('health.vaccinations.vaccineName'), type: 'text' },
            { key: 'validUntil',  label: t('health.vaccinations.validUntil'),  type: 'date' },
            { key: 'batchNumber', label: t('health.vaccinations.batchNumber'), type: 'text' },
            { key: 'vetName',     label: t('health.vetName'),                  type: 'text' },
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
      <button className="btn btn-secondary" onClick={onAdd}>+ {t('scan.addEntry')}</button>
    </div>
  )
}

function AntiparasiticForm({ entries, onChange, onAdd, onRemove, type, onTypeChange }) {
  const { t } = useTranslation()
  return (
    <div>
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
              value={e.date || ''} onChange={ev => onChange(i, 'date', ev.target.value)} />
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
      <button className="btn btn-secondary" onClick={onAdd}>+ {t('scan.addEntry')}</button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ScanScreen({ dog, onClose, onSaved }) {
  const { t } = useTranslation()
  const { toast, showToast } = useToast()

  // phase: 'doc' → 'section' → 'guide' → 'ocr' → 'review'
  const [phase,       setPhase]       = useState('doc')
  const [selDoc,      setSelDoc]      = useState(null)   // DOCUMENT_GUIDE entry
  const [selStep,     setSelStep]     = useState(null)   // step within doc

  const [progress,    setProgress]    = useState(0)
  const [ocrText,     setOcrText]     = useState('')

  // Pre-fill profile with existing dog data — scan only ADDS missing fields
  const [profileData, setProfileData]     = useState({
    name:      dog?.name      || '',
    breed:     dog?.breedName || '',
    birthdate: dog?.birthdate || '',
    sex:       dog?.sex       || '',
    colour:    dog?.colour    || '',
    chip:      dog?.chipNumber || '',
  })
  const [vaccinEntries, setVaccinEntries] = useState([{}])
  const [antiEntries,   setAntiEntries]   = useState([{}])
  const [antiType,      setAntiType]      = useState('deworming')

  const galleryRef = useRef(null)
  const cameraRef  = useRef(null)

  // ── OCR ──────────────────────────────────────────────────────────────────────
  const handleFile = async (file) => {
    if (!file || !selStep) return
    setPhase('ocr')
    setProgress(0)
    try {
      const resized = await resizeImage(file, 1600, 0.92)
      const blob    = await (await fetch(resized)).blob()
      const text    = await runOCR(blob, setProgress)
      setOcrText(text)

      if (selStep.scanType === 'profile') {
        const ocr = parseDogProfile(text)
        // Merge: OCR result wins only if it found something; existing dog data fills the rest
        setProfileData(prev => ({
          name:      ocr.name      || prev.name      || '',
          breed:     ocr.breed     || prev.breed     || '',
          birthdate: ocr.birthdate || prev.birthdate || '',
          sex:       ocr.sex       || prev.sex       || '',
          colour:    ocr.colour    || prev.colour    || '',
          chip:      ocr.chip      || prev.chip      || '',
        }))
      } else if (selStep.scanType === 'vaccination') {
        const entries = parseVaccinations(text)
        setVaccinEntries(entries.length ? entries : [{
          vaccineType: selStep.vaccineType || 'combined',
          vaccineName: '', date: '', validUntil: '', batchNumber: '', vetName: '',
        }])
      } else {
        const entries = parseAntiparasitic(text)
        setAntiType(selStep.antiType || 'deworming')
        setAntiEntries(entries.length
          ? entries.map(e => ({ ...e, activeIngredient: getProduct(e.product)?.activeIngredient || '', dose: '' }))
          : [{ date: '', product: '', activeIngredient: '', dose: '' }]
        )
      }
      setPhase('review')
    } catch (err) {
      console.error('OCR error', err)
      showToast(t('scan.error'))
      setPhase('guide')
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      if (selStep.scanType === 'profile') {
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

      } else if (selStep.scanType === 'vaccination') {
        for (const e of vaccinEntries) {
          if (!e.date && !e.vaccineName) continue
          await addVaccination({ dogId: dog.id, vaccineType: selStep.vaccineType || 'combined', ...e })
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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="screen">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">📷 {t('scan.title')}</h1>
        <button className="btn btn-ghost" onClick={onClose}>✕</button>
      </div>

      <PhaseBar phase={phase} />

      {/* ── FAZA 1: Wybór dokumentu ── */}
      {phase === 'doc' && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
            {t('scan.chooseDoc')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
            {t('scan.chooseDocHint')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DOCUMENT_GUIDE.map(doc => (
              <button key={doc.id}
                onClick={() => { setSelDoc(doc); setSelStep(null); setPhase('section') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: doc.bgColor, border: `1.5px solid ${doc.color}30`,
                  borderRadius: 'var(--radius)', padding: '14px 16px',
                  textAlign: 'left', cursor: 'pointer', width: '100%',
                }}
              >
                <span style={{ fontSize: 30, lineHeight: 1 }}>{doc.flag}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: doc.color }}>{doc.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{doc.subtitle}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── FAZA 2: Wybór sekcji ── */}
      {phase === 'section' && selDoc && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: selDoc.bgColor, borderRadius: 'var(--radius)',
            padding: '10px 14px', marginBottom: 16,
          }}>
            <span style={{ fontSize: 22 }}>{selDoc.flag}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: selDoc.color }}>{selDoc.name}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{selDoc.subtitle}</div>
            </div>
            <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 12 }}
              onClick={() => setPhase('doc')}>← zmień</button>
          </div>

          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
            {t('scan.chooseSection')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 14 }}>
            {t('scan.chooseSectionHint')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selDoc.steps.map((step, idx) => (
              <button key={step.id}
                onClick={() => { setSelStep(step); setPhase('guide') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--surface)', border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                  textAlign: 'left', cursor: 'pointer', width: '100%',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--blue-light)', color: 'var(--blue)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 13, flexShrink: 0,
                }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {step.icon} {step.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
                    {step.section} · {step.page}
                  </div>
                </div>
                <span style={{ color: 'var(--gray-300)', fontSize: 18 }}>›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── FAZA 3: Wskazówka strony ── */}
      {phase === 'guide' && selDoc && selStep && (
        <div>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gray-400)', marginBottom: 16 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '2px 6px' }}
              onClick={() => setPhase('section')}>← {selDoc.flag} {selDoc.name}</button>
            <span>›</span>
            <span style={{ fontWeight: 600, color: 'var(--gray-600)' }}>{selStep.icon} {selStep.label}</span>
          </div>

          {/* Page locator card */}
          <div style={{
            background: 'var(--blue-light)', border: '1.5px solid var(--blue)',
            borderRadius: 'var(--radius)', padding: 16, marginBottom: 14,
          }}>
            {/* Big page indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 8,
                background: 'var(--blue)', color: '#fff',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, flexShrink: 0, lineHeight: 1.3,
              }}>
                <span style={{ fontSize: 18 }}>📄</span>
                <span>{selStep.page}</span>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--blue-dark)' }}>
                  {selStep.icon} {selStep.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--blue)', marginTop: 2, fontWeight: 600 }}>
                  {selStep.section}
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>
                  {selStep.sectionAlts}
                </div>
              </div>
            </div>

            {/* Landscape warning */}
            {selStep.landscape && (
              <div style={{
                background: '#fef3c7', borderRadius: 8, padding: '10px 12px',
                fontSize: 14, color: '#92400e', lineHeight: 1.5, fontWeight: 700,
                marginBottom: 8, textAlign: 'center',
              }}>
                📱↔️ Obróć telefon POZIOMO przed zdjęciem!
              </div>
            )}

            {/* Tip */}
            <div style={{
              background: '#fff', borderRadius: 8, padding: '10px 12px',
              fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.5,
              borderLeft: '3px solid var(--blue)',
            }}>
              💡 {selStep.tip}
            </div>
          </div>

          {/* What to look for */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--gray-600)' }}>
              🔍 {t('scan.lookFor')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selStep.fields.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{f.symbol}</span>
                  <span>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Photo buttons */}
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 10, textAlign: 'center', fontWeight: 600 }}>
            {t('scan.readyToScan')}
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

      {/* ── FAZA 4: OCR ── */}
      {phase === 'ocr' && (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <div className="spinner" style={{ width: 48, height: 48, margin: '0 auto 20px' }} />
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{t('scan.processing')}</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>{t('scan.processingNote')}</div>
          <div style={{ background: 'var(--gray-100)', borderRadius: 8, height: 8, overflow: 'hidden', maxWidth: 300, margin: '0 auto' }}>
            <div style={{ background: 'var(--blue)', height: '100%', width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gray-400)' }}>{progress}%</div>
        </div>
      )}

      {/* ── FAZA 5: Weryfikacja ── */}
      {phase === 'review' && selStep && (
        <div>
          <div className="card" style={{ background: 'var(--blue-light)', border: '1px solid var(--blue)', marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--blue-dark)' }}>
              ✏️ {t('scan.reviewNote')}
            </div>
          </div>
          {selStep?.scanType === 'vaccination' && (
            <div className="card" style={{ background: '#fef3c7', border: '1px solid #f59e0b', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#92400e' }}>
                ✍️ <strong>Daty pisane ręcznie</strong> (jak w paszporcie EU) nie są wykrywane automatycznie — wpisz je ręcznie w pola DATA i WAŻNE DO.
              </div>
            </div>
          )}

          {selStep.scanType === 'profile' && (
            <ProfileForm data={profileData}
              onChange={(key, val) => setProfileData(d => ({ ...d, [key]: val }))} />
          )}
          {selStep.scanType === 'vaccination' && (
            <VaccinationForm entries={vaccinEntries}
              onChange={(i, key, val) => setVaccinEntries(es => es.map((e, idx) => idx === i ? { ...e, [key]: val } : e))}
              onAdd={() => setVaccinEntries(es => [...es, { vaccineType: selStep.vaccineType || 'combined', vaccineName: '', date: '', validUntil: '', batchNumber: '', vetName: '' }])}
              onRemove={i => setVaccinEntries(es => es.filter((_, idx) => idx !== i))} />
          )}
          {selStep.scanType === 'antiparasitic' && (
            <AntiparasiticForm entries={antiEntries} type={antiType} onTypeChange={setAntiType}
              onChange={(i, key, val) => setAntiEntries(es => es.map((e, idx) => idx === i ? { ...e, [key]: val } : e))}
              onAdd={() => setAntiEntries(es => [...es, { date: '', product: '', activeIngredient: '', dose: '' }])}
              onRemove={i => setAntiEntries(es => es.filter((_, idx) => idx !== i))} />
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave}>
              💾 {t('scan.save')}
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPhase('guide')}>
              {t('scan.scanAgain')}
            </button>
          </div>

          {ocrText && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ fontSize: 12, color: 'var(--gray-400)', cursor: 'pointer' }}>{t('scan.rawText')}</summary>
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
