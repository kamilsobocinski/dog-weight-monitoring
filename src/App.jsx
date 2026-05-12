import { useState, useEffect } from 'react'
import { useDog } from './hooks/useDog'
import { checkAndShowNotification, calcNextNotif } from './utils/notifications'
import { initOneSignal, isPushSubscribed, scheduleNextNotification } from './utils/onesignal'
import { getSetting, setSetting, getAllDogs } from './utils/db'
import { onAuth, handleRedirectResult, signInWithGoogle } from './utils/firebase'
import {
  isSyncDue, markSyncDone, getLastSyncDate,
  uploadBackup, downloadBackup, hasCloudBackup,
} from './utils/cloudSync'
import { OverviewScreen } from './screens/OverviewScreen'
import { HealthScreen } from './screens/HealthScreen'
import { WeightScreen } from './screens/WeightScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SetupScreen } from './screens/SetupScreen'
import { ScanScreen } from './screens/ScanScreen'
import { MedicalCardScreen } from './screens/MedicalCardScreen'
import { NutritionScreen } from './screens/NutritionScreen'
import { DietWeightScreen } from './screens/DietWeightScreen'
import { TrainingScreen } from './screens/TrainingScreen'
import { InstallPrompt } from './components/InstallPrompt'
import { useTranslation } from 'react-i18next'

// ─── Google logo (inline, no extra dep) ──────────────────────────────────────
function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" style={{ display:'block', flexShrink:0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

// ─── Welcome screen (shown when no dog profile exists yet) ───────────────────
function WelcomeCard({ user, onAddDog }) {
  const { t } = useTranslation()
  const [signingIn, setSigningIn] = useState(false)

  const handleSignIn = async () => {
    setSigningIn(true)
    try { await signInWithGoogle() } catch (err) {
      alert('Błąd logowania: ' + (err?.message || err?.code || String(err)))
    } finally { setSigningIn(false) }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 'calc(100dvh - 64px)',
      padding: '32px 24px', textAlign: 'center',
    }}>
      {/* Branding */}
      <div style={{ fontSize: 72, marginBottom: 8, lineHeight: 1 }}>🐾</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)', marginBottom: 6 }}>DogPass</div>
      <div style={{ fontSize: 15, color: 'var(--gray-400)', marginBottom: 40, lineHeight: 1.5, maxWidth: 280 }}>
        Monitoruj wagę, dietę i trening swojego psa
      </div>

      {/* CTAs */}
      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!user && (
          <button
            onClick={handleSignIn}
            disabled={signingIn}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              padding: '15px 20px', borderRadius: 12, border: '1.5px solid var(--gray-200)',
              background: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)', color: '#333',
            }}>
            {signingIn ? <span className="spinner" style={{ width:18, height:18 }} /> : <GoogleLogo />}
            {signingIn ? 'Logowanie…' : t('auth.signInGoogle')}
          </button>
        )}

        <button
          onClick={onAddDog}
          className="btn btn-primary"
          style={{ padding: '15px 20px', borderRadius: 12, fontSize: 15, fontWeight: 700 }}>
          🐶 {t('settings.addDog')}
        </button>

        {user && (
          <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 4 }}>
            ✅ Zalogowano jako {user.displayName || user.email}
          </div>
        )}
      </div>

      {/* Feature hints */}
      <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
        {[
          { icon: '⚖️', text: 'Monitoring wagi z wykresem' },
          { icon: '🥩', text: 'Plan diety generowany przez AI' },
          { icon: '🏃', text: 'Spersonalizowane plany treningowe' },
          { icon: '💉', text: 'Szczepienia i odrobaczanie' },
        ].map(({ icon, text }) => (
          <div key={text} style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--gray-500)' }}>
            <span style={{ fontSize:18, flexShrink:0 }}>{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function IconOverview() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
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
function IconWeight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="4"/>
      <path d="M5 21v-2a7 7 0 0 1 14 0v2"/>
      <line x1="3" y1="21" x2="21" y2="21"/>
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
function IconNutrition() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/>
      <line x1="10" y1="1" x2="10" y2="4"/>
      <line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  )
}
function IconDietWeight() {
  // Bowl + scale: represents diet & weight
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h18"/>
      <path d="M6 7a6 6 0 0 0 12 0"/>
      <line x1="12" y1="7" x2="12" y2="3"/>
      <line x1="8" y1="3" x2="16" y2="3"/>
      <path d="M9 20h6"/>
      <line x1="12" y1="13" x2="12" y2="20"/>
    </svg>
  )
}
function IconTraining() {
  // Running figure
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13" cy="4" r="2"/>
      <path d="M7 21l3-6 2 2 3-4"/>
      <path d="M17 21l-3-4-2-2 1-4"/>
      <path d="M6 12l2-3 4 1 2-3"/>
    </svg>
  )
}

export default function App() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('overview')
  // setupMode: null | 'add' | { dog } (edit)
  const [setupMode, setSetupMode] = useState(null)
  const [scanOpen,        setScanOpen]        = useState(false)
  const [medicalCardOpen, setMedicalCardOpen] = useState(false)

  // ── Firebase auth + sync state ────────────────────────────────────────────
  const [user,          setUser]          = useState(null)
  const [syncing,       setSyncing]       = useState(false)
  const [lastSync,      setLastSync]      = useState(() => getLastSyncDate())
  // restorePrompt: null | { uid: string }
  const [restorePrompt, setRestorePrompt] = useState(null)

  // Add body class so print CSS can hide the app content
  useEffect(() => {
    if (medicalCardOpen) document.body.classList.add('medical-card-open')
    else document.body.classList.remove('medical-card-open')
    return () => document.body.classList.remove('medical-card-open')
  }, [medicalCardOpen])

  // ── Handle Google redirect return (iOS Safari / PWA) ─────────────────────
  useEffect(() => { handleRedirectResult() }, [])

  // ── Auth listener — runs once on mount ───────────────────────────────────
  useEffect(() => {
    return onAuth(async (fbUser) => {
      setUser(fbUser)
      if (!fbUser) return

      // Read local dogs directly from DB (avoids stale closure value)
      const localDogs = await getAllDogs().catch(() => [])
      const lastSyncDate = getLastSyncDate()

      // CASE 1: No local dogs → always check for cloud backup first
      // (covers: fresh install, cleared data, stale localStorage)
      if (localDogs.length === 0) {
        const backupExists = await hasCloudBackup(fbUser.uid)
        if (backupExists) {
          setRestorePrompt({ uid: fbUser.uid })
          return
        }
        // No backup yet — upload current (empty) state as baseline
        setSyncing(true)
        try { await uploadBackup(fbUser.uid) } catch (_) {}
        setSyncing(false)
        setLastSync(getLastSyncDate())
        return
      }

      // CASE 2: Has local dogs, never synced before → first upload
      if (!lastSyncDate) {
        setSyncing(true)
        try { await uploadBackup(fbUser.uid) } catch (_) {}
        setSyncing(false)
        setLastSync(getLastSyncDate())
        return
      }

      // CASE 3: Returning user with data — auto-sync weekly
      if (isSyncDue()) {
        setSyncing(true)
        try { await uploadBackup(fbUser.uid) } catch (_) {}
        setSyncing(false)
        setLastSync(getLastSyncDate())
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Manual backup ────────────────────────────────────────────────────────
  const handleManualBackup = async () => {
    if (!user || syncing) return
    setSyncing(true)
    try { await uploadBackup(user.uid) } catch (_) {}
    setSyncing(false)
    setLastSync(getLastSyncDate())
  }

  // ── Restore handlers ─────────────────────────────────────────────────────
  const handleRestoreYes = async () => {
    if (!restorePrompt) return
    setSyncing(true)
    try {
      await downloadBackup(restorePrompt.uid)
      setLastSync(getLastSyncDate())
      window.location.reload()
    } catch (_) {
      setSyncing(false)
    }
    setRestorePrompt(null)
  }

  const handleRestoreNo = () => {
    markSyncDone() // mark so we don't prompt again on next login
    setLastSync(getLastSyncDate())
    setRestorePrompt(null)
  }

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
    setTab('overview')
  }

  const NAV = [
    { id: 'overview',  icon: <IconOverview />,   label: t('nav.overview') },
    { id: 'zdrowie',   icon: <IconDietWeight />,  label: t('nav.zdrowie') },
    { id: 'training',  icon: <IconTraining />,    label: t('nav.training') },
    { id: 'settings',  icon: <IconSettings />,    label: t('nav.settings') },
  ]

  return (
    <div className="app">
      {/* ── Setup overlay (add/edit dog) ── */}
      {setupMode !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'var(--surface)', overflowY: 'auto' }}>
          <SetupScreen
            dog={setupMode === 'add' ? null : setupMode}
            onSave={handleSaveDog}
            onCancel={dogs.length > 0 ? () => setSetupMode(null) : null}
          />
        </div>
      )}

      {/* ── Restore-from-cloud modal ── */}
      {restorePrompt && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius)',
            padding: 24, maxWidth: 340, width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 10 }}>☁️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, textAlign: 'center' }}>
              {t('auth.restoreTitle')}
            </div>
            <div style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 20, textAlign: 'center', lineHeight: 1.5 }}>
              {t('auth.restoreMsg')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleRestoreYes} disabled={syncing}>
                {syncing
                  ? <><span className="spinner" style={{ width: 14, height: 14 }} /> {t('auth.syncing')}</>
                  : t('auth.restoreYes')
                }
              </button>
              <button className="btn btn-secondary" onClick={handleRestoreNo} disabled={syncing}>
                {t('auth.restoreNo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlays (scan + medical card) ── */}
      {scanOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--surface)', overflowY: 'auto' }}>
          <ScanScreen
            dog={dog}
            onClose={() => setScanOpen(false)}
            onSaved={() => setScanOpen(false)}
          />
        </div>
      )}
      {medicalCardOpen && (
        <div className="medical-card-wrapper" style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#fff', overflowY: 'auto' }}>
          <MedicalCardScreen
            dog={dog}
            weights={weights}
            onClose={() => setMedicalCardOpen(false)}
          />
        </div>
      )}

      {/* ── Main app content (hidden in print when medical card is open) ── */}
      <div className="app-content">
        {/* No dog yet — welcome screen (tabs still visible) */}
        {dogs.length === 0 && tab !== 'settings' && (
          <WelcomeCard
            user={user}
            onAddDog={() => setSetupMode('add')}
          />
        )}

        {dogs.length > 0 && tab === 'overview' && (
          <OverviewScreen
            dog={dog} dogs={dogs} weights={weights}
            onSelectDog={selectDog}
            onMedicalCard={() => setMedicalCardOpen(true)}
          />
        )}
        {dogs.length > 0 && tab === 'zdrowie' && (
          <DietWeightScreen
            dog={dog} dogs={dogs} weights={weights}
            onAdd={addWeightEntry} onDelete={removeWeight}
            onSelectDog={selectDog} onNavigate={setTab}
            onScan={() => setScanOpen(true)}
            onMedicalCard={() => setMedicalCardOpen(true)}
          />
        )}
        {dogs.length > 0 && tab === 'training' && (
          <TrainingScreen dog={dog} />
        )}
        {tab === 'settings' && (
          <SettingsScreen
            dog={dog} dogs={dogs}
            onAddDog={() => setSetupMode('add')}
            onEditDog={() => setSetupMode(dog)}
            onDeleteDog={removeDog}
            user={user}
            syncing={syncing}
            lastSync={lastSync}
            onBackup={handleManualBackup}
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
      </div>{/* end .app-content */}
    </div>
  )
}
