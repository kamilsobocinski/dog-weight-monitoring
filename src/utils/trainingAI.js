/**
 * Gemini AI — dog training plan generator
 * Reuses the same model chain as gemini.js
 */

import { getBreedById, getBreedByName, getIdealWeightAtAge } from '../data/breeds'

const GEMINI_KEY  = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_MODELS = [
  'gemini-2.5-flash-preview-04-17',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
]

function calcAgeMonths(birthdate) {
  if (!birthdate) return null
  const now   = new Date()
  const birth = new Date(birthdate)
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
}

function calcAgeStr(birthdate) {
  const m = calcAgeMonths(birthdate)
  if (m === null) return null
  const y = Math.floor(m / 12), mo = m % 12
  if (y > 0 && mo > 0) return `${y} lat ${mo} mies.`
  if (y > 0)  return `${y} lat`
  return `${mo} mies.`
}

function calcWeightStatus(dog, weights) {
  if (!weights?.length || !dog) return null
  const current = weights[weights.length - 1].value
  const breed   = dog.breedId ? getBreedById(dog.breedId) : dog.breedName ? getBreedByName(dog.breedName) : null
  if (!breed) return null
  const age = calcAgeMonths(dog.birthdate) ?? 36
  const { min, max } = getIdealWeightAtAge(breed, dog.sex || 'male', age)
  const status = current > max ? 'overweight' : current < min ? 'underweight' : 'normal'
  return { status, current, min, max }
}

// Human-readable labels (Polish — AI always gets Polish input, responds in target lang)
const COMMAND_LABELS = {
  sit: 'Siad', down: 'Waruj', stay: 'Zostań', come: 'Do mnie / Przywołanie',
  heel: 'Noga (chodzenie przy nodze)', fetch: 'Aport', leave: 'Zostaw',
  paw: 'Łapa', no: 'Nie', place: 'Na miejsce / Do miejsca', other: 'Inne',
}

const BEHAVIOR_LABELS = {
  barking:     'Nadmierne szczekanie',
  leashPulling:'Ciągnie na smyczy',
  stealing:    'Kradnie przedmioty',
  noRecall:    'Brak reakcji na przywołanie poza domem',
  jumping:     'Skacze na ludzi',
  aggression:  'Agresja wobec psów lub ludzi',
  fear:        'Lęki / strach / nadmierna reakcja na bodźce',
  destructive: 'Niszczenie przedmiotów / gryzienie mebli',
  other:       'Inne',
}

const DAY_LABELS_PL = {
  mon: 'poniedziałek', tue: 'wtorek', wed: 'środa', thu: 'czwartek',
  fri: 'piątek', sat: 'sobota', sun: 'niedziela',
}

const ENV_LABELS = { indoor: 'w domu', outdoor: 'na zewnątrz', both: 'w domu i na zewnątrz' }

/**
 * Build prompt for Gemini training plan generation.
 * @param {object} dog            - Dog profile
 * @param {Array}  weights        - Weight records
 * @param {object} profile        - Training interview profile
 * @param {object|null} lastPlan  - Last training plan (with feedback) for continuity
 * @param {string} language
 */
function buildTrainingPrompt(dog, weights, profile, lastPlan, language = 'pl') {
  const langNote = {
    pl: 'Odpowiedz wyłącznie po polsku.',
    en: 'Reply in English only.',
    de: 'Antworte ausschließlich auf Deutsch.',
    es: 'Responde solo en español.',
  }[language] || 'Odpowiedz wyłącznie po polsku.'

  const lines = [
    '## KRYTYCZNE ZASADY FORMATOWANIA (czytaj przed wszystkim):',
    '1. NIE pisz żadnego wstępu, powitania, ani ogólnych zdań o treningu.',
    '2. Pierwsza linia odpowiedzi MUSI zaczynać się od "## 1. Cel sesji".',
    '3. Każde ćwiczenie = konkretne kroki, czas, liczba powtórzeń. Zero ogólników.',
    '',
    `Jesteś profesjonalnym trenerem psów. ${langNote}`,
    '',
    '## Dane psa:',
  ]

  if (dog?.name)      lines.push(`- Imię: ${dog.name}`)
  if (dog?.breedName) lines.push(`- Rasa: ${dog.breedName}`)
  if (dog?.sex)       lines.push(`- Płeć: ${dog.sex === 'female' ? 'suka' : 'pies'}`)

  const age = calcAgeStr(dog?.birthdate)
  if (age)            lines.push(`- Wiek: ${age}`)

  const ws = calcWeightStatus(dog, weights)
  if (ws) {
    lines.push(`- Waga: ${ws.current} kg (norma rasy: ${ws.min}–${ws.max} kg, stan: ${
      ws.status === 'overweight' ? 'nadwaga' :
      ws.status === 'underweight' ? 'niedowaga' : 'prawidłowa'
    })`)
    if (ws.status === 'overweight')  lines.push('  ⚠️ Pies ma nadwagę — zalec więcej aktywności fizycznej.')
    if (ws.status === 'underweight') lines.push('  ⚠️ Pies ma niedowagę — zadbaj o odpowiedni wysiłek bez przemęczania.')
  }

  lines.push('', '## Wywiad treningowy:')

  // Known commands
  const known = (profile.knownCommands || []).map(c => COMMAND_LABELS[c] || c)
  if (known.length) {
    lines.push(`\n### Co pies już umie (${known.length} komend):`)
    known.forEach(c => lines.push(`  ✓ ${c}`))
  }
  if (profile.knownCommandsNote?.trim()) {
    lines.push(`  Dodatkowe komendy: ${profile.knownCommandsNote}`)
  }

  // Negative behaviors
  const behaviors = (profile.negativeBehaviors || []).map(b => BEHAVIOR_LABELS[b] || b)
  if (behaviors.length) {
    lines.push(`\n### ⚠️ Zachowania do pracy (PRIORYTET):`)
    behaviors.forEach(b => lines.push(`  • ${b}`))
  }
  if (profile.negativeBehaviorsNote?.trim()) {
    lines.push(`  Opis: ${profile.negativeBehaviorsNote}`)
  }

  // Schedule
  lines.push('\n### Harmonogram treningowy:')
  if (profile.sessionsPerWeek) lines.push(`- Częstotliwość: ${profile.sessionsPerWeek}× w tygodniu`)
  if (profile.minutesPerSession) lines.push(`- Czas sesji: ${profile.minutesPerSession} minut`)
  const days = (profile.trainingDays || []).map(d => DAY_LABELS_PL[d] || d)
  if (days.length) lines.push(`- Dni treningowe: ${days.join(', ')}`)
  if (profile.trainingTime) lines.push(`- Godzina treningu: ${profile.trainingTime}`)
  if (profile.environment) lines.push(`- Środowisko: ${ENV_LABELS[profile.environment] || profile.environment}`)

  if (profile.goals?.trim()) {
    lines.push(`\n### Cele właściciela:\n"${profile.goals}"`)
  }
  if (profile.additionalInfo?.trim()) {
    lines.push(`\n### Dodatkowe informacje:\n"${profile.additionalInfo}"`)
  }

  // Previous plan + feedback for continuity
  if (lastPlan?.feedbackText || lastPlan?.feedbackRating) {
    lines.push('\n## Feedback z poprzedniej sesji treningowej:')
    if (lastPlan.feedbackRating) {
      lines.push(`Ocena: ${'⭐'.repeat(lastPlan.feedbackRating)} (${lastPlan.feedbackRating}/5)`)
    }
    if (lastPlan.feedbackText?.trim()) {
      lines.push(`Komentarz właściciela: "${lastPlan.feedbackText}"`)
    }
    lines.push('→ Weź ten feedback pod uwagę przy planowaniu kolejnej sesji.')
  }

  // Task
  const isFirst = !lastPlan
  lines.push('\n## Zadanie:')
  lines.push(isFirst
    ? `Przygotuj PIERWSZY plan treningowy dla ${dog?.name || 'tego psa'}.`
    : `Na podstawie feedbacku z poprzedniej sesji przygotuj KOLEJNY plan treningowy.`
  )
  lines.push('')
  lines.push('Plan musi zawierać DOKŁADNIE te sekcje (zacznij bezpośrednio od punktu 1):')
  lines.push('## 1. Cel sesji')
  lines.push('_(co konkretnie chcemy osiągnąć w tej sesji — 2–3 zdania)_')
  lines.push('')
  lines.push('## 2. Rozgrzewka (2–3 min)')
  lines.push('_(3 znane komendy do szybkiego powtórzenia — po 3–5 powtórzeń każda)_')
  lines.push('')
  lines.push('## 3. Ćwiczenia główne')
  lines.push('_(3–4 ćwiczenia, każde z nazwą, techniką krok po kroku, liczbą powtórzeń i wskazówką)_')
  lines.push('')
  lines.push('## 4. Praca nad zachowaniem')
  lines.push('_(konkretna technika pracy nad wskazanym problemem — krok po kroku)_')
  lines.push('')
  lines.push('## 5. Zakończenie (1–2 min)')
  lines.push('_(ulubiona komenda + nagroda, pozytywne zakończenie sesji)_')
  lines.push('')
  lines.push('## 6. Wskazówki praktyczne')
  lines.push('_(2–3 krótkie porady na co uważać podczas tej sesji)_')
  lines.push('')
  lines.push('## Ważne instrukcje:')
  lines.push('- NIE pisz wstępu, powitania ani ogólnych zdań o psim treningu.')
  lines.push('- Zacznij BEZPOŚREDNIO od "## 1. Cel sesji".')
  lines.push('- Każde ćwiczenie = konkretne kroki (1. Stań... 2. Pokaż...), czas trwania, liczba powtórzeń.')
  lines.push('- Zero ogólników — same konkretne działania.')
  lines.push(`- Cała sesja ma trwać ok. ${profile.minutesPerSession || 15} minut.`)

  return lines.join('\n')
}

async function tryModel(model, prompt) {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${GEMINI_KEY}`
  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.65, maxOutputTokens: 4096 },
    }),
  })
  const json = await res.json()
  if (!res.ok) {
    const code = json.error?.code || res.status
    const msg  = json.error?.message || `HTTP ${res.status}`
    throw new Error(`[${model}] ${code}: ${msg}`)
  }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error(`[${model}] Empty response`)
  return text
}

/**
 * Generate an AI training plan.
 * @param {object} dog
 * @param {Array}  weights
 * @param {object} profile    - Training profile (interview answers)
 * @param {object|null} lastPlan - Previous plan (with feedback) for continuity
 * @param {string} language
 */
export async function generateTrainingPlan(dog, weights, profile, lastPlan = null, language = 'pl') {
  if (!GEMINI_KEY) throw new Error('Brak klucza API Gemini.')

  const prompt = buildTrainingPrompt(dog, weights, profile, lastPlan, language)

  const errors = []
  for (const model of GEMINI_MODELS) {
    try {
      const text = await tryModel(model, prompt)
      console.log(`✅ Training plan OK via ${model}`)
      return text
    } catch (err) {
      console.warn(`⚠️ ${model} failed:`, err.message)
      errors.push(err.message)
      if (err.message.includes('API_KEY_INVALID') ||
          err.message.includes('403') ||
          err.message.includes('PERMISSION_DENIED')) break
    }
  }

  const last = errors[errors.length - 1] || 'Nieznany błąd'
  if (errors.some(e => e.includes('429') || e.includes('RESOURCE_EXHAUSTED'))) {
    throw new Error('❌ Przekroczono limit API Gemini. Spróbuj jutro.')
  }
  if (errors.some(e => e.includes('403') || e.includes('PERMISSION_DENIED'))) {
    throw new Error('❌ Brak dostępu do Gemini API. Sprawdź klucz.')
  }
  throw new Error(`❌ Błąd Gemini API: ${last}`)
}
