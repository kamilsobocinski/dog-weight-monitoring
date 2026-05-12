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
 * Build a detailed prompt for Gemini with ALL available dog data.
 */
function buildPrompt(dog, weights, foodItems, language = 'pl', healthData = {}) {
  const latestWeight = weights.length > 0 ? weights[weights.length - 1].value : null
  const age = calcAge(dog?.birthdate)
  const ageMonths = calcAgeMonths(dog?.birthdate)
  const ws = calcWeightStatus(dog, weights)

  const langInstructions = {
    pl: 'Odpowiedz wyłącznie po polsku.',
    en: 'Reply in English only.',
    de: 'Antworte ausschließlich auf Deutsch.',
    es: 'Responde solo en español.',
  }
  const langNote = langInstructions[language] || langInstructions.pl

  // ── Determine life stage ──
  let lifeStage = 'dorosły'
  if (ageMonths !== null) {
    if (ageMonths < 12) lifeStage = 'szczenię'
    else if (ageMonths < 18) lifeStage = 'młody dorosły (rośnie)'
    else if (ageMonths > 84) lifeStage = 'senior (7+ lat)'
  }

  // ── Determine size category from breed norm ──
  let sizeCategory = ''
  if (ws.idealMax !== undefined) {
    if (ws.idealMax <= 5) sizeCategory = 'miniaturowy (do 5 kg)'
    else if (ws.idealMax <= 10) sizeCategory = 'mały (5–10 kg)'
    else if (ws.idealMax <= 25) sizeCategory = 'średni (10–25 kg)'
    else if (ws.idealMax <= 45) sizeCategory = 'duży (25–45 kg)'
    else sizeCategory = 'olbrzym (powyżej 45 kg)'
  }

  const lines = [
    `Jesteś weterynarzem-dietetykiem i ekspertem od żywienia psów. ${langNote}`,
    '',
    '## PEŁNY PROFIL PSA:',
    dog?.name      ? `- Imię: **${dog.name}**` : '',
    dog?.breedName ? `- Rasa: **${dog.breedName}**` : '',
    dog?.sex       ? `- Płeć: **${dog.sex === 'female' ? 'suka' : 'pies (samiec)'}**` : '',
    age            ? `- Wiek: **${age}** (etap życia: ${lifeStage})` : '',
    sizeCategory   ? `- Kategoria wielkości: ${sizeCategory}` : '',
  ].filter(Boolean)

  // ── Weight status vs breed norm ──
  if (ws.status !== 'unknown') {
    lines.push(`- Norma wagowa dla tej rasy/płci/wieku: **${ws.idealMin}–${ws.idealMax} kg**`)
    lines.push(`- Aktualna waga: **${latestWeight} kg**`)
    if (ws.status === 'overweight') {
      lines.push(`- ⚠️ NADWAGA: o ${Math.abs(ws.diffKg)} kg za dużo (+${Math.abs(ws.diffPct)}% powyżej normy)`)
    } else if (ws.status === 'underweight') {
      lines.push(`- ⚠️ NIEDOWAGA: o ${Math.abs(ws.diffKg)} kg za mało (${Math.abs(ws.diffPct)}% poniżej normy)`)
    } else {
      lines.push(`- ✅ Waga prawidłowa (${ws.diffKg >= 0 ? '+' : ''}${ws.diffKg} kg od środka normy)`)
    }
  } else if (latestWeight) {
    lines.push(`- Aktualna waga: **${latestWeight} kg** (brak danych wzorcowych dla rasy)`)
  }

  lines.push('')

  // ── Full weight history ──
  if (weights.length > 0) {
    lines.push('## HISTORIA WAGI (wszystkie pomiary):')
    // Show all measurements, newest first
    const sorted = [...weights].sort((a, b) => new Date(b.date) - new Date(a.date))
    sorted.forEach(w => {
      const d = new Date(w.date).toLocaleDateString('pl-PL', { day:'2-digit', month:'2-digit', year:'numeric' })
      const note = w.note ? ` — notatka: "${w.note}"` : ''
      lines.push(`- ${d}: **${w.value} kg**${note}`)
    })

    if (weights.length >= 2) {
      const oldest = weights[0], newest = weights[weights.length - 1]
      const diffKg = (newest.value - oldest.value).toFixed(2)
      const spanDays = Math.round((new Date(newest.date) - new Date(oldest.date)) / (1000*60*60*24))
      const spanMonths = (spanDays / 30.44).toFixed(1)
      const sign = diffKg > 0 ? '+' : ''
      const kgPerMonth = spanDays > 0 ? (diffKg / (spanDays / 30.44)).toFixed(2) : 0
      lines.push(`- Zmiana łączna: **${sign}${diffKg} kg** przez ${spanMonths} miesięcy (${sign}${kgPerMonth} kg/miesiąc)`)
    }
    lines.push('')
  }

  // ── Health records ──
  const { vaccinations = [], dewormings = [], parasitePrevention = [] } = healthData

  if (dewormings.length > 0 || vaccinations.length > 0 || parasitePrevention.length > 0) {
    lines.push('## DANE ZDROWOTNE:')

    if (dewormings.length > 0) {
      const last = [...dewormings].sort((a,b) => new Date(b.date) - new Date(a.date))[0]
      const d = new Date(last.date).toLocaleDateString('pl-PL', { day:'2-digit', month:'2-digit', year:'numeric' })
      const monthsAgo = Math.round((Date.now() - new Date(last.date)) / (1000*60*60*24*30.44))
      lines.push(`- Ostatnie odrobaczanie: ${d} (${monthsAgo} mies. temu)${monthsAgo > 3 ? ' — ⚠️ może być wskazane odrobaczenie (wpływa na wchłanianie składników)' : ''}`)
    } else {
      lines.push('- Odrobaczanie: brak danych (ważne dla prawidłowego wchłaniania składników odżywczych)')
    }

    if (vaccinations.length > 0) {
      const last = [...vaccinations].sort((a,b) => new Date(b.date) - new Date(a.date))[0]
      const d = new Date(last.date).toLocaleDateString('pl-PL', { day:'2-digit', month:'2-digit', year:'numeric' })
      lines.push(`- Ostatnie szczepienie: ${d} (${last.vaccineType || 'rodzaj nieznany'})`)
    }

    if (parasitePrevention.length > 0) {
      const last = [...parasitePrevention].sort((a,b) => new Date(b.date) - new Date(a.date))[0]
      const d = new Date(last.date).toLocaleDateString('pl-PL', { day:'2-digit', month:'2-digit', year:'numeric' })
      lines.push(`- Ostatnia ochrona przed pasożytami zewnętrznymi: ${d}`)
    }

    lines.push('')
  }

  // ── Current food ──
  const foodText = formatFoodForPrompt(foodItems)
  if (foodText) {
    lines.push('## OBECNA DIETA PSA:')
    lines.push(foodText)
    lines.push('')
  } else {
    lines.push('## OBECNA DIETA PSA:')
    lines.push('- Brak danych o obecnej diecie — zaproponuj dietę od podstaw dla tej rasy, płci i wieku.')
    lines.push('')
  }

  // ── Task — adapt based on weight status ──
  lines.push('## ZADANIE:')

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
  lines.push('## Ważne instrukcje formatowania:')
  lines.push('- NIE pisz wstępu ani ogólnych zdań o tym, że "AI pomoże" lub "przedstawię plan".')
  lines.push('- Zacznij BEZPOŚREDNIO od pierwszego nagłówka (## 1. ...)')
  lines.push('- Każdy punkt = konkretna liczba, dawka, marka lub zalecenie. Zero ogólników.')
  lines.push('- Używaj nagłówków ## i list - (myślnik) dla czytelności.')
  lines.push('- Odpowiedź musi być kompletna — wygeneruj WSZYSTKIE 7 punktów planu.')

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
      generationConfig: { temperature: 0.6, maxOutputTokens: 4096 },
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

/**
 * Recognize a dog food packaging photo using Gemini Vision.
 * Returns { brand, productName, ingredients, protein, fat, fibre, moisture, kcalPer100g, feedingNote }
 */
export async function recognizeFoodPackaging(imageDataUrl, language = 'pl') {
  if (!GEMINI_KEY) throw new Error('Brak klucza Gemini API')

  const base64   = imageDataUrl.split(',')[1]
  const mimeType = imageDataUrl.match(/data:(.*?);/)?.[1] || 'image/jpeg'

  const langNote = { pl: 'po polsku', en: 'in English', de: 'auf Deutsch', es: 'en español' }[language] || 'po polsku'

  const prompt = `To jest opakowanie karmy dla psa. Odczytaj i zwróć dane ${langNote} jako czysty JSON (bez markdown, bez komentarzy):
{
  "brand": "nazwa marki (np. Royal Canin, Purina, Hill's, Animonda)",
  "productName": "pełna nazwa produktu z opakowania",
  "ingredients": "pierwsze 5-8 składników z listy składów",
  "protein": <liczba % lub null>,
  "fat": <liczba % lub null>,
  "fibre": <liczba % lub null>,
  "moisture": <liczba % lub null>,
  "kcalPer100g": <liczba kcal/100g lub null>,
  "feedingNote": "zalecane dzienne porcje jeśli widoczne, lub null"
}
Jeśli czegoś nie widać — wstaw null. Zwróć WYŁĄCZNIE sam JSON.`

  const errors = []
  for (const model of GEMINI_MODELS) {
    try {
      const url = `${GEMINI_BASE}/${model}:generateContent?key=${GEMINI_KEY}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: prompt },
          ]}],
          generationConfig: { temperature: 0.1, maxOutputTokens: 600 },
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg = json.error?.message || `HTTP ${res.status}`
        throw new Error(`[${model}] ${msg}`)
      }
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error(`[${model}] Pusta odpowiedź`)

      // Strip markdown fences, then extract the first {...} block
      const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const jsonMatch = stripped.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error(`[${model}] Brak JSON w odpowiedzi: ${stripped.slice(0, 120)}`)
      return JSON.parse(jsonMatch[0])
    } catch (err) {
      console.warn('Scan model failed:', model, err.message)
      errors.push(err.message)
      if (err.message.includes('API_KEY_INVALID') || err.message.includes('403') || err.message.includes('PERMISSION_DENIED')) break
    }
  }
  throw new Error('Rozpoznawanie nieudane: ' + (errors[errors.length - 1] || 'nieznany błąd'))
}

export async function generateNutritionPlan(dog, weights, foodItems, language = 'pl', healthData = {}) {
  if (!GEMINI_KEY) {
    throw new Error('Brak klucza API Gemini. Sprawdź ustawienia VITE_GEMINI_API_KEY.')
  }

  const prompt = buildPrompt(dog, weights, foodItems, language, healthData)

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
