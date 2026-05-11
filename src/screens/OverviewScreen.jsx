import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format, parseISO, differenceInMonths, differenceInDays } from 'date-fns'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts'
import { getBreedById, getIdealWeightAtAge } from '../data/breeds'
import { calcRealTrend } from '../utils/trend'
import { getVaccinations, getDewormings, getParasitePrevention } from '../utils/db'
import { DogSelector } from '../components/DogSelector'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ageLabel(birthdate, t) {
  if (!birthdate) return null
  const months = differenceInMonths(new Date(), parseISO(birthdate))
  const y = Math.floor(months / 12)
  const m = months % 12
  const parts = []
  if (y > 0) parts.push(`${y} ${t('dashboard.years')}`)
  if (m > 0) parts.push(`${m} ${t('dashboard.months')}`)
  return parts.join(' ') || `<1 ${t('dashboard.months')}`
}

function daysAgoLabel(dateStr) {
  if (!dateStr) return null
  const d = differenceInDays(new Date(), parseISO(dateStr))
  if (d === 0) return 'dziś'
  if (d === 1) return 'wczoraj'
  return `${d} dni temu`
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ icon, title, children, accent }) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      marginBottom: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        background: accent || 'var(--blue)',
        color: '#fff',
        fontWeight: 700, fontSize: 14,
      }}>
        <span style={{ fontSize: 17 }}>{icon}</span>
        {title}
      </div>
      <div style={{ padding: '12px 14px' }}>
        {children}
      </div>
    </div>
  )
}

// ─── Vaccine status ───────────────────────────────────────────────────────────

function VaxStatus({ validUntil }) {
  if (!validUntil) return null
  const days = differenceInDays(parseISO(validUntil), new Date())
  if (days < 0)   return <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>⚠️ wygasło</span>
  if (days < 30)  return <span style={{ background: '#fef3c7', color: '#d97706', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>⏰ za {days} dni</span>
  return <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>✓ ważna</span>
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function OverviewScreen({ dog, dogs, weights, onSelectDog, onMedicalCard }) {
  const { t } = useTranslation()

  const [vaccinations, setVaccinations] = useState([])
  const [dewormings,   setDewormings]   = useState([])
  const [parasites,    setParasites]    = useState([])

  useEffect(() => {
    if (!dog) return
    getVaccinations(dog.id).then(v => setVaccinations([...v].reverse()))
    getDewormings(dog.id).then(d => setDewormings([...d].reverse()))
    getParasitePrevention(dog.id).then(p => setParasites([...p].reverse()))
  }, [dog])

  const breed      = dog ? getBreedById(dog.breedId) : null
  const ageMonths  = useMemo(() => dog?.birthdate ? differenceInMonths(new Date(), parseISO(dog.birthdate)) : 0, [dog])
  const idealRange = useMemo(() => (breed && dog) ? getIdealWeightAtAge(breed, dog.sex, ageMonths) : null, [breed, dog, ageMonths])

  const sortedW  = useMemo(() => [...weights].sort((a,b) => a.date.localeCompare(b.date)), [weights])
  const latest   = sortedW[sortedW.length - 1] ?? null
  const trend    = useMemo(() => calcRealTrend(weights), [weights])

  const status = useMemo(() => {
    if (!latest || !idealRange) return null
    if (latest.value < idealRange.min) return 'low'
    if (latest.value > idealRange.max) return 'high'
    return 'good'
  }, [latest, idealRange])

  const chartData = useMemo(() => sortedW.slice(-10).map(w => ({
    date: format(parseISO(w.date), 'd MMM'),
    weight: w.value,
  })), [sortedW])

  const yDomain = useMemo(() => {
    const vals = sortedW.slice(-10).map(w => w.value)
    if (idealRange) vals.push(idealRange.min, idealRange.max)
    if (!vals.length) return ['auto', 'auto']
    return [+(Math.min(...vals) * 0.95).toFixed(1), +(Math.max(...vals) * 1.05).toFixed(1)]
  }, [sortedW, idealRange])

  const statusColor = status === 'good' ? '#16a34a' : status === 'high' ? '#ea580c' : '#2563eb'
  const statusBg    = status === 'good' ? '#dcfce7' : status === 'high' ? '#ffedd5' : '#eff6ff'

  const trendColor = trend.direction === 'up' ? '#ea580c' : trend.direction === 'down' ? '#2563eb' : '#16a34a'

  if (!dog) {
    return (
      <div className="screen">
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <div className="empty-state-icon">🐾</div>
          <div className="empty-state-text">{t('dashboard.noData')}</div>
        </div>
      </div>
    )
  }

  const lastDeworm  = dewormings[0]
  const lastParasite = parasites[0]

  return (
    <div className="screen">
      {/* ── Dog selector header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 16, padding: '4px 0',
      }}>
        {dog.photo ? (
          <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--blue)', flexShrink: 0 }}>
            <img src={dog.photo} alt={dog.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, border: '2px solid var(--blue)',
          }}>🐾</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <DogSelector dogs={dogs} selectedDog={dog} onSelect={onSelectDog} />
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {dog.breedName}
            {dog.birthdate && ` · ${ageLabel(dog.birthdate, t)}`}
            {dog.sex && ` · ${dog.sex === 'female' ? t('setup.female') : t('setup.male')}`}
          </div>
        </div>
        {onMedicalCard && (
          <button
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}
            onClick={onMedicalCard}
          >
            📄 {t('medCard.printBtn').split('/')[0].trim()}
          </button>
        )}
      </div>

      {/* ── Profil ── */}
      <Section icon="🐶" title={t('medCard.dogInfo')} accent="#1d4ed8">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: t('setup.birthdate'), value: dog.birthdate ? format(parseISO(dog.birthdate), 'dd.MM.yyyy') : '—' },
            { label: t('setup.breed'),     value: dog.breedName || '—' },
            { label: t('medCard.colour'),  value: dog.colour    || '—' },
            { label: t('medCard.chipNo'),  value: dog.chipNumber || '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
              <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Waga ── */}
      <Section icon="⚖️" title={t('nav.weight')} accent="#0369a1">
        {weights.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--gray-400)', textAlign: 'center', padding: '12px 0' }}>
            {t('weight.addFirst')}
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {/* Current weight */}
              <div style={{
                flex: 1, background: statusBg, borderRadius: 10, padding: '10px 12px',
                border: `1.5px solid ${statusColor}30`,
              }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 2 }}>{t('dashboard.currentWeight')}</div>
                <div style={{ fontWeight: 800, fontSize: 22, color: statusColor }}>{latest.value} kg</div>
                {status && (
                  <div style={{ fontSize: 11, color: statusColor, fontWeight: 600, marginTop: 2 }}>
                    {status === 'good' ? `✅ ${t('dashboard.withinRange')}` :
                     status === 'high' ? `⬆ ${t('dashboard.above')}` : `⬇ ${t('dashboard.below')}`}
                  </div>
                )}
              </div>
              {/* Ideal range */}
              <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 10, padding: '10px 12px', border: '1.5px solid #16a34a30' }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 2 }}>{t('dashboard.idealRange')}</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#16a34a' }}>
                  {idealRange ? `${idealRange.min}–${idealRange.max}` : '—'}
                </div>
                <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>kg</div>
              </div>
              {/* Trend */}
              <div style={{ flex: 1, background: 'var(--gray-50)', borderRadius: 10, padding: '10px 12px', border: '1.5px solid var(--gray-200)' }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 2 }}>{t('dashboard.trend')}</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: trendColor }}>
                  {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
                </div>
                <div style={{ fontSize: 10, color: trendColor, marginTop: 2, fontWeight: 600 }}>
                  {trend.direction !== 'stable' && trend.n >= 2
                    ? `${trend.kgPerMonth > 0 ? '+' : ''}${trend.kgPerMonth} kg/mies.`
                    : t('dashboard.trendStable')}
                </div>
              </div>
            </div>

            {/* Mini chart */}
            <div style={{ height: 100, marginBottom: 4 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} domain={yDomain} />
                  <Tooltip formatter={v => [`${v} kg`]} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                  {idealRange && <ReferenceLine y={idealRange.min} stroke="#16a34a" strokeDasharray="3 2" strokeWidth={1} />}
                  {idealRange && <ReferenceLine y={idealRange.max} stroke="#16a34a" strokeDasharray="3 2" strokeWidth={1} />}
                  <Area type="monotone" dataKey="weight" stroke="#2563eb" strokeWidth={2} fill="url(#wGrad)" dot={{ fill: '#2563eb', r: 2.5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-400)', textAlign: 'right' }}>
              {t('dashboard.lastMeasured')}: {format(parseISO(latest.date), 'dd.MM.yyyy')} · {weights.length} pom.
            </div>
          </>
        )}
      </Section>

      {/* ── Szczepienia ── */}
      <Section icon="💉" title={t('health.tabs.vaccinations')} accent="#7c3aed">
        {vaccinations.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--gray-400)', textAlign: 'center', padding: '8px 0' }}>{t('health.noData')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {vaccinations.map(v => (
              <div key={v.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', background: 'var(--gray-50)', borderRadius: 8,
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{v.vaccineName || t(`health.vaccineTypes.${v.vaccineType}`)}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                    {format(parseISO(v.date), 'dd.MM.yyyy')}
                    {v.vetName && ` · ${v.vetName}`}
                  </div>
                </div>
                {v.validUntil && <VaxStatus validUntil={v.validUntil} />}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Odrobaczanie ── */}
      <Section icon="💊" title={t('health.tabs.deworming')} accent="#0891b2">
        {lastDeworm ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{lastDeworm.product}</div>
              {lastDeworm.activeIngredient && (
                <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{lastDeworm.activeIngredient}</div>
              )}
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                {format(parseISO(lastDeworm.date), 'dd.MM.yyyy')}
                {lastDeworm.nextDue && ` → następna: ${format(parseISO(lastDeworm.nextDue), 'dd.MM.yyyy')}`}
              </div>
            </div>
            <div style={{
              background: 'var(--blue-light)', color: 'var(--blue)',
              borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap', marginLeft: 8,
            }}>
              {daysAgoLabel(lastDeworm.date)}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--gray-400)', textAlign: 'center', padding: '8px 0' }}>{t('health.noData')}</div>
        )}
        {dewormings.length > 1 && (
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 6 }}>
            łącznie {dewormings.length} wpisów
          </div>
        )}
      </Section>

      {/* ── Ochrona przed pasożytami ── */}
      <Section icon="🐛" title={t('health.tabs.parasites')} accent="#0f766e">
        {lastParasite ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{lastParasite.product}</div>
              {lastParasite.activeIngredient && (
                <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{lastParasite.activeIngredient}</div>
              )}
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                {format(parseISO(lastParasite.date), 'dd.MM.yyyy')}
                {lastParasite.nextDue && ` → następna: ${format(parseISO(lastParasite.nextDue), 'dd.MM.yyyy')}`}
              </div>
            </div>
            <div style={{
              background: '#f0fdf4', color: '#0f766e',
              borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap', marginLeft: 8,
            }}>
              {daysAgoLabel(lastParasite.date)}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--gray-400)', textAlign: 'center', padding: '8px 0' }}>{t('health.noData')}</div>
        )}
        {parasites.length > 1 && (
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 6 }}>
            łącznie {parasites.length} wpisów
          </div>
        )}
      </Section>
    </div>
  )
}
