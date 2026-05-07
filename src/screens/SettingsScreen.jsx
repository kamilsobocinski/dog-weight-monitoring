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

export function SettingsScreen({ dog, dogs, onAddDog, onEditDog, onDeleteDog }) {
  const { t } = useTranslation()
  const { toast, showToast } = useToast()
  const [interval, setIntervalVal] = useState('biweekly')
  const [notifStatus, setNotifStatus] = useState('default')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

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
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') { showToast(t('settings.notifDenied')); return }
    const days = INTERVALS.find(i => i.value === interval)?.days || 14
    await setSetting('notif-interval', days)
    setNotifStatus('granted')
    showToast(t('settings.notifGranted'))
  }

  const handleTestNotif = () => {
    if (Notification.permission === 'granted') {
      new Notification('🐾 Dog Weight Monitoring', {
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

  const dogToDelete = confirmDeleteId ? dogs.find(d => d.id === confirmDeleteId) : null

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
                    onClick={onEditDog}>
                    ✏️
                  </button>
                )}
                {dogs.length > 1 && (
                  <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 13 }}
                    onClick={() => setConfirmDeleteId(d.id)}>
                    🗑
                  </button>
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

        <div className="form-group">
          <label className="form-label">{t('settings.interval')}</label>
          <select className="form-select" value={interval} onChange={e => handleIntervalChange(e.target.value)}>
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
        <div>v1.1.0 · PWA · 100 breeds · PL / EN / DE / ES</div>
      </div>

      <Toast message={toast} />
    </div>
  )
}
