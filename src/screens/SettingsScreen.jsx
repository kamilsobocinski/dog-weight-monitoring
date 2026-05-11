import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { getSetting, setSetting } from '../utils/db'
import { calcNextNotif } from '../utils/notifications'
import { requestPushPermission, isPushSubscribed, scheduleNextNotification } from '../utils/onesignal'
import { Toast, useToast } from '../components/Toast'

const INTERVALS = [
  { value: 'daily',      days: 1  },
  { value: 'every2days', days: 2  },
  { value: 'every3days', days: 3  },
  { value: 'weekly',     days: 7  },
  { value: 'biweekly',   days: 14 },
  { value: 'monthly',    days: 30 },
  { value: 'off',        days: 0  },
]

function daysToValue(days) {
  return INTERVALS.find(i => i.days === days)?.value ?? 'every2days'
}

export function SettingsScreen({ dog, dogs, onAddDog, onEditDog, onDeleteDog }) {
  const { t } = useTranslation()
  const { toast, showToast } = useToast()

  const [interval,        setIntervalVal]    = useState('every2days')
  const [notifTime,       setNotifTime]      = useState('08:00')
  const [nextNotif,       setNextNotif]      = useState(null)
  const [subscribed,      setSubscribed]     = useState(false)
  const [enabling,        setEnabling]       = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // Load saved settings + check subscription status
  useEffect(() => {
    getSetting('notif-interval').then(v => { if (v != null) setIntervalVal(daysToValue(v)) })
    getSetting('notif-time').then(v    => { if (v) setNotifTime(v) })
    getSetting('notif-next').then(v    => { if (v) setNextNotif(new Date(v)) })
    isPushSubscribed().then(setSubscribed)
  }, [])

  // Reschedule helper — saves to DB + calls OneSignal API
  const reschedule = async (days, time) => {
    if (days === 0 || !subscribed) return null
    const next = calcNextNotif(days, time)
    await setSetting('notif-next', next.toISOString())
    setNextNotif(next)
    // Fire-and-forget to backend
    scheduleNextNotification(days, time, dog?.name)
    return next
  }

  const handleIntervalChange = async (val) => {
    setIntervalVal(val)
    const days = INTERVALS.find(i => i.value === val)?.days ?? 0
    await setSetting('notif-interval', days)
    await reschedule(days, notifTime)
  }

  const handleTimeChange = async (val) => {
    setNotifTime(val)
    await setSetting('notif-time', val)
    const days = INTERVALS.find(i => i.value === interval)?.days ?? 0
    await reschedule(days, val)
  }

  const handleEnableNotifications = async () => {
    setEnabling(true)
    try {
      // Diagnostics — visible in Safari DevTools console
      console.log('[Notif] Notification in window:', 'Notification' in window)
      if ('Notification' in window) {
        console.log('[Notif] Notification.permission:', Notification.permission)
      }

      // If already hard-blocked by the OS, bail out immediately with a clear message
      if ('Notification' in window && Notification.permission === 'denied') {
        showToast(t('settings.notifBlocked'))
        return
      }

      const granted = await requestPushPermission()
      console.log('[Notif] granted:', granted)
      if (!granted) { showToast(t('settings.notifDenied')); return }

      const days = INTERVALS.find(i => i.value === interval)?.days ?? 14
      await setSetting('notif-interval', days)
      await setSetting('notif-time', notifTime)
      setSubscribed(true)

      if (days > 0) {
        const next = calcNextNotif(days, notifTime)
        await setSetting('notif-next', next.toISOString())
        setNextNotif(next)
        scheduleNextNotification(days, notifTime, dog?.name)
      }

      showToast(t('settings.notifGranted'))
    } finally {
      setEnabling(false)
    }
  }

  const handleTestNotif = () => {
    if (Notification.permission === 'granted') {
      try {
        new Notification('🐾 Dog Weight Monitoring', {
          body: dog ? `Time to weigh ${dog.name}! 🐾` : t('weight.title'),
          icon: '/icons/icon-192.png',
        })
      } catch (_) {}
    }
  }

  const dogToDelete   = confirmDeleteId ? dogs.find(d => d.id === confirmDeleteId) : null
  const intervalDays  = INTERVALS.find(i => i.value === interval)?.days ?? 0

  return (
    <div className="screen">
      <div className="page-header">
        <h1 className="page-title">⚙️ {t('settings.title')}</h1>
      </div>

      {/* Language */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🌍 {t('settings.language')}</div>
        <LanguageSwitcher />
      </div>

      {/* Dogs list */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🐶 {t('settings.dogProfile')}</div>

        {dogs.map(d => (
          <div key={d.id}>
            {confirmDeleteId === d.id ? (
              <div style={{ background: 'var(--red-light)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--red)', marginBottom: 8 }}>
                  🗑 {t('settings.confirmDelete', { name: dogToDelete?.name })}
                </div>
                <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 10 }}>
                  {t('settings.deleteWarning')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-danger" style={{ flex: 1, padding: '8px' }}
                    onClick={() => { onDeleteDog(d.id); setConfirmDeleteId(null) }}>
                    {t('settings.confirmYes')}
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1, padding: '8px' }}
                    onClick={() => setConfirmDeleteId(null)}>
                    {t('settings.confirmNo')}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--gray-100)', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                    {d.breedName} · {d.sex === 'female' ? t('setup.female') : t('setup.male')}
                  </div>
                </div>
                {d.id === dog?.id && (
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }}
                    onClick={onEditDog}>✏️</button>
                )}
                {dogs.length > 1 && (
                  <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 13 }}
                    onClick={() => setConfirmDeleteId(d.id)}>🗑</button>
                )}
              </div>
            )}
          </div>
        ))}

        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={onAddDog}>
          + {t('settings.addDog')}
        </button>
      </div>

      {/* Notifications */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🔔 {t('settings.notifications')}</div>
        <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 14 }}>{t('settings.notificationsDesc')}</div>

        {/* Interval selector */}
        <div className="form-group">
          <label className="form-label">{t('settings.interval')}</label>
          <select className="form-select" value={interval} onChange={e => handleIntervalChange(e.target.value)}>
            {INTERVALS.map(i => (
              <option key={i.value} value={i.value}>{t(`settings.intervalOptions.${i.value}`)}</option>
            ))}
          </select>
        </div>

        {/* Time picker — hidden when interval = off */}
        {interval !== 'off' && (
          <div className="form-group">
            <label className="form-label">{t('settings.notifTime')}</label>
            <input
              type="time"
              className="form-input"
              value={notifTime}
              onChange={e => handleTimeChange(e.target.value)}
            />
          </div>
        )}

        {/* Enable / status row */}
        {!subscribed ? (
          <button className="btn btn-primary" onClick={handleEnableNotifications} disabled={enabling}>
            {enabling
              ? <><span className="spinner" style={{ width: 14, height: 14 }} /> {t('settings.enableNotifications')}</>
              : <>🔔 {t('settings.enableNotifications')}</>
            }
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ color: 'var(--green)', fontWeight: 600, fontSize: 14 }}>
              ✓ {t('settings.notifGranted')}
            </div>

            {/* Next scheduled reminder */}
            {nextNotif && intervalDays > 0 && (
              <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                🕐 {t('settings.notifNext')}: {format(nextNotif, 'dd.MM.yyyy HH:mm')}
              </div>
            )}

            <button className="btn btn-secondary" onClick={handleTestNotif}>
              🔔 {t('settings.testNotif')}
            </button>
          </div>
        )}
      </div>

      {/* App info */}
      <div className="card" style={{ color: 'var(--gray-400)', fontSize: 13, textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-600)', marginBottom: 6 }}>
          🐾 Dog Weight Monitoring
        </div>
        <div>v1.7.0 · PWA · 100 breeds · PL / EN / DE / ES</div>
        <div style={{ marginTop: 8, fontSize: 12 }}>
          Developed by Kamil Sobociński · No rights reserved
        </div>
      </div>

      <Toast message={toast} />
    </div>
  )
}
