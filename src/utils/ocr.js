import { createWorker } from 'tesseract.js'

/**
 * Run OCR on an image file.
 * Languages: Polish + English (EU passport is bilingual).
 * onProgress(0–100) called during recognition.
 */
export async function runOCR(imageFile, onProgress) {
  const worker = await createWorker(['pol', 'eng'], 1, {
    logger: m => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100))
      }
    },
  })
  try {
    const { data } = await worker.recognize(imageFile)
    return data.text
  } finally {
    await worker.terminate()
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize OCR date noise then parse all DD.MM.YYYY / DD/MM/YYYY */
function findDates(text) {
  // Allow ) ( as separators (common OCR errors), allow 2-digit years
  const matches = [...text.matchAll(/\b(\d{2})[.\/)(](\d{2})[.\/)(](\d{2,4})\b/g)]
  const results = []
  for (const m of matches) {
    let y = m[3]
    if (y.length === 2) y = '20' + y
    // Fix OCR digit-bloat e.g. "20725" → "2025"
    if (y.length > 4) y = y.slice(0, 4)
    const d = parseInt(m[1]), mo = parseInt(m[2]), yr = parseInt(y)
    if (d < 1 || d > 31 || mo < 1 || mo > 12 || yr < 2000 || yr > 2040) continue
    results.push(`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`)
  }
  // Also try to catch standalone years near "/" that OCR garbled
  // e.g.  "tp: /2026"  →  try to find a full date nearby
  return results
}

/** First date found after a keyword (case-insensitive), tolerant regex */
function dateAfterKeyword(text, keywords) {
  for (const kw of keywords) {
    const idx = text.toLowerCase().indexOf(kw.toLowerCase())
    if (idx === -1) continue
    const after = text.slice(idx, idx + 100)
    const m = after.match(/(\d{2})[.\/)(](\d{2})[.\/)(](\d{2,4})/)
    if (m) {
      let y = m[3]; if (y.length === 2) y = '20' + y; if (y.length > 4) y = y.slice(0,4)
      return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
    }
  }
  return ''
}

/** First text token after a keyword on the same / next line */
function valueAfterKeyword(text, keywords, maxLen = 40) {
  for (const kw of keywords) {
    const re = new RegExp(kw + '[^\\n]{0,10}?[:\\s]+([A-Za-z0-9żźćńółśąęŻŹĆŃÓŁŚĄĘ ().-]{2,' + maxLen + '})', 'i')
    const m = text.match(re)
    if (m) return m[1].trim()
  }
  return ''
}

/**
 * Try to extract a person name from text near given keywords.
 * Looks for "Firstname Lastname" pattern (two capitalized words).
 */
function nameAfterKeyword(text, keywords) {
  for (const kw of keywords) {
    const idx = text.toLowerCase().indexOf(kw.toLowerCase())
    if (idx === -1) continue
    const after = text.slice(idx, idx + 120)
    // Two capitalized words = likely a name
    const m = after.match(/\b([A-ZŻŹĆŃÓŁŚĄĘ][a-zżźćńółśąę]{2,})\s+([A-ZŻŹĆŃÓŁŚĄĘ][a-zżźćńółśąę]{2,})\b/)
    if (m) return `${m[1]} ${m[2]}`
  }
  return ''
}

/** Find 15-digit microchip number */
function findChip(text) {
  // chip numbers are 15 digits, often grouped or on a sticker line
  const m = text.match(/\b(\d{15})\b/)
  return m ? m[1] : ''
}

// ─── Page parsers ─────────────────────────────────────────────────────────────

/**
 * Parse dog identification page (II. OPIS ZWIERZĘCIA / page 3 or 5)
 * Returns: { name, breed, sex, birthdate, colour, chip }
 */
export function parseDogProfile(text) {
  const name     = valueAfterKeyword(text, ['Imię', 'Name'])
  const breed    = valueAfterKeyword(text, ['Rasa', 'Breed'])
  const colour   = valueAfterKeyword(text, ['Maść', 'Ubarwienie', 'Colour'])
  const chip     = findChip(text)
  const birthdate = dateAfterKeyword(text, ['Data urodzenia', 'Date of birth'])

  // Sex: look for Samica/Suka/Female/Samiec/Pies/Male
  let sex = ''
  if (/samica|suka|female/i.test(text)) sex = 'female'
  else if (/samiec|♂|male/i.test(text))  sex = 'male'

  return { name, breed, sex, birthdate, colour, chip }
}

/**
 * Parse owner details page (I. DANE WŁAŚCICIELA)
 * Returns: { ownerName, ownerSurname, address, postCode, city, phone }
 */
export function parseOwnerDetails(text) {
  const ownerName    = valueAfterKeyword(text, ['Imię', 'Name'])
  const ownerSurname = valueAfterKeyword(text, ['Nazwisko', 'Surname'])
  const address      = valueAfterKeyword(text, ['Adres', 'Address'])
  const postCode     = valueAfterKeyword(text, ['Kod pocztowy', 'Post-code'], 10)
  const city         = valueAfterKeyword(text, ['Miasto', 'City'])
  const phone        = valueAfterKeyword(text, ['Numer telefonu', 'Telephone'], 20)
  return { ownerName, ownerSurname, address, postCode, city, phone }
}

/**
 * Parse rabies vaccination page (V. SZCZEPIENIE PRZECIWKO WŚCIEKLIŹNIE)
 * Returns: [{ date, vaccineName, batchNumber, validUntil, vaccineType: 'rabies' }]
 */
export function parseVaccinations(text) {
  const results = []
  const dates = findDates(text)

  // Try to find vaccine name (common names across EU/DE/AT/ES passports)
  const vaccineNames = [
    'Biocan', 'Nobivac', 'Eurican', 'Rabisin', 'Defensor',
    'Versiguard', 'Rabigen', 'Purevax', 'Vanguard',
    'Primodog', 'Canigen', 'Duramune', 'Recombitek',
    'Dohyvac', 'Hexadog', 'Kavak', 'Rabdomun',
    'Quantum', 'Rottacell', 'Enduracell',
  ]
  let vaccineName = ''
  for (const n of vaccineNames) {
    if (text.toLowerCase().includes(n.toLowerCase())) { vaccineName = n; break }
  }
  // Fallback: line after label
  if (!vaccineName) {
    vaccineName = valueAfterKeyword(text,
      ['Producent i nazwa', 'Manufacturer and name', 'Hersteller', 'Nombre vacuna', 'Vaccine name'])
  }

  // Batch number: often near "Numer partii" / "Batch" / "Charge" / "Lote"
  const batchNumber = valueAfterKeyword(text,
    ['Numer partii', 'Batch', 'Lot', 'Charge', 'Lote', 'Nr partii'], 20)

  // Vet name: look near LEKARZ / Tierarzt / Veterinarian keywords
  const vetName = nameAfterKeyword(text,
    ['LEKARZ', 'Lekarz', 'Tierarzt', 'VETERINARIAN', 'Veterinarian', 'Veterinario', 'Vet'])

  // valid-until: look for second date, or near "Ważne od" / "gültig" / "válida"
  const validUntilFromKw = dateAfterKeyword(text,
    ['Ważne od', 'ważne od', 'gültig bis', 'Valid until', 'Válida hasta', 'Caducidad'])

  // Dates: first = vaccination date, second = valid until (or from keyword)
  if (dates.length >= 1) {
    results.push({
      vaccineType:  'rabies',
      vaccineName:  vaccineName || '',
      batchNumber:  batchNumber || '',
      date:         dates[0] || '',
      validUntil:   validUntilFromKw || dates[1] || '',
      vetName:      vetName || '',
    })
  }
  // Additional rows if multiple date pairs found
  for (let i = 2; i + 1 < dates.length; i += 2) {
    results.push({
      vaccineType: 'rabies', vaccineName, batchNumber,
      date: dates[i], validUntil: dates[i + 1] || '', vetName,
    })
  }

  return results
}

/**
 * Parse deworming / parasite prevention page (ODROBACZANIE / DEWORMING table)
 * Returns: [{ date, product }]
 *
 * The table has two columns: date | product name
 * Strategy: find all lines that start with a date-like pattern.
 */
export function parseAntiparasitic(text) {
  const results = []

  // Split into lines, find lines that start with a date DD.MM.YYYY or DD/MM/YYYY
  const lines = text.split('\n')
  for (const line of lines) {
    const dateMatch = line.match(/^[\s]*(\d{2})[./](\d{2})[./](\d{2,4})(.*)/)
    if (!dateMatch) continue

    const year = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3]
    const date = `${year}-${dateMatch[2]}-${dateMatch[1]}`
    const rest = dateMatch[4].trim()

    // rest should be the product name — clean up OCR noise
    const product = rest
      .replace(/[|\\]/g, '')       // remove OCR artefacts
      .replace(/\s{2,}/g, ' ')     // collapse whitespace
      .trim()

    if (date && product.length >= 2) {
      results.push({ date, product })
    }
  }

  return results
}
