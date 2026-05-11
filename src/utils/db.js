import Dexie from 'dexie'

export const db = new Dexie('DogWeightDB')

// v1 — original schema (weight tracking)
db.version(1).stores({
  dogs:     '++id, name, breedId, sex, birthdate',
  weights:  '++id, dogId, date, value, note',
  settings: 'key',
})

// v2 — health modules: vaccinations, deworming, parasite prevention
//       dogs table gets extra fields (chip, owner, vet, photo) — no migration needed,
//       Dexie stores any fields; only indexed columns go in the schema string.
db.version(2).stores({
  dogs:               '++id, name, breedId, sex, birthdate',
  weights:            '++id, dogId, date, value, note',
  settings:           'key',
  vaccinations:       '++id, dogId, date, vaccineType',
  dewormings:         '++id, dogId, date',
  parasitePrevention: '++id, dogId, date',
})

// ─── Dogs ────────────────────────────────────────────────────────────────────

export async function getAllDogs() {
  return db.dogs.toArray()
}

export async function getDogById(id) {
  return db.dogs.get(id)
}

export async function addDog(dog) {
  return db.dogs.add(dog)
}

export async function updateDog(id, dog) {
  return db.dogs.update(id, dog)
}

export async function deleteDogById(id) {
  await db.weights.where('dogId').equals(id).delete()
  await db.vaccinations.where('dogId').equals(id).delete()
  await db.dewormings.where('dogId').equals(id).delete()
  await db.parasitePrevention.where('dogId').equals(id).delete()
  await db.dogs.delete(id)
}

// legacy helpers kept for first-run compatibility
export async function saveDog(dog) {
  const existing = await db.dogs.toArray()
  if (existing.length > 0) {
    await db.dogs.update(existing[0].id, dog)
    return existing[0].id
  }
  return db.dogs.add(dog)
}

export async function getDog() {
  const all = await db.dogs.toArray()
  return all[0] || null
}

// ─── Weights ─────────────────────────────────────────────────────────────────

export async function addWeight(dogId, value, date, note = '') {
  return db.weights.add({ dogId, value: +value, date, note, createdAt: Date.now() })
}

export async function getWeights(dogId) {
  return db.weights.where('dogId').equals(dogId).sortBy('date')
}

export async function deleteWeight(id) {
  return db.weights.delete(id)
}

// ─── Vaccinations ─────────────────────────────────────────────────────────────
//
// Record shape:
// { id, dogId, date, vaccineType, vaccineName, batchNumber, validUntil, vetName, note }
//
// vaccineType: 'rabies' | 'combined' | 'other'

export async function getVaccinations(dogId) {
  return db.vaccinations.where('dogId').equals(dogId).sortBy('date')
}

export async function addVaccination(record) {
  return db.vaccinations.add({ ...record, createdAt: Date.now() })
}

export async function updateVaccination(id, record) {
  return db.vaccinations.update(id, record)
}

export async function deleteVaccination(id) {
  return db.vaccinations.delete(id)
}

// ─── Dewormings ───────────────────────────────────────────────────────────────
//
// Record shape:
// { id, dogId, date, product, activeIngredient, doseAmount, doseUnit,
//   weightAtDose, reaction, reactionNote, vetName, note, nextDue }
//
// reaction: null | 'none' | 'diarrhea' | 'vomiting' | 'lethargy' | 'other'

export async function getDewormings(dogId) {
  return db.dewormings.where('dogId').equals(dogId).sortBy('date')
}

export async function addDeworming(record) {
  return db.dewormings.add({ ...record, createdAt: Date.now() })
}

export async function updateDeworming(id, record) {
  return db.dewormings.update(id, record)
}

export async function deleteDeworming(id) {
  return db.dewormings.delete(id)
}

// ─── Parasite Prevention (tick / flea) ───────────────────────────────────────
//
// Record shape:
// { id, dogId, date, product, activeIngredient, productClass,
//   preventionType, doseAmount, doseUnit, weightAtDose,
//   reaction, reactionNote, vetName, note, nextDue }
//
// preventionType: 'tick' | 'flea' | 'tick+flea' | 'tick+flea+worm'
// reaction: null | 'none' | 'diarrhea' | 'vomiting' | 'lethargy' | 'other'

export async function getParasitePrevention(dogId) {
  return db.parasitePrevention.where('dogId').equals(dogId).sortBy('date')
}

export async function addParasitePrevention(record) {
  return db.parasitePrevention.add({ ...record, createdAt: Date.now() })
}

export async function updateParasitePrevention(id, record) {
  return db.parasitePrevention.update(id, record)
}

export async function deleteParasitePrevention(id) {
  return db.parasitePrevention.delete(id)
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSetting(key) {
  const row = await db.settings.get(key)
  return row ? row.value : null
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value })
}
