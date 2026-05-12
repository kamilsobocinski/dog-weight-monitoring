import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { generateNutritionPlan, calcWeightStatus } from '../utils/gemini'
import { getNutritionPlans, addNutritionPlan, deleteNutritionPlan,
         getVaccinations, getDewormings, getParasitePrevention } from '../utils/db'
import { runOCR, parseFoodLabel } from '../utils/ocr'
import { resizeImage } from '../utils/imageUtils'

// ─── Constants ────────────────────────────────────────────────────────────────

const FOOD_TYPES = [
  { id: 'dry',        icon: '🥩', labelKey: 'nutrition.typeDry' },
  { id: 'wet',        icon: '💧', labelKey: 'nutrition.typeWet' },
  { id: 'raw',        icon: '🫀', labelKey: 'nutrition.typeRaw' },
  { id: 'homemade',   icon: '🍳', labelKey: 'nutrition.typeHomemade' },
  { id: 'treat',      icon: '🦴', labelKey: 'nutrition.typeTreat' },
  { id: 'supplement', icon: '💊', labelKey: 'nutrition.typeSupplement' },
  { id: 'other',      icon: '🍽️', labelKey: 'nutrition.typeOther' },
]

const FREQUENCIES = [
  { id: 'daily',        labelKey: 'nutrition.freqDaily' },
  { id: 'few_week',     labelKey: 'nutrition.freqFewWeek' },
  { id: 'weekly',       labelKey: 'nutrition.freqWeekly' },
  { id: 'occasionally', labelKey: 'nutrition.freqOccasionally' },
]

export const KCAL_PER_G = {
  dry: 3.5, wet: 0.85, raw: 1.5, homemade: 1.2,
  treat: 3.2, supplement: 0, other: 2.5,
}

function blankForm(type = 'dry') {
  const isTreat = type === 'treat'
  return {
    type,
    name: '',
    frequency: 'daily',
    unit: isTreat ? 'pcs' : 'g',
    timesPerDay: 2,
    gramsPerPortion: 150,
    piecesPerDay: 5,
    gramsPerPiece: 7,
    scannedLabel: '',
  }
}

function dailyGrams(item) {
  if (item.unit === 'pcs') return (item.piecesPerDay || 0) * (item.gramsPerPiece || 0)
  if (item.frequency !== 'daily') return 0
  return (item.timesPerDay || 1) * (item.gramsPerPortion || 0)
}
function dailyKcal(item) {
  return Math.round(dailyGrams(item) * (KCAL_PER_G[item.type] ?? 2.5))
}

export function formatFoodSummary(items) {
  if (!items?.length) return ''
  return items.map(it => {
    const icon = FOOD_TYPES.find(f => f.id === it.type)?.icon || '🍽️'
    const name = it.name || '?'
    if (it.unit === 'pcs') return `${icon} ${name}: ${it.piecesPerDay}szt×${it.gramsPerPiece}g`
    if (it.frequency === 'daily') return `${icon} ${name}: ${it.timesPerDay}×${it.gramsPerPortion}g`
    return `${icon} ${name}: ${it.gramsPerPortion}g`
  }).join(' | ')
}

// ─── PDF preview modal (in-app, no window.open) ──────────────────────────────

function PdfModal({ plan, dog, onClose }) {
  // Add/remove body class for print CSS
  useEffect(() => {
    document.body.classList.add('nutrition-pdf-open')
    return () => document.body.classList.remove('nutrition-pdf-open')
  }, [])

  const d = new Date(plan.generatedAt)
  const dateStr = d.toLocaleDateString('pl-PL', { day:'2-digit', month:'2-digit', year:'numeric' })
  const timeStr = d.toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' })

  let agStr = ''
  if (dog?.birthdate) {
    const m = Math.floor((Date.now() - new Date(dog.birthdate)) / (1000*60*60*24*30.44))
    const y = Math.floor(m/12), mo = m%12
    agStr = y > 0 ? `${y} lat${mo > 0 ? ` ${mo} mies.` : ''}` : `${mo} mies.`
  }

  const foodSummary = plan.foodItems?.length ? plan.foodItems : null

  return (
    <div className="nutrition-pdf-wrapper" style={{
      position:'fixed', inset:0, zIndex:300, background:'#fff',
      overflowY:'auto', WebkitOverflowScrolling:'touch',
    }}>
      {/* Toolbar — hidden on print */}
      <div className="nutrition-pdf-no-print" style={{
        position:'sticky', top:0, zIndex:10,
        background:'#fff', borderBottom:'1px solid #e5e7eb',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 16px', gap:8,
      }}>
        <div style={{ fontWeight:700, fontSize:15 }}>🥩 Plan diety</div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => window.print()}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8,
              background:'#e85d4a', color:'#fff', border:'none', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            🖨️ Drukuj / PDF
          </button>
          <button onClick={onClose}
            style={{ padding:'8px 14px', borderRadius:8, border:'1.5px solid var(--gray-200)',
              background:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            ✕ Zamknij
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:680, margin:'0 auto', padding:'24px 20px 48px' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', borderBottom:'3px solid #e85d4a', paddingBottom:12, marginBottom:20, alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:42, height:42, borderRadius:'50%', background:'linear-gradient(135deg,#e85d4a,#c0392b)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🐾</div>
            <div>
              <div style={{ fontSize:20, fontWeight:800, color:'#e85d4a' }}>DogPass</div>
              <div style={{ fontSize:11, color:'#666' }}>Dbaj o zdrowie swojego psa</div>
            </div>
          </div>
          <div style={{ textAlign:'right', fontSize:11, color:'#666' }}>
            Wygenerowano<br /><strong>{dateStr}, {timeStr}</strong>
          </div>
        </div>

        {/* Hero */}
        <div style={{ background:'linear-gradient(135deg,#fff7ed,#fef3c7)', border:'1px solid #fed7aa', borderRadius:10, padding:'14px 18px', marginBottom:20, textAlign:'center' }}>
          <div style={{ fontSize:18, fontWeight:800, color:'#92400e', marginBottom:4 }}>🥩 Indywidualny plan diety</div>
          <div style={{ fontSize:13, color:'#92400e', opacity:0.8 }}>Dieta stworzona przez AI specjalnie dla Twojego pupila</div>
          <span style={{ display:'inline-block', background:'#92400e', color:'#fff', fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:12, marginTop:6 }}>🤖 Gemini AI</span>
        </div>

        {/* Dog info */}
        {dog && (
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#92400e', borderBottom:'1px solid #fed7aa', paddingBottom:4, marginBottom:8 }}>Dane psa</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <tbody>
                {dog.name      && <tr><td style={{ padding:'4px 8px', fontWeight:700, background:'#fef3c7', border:'1px solid #fed7aa', width:'30%' }}>Imię</td><td style={{ padding:'4px 8px', border:'1px solid #fed7aa' }}>{dog.name}</td></tr>}
                {dog.breedName && <tr><td style={{ padding:'4px 8px', fontWeight:700, background:'#fef3c7', border:'1px solid #fed7aa' }}>Rasa</td><td style={{ padding:'4px 8px', border:'1px solid #fed7aa' }}>{dog.breedName}</td></tr>}
                {dog.sex       && <tr><td style={{ padding:'4px 8px', fontWeight:700, background:'#fef3c7', border:'1px solid #fed7aa' }}>Płeć</td><td style={{ padding:'4px 8px', border:'1px solid #fed7aa' }}>{dog.sex==='female'?'Suka':'Pies'}</td></tr>}
                {agStr         && <tr><td style={{ padding:'4px 8px', fontWeight:700, background:'#fef3c7', border:'1px solid #fed7aa' }}>Wiek</td><td style={{ padding:'4px 8px', border:'1px solid #fed7aa' }}>{agStr}</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Food items */}
        {foodSummary && (
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#92400e', borderBottom:'1px solid #fed7aa', paddingBottom:4, marginBottom:8 }}>Obecna dieta</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr>
                  <th style={{ padding:'5px 8px', background:'#fef3c7', border:'1px solid #fed7aa', textAlign:'left', color:'#92400e' }}>Składnik</th>
                  <th style={{ padding:'5px 8px', background:'#fef3c7', border:'1px solid #fed7aa', textAlign:'left', color:'#92400e' }}>Dawkowanie</th>
                </tr>
              </thead>
              <tbody>
                {foodSummary.map((it, i) => {
                  const ft = FOOD_TYPES.find(f => f.id === it.type)
                  const dg = dailyGrams(it), dk = dailyKcal(it)
                  const dosage = it.unit === 'pcs'
                    ? `${it.piecesPerDay} szt × ${it.gramsPerPiece}g = ${dg}g/dzień`
                    : it.frequency === 'daily'
                      ? `${it.timesPerDay}× po ${it.gramsPerPortion}g = ${dg}g/dzień`
                      : `${it.gramsPerPortion}g, ${{few_week:'2–4×/tydz.',weekly:'1×/tydz.',occasionally:'okazjonalnie'}[it.frequency]||it.frequency}`
                  return (
                    <tr key={i} style={{ background: i%2===1 ? '#fffbeb' : '#fff' }}>
                      <td style={{ padding:'5px 8px', border:'1px solid #fed7aa' }}>{ft?.icon} <strong>{it.name||'—'}</strong></td>
                      <td style={{ padding:'5px 8px', border:'1px solid #fed7aa' }}>{dosage}{dk>0?` (≈${dk} kcal)`:''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Plan content */}
        <div style={{ marginBottom:24 }}>
          <MarkdownText text={plan.plan} />
        </div>

        {/* Footer */}
        <div style={{ borderTop:'1px solid #e5e7eb', paddingTop:10, display:'flex', justifyContent:'space-between', fontSize:11, color:'#9ca3af' }}>
          <span>Wygenerowano przez <strong style={{ color:'#e85d4a' }}>DogPass</strong></span>
          <span>{dateStr}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function MarkdownText({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  const els = []
  let buf = []
  const flush = () => {
    if (!buf.length) return
    els.push(<ul key={els.length} style={{ paddingLeft:18, margin:'4px 0 8px' }}>
      {buf.map((h,i) => <li key={i} style={{ marginBottom:2, fontSize:14, lineHeight:1.5 }} dangerouslySetInnerHTML={{ __html: h }} />)}
    </ul>)
    buf = []
  }
  const bold = s => s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (line.startsWith('## '))      { flush(); els.push(<h3 key={i} style={{ fontSize:15,fontWeight:700,margin:'14px 0 4px',color:'var(--primary)' }}>{line.slice(3)}</h3>) }
    else if (line.startsWith('# ')) { flush(); els.push(<h2 key={i} style={{ fontSize:17,fontWeight:700,margin:'16px 0 6px' }}>{line.slice(2)}</h2>) }
    else if (line.startsWith('- ')||/^\d+\.\s/.test(line)) { buf.push(bold(line.replace(/^[-*]\s/,'').replace(/^\d+\.\s/,''))) }
    else if (line==='')             { flush(); els.push(<div key={i} style={{ height:4 }} />) }
    else                            { flush(); els.push(<p key={i} style={{ fontSize:14,lineHeight:1.6,margin:'2px 0' }} dangerouslySetInnerHTML={{ __html: bold(line) }} />) }
  })
  flush()
  return <div>{els}</div>
}

// ─── Saved item row (compact) ─────────────────────────────────────────────────

function SavedItemRow({ item, onEdit, onDelete, t }) {
  const ft   = FOOD_TYPES.find(f => f.id === item.type)
  const dg   = dailyGrams(item)
  const dk   = dailyKcal(item)
  const name = item.name || t(ft?.labelKey || 'nutrition.typeOther')

  let portionStr = ''
  if (item.unit === 'pcs') {
    portionStr = `${item.piecesPerDay} szt × ${item.gramsPerPiece}g`
  } else if (item.frequency === 'daily') {
    portionStr = `${item.timesPerDay}× ${item.gramsPerPortion}g`
  } else {
    const freqLabels = { few_week: '2–4×/tydz.', weekly: '1×/tydz.', occasionally: 'okazjon.' }
    portionStr = `${freqLabels[item.frequency]||item.frequency} · ${item.gramsPerPortion}g`
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', background:'var(--surface)', border:'1px solid var(--gray-200)', borderRadius:10, marginBottom:6 }}>
      <span style={{ fontSize:20, flexShrink:0 }}>{ft?.icon || '🍽️'}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
        <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:1 }}>{portionStr}</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3, flexShrink:0 }}>
        {dg > 0 && <span style={{ fontSize:11, fontWeight:700, color:'#166534', background:'#f0fdf4', padding:'1px 7px', borderRadius:10 }}>{dg}g/{t('nutrition.day')}</span>}
        {dk > 0 && <span style={{ fontSize:11, fontWeight:700, color:'#92400e', background:'#fff7ed', padding:'1px 7px', borderRadius:10 }}>{dk} kcal</span>}
      </div>
      <button onClick={onEdit}  style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'var(--gray-400)', padding:'2px 4px' }}>✏️</button>
      <button onClick={onDelete} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'var(--gray-400)', padding:'2px 4px' }}>✕</button>
    </div>
  )
}

// ─── Add / Edit item form ─────────────────────────────────────────────────────

function ItemForm({ initial, onSave, onCancel, t }) {
  const [form, setForm]     = useState(initial || blankForm('dry'))
  const [scanning, setScan] = useState(false)
  const fileRef             = useRef(null)

  const upd = patch => setForm(f => {
    const next = { ...f, ...patch }
    // When type changes to treat → switch to pcs mode automatically
    if (patch.type === 'treat' && f.unit !== 'pcs') next.unit = 'pcs'
    if (patch.type && patch.type !== 'treat' && f.unit === 'pcs') next.unit = 'g'
    return next
  })

  const handleScan = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScan(true)
    try {
      const dataUrl = await resizeImage(file)
      const blob    = await (await fetch(dataUrl)).blob()
      const text    = await runOCR(blob)
      const parsed  = parseFoodLabel(text)
      const name    = [parsed.brand, parsed.productName].filter(Boolean).join(' ')
      const ctx     = [
        parsed.ingredients ? `Skład: ${parsed.ingredients.slice(0,300)}` : '',
        parsed.analysis    ? `Analiza: ${parsed.analysis.slice(0,200)}` : '',
      ].filter(Boolean).join('\n')
      upd({ name: name || form.name, scannedLabel: ctx || text.slice(0,400) })
    } catch (err) {
      console.error('Scan error:', err)
      alert(t('nutrition.scanError'))
    } finally {
      setScan(false)
      e.target.value = ''
    }
  }

  const isPcs   = form.unit === 'pcs'
  const isDaily = form.frequency === 'daily'
  const dg      = dailyGrams(form)
  const dk      = dailyKcal(form)

  return (
    <div style={{ background:'var(--gray-100)', borderRadius:12, padding:'14px 12px', marginBottom:12 }}>

      {/* Step 1: Type */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', marginBottom:7, textTransform:'uppercase', letterSpacing:'0.05em' }}>
          {t('nutrition.dietLabel')}
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {FOOD_TYPES.map(ft => (
            <button key={ft.id} type="button"
              onClick={() => upd({ type: ft.id })}
              style={{
                padding:'7px 12px', borderRadius:20, fontSize:13, cursor:'pointer',
                border: form.type === ft.id ? '2px solid var(--blue)' : '1.5px solid var(--gray-200)',
                background: form.type === ft.id ? 'var(--blue)' : 'var(--surface)',
                color: form.type === ft.id ? '#fff' : 'var(--gray-600)',
                fontWeight: form.type === ft.id ? 700 : 400,
                transition:'all 0.1s',
              }}>
              {ft.icon} {t(ft.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Name + scan */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>
          {t('nutrition.currentFoodLabel')}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <input type="text" value={form.name}
            onChange={e => upd({ name: e.target.value })}
            placeholder={t('nutrition.itemNamePlaceholder')}
            style={{ flex:1, border:'1.5px solid var(--gray-200)', borderRadius:8, padding:'9px 11px', fontSize:14, background:'#fff' }} />
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            style={{ display:'none' }} onChange={handleScan} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={scanning}
            style={{ padding:'9px 13px', border:'1.5px solid var(--gray-200)', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', gap:5, flexShrink:0, color: scanning ? 'var(--gray-400)' : 'var(--gray-700)' }}>
            {scanning ? <span className="spinner" style={{ width:14, height:14 }} /> : '📦'}
            {!scanning && t('nutrition.scanPackageShort')}
          </button>
        </div>
        {form.scannedLabel && (
          <div style={{ marginTop:5, fontSize:11, color:'#166534', background:'#f0fdf4', borderRadius:6, padding:'3px 9px' }}>
            ✅ {t('nutrition.scannedPackage')}
          </div>
        )}
      </div>

      {/* Step 3: Amount / frequency */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>
          {t('nutrition.dosageLabel')}
        </div>

        {/* Unit toggle (g vs pcs) */}
        <div style={{ display:'flex', gap:0, marginBottom:10, width:'fit-content', borderRadius:8, overflow:'hidden', border:'1.5px solid var(--gray-200)' }}>
          {[{id:'g',label:t('nutrition.unitGrams')},{id:'pcs',label:t('nutrition.unitPieces')}].map(u => (
            <button key={u.id} type="button" onClick={() => upd({ unit: u.id })}
              style={{ padding:'7px 18px', fontSize:13, cursor:'pointer', border:'none',
                background: form.unit===u.id ? 'var(--blue)' : '#fff',
                color: form.unit===u.id ? '#fff' : 'var(--gray-500)',
                fontWeight: form.unit===u.id ? 700 : 400 }}>
              {u.label}
            </button>
          ))}
        </div>

        {/* Gram mode */}
        {!isPcs && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
            <select value={form.frequency} onChange={e => upd({ frequency: e.target.value })}
              style={{ border:'1.5px solid var(--gray-200)', borderRadius:8, padding:'8px 10px', fontSize:14, background:'#fff', cursor:'pointer' }}>
              {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{t(f.labelKey)}</option>)}
            </select>

            {isDaily && (
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <button type="button" onClick={() => upd({ timesPerDay: Math.max(1, form.timesPerDay-1) })} style={stepBtn}>−</button>
                <span style={{ fontWeight:700, fontSize:15, minWidth:20, textAlign:'center' }}>{form.timesPerDay}</span>
                <button type="button" onClick={() => upd({ timesPerDay: Math.min(8, form.timesPerDay+1) })} style={stepBtn}>+</button>
                <span style={{ fontSize:12, color:'var(--gray-500)' }}>× {t('nutrition.perDay')}</span>
              </div>
            )}

            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input type="number" min="1" max="2000" value={form.gramsPerPortion}
                onChange={e => upd({ gramsPerPortion: Math.max(1, parseInt(e.target.value)||1) })}
                style={{ width:72, border:'1.5px solid var(--gray-200)', borderRadius:8, padding:'8px 8px', fontSize:14, background:'#fff', textAlign:'center' }} />
              <span style={{ fontSize:12, color:'var(--gray-500)' }}>g / {isDaily ? t('nutrition.perPortion') : t('nutrition.perPortionOcc')}</span>
            </div>
          </div>
        )}

        {/* Pieces mode */}
        {isPcs && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <button type="button" onClick={() => upd({ piecesPerDay: Math.max(1, form.piecesPerDay-1) })} style={stepBtn}>−</button>
              <span style={{ fontWeight:700, fontSize:15, minWidth:24, textAlign:'center' }}>{form.piecesPerDay}</span>
              <button type="button" onClick={() => upd({ piecesPerDay: Math.min(99, form.piecesPerDay+1) })} style={stepBtn}>+</button>
              <span style={{ fontSize:12, color:'var(--gray-500)' }}>{t('nutrition.piecesPerDay')}</span>
            </div>
            <span style={{ color:'var(--gray-400)', fontWeight:700 }}>×</span>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input type="number" min="1" max="500" value={form.gramsPerPiece}
                onChange={e => upd({ gramsPerPiece: Math.max(1, parseInt(e.target.value)||1) })}
                style={{ width:60, border:'1.5px solid var(--gray-200)', borderRadius:8, padding:'8px 8px', fontSize:14, background:'#fff', textAlign:'center' }} />
              <span style={{ fontSize:12, color:'var(--gray-500)' }}>g / {t('nutrition.perPiece')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Totals badge */}
      {dg > 0 && (
        <div style={{ display:'flex', gap:6, marginBottom:12 }}>
          <span style={{ background:'#f0fdf4', color:'#166534', border:'1px solid #86efac', borderRadius:12, padding:'3px 10px', fontSize:12, fontWeight:700 }}>
            = {dg}g / {t('nutrition.day')}
          </span>
          {dk > 0 && <span style={{ background:'#fff7ed', color:'#92400e', border:'1px solid #fed7aa', borderRadius:12, padding:'3px 10px', fontSize:12, fontWeight:700 }}>
            ≈ {dk} kcal / {t('nutrition.day')}
          </span>}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display:'flex', gap:8 }}>
        <button type="button" className="btn btn-primary" style={{ flex:1 }} onClick={() => onSave(form)}>
          ✓ {initial?.id ? t('nutrition.save') : t('nutrition.addItem')}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" style={{ flex:'0 0 auto' }} onClick={onCancel}>
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

const stepBtn = {
  width:32, height:32, borderRadius:8, border:'1.5px solid var(--gray-200)',
  background:'#fff', cursor:'pointer', fontSize:18, fontWeight:700,
  display:'flex', alignItems:'center', justifyContent:'center', padding:0,
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, dog, onDelete, onShowPdf, defaultExpanded, t }) {
  const [expanded, setExpanded] = useState(!!defaultExpanded)
  const d = new Date(plan.generatedAt)
  const dateStr = d.toLocaleDateString('pl-PL', { day:'2-digit', month:'2-digit', year:'numeric' })
  const timeStr = d.toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' })

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--gray-200)', borderRadius:12, marginBottom:10, overflow:'hidden' }}>

      {/* Header row — click to expand, no PDF button here */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', cursor:'pointer' }} onClick={() => setExpanded(x=>!x)}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700 }}>🤖 {t('nutrition.plan')} · {dateStr} {timeStr}</div>
          {!expanded && (
            <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {plan.plan.slice(0,140).replace(/#+\s/g,'').replace(/\*\*/g,'')}…
            </div>
          )}
        </div>
        <span style={{ fontSize:18, color:'var(--gray-400)', marginLeft:8, flexShrink:0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding:'0 14px 16px', borderTop:'1px solid var(--gray-200)' }}>

          {/* Diet summary pill */}
          {plan.foodItems?.length > 0 && (
            <div style={{ background:'var(--gray-100)', borderRadius:8, padding:'7px 12px', marginTop:12, marginBottom:4, fontSize:12, color:'var(--gray-600)' }}>
              🍗 <strong>{t('nutrition.currentFood')}:</strong> {formatFoodSummary(plan.foodItems)}
            </div>
          )}

          {/* Plan text */}
          <div style={{ marginTop:12 }}>
            <MarkdownText text={plan.plan} />
          </div>

          {/* Action buttons */}
          <div style={{ display:'flex', gap:8, marginTop:16 }}>
            <button className="btn btn-primary" style={{ flex:1, fontSize:13, padding:'9px 0', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
              onClick={() => onShowPdf(plan)}>
              📄 {t('nutrition.exportPdf')}
            </button>
            <button className="btn btn-danger" style={{ fontSize:13, padding:'9px 14px' }}
              onClick={() => onDelete(plan.id)}>
              🗑
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function NutritionScreen({ dog, weights }) {
  const { t, i18n } = useTranslation()

  const [savedItems,      setSavedItems]      = useState([])
  const [showForm,        setShowForm]        = useState(false)
  const [formInitialType, setFormInitialType] = useState('dry')
  const [editItem,        setEditItem]        = useState(null)
  const [generating,      setGenerating]      = useState(false)
  const [plans,           setPlans]           = useState([])
  const [error,           setError]           = useState('')
  const [pdfPlan,         setPdfPlan]         = useState(null)
  const [healthData,      setHealthData]      = useState({})

  useEffect(() => {
    if (!dog?.id) return
    // Load nutrition plans + restore last saved items
    getNutritionPlans(dog.id).then(plans => {
      setPlans(plans)
      if (plans.length > 0 && plans[0].foodItems?.length > 0) {
        setSavedItems(plans[0].foodItems)
      }
    }).catch(() => {})
    // Load health records for the AI prompt
    Promise.all([
      getVaccinations(dog.id).catch(() => []),
      getDewormings(dog.id).catch(() => []),
      getParasitePrevention(dog.id).catch(() => []),
    ]).then(([vaccinations, dewormings, parasitePrevention]) => {
      setHealthData({ vaccinations, dewormings, parasitePrevention })
    })
  }, [dog?.id])

  // Add item
  const handleAddItem = (form) => {
    const item = { ...form, id: Date.now() + Math.random() }
    setSavedItems(prev => [...prev, item])
    setShowForm(false)
  }

  // Save edited item
  const handleSaveEdit = (form) => {
    setSavedItems(prev => prev.map((it, i) => i === editItem.index ? { ...it, ...form } : it))
    setEditItem(null)
  }

  // Delete item
  const handleDeleteItem = (idx) => {
    setSavedItems(prev => prev.filter((_,i) => i !== idx))
  }

  // Generate plan — new plan added to top and auto-expanded
  const handleGenerate = async () => {
    if (!dog) return
    setGenerating(true)
    setError('')
    try {
      const plan = await generateNutritionPlan(dog, weights, savedItems, i18n.language || 'pl', healthData)
      const record = { dogId: dog.id, plan, foodItems: savedItems }
      const id = await addNutritionPlan(record)
      const newPlan = { ...record, id, generatedAt: Date.now() }
      setPlans(prev => [newPlan, ...prev])
      // Scroll to plan and show it expanded immediately
      setTimeout(() => {
        document.getElementById('nutrition-plans-top')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (err) {
      setError(err.message || t('nutrition.generateError'))
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('nutrition.confirmDelete'))) return
    await deleteNutritionPlan(id)
    setPlans(prev => prev.filter(p => p.id !== id))
  }

  const weightStatus = dog ? calcWeightStatus(dog, weights) : { status: 'unknown' }
  const latestWeight = weights.length > 0 ? weights[weights.length - 1].value : null

  const STATUS_STYLE = {
    overweight:  { bg:'#fef2f2', border:'#fca5a5', color:'#991b1b', icon:'⚠️' },
    underweight: { bg:'#eff6ff', border:'#93c5fd', color:'#1e40af', icon:'⚠️' },
    normal:      { bg:'#f0fdf4', border:'#86efac', color:'#166534', icon:'✅' },
  }
  const ss = STATUS_STYLE[weightStatus.status]

  // total daily kcal
  const totalKcal = savedItems.reduce((sum, it) => sum + dailyKcal(it), 0)

  return (
    <div className="screen" style={{ paddingBottom: 80 }}>
      {/* PDF preview modal */}
      {pdfPlan && (
        <PdfModal
          plan={pdfPlan}
          dog={dog}
          onClose={() => setPdfPlan(null)}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'16px 16px 8px' }}>
        <span style={{ fontSize:24 }}>🥩</span>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, margin:0 }}>{t('nutrition.title')}</h1>
          {dog && <div style={{ fontSize:13, color:'var(--gray-500)' }}>
            {dog.name}{latestWeight ? ` · ${latestWeight} kg` : ''}{dog.breedName ? ` · ${dog.breedName}` : ''}
          </div>}
        </div>
      </div>

      <div style={{ padding:'0 16px' }}>

        {/* Weight status banner */}
        {ss && (
          <div style={{ background:ss.bg, border:`1px solid ${ss.border}`, borderRadius:10, padding:'10px 14px', marginBottom:14, display:'flex', gap:8 }}>
            <span style={{ fontSize:18, flexShrink:0 }}>{ss.icon}</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:ss.color }}>
                {t(`nutrition.status${weightStatus.status.charAt(0).toUpperCase()+weightStatus.status.slice(1)}`)}
              </div>
              {weightStatus.diffKg != null && <div style={{ fontSize:12, color:ss.color, marginTop:2, opacity:0.85 }}>
                {weightStatus.status==='normal'
                  ? t('nutrition.statusNormalDetail', { idealMin:weightStatus.idealMin, idealMax:weightStatus.idealMax })
                  : t(`nutrition.status${weightStatus.status==='overweight'?'Overweight':'Underweight'}Detail`, { diffKg:Math.abs(weightStatus.diffKg), idealMin:weightStatus.idealMin, idealMax:weightStatus.idealMax })}
              </div>}
            </div>
          </div>
        )}

        {/* Diet section header */}
        <div style={{ fontWeight:700, fontSize:15, marginBottom:10 }}>🍽️ {t('nutrition.dietLabel')}</div>

        {/* Saved items list */}
        {savedItems.length === 0 && !showForm && (
          <div style={{ textAlign:'center', padding:'20px', color:'var(--gray-400)', fontSize:13, border:'2px dashed var(--gray-200)', borderRadius:10, marginBottom:10 }}>
            {t('nutrition.dietHint')}
          </div>
        )}

        {savedItems.map((item, idx) => {
          // If this item is being edited, show form inline
          if (editItem?.index === idx) {
            return (
              <ItemForm key={item.id} initial={editItem.item} t={t}
                onSave={handleSaveEdit}
                onCancel={() => setEditItem(null)} />
            )
          }
          return (
            <SavedItemRow key={item.id} item={item} t={t}
              onEdit={() => setEditItem({ index: idx, item })}
              onDelete={() => handleDeleteItem(idx)} />
          )
        })}

        {/* Add item form */}
        {showForm && (
          <ItemForm t={t}
            initial={blankForm(formInitialType)}
            onSave={handleAddItem}
            onCancel={() => setShowForm(false)} />
        )}

        {/* Total kcal summary */}
        {savedItems.length > 1 && totalKcal > 0 && (
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#92400e', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:12, padding:'4px 12px' }}>
              Σ ≈ {totalKcal} kcal / {t('nutrition.day')}
            </span>
          </div>
        )}

        {/* Add item / add treat buttons */}
        {!showForm && editItem === null && (
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            <button type="button"
              onClick={() => { setFormInitialType('dry'); setShowForm(true) }}
              style={{ flex:1, padding:'11px 0', borderRadius:10, border:'2px dashed var(--gray-200)', background:'transparent', cursor:'pointer', fontSize:14, color:'var(--blue)', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              ➕ {t('nutrition.addItem')}
            </button>
            <button type="button"
              onClick={() => { setFormInitialType('treat'); setShowForm(true) }}
              style={{ padding:'11px 16px', borderRadius:10, border:'2px dashed #fed7aa', background:'#fffbeb', cursor:'pointer', fontSize:13, color:'#92400e', fontWeight:600, whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
              🦴 {t('nutrition.addTreat')}
            </button>
          </div>
        )}

        {/* Generate button */}
        <button className="btn btn-primary"
          style={{ width:'100%', fontSize:15, padding:'13px 0', marginBottom:14 }}
          onClick={handleGenerate}
          disabled={generating || !dog}>
          {generating
            ? <><span className="spinner" style={{ width:16, height:16 }} /> {t('nutrition.generating')}</>
            : <>🤖 {t('nutrition.generateBtn')}</>}
        </button>

        {error && (
          <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:13, color:'#991b1b' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Plans */}
        <div id="nutrition-plans-top" />
        {plans.length > 0 && (
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-500)', marginBottom:8 }}>
              {t('nutrition.history')} ({plans.length})
            </div>
            {plans.map((plan, idx) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                dog={dog}
                onDelete={handleDelete}
                onShowPdf={setPdfPlan}
                defaultExpanded={idx === 0}
                t={t}
              />
            ))}
          </div>
        )}

        {plans.length === 0 && !generating && (
          <div style={{ textAlign:'center', padding:'32px 16px', color:'var(--gray-400)', fontSize:14 }}>
            <div style={{ fontSize:48, marginBottom:8 }}>🥣</div>
            <div>{t('nutrition.noPlans')}</div>
            <div style={{ fontSize:12, marginTop:4 }}>{t('nutrition.noPlansHint')}</div>
          </div>
        )}
      </div>
    </div>
  )
}
