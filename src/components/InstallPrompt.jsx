import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isStandalone() {
  return window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
}

export function InstallPrompt() {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    if (isStandalone()) return
    const dismissed = localStorage.getItem('install-dismissed')
    if (dismissed) return

    if (isIos()) {
      // Show iOS instructions after 3s
      const timer = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(timer)
    }

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    setShow(false)
    localStorage.setItem('install-dismissed', '1')
  }

  const installAndroid = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  if (!show) return null

  return (
    <div className="install-overlay" onClick={dismiss}>
      <div className="install-sheet" onClick={e => e.stopPropagation()}>
        <div className="install-paw">🐾</div>
        <div className="install-title">{t('install.title')}</div>

        {isIos() ? (
          <div className="install-steps">
            <div className="install-step">
              <div className="install-step-num">1</div>
              <span>
                {t('install.iosStep1')}{' '}
                <span style={{fontSize:18}}>⬆️</span>{' '}
                {t('install.iosStep2')}
              </span>
            </div>
            <div className="install-step">
              <div className="install-step-num">2</div>
              <span>{t('install.iosStep3')}</span>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            <button className="btn btn-primary" onClick={installAndroid}>
              📲 {t('install.androidBtn')}
            </button>
          </div>
        )}

        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={dismiss}>
          {t('install.dismiss')}
        </button>
      </div>
    </div>
  )
}
