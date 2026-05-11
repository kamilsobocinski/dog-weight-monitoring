import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { breeds } from '../data/breeds'
import { Toast, useToast } from '../components/Toast'
import { resizeImage } from '../utils/imageUtils'

export function SetupScreen({ dog, onSave, onCancel }) {
  const { t } = useTranslation()
  const { toast, showToast } = useToast()

  const [name, setName] = useState(dog?.name || '')
  const [sex, setSex] = useState(dog?.sex || 'male')
  const [birthdate, setBirthdate] = useState(dog?.birthdate || '')
  const [breedSearch, setBreedSearch] = useState(dog?.breedName || '')
  const [selectedBreed, setSelectedBreed] = useState(dog ? { id: dog.breedId, name: dog.breedName } : null)
  const [showList, setShowList] = useState(false)
  const [errors, setErrors] = useState({})
  const [photo, setPhoto] = useState(dog?.photo || null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const searchRef   = useRef(null)
  const galleryRef  = useRef(null)
  const cameraRef   = useRef(null)

  const handlePhotoFile = async (file) => {
    if (!file) return
    setPhotoLoading(true)
    try {
      const base64 = await resizeImage(file, 400, 0.82)
      setPhoto(base64)
    } catch (e) {
      console.warn('Photo resize failed', e)
    } finally {
      setPhotoLoading(false)
    }
  }

  const filtered = breeds.filter(b =>
    b.name.toLowerCase().includes(breedSearch.toLowerCase())
  ).slice(0, 40)

  const validate = () => {
    const e = {}
    if (!name.trim()) e.name = t('errors.weightInvalid')
    if (!selectedBreed) e.breed = t('setup.noBreedSelected')
    if (!birthdate) e.birthdate = t('errors.dateRequired')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    const data = { name: name.trim(), sex, birthdate, breedId: selectedBreed.id, breedName: selectedBreed.name, photo: photo || null }
    if (dog?.id) data.id = dog.id
    onSave(data)
    showToast(t('setup.saved'))
  }

  const selectBreed = (b) => {
    setSelectedBreed(b)
    setBreedSearch(b.name)
    setShowList(false)
  }

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowList(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler) }
  }, [])

  return (
    <div className="screen">
      <div className="page-header">
        <h1 className="page-title">🐶 {dog ? t('setup.editTitle') : t('setup.addTitle')}</h1>
        {onCancel && (
          <button className="btn btn-ghost" onClick={onCancel}>✕</button>
        )}
      </div>

      {/* Photo */}
      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
        <div
          style={{
            width: 110, height: 110, borderRadius: '50%', overflow: 'hidden',
            background: 'var(--gray-100)', border: '3px solid var(--gray-200)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12, cursor: 'pointer', position: 'relative',
          }}
          onClick={() => galleryRef.current?.click()}
        >
          {photoLoading ? (
            <span className="spinner" style={{ width: 28, height: 28 }} />
          ) : photo ? (
            <img src={photo} alt="dog" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 44 }}>🐶</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}
            onClick={() => cameraRef.current?.click()}>
            📷 {t('setup.photoCamera')}
          </button>
          <button type="button" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}
            onClick={() => galleryRef.current?.click()}>
            🖼 {t('setup.photoGallery')}
          </button>
          {photo && (
            <button type="button" className="btn btn-danger" style={{ padding: '8px 12px', fontSize: 13 }}
              onClick={() => setPhoto(null)}>
              ✕
            </button>
          )}
        </div>

        {/* Hidden file inputs */}
        <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => handlePhotoFile(e.target.files?.[0])} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={e => handlePhotoFile(e.target.files?.[0])} />
      </div>

      <div className="form-group">
        <label className="form-label">{t('setup.name')}</label>
        <input
          className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('setup.namePlaceholder')}
          maxLength={30}
        />
        {errors.name && <div className="form-error">{errors.name}</div>}
      </div>

      <div className="form-group">
        <label className="form-label">{t('setup.sex')}</label>
        <div className="tag-group">
          <button className={`tag-btn${sex === 'male' ? ' active' : ''}`} onClick={() => setSex('male')}>
            🐕 {t('setup.male')}
          </button>
          <button className={`tag-btn${sex === 'female' ? ' active' : ''}`} onClick={() => setSex('female')}>
            🐩 {t('setup.female')}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">{t('setup.birthdate')}</label>
        <input
          className="form-input"
          type="date"
          value={birthdate}
          onChange={e => setBirthdate(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
        />
        {errors.birthdate && <div className="form-error">{errors.birthdate}</div>}
      </div>

      <div className="form-group">
        <label className="form-label">{t('setup.breed')}</label>
        <div className="breed-dropdown" ref={searchRef}>
          <input
            className="form-input"
            value={breedSearch}
            onChange={e => { setBreedSearch(e.target.value); setShowList(true); setSelectedBreed(null) }}
            onFocus={() => setShowList(true)}
            placeholder={t('setup.breedPlaceholder')}
          />
          {showList && filtered.length > 0 && (
            <div className="breed-list">
              {filtered.map(b => (
                <div key={b.id} className="breed-option" onMouseDown={() => selectBreed(b)} onTouchEnd={() => selectBreed(b)}>
                  {b.name}
                </div>
              ))}
            </div>
          )}
        </div>
        {errors.breed && <div className="form-error">{errors.breed}</div>}
      </div>

      {selectedBreed && (
        <div className="card" style={{ background: 'var(--blue-light)', border: '1px solid var(--blue)', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--blue-dark)', fontWeight: 600 }}>
            ✓ {t('setup.refFound')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--blue-dark)', marginTop: 4 }}>
            {selectedBreed.name} — {t('setup.male')}: {breeds.find(b=>b.id===selectedBreed.id)?.male.min}–{breeds.find(b=>b.id===selectedBreed.id)?.male.max} kg &nbsp;|&nbsp;
            {t('setup.female')}: {breeds.find(b=>b.id===selectedBreed.id)?.female.min}–{breeds.find(b=>b.id===selectedBreed.id)?.female.max} kg
          </div>
        </div>
      )}

      <button className="btn btn-primary" onClick={handleSave}>
        💾 {t('setup.save')}
      </button>

      <Toast message={toast} />
    </div>
  )
}
