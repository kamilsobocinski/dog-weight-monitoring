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

// v3 — nutrition plans (AI-generated diet advice)
db.version(3).stores({
  dogs:               '++id, name, breedId, sex, birthdate',
  weights:            '++id, dogId, date, value, note',
  settings:           'key',
  vaccinations:       '++id, dogId, date, vaccineType',
  dewormings:         '++id, dogId, date',
  parasitePrevention: '++id, dogId, date',
  nutritionPlans:     '++id, dogId, generatedAt',
})

// v4 — training: interview profile (1 per dog) + AI-generated plans + feedback
db.version(4).stores({
  dogs:               '++id, name, breedId, sex, birthdate',
  weights:            '++id, dogId, date, value, note',
  settings:           'key',
  vaccinations:       '++id, dogId, date, vaccineType',
  dewormings:         '++id, dogId, date',
  parasitePrevention: '++id, dogId, date',
  nutritionPlans:     '++id, dogId, generatedAt',
  trainingProfiles:   'dogId',
  trainingPlans:      '++id, dogId, generatedAt',
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
  await db.nutritionPlans.where('dogId').equals(id).delete()
  await db.trainingProfiles.where('dogId').equals(id).delete()
  await db.trainingPlans.where('dogId').equals(id).delete()
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

// ─── Nutrition Plans ──────────────────────────────────────────────────────────
//
// Record shape:
// { id, dogId, generatedAt, plan, currentFood, scannedLabel }

export async function getNutritionPlans(dogId) {
  return db.nutritionPlans.where('dogId').equals(dogId).reverse().sortBy('generatedAt')
}

export async function addNutritionPlan(record) {
  return db.nutritionPlans.add({ ...record, generatedAt: Date.now() })
}

export async function deleteNutritionPlan(id) {
  return db.nutritionPlans.delete(id)
}

export async function addNutritionPlanRaw(n) {
  return db.nutritionPlans.put(n)
}

// ─── Training Profiles ────────────────────────────────────────────────────────
// One profile per dog (dogId is primary key). Use put() to upsert.

export async function getTrainingProfile(dogId) {
  return db.trainingProfiles.get(dogId)
}

export async function saveTrainingProfile(profile) {
  return db.trainingProfiles.put(profile)
}

export async function saveTrainingProfileRaw(p) {
  return db.trainingProfiles.put(p)
}

// ─── Training Plans ───────────────────────────────────────────────────────────
// { id, dogId, generatedAt, planText, feedbackText, feedbackRating, feedbackDate, isCompleted }

export async function getTrainingPlans(dogId) {
  return db.trainingPlans.where('dogId').equals(dogId).reverse().sortBy('generatedAt')
}

export async function addTrainingPlan(record) {
  return db.trainingPlans.add({ ...record, generatedAt: Date.now() })
}

export async function updateTrainingPlan(id, patch) {
  return db.trainingPlans.update(id, patch)
}

export async function deleteTrainingPlan(id) {
  return db.trainingPlans.delete(id)
}

export async function addTrainingPlanRaw(p) {
  return db.trainingPlans.put(p)
}

// ─── Raw insert helpers (for restore from cloud backup) ──────────────────────
// These bypass auto-increment and preserve original IDs.

export async function addDogRaw(dog) {
  return db.dogs.put(dog)
}

export async function addWeightRaw(w) {
  return db.weights.put(w)
}

export async function addVaccinationRaw(v) {
  return db.vaccinations.put(v)
}

export async function addDewormingRaw(d) {
  return db.dewormings.put(d)
}

export async function addParasitePreventionRaw(p) {
  return db.parasitePrevention.put(p)
}

export async function getAllWeights(dogId) {
  return db.weights.where('dogId').equals(dogId).sortBy('date')
}

/** Wipe all local data (used before restoring from cloud) */
export async function clearAllData() {
  await db.dogs.clear()
  await db.weights.clear()
  await db.vaccinations.clear()
  await db.dewormings.clear()
  await db.parasitePrevention.clear()
  await db.nutritionPlans.clear()
  await db.trainingProfiles.clear()
  await db.trainingPlans.clear()
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSetting(key) {
  const row = await db.settings.get(key)
  return row ? row.value : null
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value })
}
