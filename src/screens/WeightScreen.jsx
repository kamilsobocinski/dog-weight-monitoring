import { useState, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { format, parseISO, differenceInMonths } from 'date-fns'
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea,
} from 'recharts'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getBreedById, getIdealWeightAtAge } from '../data/breeds'
import { calcRealTrend } from '../utils/trend'
import { Toast, useToast } from '../components/Toast'

function dogAgeStr(birthdate) {
  if (!birthdate) return ''
  const months = differenceInMonths(new Date(), parseISO(birthdate))
  const y = Math.floor(months / 12)
  const m = months % 12
  return [y > 0 && `${y}y`, m > 0 && `${m}m`].filter(Boolean).join(' ') || '<1m'
}

export function WeightScreen({ dog, weights, onAdd, onDelete }) {
  const { t } = useTranslation()
  const { toast, showToast } = useToast()

  // ── Add form
  const [value,    setValue]    = useState('')
  const [date,     setDate]     = useState(new Date().toISOString().slice(0, 10))
  const [note,     setNote]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState('')

  // ── History
  const [confirmId, setConfirmId] = useState(null)
  const [exporting, setExporting] = useState(false)
  const chartRef = useRef(null)

  // ── Computed
  const breed      = dog ? getBreedById(dog.breedId) : null
  const ageMonths  = useMemo(() => {
    if (!dog?.birthdate) return 0
    return differenceInMonths(new Date(), parseISO(dog.birthdate))
  }, [dog])
  const idealRange = useMemo(() => {
    if (!breed || !dog) return null
    return getIdealWeightAtAge(breed, dog.sex, ageMonths)
  }, [breed, dog, ageMonths])

  const sortedAsc  = useMemo(() => [...weights].sort((a, b) => a.date.localeCompare(b.date)), [weights])
  const sortedDesc = useMemo(() => [...weights].sort((a, b) => b.date.localeCompare(a.date)), [weights])
  const latest     = sortedDesc[0] ?? null
  const trend      = useMemo(() => calcRealTrend(weights), [weights])

  const status = useMemo(() => {
    if (!latest || !idealRange) return null
    if (latest.value < idealRange.min) return 'low'
    if (latest.value > idealRange.max) return 'high'
    return 'good'
  }, [latest, idealRange])

  const chartData = useMemo(() => sortedAsc.map(w => ({
    date: format(parseISO(w.date), 'd MMM'),
    weight: w.value,
  })), [sortedAsc])

  const yDomain = useMemo(() => {
    const vals = weights.map(w => w.value)
    if (idealRange) vals.push(idealRange.min, idealRange.max)
    if (!vals.length) return ['auto', 'auto']
    return [+(Math.min(...vals) * 0.93).toFixed(1), +(Math.max(...vals) * 1.07).toFixed(1)]
  }, [weights, idealRange])

  const deviation = useMemo(() => {
    if (!idealRange || !latest) return null
    const w   = latest.value
    const mid = (idealRange.min + idealRange.max) / 2
    const pct = +((w - mid) / mid * 100).toFixed(1)
    if (w > idealRange.max) return { type: 'high', kg: +(w - idealRange.max).toFixed(2), pct }
    if (w < idealRange.min) return { type: 'low',  kg: +(idealRange.min - w).toFixed(2), pct }
    return null
  }, [idealRange, latest])

  // ── Add weight handler
  const handleAdd = async () => {
    const num = parseFloat(String(value).replace(',', '.'))
    if (!value || isNaN(num) || num <= 0) { setErr(t('errors.weightInvalid')); return }
    if (num < 0.5)  { setErr(t('errors.weightTooLow'));  return }
    if (num > 120)  { setErr(t('errors.weightTooHigh')); return }
    if (!date)      { setErr(t('errors.dateRequired'));  return }
    setErr('')
    setSaving(true)
    try {
      await onAdd(num, date, note.trim())
      setValue('')
      setNote('')
      showToast(t('weight.saved'))
    } finally {
      setSaving(false)
    }
  }

  // ── PDF export (identical logic to HistoryScreen)
  const exportPDF = async () => {
    if (!dog || weights.length === 0) return
    setExporting(true)
    try {
      const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const margin = 15

      doc.setFillColor(37, 99, 235)
      doc.rect(0, 0, pageW, 28, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('🐾 DogPass', margin, 12)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Generated: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, margin, 20)

      doc.setTextColor(30, 41, 59)
      doc.setFillColor(241, 245, 249)
      doc.rect(margin, 33, pageW - margin * 2, 26, 'F')
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(dog.name, margin + 4, 42)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(dog.breedName || '', margin + 4, 49)
      const dobStr = dog.birthdate ? format(parseISO(dog.birthdate), 'dd.MM.yyyy') : '—'
      const sexStr = dog.sex === 'female' ? t('setup.female') : t('setup.male')
      doc.text(
        `${t('setup.birthdate')}: ${dobStr}  |  ${t('setup.sex')}: ${sexStr}  |  Age: ${dogAgeStr(dog.birthdate)}`,
        margin + 4, 56,
      )
      if (idealRange) {
        doc.setFontSize(9)
        doc.setTextColor(100, 116, 139)
        doc.text(`Ideal weight range: ${idealRange.min}–${idealRange.max} kg`, pageW - margin, 56, { align: 'right' })
      }

      let chartY = 65
      if (chartRef.current) {
        try {
          const canvas = await html2canvas(chartRef.current, { scale: 2, backgroundColor: '#ffffff', logging: false })
          const imgData = canvas.toDataURL('image/png')
          const chartH = 55
          doc.addImage(imgData, 'PNG', margin, chartY, pageW - margin * 2, chartH)
          chartY += chartH + 8
        } catch { chartY += 5 }
      }

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 41, 59)
      doc.text('Weight History', margin, chartY + 5)
      chartY += 8

      const hasRange = !!idealRange
      const rows = sortedDesc.map(w => {
        let dev = ''
        if (idealRange) {
          const mid = (idealRange.min + idealRange.max) / 2
          const d = w.value - mid
          dev = (d >= 0 ? '+' : '') + d.toFixed(1) + ' kg'
        }
        const norm = idealRange ? `${idealRange.min}–${idealRange.max} kg` : '—'
        const row = [format(parseISO(w.date), 'dd.MM.yyyy'), `${w.value} kg`, dev, norm, w.note || '']
        if (hasRange) row.push('')
        return row
      })

      const head = [['Date', 'Weight', 'Deviation', 'Breed norm', 'Note']]
      if (hasRange) head[0].push('Range')

      const colStyles = { 2: { halign: 'center' }, 3: { halign: 'center' } }
      if (hasRange) colStyles[5] = { halign: 'center', cellWidth: 34 }

      autoTable(doc, {
        startY: chartY + 2,
        head,
        body: rows,
        margin: { left: margin, right: margin },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: [30, 41, 59], minCellHeight: 10 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: colStyles,
        didDrawCell: (data) => {
          if (!hasRange || data.section !== 'body' || data.column.index !== 5) return
          const row = sortedDesc[data.row.index]
          if (!row || !idealRange) return
          const weight = row.value
          const { x, y, width, height } = data.cell
          const pad = 4, bx = x + pad, bw = width - pad * 2, bh = 5, by = y + (height - bh) / 2
          const spread = Math.max(idealRange.max - idealRange.min, 0.5)
          const vMin = idealRange.min - spread * 0.8
          const vMax = idealRange.max + spread * 0.8
          const vRange = vMax - vMin
          doc.setFillColor(210, 210, 210)
          doc.roundedRect(bx, by, bw, bh, 1.5, 1.5, 'F')
          const gx = bx + ((idealRange.min - vMin) / vRange) * bw
          const gw = ((idealRange.max - idealRange.min) / vRange) * bw
          doc.setFillColor(134, 239, 172)
          doc.roundedRect(gx, by, gw, bh, 1.5, 1.5, 'F')
          const rawDotX = bx + ((weight - vMin) / vRange) * bw
          const dotX = Math.max(bx + 2.5, Math.min(bx + bw - 2.5, rawDotX))
          const dotY = by + bh / 2
          if (weight < idealRange.min)      doc.setFillColor(37, 99, 235)
          else if (weight > idealRange.max) doc.setFillColor(220, 38, 38)
          else                              doc.setFillColor(22, 163, 74)
          doc.circle(dotX, dotY, 2.5, 'F')
        },
      })

      const pages = doc.getNumberOfPages()
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p)
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(`DogPass · Page ${p}/${pages}`, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' })
      }

      doc.save(`${dog.name}_weight_${format(new Date(), 'yyyyMMdd')}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  // ── Shared chart markup (visible + PDF capture)
  const chartMarkup = (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} domain={yDomain} />
        <Tooltip formatter={v => [`${v} kg`]} />
        {idealRange && <ReferenceArea y1={idealRange.min} y2={idealRange.max} fill="#16a34a" fillOpacity={0.15} stroke="#16a34a" strokeOpacity={0.5} strokeWidth={1} />}
        {idealRange && <ReferenceLine y={idealRange.min} stroke="#16a34a" strokeDasharray="4 2" strokeWidth={1} />}
        {idealRange && <ReferenceLine y={idealRange.max} stroke="#16a34a" strokeDasharray="4 2" strokeWidth={1} />}
        <Line type="monotone" dataKey="weight" stroke="#2563eb" strokeWidth={2.5} dot={{ fill: '#2563eb', r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )

  if (!dog) {
    return (
      <div className="screen">
        <div className="page-header"><h1 className="page-title">⚖️ {t('nav.weight')}</h1></div>
        <div className="empty-state">
          <div className="empty-state-icon">🐶</div>
          <div className="empty-state-text">{t('dashboard.noData')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">⚖️ {dog.name}</h1>
        {dog.photo && (
          <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--gray-200)', flexShrink: 0 }}>
            <img src={dog.photo} alt={dog.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.currentWeight')}</div>
          <div className="stat-value">{latest ? `${latest.value} kg` : '—'}</div>
          {status && (
            <div className="stat-sub">
              <span className={`status-${status}`}>
                {status === 'good' ? t('dashboard.withinRange') :
                 status === 'high' ? t('dashboard.above') : t('dashboard.below')}
              </span>
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.idealRange')}</div>
          <div className="stat-value" style={{ fontSize: 16 }}>
            {idealRange ? `${idealRange.min}–${idealRange.max}` : '—'}
          </div>
          <div className="stat-sub">kg</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.trend')}</div>
          <div className="stat-value" style={{ fontSize: 16,
            color: trend.direction === 'up' ? 'var(--orange)' : trend.direction === 'down' ? 'var(--blue)' : 'var(--green)' }}>
            {trend.direction === 'up'   ? t('dashboard.trendUp')   :
             trend.direction === 'down' ? t('dashboard.trendDown') : t('dashboard.trendStable')}
          </div>
          {trend.direction !== 'stable' && trend.n >= 2 && (
            <div className="stat-sub" style={{ fontSize: 11 }}>
              {trend.kgPerMonth > 0 ? '+' : ''}{trend.kgPerMonth} kg/{t('medCard.perMonth')}
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.lastMeasured')}</div>
          <div className="stat-value" style={{ fontSize: 16 }}>
            {latest ? format(parseISO(latest.date), 'dd.MM.yy') : '—'}
          </div>
          <div className="stat-sub">{weights.length} pom.</div>
        </div>
      </div>

      {/* Deviation badge */}
      {deviation && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 10,
          fontSize: 13, fontWeight: 600,
          background: deviation.type === 'high' ? 'var(--red-light)'  : 'var(--blue-light)',
          color:      deviation.type === 'high' ? 'var(--red)'        : 'var(--blue)',
        }}>
          <span style={{ fontSize: 16 }}>{deviation.type === 'high' ? '⬆' : '⬇'}</span>
          <span>
            {deviation.type === 'high' ? '+' : '−'}{deviation.kg} kg
            {' '}·{' '}
            {deviation.pct >= 0 ? '+' : ''}{deviation.pct}%
            {' '}{deviation.type === 'high' ? t('dashboard.above') : t('dashboard.below')}
          </span>
        </div>
      )}

      {/* Chart (ref for PDF capture) */}
      {weights.length > 0 && (
        <div ref={chartRef} style={{ background: 'white', padding: '8px 4px', marginBottom: 12 }}>
          {chartMarkup}
        </div>
      )}

      {/* ─── Add measurement form ─────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
          ➕ {t('weight.title')}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {/* Weight */}
          <div style={{ flex: 1 }}>
            <label className="form-label">{t('weight.value')}</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              className="form-input"
              style={{ fontSize: 22, fontWeight: 700, textAlign: 'center' }}
              placeholder="kg"
              value={value}
              onChange={e => { setValue(e.target.value); setErr('') }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
          {/* Date */}
          <div style={{ flex: 1 }}>
            <label className="form-label">{t('weight.date')}</label>
            <input
              type="date"
              className="form-input"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setDate(e.target.value)}
            />
          </div>
        </div>

        {/* Note */}
        <div style={{ marginBottom: 8 }}>
          <label className="form-label">{t('weight.note')}</label>
          <input
            type="text"
            className="form-input"
            placeholder={t('weight.notePlaceholder')}
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={100}
          />
        </div>

        {err && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>⚠️ {err}</div>}

        <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
          {saving
            ? <><span className="spinner" style={{ width: 14, height: 14 }} /> {t('weight.save')}</>
            : `✓ ${t('weight.save')}`
          }
        </button>
      </div>

      {/* ─── History ──────────────────────────────────────────────────── */}
      {weights.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 20 }}>
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-text">{t('weight.addFirst')}</div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>📋 {t('history.title')}</div>
            <button
              className="btn btn-secondary"
              style={{ padding: '7px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}
              onClick={exportPDF}
              disabled={exporting}
            >
              {exporting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '📄'} PDF
            </button>
          </div>

          <div className="card">
            {sortedDesc.map((w, i) => {
              const prev  = sortedDesc[i + 1]
              const delta = prev ? w.value - prev.value : null

              return (
                <div key={w.id}>
                  {confirmId === w.id ? (
                    <div className="weight-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{t('weight.confirmDelete')}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-danger" style={{ padding: '8px 16px', fontSize: 13 }}
                          onClick={() => { onDelete(w.id); setConfirmId(null) }}>
                          {t('weight.delete')}
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}
                          onClick={() => setConfirmId(null)}>✕</button>
                      </div>
                    </div>
                  ) : (
                    <div className="weight-row">
                      <div className="weight-date">{format(parseISO(w.date), 'dd.MM.yyyy')}</div>
                      <div>
                        <div className="weight-val">{w.value} kg</div>
                        {w.note && <div className="weight-note">{w.note}</div>}
                        {idealRange && (
                          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                            norm: {idealRange.min}–{idealRange.max} kg
                          </div>
                        )}
                      </div>
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                        {delta !== null && (
                          <span className={
                            delta > 0.05  ? 'weight-delta-up'   :
                            delta < -0.05 ? 'weight-delta-down' : 'weight-delta-same'
                          }>
                            {delta > 0.05 ? `+${delta.toFixed(1)}` : delta < -0.05 ? delta.toFixed(1) : '±0'}
                          </span>
                        )}
                        <button onClick={() => setConfirmId(w.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-300)', fontSize: 18, padding: '4px', lineHeight: 1 }}>
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
      )}

      <Toast message={toast} />
    </div>
  )
}
