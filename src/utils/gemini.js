/**
 * Gemini 1.5 Flash API — AI nutrition advisor for dogs
 * Free tier: 1500 req/day, 1M tokens/min
 */

import { getBreedById, getBreedByName, getIdealWeightAtAge } from '../data/breeds'

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY

// Try models in order — 2.5 Flash first, fallback to older
const GEMINI_MODELS = [
  'gemini-2.5-flash-preview-04-17',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
]
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Calculate dog age in months (for ideal weight lookup).
 */
function calcAgeMonths(birthdate) {
  if (!birthdate) return null
  const now = new Date()
  const birth = new Date(birthdate)
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
}

/**
 * Calculate dog age in human-readable string (years + months).
 */
function calcAge(birthdate) {
  if (!birthdate) return null
  const months = calcAgeMonths(birthdate)
  if (months === null) return null
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y > 0 && m > 0) return `${y} lat ${m} mies.`
  if (y > 0) return `${y} lat`
  return `${m} mies.`
}

/**
 * Determine weight status vs breed norm.
 * Returns: { status: 'overweight'|'underweight'|'normal'|'unknown', diffKg, diffPct, idealMin, idealMax }
 */
export function calcWeightStatus(dog, weights) {
  if (!weights.length || !dog) return { status: 'unknown' }
  const currentWeight = weights[weights.length - 1].value
  if (!currentWeight) return { status: 'unknown' }

  // Try to find breed data
  const breed = dog.breedId
    ? getBreedById(dog.breedId)
    : dog.breedName
      ? getBreedByName(dog.breedName)
      : null

  if (!breed) return { status: 'unknown', currentWeight }

  const ageMonths = calcAgeMonths(dog.birthdate) ?? 36
  const { min: idealMin, max: idealMax } = getIdealWeightAtAge(breed, dog.sex || 'male', ageMonths)
  const idealMid = (idealMin + idealMax) / 2

  const diffKg = +(currentWeight - idealMid).toFixed(1)
  const diffPct = Math.round((currentWeight - idealMid) / idealMid * 100)

  let status = 'normal'
  if (currentWeight > idealMax) status = 'overweight'
  else if (currentWeight < idealMin) status = 'underweight'

  return { status, diffKg, diffPct, idealMin, idealMax, currentWeight }
}

// kcal/g estimates (must match NutritionScreen.jsx KCAL_PER_G)
const KCAL_PER_G = {
  dry: 3.5, wet: 0.85, raw: 1.5, homemade: 1.2,
  treat: 3.2, supplement: 0, other: 2.5,
}

/** Format structured food items into text for the AI prompt */
function formatFoodForPrompt(foodItems) {
  if (!foodItems?.length) return ''

  const typeNames = {
    dry: 'karma sucha (granulat)', wet: 'karma mokra (puszka/saszetka)',
    raw: 'dieta BARF / surowe mięso', homemade: 'domowe gotowane jedzenie',
    treat: 'przysmaki / kości / smaczki', supplement: 'suplement', other: 'inne',
  }
  const freqNames = {
    daily: 'codziennie', few_week: '2-4× w tygodniu',
    weekly: 'raz w tygodniu', occasionally: 'okazjonalnie',
  }

  let totalDailyKcal = 0

  const lines = foodItems.map((item, i) => {
    const type = typeNames[item.type] || item.type
    const name = item.name ? `"${item.name}"` : '(nazwa nieznana)'
    let portion = '', dailyG = 0

    if (item.unit === 'pcs') {
      // Pieces mode (treats)
      dailyG = (item.piecesPerDay || 0) * (item.gramsPerPiece || 0)
      const kcal = Math.round(dailyG * (KCAL_PER_G[item.type] ?? 2.5))
      portion = `${item.piecesPerDay} sztuk/dzień × ${item.gramsPerPiece}g/szt = **${dailyG}g/dzień** (≈${kcal} kcal)`
      totalDailyKcal += kcal
    } else if (item.frequency === 'daily') {
      dailyG = (item.timesPerDay || 1) * (item.gramsPerPortion || 0)
      const kcal = Math.round(dailyG * (KCAL_PER_G[item.type] ?? 2.5))
      portion = `${item.timesPerDay}× dziennie po ${item.gramsPerPortion}g = **${dailyG}g/dzień** (≈${kcal} kcal)`
      totalDailyKcal += kcal
    } else {
      const freq = freqNames[item.frequency] || item.frequency
      portion = `${freq}, jednorazowo ${item.gramsPerPortion}g`
    }

    let extra = item.scannedLabel
      ? `\n   Skład ze skanu: ${item.scannedLabel.slice(0, 300)}`
      : ''
    return `${i + 1}. ${type}: ${name}\n   Dawkowanie: ${portion}${extra}`
  })

  const kcalNote = totalDailyKcal > 0
    ? `\n⚡ Szacowane łączne dzienne spożycie kalorii: **${totalDailyKcal} kcal/dzień**\n(Uwaga: podane kcal to szacunkowe wartości średnie — rzeczywiste mogą różnić się o ±15%)`
    : ''

  return lines.join('\n') + kcalNote
}

/**
 * Build a detailed prompt for Gemini with all dog data.
 */
function buildPrompt(dog, weights, foodItems, language = 'pl') {
  const latestWeight = weights.length > 0 ? weights[weights.length - 1].value : null
  const age = calcAge(dog?.birthdate)
  const ws = calcWeightStatus(dog, weights)

  const langInstructions = {
    pl: 'Odpowiedz wyłącznie po polsku.',
    en: 'Reply in English only.',
    de: 'Antworte ausschließlich auf Deutsch.',
    es: 'Responde solo en español.',
  }
  const langNote = langInstructions[language] || langInstructions.pl

  const lines = [
    `Jesteś ekspertem od żywienia psów. ${langNote}`,
    '',
    '## Dane psa:',
    dog?.name    ? `- Imię: ${dog.name}` : '',
    dog?.breedName ? `- Rasa: ${dog.breedName}` : '',
    dog?.sex     ? `- Płeć: ${dog.sex === 'female' ? 'suka' : 'pies'}` : '',
    age          ? `- Wiek: ${age}` : '',
    latestWeight ? `- Aktualna waga: ${latestWeight} kg` : '',
  ].filter(Boolean)

  // ── Weight status vs breed norm ── (this is the key context for AI)
  if (ws.status !== 'unknown') {
    lines.push(`- Norma wagowa dla tej rasy i wieku: ${ws.idealMin}–${ws.idealMax} kg`)
    if (ws.status === 'overweight') {
      lines.push(`- ⚠️ NADWAGA: pies waży o ${Math.abs(ws.diffKg)} kg za dużo (+${Math.abs(ws.diffPct)}% powyżej normy)`)
    } else if (ws.status === 'underweight') {
      lines.push(`- ⚠️ NIEDOWAGA: pies waży o ${Math.abs(ws.diffKg)} kg za mało (${ws.diffPct}% poniżej normy)`)
    } else {
      lines.push(`- ✅ Waga w normie (${ws.diffKg >= 0 ? '+' : ''}${ws.diffKg} kg od środka normy)`)
    }
  }

  // Weight trend
  if (weights.length >= 2) {
    const oldest = weights[0]
    const newest = weights[weights.length - 1]
    const diffKg = (newest.value - oldest.value).toFixed(1)
    const diffSign = diffKg > 0 ? '+' : ''
    lines.push(`- Trend wagi (ostatnie ${weights.length} pomiarów): ${diffSign}${diffKg} kg`)
  }

  lines.push('')

  // Current food info — structured
  const foodText = formatFoodForPrompt(foodItems)
  if (foodText) {
    lines.push('## Obecna dieta psa:')
    lines.push(foodText)
    lines.push('')
  }

  // ── Task — adapt based on weight status ──
  lines.push('## Zadanie:')

  if (ws.status === 'overweight') {
    lines.push(`⚠️ Ten pies ma NADWAGĘ — jest o ${Math.abs(ws.diffKg)} kg za ciężki. Zaproponuj DIETĘ ODCHUDZAJĄCĄ.`)
    lines.push(`Cel: bezpieczne schudnięcie do normy ${ws.idealMin}–${ws.idealMax} kg w ciągu 3-6 miesięcy.`)
    lines.push('')
    lines.push('Plan musi zawierać:')
    lines.push('1. **Ocena obecnej diety** — co prawdopodobnie przyczyniło się do nadwagi')
    lines.push('2. **Cel wagowy i plan odchudzania** — docelowa waga, ile kg/miesiąc, jak długo')
    lines.push('3. **Zmniejszona dzienna porcja** — konkretna ilość (gramy) karmy light/odchudzającej')
    lines.push('4. **Rekomendowane karmy light** — 2-3 marki dedykowane do redukcji masy ciała')
    lines.push('5. **Zakaz smakołyków i produktów tuczących** — lista czego absolutnie unikać')
    lines.push('6. **Aktywność fizyczna** — ile ruchu dziennie przyspieszy odchudzanie')
    lines.push('7. **Wskazówki praktyczne** — jak kontrolować porcje, kiedy i ile razy dziennie karmić')
  } else if (ws.status === 'underweight') {
    lines.push(`⚠️ Ten pies ma NIEDOWAGĘ — jest o ${Math.abs(ws.diffKg)} kg za lekki. Zaproponuj DIETĘ WZMACNIAJĄCĄ.`)
    lines.push(`Cel: bezpieczny przyrost masy do normy ${ws.idealMin}–${ws.idealMax} kg.`)
    lines.push('')
    lines.push('Plan musi zawierać:')
    lines.push('1. **Ocena obecnej diety** — ewentualne braki kaloryczne lub niedobory')
    lines.push('2. **Cel wagowy i plan przyrostu** — docelowa waga, jak długo, ile kg/miesiąc')
    lines.push('3. **Zwiększona kaloryczność** — konkretna ilość (gramy) i jak zwiększać porcje stopniowo')
    lines.push('4. **Rekomendowane karmy wysokoenergetyczne** — 2-3 marki bogate w białko i kalorie')
    lines.push('5. **Suplementy wzmacniające** — co warto dodać (olej, jajko, itp.)')
    lines.push('6. **Kiedy martwić się o niedowagę** — sygnały że konieczna wizyta u weterynarza')
    lines.push('7. **Wskazówki praktyczne** — ile razy dziennie karmić, jak zachęcić do jedzenia')
  } else {
    lines.push('✅ Ten pies ma prawidłową wagę — zaproponuj DIETĘ UTRZYMUJĄCĄ ZDROWĄ WAGĘ.')
    lines.push('')
    lines.push('Plan musi zawierać:')
    lines.push('1. **Ocena obecnej diety** (jeśli podano) — plusy i minusy, ewentualne braki')
    lines.push('2. **Zalecana dzienna porcja** — gramy karmy suchej/mokrej dla tej wagi i rasy')
    lines.push('3. **Składniki odżywcze** — ile białka, tłuszczu, węglowodanów powinien mieć w diecie')
    lines.push('4. **Rekomendowane marki/typy karmy** — 2-3 konkretne sugestie dla tej rasy i wieku')
    lines.push('5. **Produkty do unikania** — co jest szkodliwe lub nieodpowiednie dla tej rasy')
    lines.push('6. **Smakołyki i suplementy** — co warto dodać (opcjonalnie)')
    lines.push('7. **Wskazówki praktyczne** — kiedy i jak często karmić')
  }

  lines.push('')
  lines.push('Formatuj odpowiedź czytelnie z nagłówkami (##) i listami punktowanymi. Bądź konkretny i praktyczny.')

  return lines.join('\n')
}

/**
 * Generate an AI nutrition plan for a dog.
 *
 * @param {object} dog            - Dog profile from db.js
 * @param {Array}  weights        - Array of weight records (sorted by date)
 * @param {string} currentFood    - Manually entered food name/description
 * @param {string} scannedLabel   - Text extracted from food packaging OCR
 * @param {string} language       - 'pl' | 'en' | 'de' | 'es'
 * @returns {Promise<string>}     - Markdown-formatted nutrition plan
 */
/**
 * Try one Gemini model. Returns text on success, throws with details on failure.
 */
async function tryModel(model, prompt) {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${GEMINI_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1500 },
    }),
  })

  const json = await res.json()

  if (!res.ok) {
    const code   = json.error?.code    || res.status
    const msg    = json.error?.message || `HTTP ${res.status}`
    const status = json.error?.status  || ''
    throw new Error(`[${model}] ${code} ${status}: ${msg}`)
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error(`[${model}] Pusta odpowiedź od API`)
  return text
}

export async function generateNutritionPlan(dog, weights, foodItems, language = 'pl') {
  if (!GEMINI_KEY) {
    throw new Error('Brak klucza API Gemini. Sprawdź ustawienia VITE_GEMINI_API_KEY.')
  }

  const prompt = buildPrompt(dog, weights, foodItems, language)

  const errors = []
  for (const model of GEMINI_MODELS) {
    try {
      const text = await tryModel(model, prompt)
      console.log(`✅ Gemini OK via ${model}`)
      return text
    } catch (err) {
      console.warn(`⚠️ Gemini model ${model} failed:`, err.message)
      errors.push(err.message)
      // If it's an API key problem (403/invalid key), no point trying other models
      if (err.message.includes('API_KEY_INVALID') ||
          err.message.includes('403') ||
          err.message.includes('PERMISSION_DENIED')) {
        break
      }
    }
  }

  // All models failed — throw combined error for UI display
  const lastErr = errors[errors.length - 1] || 'Nieznany błąd'
  // Friendly messages for common error codes
  if (errors.some(e => e.includes('API_KEY_INVALID') || e.includes('400') && e.includes('key'))) {
    throw new Error('❌ Nieprawidłowy klucz API Gemini. Sprawdź klucz w Google Cloud Console.')
  }
  if (errors.some(e => e.includes('403') || e.includes('PERMISSION_DENIED'))) {
    throw new Error('❌ Brak dostępu do Gemini API. Sprawdź ograniczenia klucza w Google Cloud Console (Application restrictions → usuń lub dodaj domenę).')
  }
  if (errors.some(e => e.includes('429') || e.includes('RESOURCE_EXHAUSTED'))) {
    throw new Error('❌ Przekroczono limit API Gemini (1500 req/dzień). Spróbuj jutro.')
  }
  throw new Error(`❌ Błąd Gemini API: ${lastErr}`)
}
