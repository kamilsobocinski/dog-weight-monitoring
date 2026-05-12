import { createWorker } from 'tesseract.js'

// ─── Google Cloud Vision API ──────────────────────────────────────────────────

const VISION_KEY = import.meta.env.VITE_GOOGLE_VISION_API_KEY

/** Convert a Blob to base64 string (without data: prefix) */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** Run OCR via Google Cloud Vision API (DOCUMENT_TEXT_DETECTION) */
async function runGoogleVisionOCR(imageBlob, onProgress) {
  if (onProgress) onProgress(10)
  const base64 = await blobToBase64(imageBlob)
  if (onProgress) onProgress(30)

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${VISION_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: base64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: { languageHints: ['pl', 'en', 'de', 'es'] },
        }],
      }),
    }
  )
  if (onProgress) onProgress(80)

  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message || 'Google Vision error')

  const text = json.responses?.[0]?.fullTextAnnotation?.text || ''
  if (onProgress) onProgress(100)
  return text
}

/** Run OCR via Tesseract.js (local, free, slower, worse on handwriting) */
async function runTesseractOCR(imageBlob, onProgress) {
  const worker = await createWorker(['pol', 'eng', 'deu'], 1, {
    logger: m => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100))
      }
    },
  })
  try {
    const { data } = await worker.recognize(imageBlob)
    return data.text
  } finally {
    await worker.terminate()
  }
}

/**
 * Run OCR on an image blob.
 * Uses Google Cloud Vision if VITE_GOOGLE_VISION_API_KEY is set,
 * otherwise falls back to Tesseract.js.
 */
export async function runOCR(imageFile, onProgress) {
  if (VISION_KEY) {
    return runGoogleVisionOCR(imageFile, onProgress)
  }
  return runTesseractOCR(imageFile, onProgress)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find all dates in DD.MM.YYYY / DD/MM/YYYY with OCR-noise tolerance.
 * Allows ) ( as separators, 2-digit years, fixes digit-bloat (20725 → 2025).
 */
function fixYear(raw) {
  if (raw.length === 2) return '20' + raw
  if (raw.length === 4) return raw
  // OCR digit-insertion: "20725" → try "20" + last 2 digits = "2025"
  if (raw.length === 5 && raw.startsWith('20')) {
    const candidate = '20' + raw[3] + raw[4]
    const yr = parseInt(candidate)
    if (yr >= 2020 && yr <= 2040) return candidate
  }
  // Last-resort: take first 4 chars
  return raw.slice(0, 4)
}

function findDates(text) {
  const matches = [...text.matchAll(/\b(\d{2})[.\/)(](\d{2})[.\/)(](\d{2,5})\b/g)]
  const results = []
  for (const m of matches) {
    const y = fixYear(m[3])
    const d = parseInt(m[1]), mo = parseInt(m[2]), yr = parseInt(y)
    if (d < 1 || d > 31 || mo < 1 || mo > 12 || yr < 2000 || yr > 2040) continue
    results.push(`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`)
  }
  return results
}

/** First date after a keyword, tolerant separators */
function dateAfterKeyword(text, keywords) {
  for (const kw of keywords) {
    const idx = text.toLowerCase().indexOf(kw.toLowerCase())
    if (idx === -1) continue
    const after = text.slice(idx, idx + 120)
    const m = after.match(/(\d{2})[.\/)(](\d{2})[.\/)(](\d{2,5})/)
    if (m) {
      const y = fixYear(m[3])
      const d = parseInt(m[1]), mo = parseInt(m[2]), yr = parseInt(y)
      if (d < 1 || d > 31 || mo < 1 || mo > 12 || yr < 2000 || yr > 2040) continue
      return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
    }
  }
  return ''
}

/**
 * Value on the SAME LINE after a keyword (keyword: value or keyword value).
 * EU passport tables often have "Label: Value" on one line.
 */
function valueAfterKeyword(text, keywords, maxLen = 50) {
  for (const kw of keywords) {
    const re = new RegExp(
      kw + '[^\\n]{0,15}?[:\\s]+([A-Za-z0-9żźćńółśąęŻŹĆŃÓŁŚĄĘ ().,/-]{2,' + maxLen + '})',
      'i'
    )
    const m = text.match(re)
    if (m) {
      const val = m[1].trim().replace(/[|\\]/g, '').trim()
      if (val.length >= 2) return val
    }
  }
  return ''
}

/**
 * Value on the NEXT LINE after a keyword line.
 * EU passport profile pages print label on one line, value on the next.
 */
function valueOnNextLine(text, keywords, maxLen = 60) {
  const lines = text.split('\n')
  for (const kw of keywords) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].toLowerCase().includes(kw.toLowerCase())) {
        const next = lines[i + 1].trim().replace(/[|\\]/g, '').trim()
        // Skip if next line is empty, another label, or a date
        if (
          next.length >= 2 &&
          next.length <= maxLen &&
          !/^\d{2}[./]/.test(next) &&
          !/^(imię|name|rasa|breed|data|date|płeć|sex|maść|colour|chip|micro)/i.test(next)
        ) return next
      }
    }
  }
  return ''
}

/**
 * Try both same-line and next-line strategies, return whichever finds something.
 */
function valueFlexible(text, keywords, maxLen = 50) {
  return valueAfterKeyword(text, keywords, maxLen) ||
         valueOnNextLine(text, keywords, maxLen)
}

/**
 * Extract a person name (Two Capitalized Words) near keywords.
 * Works for Polish, German, Spanish names.
 */
function nameAfterKeyword(text, keywords) {
  for (const kw of keywords) {
    const idx = text.toLowerCase().indexOf(kw.toLowerCase())
    if (idx === -1) continue
    const after = text.slice(idx, idx + 150)
    // Two capitalized words (incl. Polish diacritics)
    const m = after.match(
      /\b([A-ZŻŹĆŃÓŁŚĄĘ][a-zżźćńółśąę]{2,})\s+([A-ZŻŹĆŃÓŁŚĄĘ][a-zżźćńółśąę]{2,})\b/
    )
    if (m) return `${m[1]} ${m[2]}`
  }
  return ''
}

/** Find 15-digit microchip number */
function findChip(text) {
  // 15 consecutive digits, possibly split by spaces or dashes
  const cleaned = text.replace(/[\s-]/g, '')
  const m = cleaned.match(/\b(\d{15})\b/)
  if (m) return m[1]
  // Also try with spaces: groups like "900 123 000 123 456"
  const spaced = text.match(/\b(\d{3}[\s]?\d{3}[\s]?\d{3}[\s]?\d{3}[\s]?\d{3})\b/)
  if (spaced) return spaced[1].replace(/\s/g, '')
  return ''
}

// ─── Page parsers ─────────────────────────────────────────────────────────────

/**
 * Parse dog identification page:
 *   EU passport Section II / Paszport EU Sekcja II
 *   DE Impfpass Tierbeschreibung / AT Heimtierausweis / ES Identificación
 *
 * Returns: { name, breed, sex, birthdate, colour, chip }
 */
export function parseDogProfile(text) {
  // Name — try same-line first, then next-line
  const name = valueFlexible(text, [
    'Imię', 'Tiername', 'Name des Tieres', 'Nombre', 'Name',
  ])

  // Breed
  const breed = valueFlexible(text, [
    'Rasa', 'Rasse', 'Raza', 'Race', 'Breed',
  ])

  // Colour / coat
  const colour = valueFlexible(text, [
    'Maść', 'Ubarwienie', 'Umaszczenie', 'Farbe', 'Abzeichen', 'Color', 'Couleur', 'Colour',
  ])

  // Chip
  const chip = findChip(text)

  // Birthdate
  const birthdate = dateAfterKeyword(text, [
    'Data urodzenia', 'Geburtsdatum', 'Fecha de nacimiento', 'Date of birth', 'Date de naissance',
    'Geb.', 'Né le',
  ])

  // Sex — check for language variants
  let sex = ''
  if (/samica|suka|female|weiblich|hembra|femelle/i.test(text))    sex = 'female'
  else if (/samiec|pies|male|männlich|macho|mâle|♂/i.test(text))  sex = 'male'

  return { name, breed, sex, birthdate, colour, chip }
}

/**
 * Parse owner details page (not shown in UI currently, kept for future use).
 */
export function parseOwnerDetails(text) {
  const ownerName    = valueFlexible(text, ['Imię właściciela', 'Name', 'Imię'])
  const ownerSurname = valueFlexible(text, ['Nazwisko', 'Surname', 'Nachname', 'Apellido'])
  const address      = valueFlexible(text, ['Adres', 'Address', 'Adresse', 'Dirección'])
  const postCode     = valueFlexible(text, ['Kod pocztowy', 'Post-code', 'PLZ', 'Código postal'], 10)
  const city         = valueFlexible(text, ['Miasto', 'City', 'Stadt', 'Ciudad'])
  const phone        = valueFlexible(text, ['Telefon', 'Numer telefonu', 'Phone', 'Tel.'], 20)
  return { ownerName, ownerSurname, address, postCode, city, phone }
}

/**
 * Parse vaccination page:
 *   EU passport Section IV (Rabies) / Section V (Other)
 *   DE/AT Impfpass Impfungen / ES Cartilla vacunaciones
 *
 * Returns: [{ date, vaccineName, batchNumber, validUntil, vetName, vaccineType }]
 */
export function parseVaccinations(text) {
  const results = []
  const dates = findDates(text)

  // ── Vaccine name ──
  // Compare without spaces: catches "BiocanR" = "Biocan R", "NobivacRabies" etc.
  const norm = s => s.toLowerCase().replace(/\s+/g, '')
  const textNorm = norm(text)
  const KNOWN_VACCINES = [
    // Rabies
    'Rabisin', 'Nobivac Rabies', 'Nobivac', 'Defensor', 'Versiguard', 'Rabigen',
    'Biocan R', 'Biocan', 'Purevax Rabies', 'Purevax', 'Rabdomun', 'Kavak',
    'Rottacell', 'Rabivet',
    // Combined (DHPPI + L)
    'Eurican', 'Canigen', 'Primodog', 'Vanguard', 'Duramune', 'Recombitek',
    'Hexadog', 'Dohyvac', 'Quantum', 'Enduracell', 'Versican',
    'Biocan DHPPi', 'Biocan Lyme', 'Biocan Multi',
    // Leishmania
    'CaniLeish', 'Letifend',
  ]
  let vaccineName = ''
  for (const n of KNOWN_VACCINES) {
    if (textNorm.includes(norm(n))) { vaccineName = n; break }
  }
  if (!vaccineName) {
    vaccineName = valueFlexible(text, [
      'Producent i nazwa', 'Manufacturer and name', 'Hersteller und Name',
      'Nombre vacuna', 'Nombre del producto', 'Impfstoff', 'Vaccine',
    ])
  }

  // ── Batch / lot number ──
  let batchNumber = valueFlexible(text, [
    'Numer partii', 'Nr partii', 'Nr serii', 'Batch', 'Lot', 'Charge', 'Lote',
    'Chargennummer', 'Numéro de lot',
  ], 20)
  if (!batchNumber) {
    // Fallback: any standalone 5-8 digit number is likely a batch/series number
    const bm = text.match(/\b(\d{5,8})\b/)
    if (bm) batchNumber = bm[1]
  }

  // ── Vet name ──
  let vetName = nameAfterKeyword(text, [
    'LEKARZ', 'Lekarz', 'Lekarz wet', 'Weterynarza', 'Weterynarz',
    'Tierarzt', 'TIERARZT', 'Praktischer Tierarzt',
    'VETERINARIAN', 'Veterinarian', 'Authorised vet', 'UPOWAŻNIONY',
    'Veterinario', 'Médico veterinario',
  ])
  if (!vetName) {
    // Fallback: find "Firstname Lastname" pattern after VALID UNTIL / WAŻNE DO section
    const idx = Math.max(
      text.indexOf('VALID UNTIL'), text.indexOf('WAŻNE DO'),
      text.indexOf('gültig bis'), 0
    )
    const after = text.slice(idx, idx + 300)
    const m = after.match(/\b([A-ZŻŹĆŃÓŁŚĄĘ][a-zżźćńółśąę]{2,})\s+([A-ZŻŹĆŃÓŁŚĄĘ][a-zżźćńółśąę]{2,})\b/)
    if (m) vetName = `${m[1]} ${m[2]}`
  }

  // ── Valid-until date ──
  // EU passport: "Ważne od" = valid FROM, "Ważne do" = valid UNTIL (expiry)
  // Also handle MM/YYYY format (e.g. "Termin ważności 08/2027")
  let validUntil = dateAfterKeyword(text, [
    'Ważne do', 'ważne do', 'WAŻNE DO',
    'gültig bis', 'Gültig bis',
    'Valid until', 'VALID UNTIL',
    'Válida hasta', 'Caducidad',
    'valid through',
  ])
  if (!validUntil) {
    // Try MM/YYYY format after "Termin" keywords
    for (const kw of ['Termin waznosci', 'Termin ważności', 'VALID UNTIL', 'WAŻNE DO', 'gültig bis']) {
      const idx = text.toLowerCase().indexOf(kw.toLowerCase())
      if (idx === -1) continue
      const after = text.slice(idx, idx + 80)
      const m = after.match(/\b(\d{2})[/.](\d{4})\b/)
      if (m) {
        const yr = parseInt(m[2])
        if (yr >= 2020 && yr <= 2040) { validUntil = `${m[2]}-${m[1]}-01`; break }
      }
    }
  }
  if (!validUntil) validUntil = dates.length >= 2 ? dates[1] : ''

  // ── Build results ──
  if (dates.length >= 1) {
    results.push({
      vaccineType:  'rabies',
      vaccineName:  vaccineName || '',
      batchNumber:  batchNumber || '',
      date:         dates[0] || '',
      validUntil:   validUntil || '',
      vetName:      vetName || '',
    })
  }
  // Additional vaccination rows (date pairs after the first)
  for (let i = 2; i < dates.length; i += 2) {
    results.push({
      vaccineType: 'rabies',
      vaccineName,
      batchNumber,
      date:        dates[i],
      validUntil:  dates[i + 1] || '',
      vetName,
    })
  }

  return results
}

/**
 * Parse food packaging label.
 * Extracts: brand, productName, ingredients, analysisText (protein%, fat%, etc.)
 *
 * Returns: { brand, productName, ingredients, analysis, fullText }
 * fullText is always the raw OCR text — useful for Gemini context.
 */
export function parseFoodLabel(text) {
  // Brand name: first short line (≤30 chars) that looks like a brand
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  const brand = lines.find(l => l.length >= 2 && l.length <= 30 && /^[A-Za-zżźćńółśąęŻŹĆŃÓŁŚĄĘ\s]+$/.test(l)) || ''

  // Product name: line after brand or containing keywords
  const productName = valueFlexible(text, [
    'Nazwa produktu', 'Product name', 'Produktname', 'Nombre del producto',
    'Pełnoporcjowa', 'Complete', 'Karma',
  ]) || ''

  // Ingredients: text after "Skład" or "Ingredients"
  let ingredients = ''
  for (const kw of ['Skład:', 'Skład', 'Ingredients:', 'Ingredients', 'Zutaten:', 'Zutaten', 'Ingredientes:']) {
    const idx = text.indexOf(kw)
    if (idx !== -1) {
      // Take up to 500 chars, stopping at analysis section keywords
      const raw = text.slice(idx + kw.length, idx + kw.length + 500)
      const stopAt = raw.search(/Składniki analityczne|Analytical constituents|Analytische|Analyse|Wartości odżywcze|Nutrition|Zawartość/i)
      ingredients = (stopAt > 0 ? raw.slice(0, stopAt) : raw).trim().replace(/\s{2,}/g, ' ')
      break
    }
  }

  // Analytical constituents (protein, fat, fibre, moisture)
  let analysis = ''
  for (const kw of ['Składniki analityczne', 'Analytical constituents', 'Analytische Bestandteile', 'Análisis']) {
    const idx = text.indexOf(kw)
    if (idx !== -1) {
      analysis = text.slice(idx, idx + 300).trim().replace(/\s{2,}/g, ' ')
      break
    }
  }

  return { brand, productName, ingredients, analysis, fullText: text }
}

/**
 * Parse antiparasitic / deworming page:
 *   EU passport Section VI (Echinococcus)
 *   DE/AT Entwurmung / ES Desparasitación
 *
 * Strategy 1: lines starting with a date → date + product on same line
 * Strategy 2: date-only line → product on next line
 * Strategy 3: any date in text → look for product name nearby
 *
 * Returns: [{ date, product }]
 */
export function parseAntiparasitic(text) {
  const results = []
  const seen = new Set()

  const addEntry = (date, product) => {
    const key = date + '|' + product
    if (seen.has(key)) return
    seen.add(key)
    if (date && product.length >= 2) results.push({ date, product })
  }

  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Strategy 1: date + product on same line
    const m1 = line.match(/^(\d{2})[.\/)(](\d{2})[.\/)(](\d{2,4})\s+(.+)/)
    if (m1) {
      let y = m1[3]; if (y.length===2) y='20'+y; if(y.length>4) y=y.slice(0,4)
      const yr = parseInt(y)
      if (yr >= 2000 && yr <= 2040) {
        const date = `${y}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
        const product = m1[4].replace(/[|\\]/g,'').replace(/\s{2,}/g,' ').trim()
        addEntry(date, product)
        continue
      }
    }

    // Strategy 2: line is ONLY a date → product on next line
    const m2 = line.match(/^(\d{2})[.\/)(](\d{2})[.\/)(](\d{2,4})$/)
    if (m2 && i + 1 < lines.length) {
      let y = m2[3]; if (y.length===2) y='20'+y; if(y.length>4) y=y.slice(0,4)
      const yr = parseInt(y)
      if (yr >= 2000 && yr <= 2040) {
        const date = `${y}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`
        const product = lines[i+1].trim().replace(/[|\\]/g,'').replace(/\s{2,}/g,' ')
        if (product.length >= 2 && !/^\d{2}[./]/.test(product)) {
          addEntry(date, product)
          i++ // skip next line
        }
      }
    }
  }

  // Strategy 3 fallback: find any date, look for product name after it on same/next non-empty line
  if (results.length === 0) {
    const allDates = findDates(text)
    for (const date of allDates) {
      // Find where this date appears in text
      const dParts = date.split('-') // [YYYY, MM, DD]
      const dateStr = `${dParts[2]}.${dParts[1]}.${dParts[0]}`
      const idx = text.indexOf(dateStr)
      if (idx === -1) continue
      const after = text.slice(idx + dateStr.length, idx + dateStr.length + 80)
      const product = after.split('\n').map(l => l.trim().replace(/[|\\]/g,'')).find(l => l.length >= 3)
      if (product) addEntry(date, product)
    }
  }

  return results
}
