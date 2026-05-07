import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { getSetting, setSetting } from '../utils/db'
import { Toast, useToast } from '../components/Toast'

const INTERVALS = [
  { value: 'weekly',   days: 7  },
  { value: 'biweekly', days: 14 },
  { value: 'monthly',  days: 30 },
  { value: 'off',      days: 0  },
]

async function scheduleReminder(intervalDays, title, body) {
  if (!('Notification' in window)) return
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false

  // Store next fire time
  if (intervalDays > 0) {
    const next = Date.now() + intervalDays * 86400000
    await setSetting('notif-next', next)
    await setSetting('notif-interval', intervalDays)
    await setSetting('notif-title', title)
    await setSetting('notif-body', body)
  } else {
    await setSetting('notif-next', null)
    await setSetting('notif-interval', 0)
  }
  return true
}

export function SettingsScreen({ dog, onEditDog }) {
  const { t } = useTranslation()
  const { toast, showToast } = useToast()
  const [interval, setIntervalVal] = useState('biweekly')
  const [notifStatus, setNotifStatus] = useState('default')

  useEffect(() => {
    getSetting('notif-interval').then(v => {
      if (v === 0) setIntervalVal('off')
      else if (v === 7) setIntervalVal('weekly')
      else if (v === 30) setIntervalVal('monthly')
      else setIntervalVal('biweekly')
    })
    if ('Notification' in window) setNotifStatus(Notification.permission)
  }, [])

  const handleEnableNotifications = async () => {
    const days = INTERVALS.find(i => i.value === interval)?.days || 14
    const dogName = dog?.name || 'your dog'
    const ok = await scheduleReminder(
      days,
      `🐾 ${t('settings.notifications')}`,
      `${t('weight.title')} — ${dogName}`
    )
    if (ok === false) {
      showToast(t('settings.notifDenied'))
    } else {
      setNotifStatus('granted')
      showToast(t('settings.notifGranted'))
    }
  }

  const handleTestNotif = () => {
    if (Notification.permission === 'granted') {
      new Notification(`🐾 Dog Weight Monitoring`, {
        body: dog ? `${t('weight.title')} — ${dog.name}` : t('weight.title'),
        icon: '/icons/icon-192.png'
      })
    }
  }

  const handleIntervalChange = async (val) => {
    setIntervalVal(val)
    const days = INTERVALS.find(i => i.value === val)?.days || 0
    await setSetting('notif-interval', days)
  }

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

      {/* Dog Profile */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🐶 {t('settings.dogProfile')}</div>
        {dog ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{dog.name}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>
              {dog.breedName} · {dog.sex === 'female' ? t('setup.female') : t('setup.male')}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: 'var(--gray-400)', marginBottom: 12 }}>—</div>
        )}
        <button className="btn btn-secondary" onClick={onEditDog} style={{ width: '100%' }}>
          ✏️ {t('setup.save').replace('Save', 'Edit')} {t('settings.dogProfile')}
        </button>
      </div>

      {/* Notifications */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🔔 {t('settings.notifications')}</div>
        <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 14 }}>{t('settings.notificationsDesc')}</div>

        <div className="form-group">
          <label className="form-label">{t('settings.interval')}</label>
          <select
            className="form-select"
            value={interval}
            onChange={e => handleIntervalChange(e.target.value)}
          >
            {INTERVALS.map(i => (
              <option key={i.value} value={i.value}>{t(`settings.intervalOptions.${i.value}`)}</option>
            ))}
          </select>
        </div>

        {notifStatus !== 'granted' ? (
          <button className="btn btn-primary" onClick={handleEnableNotifications}>
            🔔 {t('settings.enableNotifications')}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ color: 'var(--green)', fontWeight: 600, fontSize: 14 }}>✓ {t('settings.notifGranted')}</div>
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
        <div>v1.0.0 · PWA</div>
        <div style={{ marginTop: 4 }}>100 breeds · PL / EN / DE / ES</div>
      </div>

      <Toast message={toast} />
    </div>
  )
}
