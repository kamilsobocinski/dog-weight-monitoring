import { useState, useEffect } from 'react'
import { useDog } from './hooks/useDog'
import { checkAndShowNotification, calcNextNotif } from './utils/notifications'
import { initOneSignal, isPushSubscribed, scheduleNextNotification } from './utils/onesignal'
import { getSetting, setSetting } from './utils/db'
import { DashboardScreen } from './screens/DashboardScreen'
import { AddWeightScreen } from './screens/AddWeightScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { HealthScreen } from './screens/HealthScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SetupScreen } from './screens/SetupScreen'
import { ScanScreen } from './screens/ScanScreen'
import { InstallPrompt } from './components/InstallPrompt'
import { useTranslation } from 'react-i18next'

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}
function IconAdd() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  )
}
function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}
function IconHealth() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  )
}
function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

export default function App() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('dashboard')
  // setupMode: null | 'add' | { dog } (edit)
  const [setupMode, setSetupMode] = useState(null)
  const [scanOpen, setScanOpen] = useState(false)

  const { dog, dogs, weights, loading, selectDog, saveDogProfile, removeDog, addWeightEntry, removeWeight } = useDog()

  // Initialise OneSignal SDK once (no-op if already done)
  useEffect(() => { initOneSignal() }, [])

  // On every app open: if the scheduled push notification was due (or chain broke),
  // reschedule the next one via OneSignal so the reminder keeps repeating.
  useEffect(() => {
    if (!dog) return
    async function maintainChain() {
      const osSubscribed = await isPushSubscribed()
      const days = await getSetting('notif-interval')
      const time = (await getSetting('notif-time')) || '08:00'
      if (!days || days === 0) return

      if (osSubscribed) {
        // OneSignal path: check if the scheduled notification is past-due
        const nextStr = await getSetting('notif-next')
        if (!nextStr || new Date(nextStr) <= new Date()) {
          const next = calcNextNotif(days, time)
          await setSetting('notif-next', next.toISOString())
          scheduleNextNotification(days, time, dog.name)
        }
      } else {
        // Fallback (no push subscription): show in-app notification when open
        let timer
        checkAndShowNotification(dog).then(nextDate => {
          if (!nextDate) return
          const ms = nextDate.getTime() - Date.now()
          if (ms > 0 && ms < 12 * 60 * 60 * 1000) {
            timer = setTimeout(() => checkAndShowNotification(dog), ms)
          }
        })
        return () => clearTimeout(timer)
      }
    }
    maintainChain()
  }, [dog])

  if (loading) {
    return (
      <div className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    )
  }

  const handleSaveDog = async (data) => {
    await saveDogProfile(data)
    setSetupMode(null)
    setTab('dashboard')
  }

  // First-run: no dogs yet
  if (dogs.length === 0 && !setupMode) {
    return (
      <div className="app">
        <SetupScreen dog={null} onSave={handleSaveDog} onCancel={null} />
        <InstallPrompt />
      </div>
    )
  }

  if (setupMode !== null) {
    const editDog = setupMode === 'add' ? null : setupMode
    return (
      <div className="app">
        <SetupScreen
          dog={editDog}
          onSave={handleSaveDog}
          onCancel={() => setSetupMode(null)}
        />
      </div>
    )
  }

  const NAV = [
    { id: 'dashboard', icon: <IconHealth />,    label: t('nav.health') },
    { id: 'add',       icon: <IconAdd />,       label: t('nav.add') },
    { id: 'history',   icon: <IconHistory />,   label: t('nav.history') },
    { id: 'settings',  icon: <IconSettings />,  label: t('nav.settings') },
  ]

  return (
    <div className="app">
      {scanOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--surface)', overflowY: 'auto' }}>
          <ScanScreen
            dog={dog}
            onClose={() => setScanOpen(false)}
            onSaved={() => setScanOpen(false)}
          />
        </div>
      )}

      {tab === 'dashboard' && (
        <HealthScreen
          dog={dog} dogs={dogs} weights={weights}
          onSelectDog={selectDog} onNavigate={setTab}
          onScan={() => setScanOpen(true)}
        />
      )}
      {tab === 'add' && (
        <AddWeightScreen
          dog={dog} onAdd={addWeightEntry} onNavigate={setTab}
        />
      )}
      {tab === 'history' && (
        <HistoryScreen
          dog={dog} weights={weights} onDelete={removeWeight}
        />
      )}
      {tab === 'settings' && (
        <SettingsScreen
          dog={dog} dogs={dogs}
          onAddDog={() => setSetupMode('add')}
          onEditDog={() => setSetupMode(dog)}
          onDeleteDog={removeDog}
        />
      )}

      <nav className="bottom-nav">
        {NAV.map(n => (
          <button
            key={n.id}
            className={`nav-item${tab === n.id ? ' active' : ''}`}
            onClick={() => setTab(n.id)}
          >
            {n.icon}
            {n.label}
          </button>
        ))}
      </nav>

      <InstallPrompt />
    </div>
  )
}
