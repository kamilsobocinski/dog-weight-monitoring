import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import {
  getTrainingProfile, saveTrainingProfile,
  getTrainingPlans, addTrainingPlan, updateTrainingPlan, deleteTrainingPlan,
} from '../utils/db'
import { generateTrainingPlan } from '../utils/trainingAI'
import { Toast, useToast } from '../components/Toast'

// ─── Constants ────────────────────────────────────────────────────────────────

const KNOWN_COMMANDS = ['sit','down','stay','come','heel','fetch','leave','paw','no','place','other']
const NEGATIVE_BEHAVIORS = ['barking','leashPulling','stealing','noRecall','jumping','aggression','fear','destructive','other']
const DAYS = ['mon','tue','wed','thu','fri','sat','sun']
const ENVIRONMENTS = ['indoor','outdoor','both']

function emptyProfile(dogId) {
  return {
    dogId,
    knownCommands: [],
    knownCommandsNote: '',
    negativeBehaviors: [],
    negativeBehaviorsNote: '',
    sessionsPerWeek: 3,
    minutesPerSession: 15,
    trainingDays: [],
    trainingTime: '08:00',
    environment: 'both',
    goals: '',
    additionalInfo: '',
  }
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({ value, onChange, min = 1, max = 99 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        style={{ width: 34, height: 34, borderRadius: 8, border: '1.5px solid var(--gray-200)',
          background: 'var(--gray-100)', fontSize: 20, lineHeight: 1, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
      >−</button>
      <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: 17 }}>{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        style={{ width: 34, height: 34, borderRadius: 8, border: '1.5px solid var(--gray-200)',
          background: 'var(--gray-100)', fontSize: 20, lineHeight: 1, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
      >+</button>
    </div>
  )
}

// ─── CheckChip ───────────────────────────────────────────────────────────────

function CheckChip({ checked, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
        border: checked ? '1.5px solid var(--blue)' : '1.5px solid var(--gray-200)',
        background: checked ? 'var(--blue-light)' : 'var(--gray-100)',
        color: checked ? 'var(--blue)' : 'var(--gray-500)',
        fontWeight: checked ? 700 : 500,
        transition: 'all 0.12s',
      }}
    >{children}</button>
  )
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function MarkdownText({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  const result = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('### ')) {
      result.push(<h4 key={i} style={{ margin: '14px 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)' }}>{line.slice(4)}</h4>)
    } else if (line.startsWith('## ')) {
      result.push(<h3 key={i} style={{ margin: '18px 0 6px', fontSize: 15, fontWeight: 800, color: 'var(--gray-800)', borderBottom: '1px solid var(--gray-100)', paddingBottom: 4 }}>{line.slice(3)}</h3>)
    } else if (line.startsWith('# ')) {
      result.push(<h2 key={i} style={{ margin: '20px 0 8px', fontSize: 17, fontWeight: 800 }}>{line.slice(2)}</h2>)
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      const content = line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      result.push(<div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0', fontSize: 13, lineHeight: 1.5 }}>
        <span style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 1 }}>•</span>
        <span dangerouslySetInnerHTML={{ __html: content }} />
      </div>)
    } else if (/^\d+\.\s/.test(line)) {
      const content = line.replace(/^\d+\.\s/, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      result.push(<div key={i} style={{ display: 'flex', gap: 8, margin: '4px 0', fontSize: 13, lineHeight: 1.5 }}>
        <span style={{ color: 'var(--blue)', flexShrink: 0, fontWeight: 700, marginTop: 1 }}>{line.match(/^\d+/)[0]}.</span>
        <span dangerouslySetInnerHTML={{ __html: content }} />
      </div>)
    } else if (line.trim() === '') {
      result.push(<div key={i} style={{ height: 6 }} />)
    } else {
      const content = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      result.push(<p key={i} style={{ margin: '2px 0', fontSize: 13, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: content }} />)
    }
    i++
  }
  return <div>{result}</div>
}

// ─── InterviewForm ────────────────────────────────────────────────────────────

function InterviewForm({ profile, onSave, onCancel }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ ...profile })
  const [saving, setSaving] = useState(false)

  const toggle = (field, val) => setForm(f => {
    const arr = f[field] || []
    return { ...f, [field]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] }
  })

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <div>
      {/* Known commands */}
      <div style={{ marginBottom: 20 }}>
        <div className="form-label" style={{ marginBottom: 8, fontSize: 14, fontWeight: 700 }}>
          🎓 {t('training.commands.label')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {KNOWN_COMMANDS.map(c => (
            <CheckChip key={c} checked={form.knownCommands.includes(c)} onClick={() => toggle('knownCommands', c)}>
              {t(`training.commands.${c}`)}
            </CheckChip>
          ))}
        </div>
        {form.knownCommands.includes('other') && (
          <input type="text" className="form-input" style={{ marginTop: 8 }}
            placeholder={t('training.knownCommandsNote')}
            value={form.knownCommandsNote} onChange={e => setForm(f => ({ ...f, knownCommandsNote: e.target.value }))} />
        )}
      </div>

      {/* Negative behaviors */}
      <div style={{ marginBottom: 20 }}>
        <div className="form-label" style={{ marginBottom: 4, fontSize: 14, fontWeight: 700 }}>
          ⚠️ {t('training.behaviors.label')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>{t('training.behaviors.hint')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {NEGATIVE_BEHAVIORS.map(b => (
            <CheckChip key={b} checked={form.negativeBehaviors.includes(b)} onClick={() => toggle('negativeBehaviors', b)}>
              {t(`training.behaviors.${b}`)}
            </CheckChip>
          ))}
        </div>
        {form.negativeBehaviors.includes('other') && (
          <input type="text" className="form-input" style={{ marginTop: 8 }}
            placeholder={t('training.behaviorsNote')}
            value={form.negativeBehaviorsNote} onChange={e => setForm(f => ({ ...f, negativeBehaviorsNote: e.target.value }))} />
        )}
      </div>

      {/* Training schedule */}
      <div style={{ marginBottom: 20 }}>
        <div className="form-label" style={{ marginBottom: 12, fontSize: 14, fontWeight: 700 }}>
          📅 {t('training.frequency.label')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>{t('training.frequency.sessionsPerWeek')}</div>
            <Stepper value={form.sessionsPerWeek} onChange={v => setForm(f => ({ ...f, sessionsPerWeek: v }))} min={1} max={14} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>{t('training.frequency.minutesPerSession')}</div>
            <Stepper value={form.minutesPerSession} onChange={v => setForm(f => ({ ...f, minutesPerSession: v }))} min={5} max={120} />
          </div>
        </div>

        {/* Day picker */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>{t('training.frequency.trainingDays')}</div>
          <div style={{ display: 'flex', gap: 5 }}>
            {DAYS.map(d => (
              <button key={d} type="button"
                onClick={() => toggle('trainingDays', d)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  border: form.trainingDays.includes(d) ? '1.5px solid var(--blue)' : '1.5px solid var(--gray-200)',
                  background: form.trainingDays.includes(d) ? 'var(--blue)' : 'var(--gray-100)',
                  color: form.trainingDays.includes(d) ? '#fff' : 'var(--gray-500)',
                }}
              >{t(`training.days.${d}`)}</button>
            ))}
          </div>
        </div>

        {/* Training time */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 4 }}>
            {t('training.frequency.trainingTime')}
          </div>
          <input type="time" className="form-input" style={{ maxWidth: 140 }}
            value={form.trainingTime}
            onChange={e => setForm(f => ({ ...f, trainingTime: e.target.value }))} />
          <div style={{ fontSize: 11, color: 'var(--blue)', marginTop: 4 }}>
            🔔 {t('training.frequency.notifHint')}
          </div>
        </div>
      </div>

      {/* Environment */}
      <div style={{ marginBottom: 20 }}>
        <div className="form-label" style={{ marginBottom: 8, fontSize: 14, fontWeight: 700 }}>
          🌳 {t('training.environment.label')}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {ENVIRONMENTS.map(e => (
            <button key={e} type="button"
              onClick={() => setForm(f => ({ ...f, environment: e }))}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                border: form.environment === e ? '2px solid var(--blue)' : '1.5px solid var(--gray-200)',
                background: form.environment === e ? 'var(--blue-light)' : 'var(--surface)',
                color: form.environment === e ? 'var(--blue)' : 'var(--gray-500)',
                fontWeight: form.environment === e ? 700 : 500,
              }}
            >{t(`training.environment.${e}`)}</button>
          ))}
        </div>
      </div>

      {/* Goals */}
      <div style={{ marginBottom: 16 }}>
        <label className="form-label">{t('training.goals')}</label>
        <textarea className="form-input" rows={3} style={{ resize: 'none' }}
          placeholder={t('training.goalsPlaceholder')}
          value={form.goals} onChange={e => setForm(f => ({ ...f, goals: e.target.value }))} />
      </div>

      {/* Additional info */}
      <div style={{ marginBottom: 20 }}>
        <label className="form-label">{t('training.additionalInfo')}</label>
        <textarea className="form-input" rows={2} style={{ resize: 'none' }}
          placeholder={t('training.additionalInfoPlaceholder')}
          value={form.additionalInfo} onChange={e => setForm(f => ({ ...f, additionalInfo: e.target.value }))} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
          {saving
            ? <><span className="spinner" style={{ width: 14, height: 14 }} /> {t('training.interview.save')}</>
            : `✓ ${t('training.interview.save')}`}
        </button>
        {onCancel && (
          <button className="btn btn-secondary" onClick={onCancel} disabled={saving} style={{ flex: '0 0 auto' }}>
            {t('settings.confirmNo')}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── FeedbackForm ─────────────────────────────────────────────────────────────

function FeedbackForm({ onSave, onClose }) {
  const { t } = useTranslation()
  const [rating, setRating]   = useState(0)
  const [note, setNote]       = useState('')
  const [saving, setSaving]   = useState(false)
  const LABELS = t('training.feedback.ratingLabel', { returnObjects: true }) || []

  const handleSave = async () => {
    if (!rating) return
    setSaving(true)
    try { await onSave({ rating, note: note.trim() }) } finally { setSaving(false) }
  }

  return (
    <div style={{ marginTop: 16, padding: 14, background: 'var(--gray-100)', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📝 {t('training.feedback.title')}</div>

      {/* Stars */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>{t('training.feedback.rating')}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[1,2,3,4,5].map(n => (
            <button key={n} type="button"
              onClick={() => setRating(n)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 28, padding: 0,
                filter: n <= rating ? 'none' : 'grayscale(1) opacity(0.3)' }}
            >⭐</button>
          ))}
          {rating > 0 && (
            <span style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600 }}>
              {LABELS[rating - 1] || ''}
            </span>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label className="form-label">{t('training.feedback.note')}</label>
        <textarea className="form-input" rows={3} style={{ resize: 'none' }}
          placeholder={t('training.feedback.notePlaceholder')}
          value={note} onChange={e => setNote(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !rating} style={{ flex: 1 }}>
          {saving
            ? <><span className="spinner" style={{ width: 14, height: 14 }} /> {t('training.feedback.save')}</>
            : `✓ ${t('training.feedback.save')}`}
        </button>
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>✕</button>
      </div>
    </div>
  )
}

// ─── Training Plan PDF modal ──────────────────────────────────────────────────

function PlanPdfModal({ plan, dog, onClose }) {
  useEffect(() => {
    document.body.classList.add('nutrition-pdf-open')
    return () => document.body.classList.remove('nutrition-pdf-open')
  }, [])

  const d = new Date(plan.generatedAt)
  const dateStr = d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="nutrition-pdf-wrapper" style={{
      position: 'fixed', inset: 0, zIndex: 300, background: '#fff',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {/* Toolbar */}
      <div className="nutrition-pdf-no-print" style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid #d1d5db', borderRadius: 8,
          padding: '7px 14px', fontSize: 14, cursor: 'pointer', color: '#374151',
        }}>✕ Zamknij</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>Plan treningowy</span>
        <button onClick={() => window.print()} style={{
          background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
          padding: '7px 14px', fontSize: 14, cursor: 'pointer', fontWeight: 600,
        }}>🖨️ Drukuj / PDF</button>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px', maxWidth: 680, margin: '0 auto' }}>
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #e5e7eb' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', color: '#111827' }}>
            🏋️ Plan treningowy — {dog?.name || ''}
          </h1>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            {dog?.breedName && <span>{dog.breedName} · </span>}
            Wygenerowano: {dateStr} {timeStr}
          </div>
        </div>
        <MarkdownText text={plan.planText} />
        {plan.feedbackRating && (
          <div style={{ marginTop: 20, padding: '12px 16px', background: '#f9fafb', borderRadius: 8, borderLeft: '3px solid #2563eb' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
              Ocena sesji: {'⭐'.repeat(plan.feedbackRating)}
            </div>
            {plan.feedbackText && <div style={{ fontSize: 13, color: '#374151', fontStyle: 'italic' }}>"{plan.feedbackText}"</div>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PlanCard ─────────────────────────────────────────────────────────────────

function PlanCard({ plan, onFeedback, onDelete, onGenerateNext, isLatest, language, dog }) {
  const { t } = useTranslation()
  const [expanded, setExpanded]   = useState(isLatest)
  const [showFeedback, setShowFeedback] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [showPdf,    setShowPdf]   = useState(false)

  const stars = plan.feedbackRating ? '⭐'.repeat(plan.feedbackRating) : null
  const hasFeedback = !!plan.feedbackRating

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {/* Header — or inline delete confirm when confirmDel=true */}
      {confirmDel ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--red-light)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>
            {t('training.plan.confirmDelete')}
          </div>
          <button className="btn btn-danger" style={{ padding: '7px 16px', fontSize: 13, flexShrink: 0 }}
            onClick={() => { onDelete(plan.id); setConfirmDel(false) }}>
            {t('settings.confirmYes')}
          </button>
          <button className="btn btn-secondary" style={{ padding: '7px 16px', fontSize: 13, flexShrink: 0 }}
            onClick={() => setConfirmDel(false)}>
            {t('settings.confirmNo')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: expanded ? 12 : 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              🏋️ {t('training.plan.title')}
              {hasFeedback && <span style={{ marginLeft: 8, fontSize: 12 }}>{stars}</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
              {format(new Date(plan.generatedAt), 'dd.MM.yyyy HH:mm')}
              {hasFeedback && <span style={{ marginLeft: 6, color: 'var(--green)', fontWeight: 600 }}>✓ {t('training.feedback.done')}</span>}
            </div>
          </div>
          <button onClick={() => setShowPdf(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--blue)', padding: '4px 6px', fontWeight: 600 }}
            title="Eksportuj PDF">
            📄
          </button>
          <button onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--gray-400)', padding: 4 }}>
            {expanded ? '▲' : '▼'}
          </button>
          <button onClick={() => setConfirmDel(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--gray-300)', padding: 4 }}>
            🗑
          </button>
        </div>
      )}

      {/* Plan text */}
      {!confirmDel && expanded && (
        <div>
          <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 12, marginBottom: 12 }}>
            <MarkdownText text={plan.planText} />
          </div>

          {/* Feedback section */}
          {hasFeedback ? (
            <div style={{ background: 'var(--gray-100)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 4 }}>
                📝 {t('training.feedback.title')}: {stars}
              </div>
              {plan.feedbackText && <div style={{ fontSize: 12, color: 'var(--gray-600)', fontStyle: 'italic' }}>"{plan.feedbackText}"</div>}
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                {plan.feedbackDate ? format(new Date(plan.feedbackDate), 'dd.MM.yyyy') : ''}
              </div>
            </div>
          ) : (
            !showFeedback && isLatest && (
              <button className="btn btn-secondary"
                style={{ width: '100%', marginBottom: 8, fontSize: 13 }}
                onClick={() => setShowFeedback(true)}>
                📝 {t('training.feedback.addBtn')}
              </button>
            )
          )}

          {showFeedback && !hasFeedback && (
            <FeedbackForm
              onSave={async (fb) => {
                await onFeedback(plan.id, fb)
                setShowFeedback(false)
              }}
              onClose={() => setShowFeedback(false)}
            />
          )}

          {/* Generate next plan button (only on latest with feedback) */}
          {isLatest && hasFeedback && (
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}
              onClick={() => onGenerateNext(plan)}>
              🤖 {t('training.plan.generateNext')}
            </button>
          )}
        </div>
      )}
    </div>

    {showPdf && <PlanPdfModal plan={plan} dog={dog} onClose={() => setShowPdf(false)} />}
  )
}

// ─── TrainingScreen ───────────────────────────────────────────────────────────

export function TrainingScreen({ dog, weights }) {
  const { t, i18n } = useTranslation()
  const { toast, showToast } = useToast()

  const [profile,    setProfile]    = useState(null)
  const [plans,      setPlans]      = useState([])
  const [isEditing,  setIsEditing]  = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loaded,     setLoaded]     = useState(false)

  // Load profile + plans
  const loadData = useCallback(async () => {
    if (!dog) return
    const [p, pl] = await Promise.all([
      getTrainingProfile(dog.id),
      getTrainingPlans(dog.id),
    ])
    setProfile(p || null)
    setPlans(pl)
    setLoaded(true)
    if (!p) setIsEditing(true) // first-run: open form
  }, [dog])

  useEffect(() => { loadData() }, [loadData])

  // Save interview
  const handleSaveProfile = async (form) => {
    const p = { ...form, dogId: dog.id, updatedAt: Date.now() }
    await saveTrainingProfile(p)
    setProfile(p)
    setIsEditing(false)
    showToast(t('training.interview.saved'))
  }

  // Generate plan
  const handleGenerate = async (lastPlanForContext = null) => {
    if (!profile || !dog) return
    setGenerating(true)
    try {
      const planText = await generateTrainingPlan(
        dog, weights, profile, lastPlanForContext, i18n.language
      )
      const id = await addTrainingPlan({ dogId: dog.id, planText, isCompleted: false })
      const newPlan = { id, dogId: dog.id, planText, isCompleted: false, generatedAt: Date.now() }
      setPlans(prev => [newPlan, ...prev])
    } catch (err) {
      showToast(err.message || t('training.plan.generateError'))
    } finally {
      setGenerating(false)
    }
  }

  // Save feedback
  const handleFeedback = async (planId, { rating, note }) => {
    const patch = {
      feedbackRating: rating,
      feedbackText: note,
      feedbackDate: Date.now(),
      isCompleted: true,
    }
    await updateTrainingPlan(planId, patch)
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, ...patch } : p))
    showToast(t('training.feedback.saved'))
  }

  // Delete plan
  const handleDelete = async (planId) => {
    await deleteTrainingPlan(planId)
    setPlans(prev => prev.filter(p => p.id !== planId))
  }

  if (!dog) {
    return (
      <div className="screen">
        <div className="empty-state">
          <div className="empty-state-icon">🐾</div>
          <div className="empty-state-text">{t('dashboard.noData')}</div>
        </div>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="screen" style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  const latestPlan = plans[0] || null
  const olderPlans = plans.slice(1)

  // Profile summary chips
  const profileSummary = profile ? [
    profile.knownCommands?.length && `🎓 ${profile.knownCommands.length} komend`,
    profile.negativeBehaviors?.length && `⚠️ ${profile.negativeBehaviors.length} zachowań`,
    profile.sessionsPerWeek && `📅 ${profile.sessionsPerWeek}×/tydz. · ${profile.minutesPerSession} min`,
    profile.trainingTime && `⏰ ${profile.trainingTime}`,
  ].filter(Boolean) : []

  return (
    <div className="screen">
      <div className="page-header">
        <h1 className="page-title">🏃 {t('nav.training')} — {dog.name}</h1>
        {dog.photo && (
          <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--gray-200)', flexShrink: 0 }}>
            <img src={dog.photo} alt={dog.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
      </div>

      {/* ─── Interview card ──────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isEditing ? 16 : 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>📋 {t('training.interview.title')}</div>
            {!isEditing && profile && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                {profileSummary.map((s, i) => (
                  <span key={i} style={{ fontSize: 11, background: 'var(--gray-100)', padding: '3px 8px', borderRadius: 20, color: 'var(--gray-600)' }}>{s}</span>
                ))}
              </div>
            )}
          </div>
          {profile && !isEditing && (
            <button className="btn btn-secondary" style={{ padding: '7px 14px', fontSize: 12, flexShrink: 0 }}
              onClick={() => setIsEditing(true)}>
              ✏️ {t('training.interview.edit')}
            </button>
          )}
        </div>

        {isEditing && (
          <InterviewForm
            profile={profile || emptyProfile(dog.id)}
            onSave={handleSaveProfile}
            onCancel={profile ? () => setIsEditing(false) : null}
          />
        )}
      </div>

      {/* ─── Generate plan button ────────────────────────────────────────── */}
      {profile && !isEditing && (
        <>
          {/* No plans yet — big CTA */}
          {plans.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>🤖</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{t('training.plan.noPlans')}</div>
              <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 20 }}>{t('training.plan.noPlansHint')}</div>
              <button className="btn btn-primary" style={{ fontSize: 15, padding: '13px 28px' }}
                onClick={() => handleGenerate(null)} disabled={generating}>
                {generating
                  ? <><span className="spinner" style={{ width: 16, height: 16 }} /> {t('training.plan.generating')}</>
                  : `🤖 ${t('training.plan.generate')}`}
              </button>
            </div>
          )}

          {/* Has plans — show generate button only when latest has feedback */}
          {plans.length > 0 && latestPlan && !latestPlan.isCompleted && (
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: 14, fontSize: 14, padding: '12px' }}
              onClick={() => handleGenerate(null)} disabled={generating}>
              {generating
                ? <><span className="spinner" style={{ width: 16, height: 16 }} /> {t('training.plan.generating')}</>
                : `🤖 ${t('training.plan.generate')}`}
            </button>
          )}
        </>
      )}

      {/* ─── Current (latest) plan ───────────────────────────────────────── */}
      {latestPlan && (
        <PlanCard
          key={latestPlan.id}
          plan={latestPlan}
          isLatest
          dog={dog}
          language={i18n.language}
          onFeedback={handleFeedback}
          onDelete={handleDelete}
          onGenerateNext={(plan) => handleGenerate(plan)}
        />
      )}

      {/* ─── Plan history ────────────────────────────────────────────────── */}
      {olderPlans.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: 'var(--gray-600)' }}>
            📚 {t('training.plan.history')} ({olderPlans.length})
          </div>
          {olderPlans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isLatest={false}
              dog={dog}
              language={i18n.language}
              onFeedback={handleFeedback}
              onDelete={handleDelete}
              onGenerateNext={() => {}}
            />
          ))}
        </div>
      )}

      <Toast message={toast} />
    </div>
  )
}
