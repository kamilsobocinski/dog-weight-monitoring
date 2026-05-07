import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer
} from 'recharts'
import { format, differenceInMonths, parseISO } from 'date-fns'
import { getBreedById, getIdealWeightAtAge } from '../data/breeds'
import { DogSelector } from '../components/DogSelector'

function dogAge(birthdate, t) {
  if (!birthdate) return ''
  const months = differenceInMonths(new Date(), parseISO(birthdate))
  const y = Math.floor(months / 12)
  const m = months % 12
  const parts = []
  if (y > 0) parts.push(`${y}${t('dashboard.years')}`)
  if (m > 0) parts.push(`${m}${t('dashboard.months')}`)
  return parts.join(' ') || `<1${t('dashboard.months')}`
}

export function DashboardScreen({ dog, dogs, weights, onSelectDog, onNavigate }) {
  const { t } = useTranslation()

  const breed = dog ? getBreedById(dog.breedId) : null

  const ageMonths = useMemo(() => {
    if (!dog?.birthdate) return 0
    return differenceInMonths(new Date(), parseISO(dog.birthdate))
  }, [dog])

  const idealRange = useMemo(() => {
    if (!breed || !dog) return null
    return getIdealWeightAtAge(breed, dog.sex, ageMonths)
  }, [breed, dog, ageMonths])

  const latestWeight = weights.length > 0 ? weights[weights.length - 1] : null

  const trend = useMemo(() => {
    if (weights.length < 2) return 'stable'
    const diff = weights[weights.length - 1].value - weights[weights.length - 2].value
    if (Math.abs(diff) < 0.1) return 'stable'
    return diff > 0 ? 'up' : 'down'
  }, [weights])

  const status = useMemo(() => {
    if (!latestWeight || !idealRange) return null
    if (latestWeight.value < idealRange.min) return 'low'
    if (latestWeight.value > idealRange.max) return 'high'
    return 'good'
  }, [latestWeight, idealRange])

  const chartData = useMemo(() => weights.map(w => ({
    date: format(parseISO(w.date), 'd MMM'),
    weight: w.value,
    min: idealRange?.min,
    max: idealRange?.max,
  })), [weights, idealRange])

  if (!dog) {
    return (
      <div className="screen">
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <div className="empty-state-icon">🐾</div>
          <div className="empty-state-text">{t('dashboard.noData')}</div>
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}
              onClick={() => onNavigate('settings')}>
              {t('setup.title')} →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      {/* Header with dog selector */}
      <div className="page-header">
        <div>
          <DogSelector dogs={dogs} selectedDog={dog} onSelect={onSelectDog} />
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
            {dog.breedName} · {dogAge(dog.birthdate, t)}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.currentWeight')}</div>
          <div className="stat-value">{latestWeight ? `${latestWeight.value} kg` : '—'}</div>
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
          <div className="stat-value" style={{ fontSize: 18 }}>
            {trend === 'up' ? t('dashboard.trendUp') :
             trend === 'down' ? t('dashboard.trendDown') : t('dashboard.trendStable')}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.lastMeasured')}</div>
          <div className="stat-value" style={{ fontSize: 16 }}>
            {latestWeight ? format(parseISO(latestWeight.date), 'dd.MM.yy') : '—'}
          </div>
          <div className="stat-sub">{weights.length} entries</div>
        </div>
      </div>

      {/* Chart */}
      {weights.length > 0 ? (
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--gray-700)' }}>
            📈 {t('dashboard.chartTitle')}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--gray-400)' }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 13 }}
                formatter={(v) => [`${v} kg`]}
              />
              {idealRange && (
                <ReferenceLine y={idealRange.min} stroke="#16a34a" strokeDasharray="4 2" strokeWidth={1.5}
                  label={{ value: `min ${idealRange.min}`, fill: '#16a34a', fontSize: 10, position: 'right' }} />
              )}
              {idealRange && (
                <ReferenceLine y={idealRange.max} stroke="#dc2626" strokeDasharray="4 2" strokeWidth={1.5}
                  label={{ value: `max ${idealRange.max}`, fill: '#dc2626', fontSize: 10, position: 'right' }} />
              )}
              <Line type="monotone" dataKey="weight" stroke="#2563eb" strokeWidth={2.5}
                dot={{ fill: '#2563eb', r: 4 }} activeDot={{ r: 6 }} name={t('dashboard.yourDog')} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-text">{t('dashboard.noData')}</div>
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}
              onClick={() => onNavigate('add')}>
              + {t('weight.title')}
            </button>
          </div>
        </div>
      )}

      {/* Status banner */}
      {idealRange && latestWeight && (
        <div className="card" style={{
          background: status === 'good' ? 'var(--green-light)' : status === 'high' ? 'var(--orange-light)' : 'var(--blue-light)',
          border: `1px solid ${status === 'good' ? 'var(--green)' : status === 'high' ? 'var(--orange)' : 'var(--blue)'}`,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {status === 'good' && `✅ ${t('dashboard.withinRange')}`}
            {status === 'high' && `⚠️ ${(latestWeight.value - idealRange.max).toFixed(1)} kg ${t('dashboard.above')}`}
            {status === 'low'  && `ℹ️ ${(idealRange.min - latestWeight.value).toFixed(1)} kg ${t('dashboard.below')}`}
          </div>
          <div style={{ fontSize: 13, marginTop: 4, opacity: .8 }}>
            {t('dashboard.idealRange')}: {idealRange.min}–{idealRange.max} kg
          </div>
        </div>
      )}
    </div>
  )
}
