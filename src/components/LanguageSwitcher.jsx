import { useTranslation } from 'react-i18next'

const LANGS = [
  { code: 'pl', label: 'PL' },
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
  { code: 'es', label: 'ES' },
]

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  return (
    <div className="lang-bar">
      {LANGS.map(l => (
        <button
          key={l.code}
          className={`lang-btn${i18n.language === l.code ? ' active' : ''}`}
          onClick={() => i18n.changeLanguage(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
