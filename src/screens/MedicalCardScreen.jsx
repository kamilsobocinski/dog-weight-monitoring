import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { format, parseISO, differenceInMonths } from 'date-fns'
import { getBreedById, getIdealWeightAtAge } from '../data/breeds'
import { getVaccinations, getDewormings, getParasitePrevention } from '../utils/db'
import { calcRealTrend } from '../utils/trend'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(dateStr) {
  if (!dateStr) return '—'
  try { return format(parseISO(dateStr), 'dd.MM.yyyy') } catch { return dateStr }
}

function dogAge(birthdate, t) {
  if (!birthdate) return '—'
  const months = differenceInMonths(new Date(), parseISO(birthdate))
  const y = Math.floor(months / 12)
  const m = months % 12
  const parts = []
  if (y > 0) parts.push(`${y}${t('dashboard.years')}`)
  if (m > 0) parts.push(`${m}${t('dashboard.months')}`)
  return parts.join(' ') || `<1${t('dashboard.months')}`
}

// ─── Print table ─────────────────────────────────────────────────────────────

function McTable({ headers, rows, emptyLabel }) {
  if (!rows.length) {
    return <p style={{ fontSize: 12, color: '#888', margin: '6px 0 16px' }}>{emptyLabel}</p>
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 12 }}>
      <thead>
        <tr>
          {headers.map(h => (
            <th key={h} style={{ background: '#f3f4f6', border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
            {row.map((cell, j) => (
              <td key={j} style={{ border: '1px solid #d1d5db', padding: '6px 8px', verticalAlign: 'top' }}>
                {cell || '—'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function Section({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 10px', borderBottom: '2px solid #2563eb', paddingBottom: 4 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {title}
      </span>
    </div>
  )
}

// ─── MedicalCardScreen ────────────────────────────────────────────────────────

export function MedicalCardScreen({ dog, weights, onClose }) {
  const { t } = useTranslation()
  const [vaccinations, setVaccinations] = useState([])
  const [dewormings,   setDewormings]   = useState([])
  const [parasites,    setParasites]    = useState([])
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    if (!dog) return
    Promise.all([
      getVaccinations(dog.id),
      getDewormings(dog.id),
      getParasitePrevention(dog.id),
    ]).then(([v, d, p]) => {
      setVaccinations([...v].sort((a, b) => b.date.localeCompare(a.date)))
      setDewormings(  [...d].sort((a, b) => b.date.localeCompare(a.date)))
      setParasites(   [...p].sort((a, b) => b.date.localeCompare(a.date)))
      setLoading(false)
    })
  }, [dog])

  const breed      = dog ? getBreedById(dog.breedId) : null
  const ageMonths  = dog?.birthdate ? differenceInMonths(new Date(), parseISO(dog.birthdate)) : 0
  const idealRange = breed ? getIdealWeightAtAge(breed, dog.sex, ageMonths) : null
  const latest     = weights.length > 0 ? weights[weights.length - 1] : null
  const trend      = calcRealTrend(weights)

  const weightStatus = latest && idealRange
    ? (latest.value < idealRange.min ? 'low' : latest.value > idealRange.max ? 'high' : 'ok')
    : null
  const statusLabel = {
    ok:   `✅ ${t('dashboard.withinRange')}`,
    high: `⚠️ +${(latest?.value - idealRange?.max).toFixed(1)} kg ${t('dashboard.above')}`,
    low:  `ℹ️ -${(idealRange?.min - latest?.value).toFixed(1)} kg ${t('dashboard.below')}`,
  }

  const trendLabel = trend.direction === 'up'   ? t('dashboard.trendUp')
                   : trend.direction === 'down'  ? t('dashboard.trendDown')
                   :                               t('dashboard.trendStable')
  const trendColor = trend.direction === 'up' ? '#ea580c' : trend.direction === 'down' ? '#2563eb' : '#16a34a'
  const trendRate  = trend.direction !== 'stable'
    ? ` (${trend.kgPerMonth > 0 ? '+' : ''}${trend.kgPerMonth} kg/${t('medCard.perMonth')})`
    : ''

  if (!dog) return null

  return (
    <div className="medical-card-overlay">
      {/* ── Toolbar (hidden in print) ── */}
      <div className="no-print" style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--surface)', borderBottom: '1px solid var(--gray-200)',
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
      }}>
        <button className="btn btn-ghost" onClick={onClose}>← {t('medCard.back')}</button>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 15, color: 'var(--gray-700)' }}>
          📄 {t('medCard.title')}
        </div>
        <button className="btn btn-primary" style={{ padding: '8px 14px' }} onClick={() => window.print()}>
          🖨️ {t('medCard.printBtn')}
        </button>
      </div>

      {/* ── Medical card content ── */}
      <div className="medical-card-content" style={{ padding: '20px 16px 40px', maxWidth: 800, margin: '0 auto' }}>

        {/* App header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>🐾 Dog Weight Monitoring</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            {t('medCard.generatedOn')}: {format(new Date(), 'dd.MM.yyyy HH:mm')}
          </div>
        </div>

        {/* Dog header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '3px solid #2563eb', paddingBottom: 14, marginBottom: 4 }}>
          {dog.photo && (
            <img src={dog.photo} alt={dog.name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0', flexShrink: 0 }} />
          )}
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{dog.name}</div>
            <div style={{ fontSize: 14, color: '#475569', marginTop: 4 }}>
              {dog.breedName} · {dog.sex === 'female' ? t('setup.female') : t('setup.male')}
            </div>
          </div>
        </div>

        {/* Dog details grid */}
        <Section icon="🐶" title={t('medCard.dogInfo')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 16px', marginBottom: 4, fontSize: 13 }}>
          <div><span style={{ fontWeight: 700, color: '#475569' }}>{t('setup.birthdate')}:</span> {fmt(dog.birthdate)}</div>
          <div><span style={{ fontWeight: 700, color: '#475569' }}>{t('dashboard.age')}:</span> {dogAge(dog.birthdate, t)}</div>
          <div><span style={{ fontWeight: 700, color: '#475569' }}>{t('setup.sex')}:</span> {dog.sex === 'female' ? t('setup.female') : t('setup.male')}</div>
          {dog.chipNumber && <div><span style={{ fontWeight: 700, color: '#475569' }}>{t('medCard.chipNo')}:</span> {dog.chipNumber}</div>}
          {dog.colour     && <div><span style={{ fontWeight: 700, color: '#475569' }}>{t('medCard.colour')}:</span> {dog.colour}</div>}
        </div>

        {/* Weight */}
        <Section icon="⚖️" title={t('medCard.weightSection')} />

        {/* Weight summary row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 16px', marginBottom: 10, fontSize: 13 }}>
          <div>
            <div style={{ fontWeight: 700, color: '#475569', fontSize: 11, textTransform: 'uppercase' }}>{t('dashboard.currentWeight')}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>{latest ? `${latest.value} kg` : '—'}</div>
            {weightStatus && <div style={{ fontSize: 11, fontWeight: 600, color: weightStatus === 'ok' ? '#16a34a' : '#ea580c' }}>{statusLabel[weightStatus]}</div>}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#475569', fontSize: 11, textTransform: 'uppercase' }}>{t('dashboard.idealRange')}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>{idealRange ? `${idealRange.min}–${idealRange.max} kg` : '—'}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{t('dashboard.comparedToIdeal')}</div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#475569', fontSize: 11, textTransform: 'uppercase' }}>{t('dashboard.trend')}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: trendColor }}>{trendLabel}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {trend.direction !== 'stable' && `${trend.kgPerMonth > 0 ? '+' : ''}${trend.kgPerMonth} kg/${t('medCard.perMonth')}`}
              {trend.n >= 3 && <span style={{ color: '#94a3b8' }}> · {t('medCard.trendBased', { n: trend.n })}</span>}
            </div>
          </div>
        </div>

        {/* Weight history table */}
        <McTable
          headers={[t('history.date'), t('history.weight'), t('history.note')]}
          rows={[...weights].reverse().slice(0, 30).map(w => [
            fmt(w.date),
            `${w.value} kg`,
            w.note || '',
          ])}
          emptyLabel={t('medCard.noData')}
        />

        {/* Vaccinations */}
        <Section icon="💉" title={t('medCard.vaccinationsSection')} />
        {loading ? <p style={{ fontSize: 12, color: '#888' }}>...</p> : (
          <McTable
            headers={[t('health.date'), t('health.vaccinations.vaccineType'), t('health.vaccinations.vaccineName'), t('health.vaccinations.validUntil'), t('health.vaccinations.batchNumber'), t('health.vetName')]}
            rows={vaccinations.map(r => [
              fmt(r.date),
              t(`health.vaccineTypes.${r.vaccineType}`),
              r.vaccineName,
              fmt(r.validUntil),
              r.batchNumber,
              r.vetName,
            ])}
            emptyLabel={t('medCard.noData')}
          />
        )}

        {/* Deworming */}
        <Section icon="💊" title={t('medCard.dewormingSection')} />
        {loading ? <p style={{ fontSize: 12, color: '#888' }}>...</p> : (
          <McTable
            headers={[t('health.date'), t('health.product'), t('health.dose'), t('medCard.reaction')]}
            rows={dewormings.map(r => [
              fmt(r.date),
              r.product,
              r.dose,
              r.reaction && r.reaction !== 'none' ? t(`health.reactions.${r.reaction}`) : t('health.reactions.none'),
            ])}
            emptyLabel={t('medCard.noData')}
          />
        )}

        {/* Parasite prevention */}
        <Section icon="🐛" title={t('medCard.parasitesSection')} />
        {loading ? <p style={{ fontSize: 12, color: '#888' }}>...</p> : (
          <McTable
            headers={[t('health.date'), t('health.product'), t('health.dose'), t('medCard.reaction'), t('health.nextDue')]}
            rows={parasites.map(r => [
              fmt(r.date),
              r.product,
              r.dose,
              r.reaction && r.reaction !== 'none' ? t(`health.reactions.${r.reaction}`) : t('health.reactions.none'),
              fmt(r.nextDue),
            ])}
            emptyLabel={t('medCard.noData')}
          />
        )}

        {/* Footer */}
        <div style={{ marginTop: 32, paddingTop: 12, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
          Dog Weight Monitoring · {format(new Date(), 'dd.MM.yyyy')} · dogweightmonitoring.vercel.app
        </div>
      </div>
    </div>
  )
}
