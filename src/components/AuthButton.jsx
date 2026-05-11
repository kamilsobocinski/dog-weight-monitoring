import { useTranslation } from 'react-i18next'
import { signInWithGoogle, signOutUser } from '../utils/firebase'

// Minimal Google logo SVG
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ display: 'block' }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

/**
 * Props:
 *   user       — Firebase User object or null
 *   syncing    — boolean, show spinner while backup is running
 *   lastSync   — Date | null
 *   onBackup   — () => void  — trigger manual backup
 */
export function AuthButton({ user, syncing, lastSync, onBackup }) {
  const { t } = useTranslation()

  if (!user) {
    return (
      <button
        className="btn btn-secondary"
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', width: '100%', justifyContent: 'center' }}
        onClick={signInWithGoogle}
      >
        <GoogleLogo />
        {t('auth.signInGoogle')}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* User row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {user.photoURL && (
          <img
            src={user.photoURL}
            alt=""
            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.displayName || user.email}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </div>
        </div>
        <button
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap' }}
          onClick={signOutUser}
        >
          {t('auth.signOut')}
        </button>
      </div>

      {/* Backup info */}
      <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
        ☁️ {lastSync
          ? `${t('auth.lastBackup')}: ${lastSync.toLocaleDateString()} ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : t('auth.noBackup')
        }
      </div>

      {/* Manual backup */}
      <button
        className="btn btn-primary"
        style={{ padding: '9px 16px', fontSize: 13 }}
        onClick={onBackup}
        disabled={syncing}
      >
        {syncing
          ? <><span className="spinner" style={{ width: 14, height: 14 }} /> {t('auth.syncing')}</>
          : `☁️ ${t('auth.backupNow')}`
        }
      </button>
    </div>
  )
}
