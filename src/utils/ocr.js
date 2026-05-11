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

/** Find all dates in DD.MM.YYYY or DD/MM/YYYY format */
function findDates(text) {
  const matches = [...text.matchAll(/\b(\d{2})[./](\d{2})[./](\d{4})\b/g)]
  return matches.map(m => `${m[3]}-${m[2]}-${m[1]}`) // → ISO YYYY-MM-DD
}

/** First date found after a keyword (case-insensitive) */
function dateAfterKeyword(text, keywords) {
  for (const kw of keywords) {
    const idx = text.toLowerCase().indexOf(kw.toLowerCase())
    if (idx === -1) continue
    const after = text.slice(idx, idx + 80)
    const m = after.match(/(\d{2})[./](\d{2})[./](\d{4})/)
    if (m) return `${m[3]}-${m[2]}-${m[1]}`
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

  // Try to find vaccine name (common names)
  const vaccineNames = ['Biocan', 'Nobivac', 'Eurican', 'Rabisin', 'Defensor',
    'Versiguard', 'Rabigen', 'Purevax', 'Vanguard']
  let vaccineName = ''
  for (const n of vaccineNames) {
    if (text.toLowerCase().includes(n.toLowerCase())) { vaccineName = n; break }
  }
  // Fallback: line after "Producent i nazwa" label
  if (!vaccineName) {
    vaccineName = valueAfterKeyword(text, ['Producent i nazwa', 'Manufacturer', 'Vaccine'])
  }

  // Batch number: often near "Numer partii" / "Batch"
  const batchNumber = valueAfterKeyword(text, ['Numer partii', 'Batch', 'Lot'], 20)

  // Dates: first = vaccination date, second = valid until
  if (dates.length >= 1) {
    results.push({
      vaccineType:  'rabies',
      vaccineName:  vaccineName || '',
      batchNumber:  batchNumber || '',
      date:         dates[0] || '',
      validUntil:   dates[1] || '',
      vetName:      '',
    })
  }
  // If more date pairs found, add additional entries
  if (dates.length >= 3) {
    results.push({ vaccineType: 'rabies', vaccineName, batchNumber, date: dates[2], validUntil: dates[3] || '', vetName: '' })
  }
  if (dates.length >= 5) {
    results.push({ vaccineType: 'rabies', vaccineName, batchNumber, date: dates[4], validUntil: dates[5] || '', vetName: '' })
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
