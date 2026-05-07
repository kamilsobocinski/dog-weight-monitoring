import Dexie from 'dexie'

export const db = new Dexie('DogWeightDB')

db.version(1).stores({
  dogs: '++id, name, breedId, sex, birthdate',
  weights: '++id, dogId, date, value, note',
  settings: 'key'
})

// --- Dogs ---
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
  await db.dogs.delete(id)
}

// legacy: keep for first-run migration
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

// --- Weights ---
export async function addWeight(dogId, value, date, note = '') {
  return db.weights.add({ dogId, value: +value, date, note, createdAt: Date.now() })
}

export async function getWeights(dogId) {
  return db.weights.where('dogId').equals(dogId).sortBy('date')
}

export async function deleteWeight(id) {
  return db.weights.delete(id)
}

// --- Settings ---
export async function getSetting(key) {
  const row = await db.settings.get(key)
  return row ? row.value : null
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value })
}
