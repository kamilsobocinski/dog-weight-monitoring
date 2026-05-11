import { useState, useRef } from 'react'
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

function dogAgeStr(birthdate) {
  if (!birthdate) return ''
  const months = differenceInMonths(new Date(), parseISO(birthdate))
  const y = Math.floor(months / 12)
  const m = months % 12
  return [y > 0 && `${y}y`, m > 0 && `${m}m`].filter(Boolean).join(' ') || '<1m'
}

export function HistoryScreen({ dog, weights, onDelete }) {
  const { t } = useTranslation()
  const [confirmId, setConfirmId] = useState(null)
  const [exporting, setExporting] = useState(false)
  const chartRef = useRef(null)

  const breed = dog ? getBreedById(dog.breedId) : null
  const ageMonths = dog?.birthdate ? differenceInMonths(new Date(), parseISO(dog.birthdate)) : 0
  const idealRange = breed && dog ? getIdealWeightAtAge(breed, dog.sex, ageMonths) : null

  const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date))

  const chartData = weights
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(w => ({ date: format(parseISO(w.date), 'd MMM'), weight: w.value }))

  // --- Deviation of latest weight from ideal range ---
  const latestWeight = sorted[0]
  let deviation = null
  if (idealRange && latestWeight) {
    const w = latestWeight.value
    const mid = (idealRange.min + idealRange.max) / 2
    const pct = +((w - mid) / mid * 100).toFixed(1)
    if (w > idealRange.max) {
      deviation = { type: 'high', kg: +(w - idealRange.max).toFixed(2), pct }
    } else if (w < idealRange.min) {
      deviation = { type: 'low', kg: +(idealRange.min - w).toFixed(2), pct }
    }
  }

  // --- YAxis domain — includes ideal band so it's fully visible ---
  const allVals = chartData.map(d => d.weight)
  if (idealRange) { allVals.push(idealRange.min, idealRange.max) }
  const yMin = allVals.length ? +(Math.min(...allVals) * 0.93).toFixed(1) : 'auto'
  const yMax = allVals.length ? +(Math.max(...allVals) * 1.07).toFixed(1) : 'auto'

  // ----------------------------------------------------------------
  const exportPDF = async () => {
    if (!dog || weights.length === 0) return
    setExporting(true)
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const margin = 15

      // Header bar
      doc.setFillColor(37, 99, 235)
      doc.rect(0, 0, pageW, 28, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('🐾 DogPass', margin, 12)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Generated: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, margin, 20)

      // Dog info box
      doc.setTextColor(30, 41, 59)
      doc.setFillColor(241, 245, 249)
      doc.rect(margin, 33, pageW - margin * 2, 26, 'F')
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(dog.name, margin + 4, 42)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(dog.breedName, margin + 4, 49)
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

      // Chart image
      let chartY = 65
      if (chartRef.current) {
        try {
          const canvas = await html2canvas(chartRef.current, { scale: 2, backgroundColor: '#ffffff', logging: false })
          const imgData = canvas.toDataURL('image/png')
          const chartH = 55
          doc.addImage(imgData, 'PNG', margin, chartY, pageW - margin * 2, chartH)
          chartY += chartH + 8
        } catch {
          chartY += 5
        }
      }

      // "Weight History" label
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 41, 59)
      doc.text('Weight History', margin, chartY + 5)
      chartY += 8

      // Build table rows
      const hasRange = !!idealRange
      const rows = sorted.map(w => {
        let dev = ''
        if (idealRange) {
          const mid = (idealRange.min + idealRange.max) / 2
          const d = w.value - mid
          dev = (d >= 0 ? '+' : '') + d.toFixed(1) + ' kg'
        }
        const norm = idealRange ? `${idealRange.min}–${idealRange.max} kg` : '—'
        const row = [
          format(parseISO(w.date), 'dd.MM.yyyy'),
          `${w.value} kg`,
          dev,
          norm,
          w.note || '',
        ]
        if (hasRange) row.push('') // placeholder for visual bar
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

        // Draw visual range bar in the last column
        didDrawCell: (data) => {
          if (!hasRange || data.section !== 'body' || data.column.index !== 5) return
          const row = sorted[data.row.index]
          if (!row || !idealRange) return

          const weight = row.value
          const { x, y, width, height } = data.cell

          const pad = 4
          const bx = x + pad
          const bw = width - pad * 2
          const bh = 5
          const by = y + (height - bh) / 2

          // Visual scale: ideal range ± 80 % of spread on each side
          const spread = Math.max(idealRange.max - idealRange.min, 0.5)
          const vMin = idealRange.min - spread * 0.8
          const vMax = idealRange.max + spread * 0.8
          const vRange = vMax - vMin

          // Gray track (full bar)
          doc.setFillColor(210, 210, 210)
          doc.roundedRect(bx, by, bw, bh, 1.5, 1.5, 'F')

          // Light-green ideal zone
          const gx = bx + ((idealRange.min - vMin) / vRange) * bw
          const gw = ((idealRange.max - idealRange.min) / vRange) * bw
          doc.setFillColor(134, 239, 172)
          doc.roundedRect(gx, by, gw, bh, 1.5, 1.5, 'F')

          // Dot — clamped inside bar
          const rawDotX = bx + ((weight - vMin) / vRange) * bw
          const dotX = Math.max(bx + 2.5, Math.min(bx + bw - 2.5, rawDotX))
          const dotY = by + bh / 2

          if (weight < idealRange.min)       doc.setFillColor(37, 99, 235)    // blue  = too low
          else if (weight > idealRange.max)  doc.setFillColor(220, 38, 38)   // red   = too high
          else                               doc.setFillColor(22, 163, 74)   // green = in range
          doc.circle(dotX, dotY, 2.5, 'F')
        },
      })

      // Footer
      const pages = doc.getNumberOfPages()
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p)
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(
          `DogPass · Page ${p}/${pages}`,
          pageW / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' },
        )
      }

      doc.save(`${dog.name}_weight_${format(new Date(), 'yyyyMMdd')}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  // ----------------------------------------------------------------
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

  // Shared chart markup — rendered in the DOM (visible) and captured for PDF via ref
  const chartMarkup = (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} domain={[yMin, yMax]} />
        <Tooltip formatter={v => [`${v} kg`]} />
        {/* Green reference band */}
        {idealRange && (
          <ReferenceArea
            y1={idealRange.min}
            y2={idealRange.max}
            fill="#16a34a"
            fillOpacity={0.15}
            stroke="#16a34a"
            strokeOpacity={0.5}
            strokeWidth={1}
          />
        )}
        {/* Boundary lines */}
        {idealRange && (
          <ReferenceLine y={idealRange.min} stroke="#16a34a" strokeDasharray="4 2" strokeWidth={1} />
        )}
        {idealRange && (
          <ReferenceLine y={idealRange.max} stroke="#16a34a" strokeDasharray="4 2" strokeWidth={1} />
        )}
        <Line
          type="monotone"
          dataKey="weight"
          stroke="#2563eb"
          strokeWidth={2.5}
          dot={{ fill: '#2563eb', r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )

  return (
    <div className="screen">
      <div className="page-header">
        <h1 className="page-title">📋 {t('history.title')}</h1>
        <button
          className="btn btn-secondary"
          style={{ padding: '7px 14px', fontSize: 13, gap: 5 }}
          onClick={exportPDF}
          disabled={exporting}
        >
          {exporting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '📄'}
          PDF
        </button>
      </div>

      {/* Deviation badge — shown only when latest weight is out of range */}
      {deviation && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 14px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 10,
          fontSize: 13,
          fontWeight: 600,
          background: deviation.type === 'high' ? 'var(--red-light)' : 'var(--blue-light)',
          color:      deviation.type === 'high' ? 'var(--red)'       : 'var(--blue)',
        }}>
          <span style={{ fontSize: 16 }}>{deviation.type === 'high' ? '⬆' : '⬇'}</span>
          <span>
            {deviation.type === 'high' ? '+' : '−'}{deviation.kg} kg
            {' '}·{' '}
            {deviation.pct >= 0 ? '+' : ''}{deviation.pct}%
            {' '}
            {deviation.type === 'high' ? t('dashboard.above') : t('dashboard.below')}
          </span>
        </div>
      )}

      {/* Chart — also captured via ref for PDF */}
      <div ref={chartRef} style={{ background: 'white', padding: '8px 4px', marginBottom: 12 }}>
        {chartMarkup}
      </div>

      {/* History list */}
      <div className="card">
        {sorted.map((w, i) => {
          const prev = sorted[i + 1]
          const delta = prev ? w.value - prev.value : null

          return (
            <div key={w.id}>
              {confirmId === w.id ? (
                <div className="weight-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t('weight.confirmDelete')}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '8px 16px', fontSize: 13 }}
                      onClick={() => { onDelete(w.id); setConfirmId(null) }}
                    >
                      {t('weight.delete')}
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '8px 16px', fontSize: 13 }}
                      onClick={() => setConfirmId(null)}
                    >✕</button>
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
                        delta < -0.05 ? 'weight-delta-down' :
                                        'weight-delta-same'
                      }>
                        {delta > 0.05 ? `+${delta.toFixed(1)}` : delta < -0.05 ? delta.toFixed(1) : '±0'}
                      </span>
                    )}
                    <button
                      onClick={() => setConfirmId(w.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-300)', fontSize: 18, padding: '4px', lineHeight: 1 }}
                    >🗑</button>
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
