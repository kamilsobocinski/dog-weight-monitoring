import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { AuthButton } from '../components/AuthButton'
import { Toast, useToast } from '../components/Toast'

export function SettingsScreen({ dog, dogs, onAddDog, onEditDog, onDeleteDog, user, syncing, lastSync, onBackup }) {
  const { t } = useTranslation()
  const { toast, showToast } = useToast()

  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const dogToDelete = confirmDeleteId ? dogs.find(d => d.id === confirmDeleteId) : null

  return (
    <div className="screen">
      <div className="page-header">
        <h1 className="page-title">⚙️ {t('settings.title')}</h1>
      </div>

      {/* Cloud backup / Account */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>☁️ {t('auth.title')}</div>
        <AuthButton user={user} syncing={syncing} lastSync={lastSync} onBackup={onBackup} />
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

      {/* App info */}
      <div className="card" style={{ color: 'var(--gray-400)', fontSize: 13, textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-600)', marginBottom: 6 }}>
          🐾 DogPass
        </div>
        <div>v1.8.0 · PWA · 100 breeds · PL / EN / DE / ES</div>
        <div style={{ marginTop: 8, fontSize: 12 }}>
          © {new Date().getFullYear()} Kamil Sobociński · All rights reserved
        </div>
      </div>

      <Toast message={toast} />
    </div>
  )
}
