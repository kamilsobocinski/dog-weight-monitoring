import {
  doc, collection, setDoc, getDocs, deleteDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  getAllDogs, getAllWeights, getVaccinations, getDewormings, getParasitePrevention,
  getNutritionPlans, getTrainingProfile, getTrainingPlans, getDietHistory,
  addDogRaw, addWeightRaw, addVaccinationRaw, addDewormingRaw, addParasitePreventionRaw,
  addNutritionPlanRaw, saveTrainingProfileRaw, addTrainingPlanRaw, addDietVersionRaw,
  clearAllData,
} from './db'

const SYNC_KEY = 'dogpass_last_sync'
const SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// ─── Check if weekly sync is due ──────────────────────────────────────────────

export function isSyncDue() {
  const last = localStorage.getItem(SYNC_KEY)
  if (!last) return true
  return Date.now() - parseInt(last, 10) > SYNC_INTERVAL_MS
}

export function markSyncDone() {
  localStorage.setItem(SYNC_KEY, Date.now().toString())
}

export function getLastSyncDate() {
  const last = localStorage.getItem(SYNC_KEY)
  return last ? new Date(parseInt(last, 10)) : null
}

// ─── Upload all local data to Firestore ───────────────────────────────────────

export async function uploadBackup(uid) {
  const dogs   = await getAllDogs()
  const batch  = writeBatch(db)
  const userRef = doc(db, 'users', uid)

  // Meta
  batch.set(userRef, { lastBackup: serverTimestamp(), appVersion: '1.8.0' }, { merge: true })

  // Clear existing subcollections by overwriting all docs
  for (const dog of dogs) {
    const dogRef = doc(db, 'users', uid, 'dogs', String(dog.id))
    batch.set(dogRef, sanitize(dog))

    const weights          = await getAllWeights(dog.id)
    const vaccinations     = await getVaccinations(dog.id)
    const dewormings       = await getDewormings(dog.id)
    const parasites        = await getParasitePrevention(dog.id)
    const nutritionPlans   = await getNutritionPlans(dog.id)
    const trainingProfile  = await getTrainingProfile(dog.id)
    const trainingPlans    = await getTrainingPlans(dog.id)
    const dietHistory      = await getDietHistory(dog.id)

    for (const w of weights) {
      batch.set(doc(db, 'users', uid, 'weights', String(w.id)), sanitize(w))
    }
    for (const v of vaccinations) {
      batch.set(doc(db, 'users', uid, 'vaccinations', String(v.id)), sanitize(v))
    }
    for (const d of dewormings) {
      batch.set(doc(db, 'users', uid, 'dewormings', String(d.id)), sanitize(d))
    }
    for (const p of parasites) {
      batch.set(doc(db, 'users', uid, 'parasitePrevention', String(p.id)), sanitize(p))
    }
    for (const n of nutritionPlans) {
      batch.set(doc(db, 'users', uid, 'nutritionPlans', String(n.id)), sanitize(n))
    }
    if (trainingProfile) {
      batch.set(doc(db, 'users', uid, 'trainingProfiles', String(dog.id)), sanitize(trainingProfile))
    }
    for (const tp of trainingPlans) {
      batch.set(doc(db, 'users', uid, 'trainingPlans', String(tp.id)), sanitize(tp))
    }
    for (const dh of dietHistory) {
      batch.set(doc(db, 'users', uid, 'dogDiets', String(dh.id)), sanitize(dh))
    }
  }

  await batch.commit()
  markSyncDone()
}

// ─── Download backup from Firestore and restore locally ───────────────────────

export async function downloadBackup(uid) {
  const snap = async (col) => {
    const s = await getDocs(collection(db, 'users', uid, col))
    return s.docs.map(d => d.data())
  }

  const [dogs, weights, vaccinations, dewormings, parasites, nutritionPlans, trainingProfiles, trainingPlans, dogDiets] = await Promise.all([
    snap('dogs'), snap('weights'), snap('vaccinations'),
    snap('dewormings'), snap('parasitePrevention'), snap('nutritionPlans'),
    snap('trainingProfiles'), snap('trainingPlans'), snap('dogDiets'),
  ])

  if (!dogs.length) return false  // no backup found

  await clearAllData()

  for (const d of dogs)             await addDogRaw(d)
  for (const w of weights)          await addWeightRaw(w)
  for (const v of vaccinations)     await addVaccinationRaw(v)
  for (const d of dewormings)       await addDewormingRaw(d)
  for (const p of parasites)        await addParasitePreventionRaw(p)
  for (const n of nutritionPlans)   await addNutritionPlanRaw(n)
  for (const tp of trainingProfiles) await saveTrainingProfileRaw(tp)
  for (const tp of trainingPlans)   await addTrainingPlanRaw(tp)
  for (const dh of dogDiets)        await addDietVersionRaw(dh)

  markSyncDone()
  return true
}

// ─── Check if cloud backup exists ─────────────────────────────────────────────

export async function hasCloudBackup(uid) {
  const s = await getDocs(collection(db, 'users', uid, 'dogs'))
  return !s.empty
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Remove undefined values that Firestore rejects */
function sanitize(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  )
}
