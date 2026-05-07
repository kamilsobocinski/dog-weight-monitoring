import { useState, useEffect, useCallback } from 'react'
import {
  getAllDogs, addDog, updateDog, deleteDogById,
  getWeights, addWeight, deleteWeight
} from '../utils/db'

const SELECTED_KEY = 'dwm-selected-dog-id'

export function useDog() {
  const [dogs, setDogs] = useState([])
  const [selectedDogId, setSelectedDogId] = useState(null)
  const [weights, setWeights] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async (keepDogId) => {
    const allDogs = await getAllDogs()
    setDogs(allDogs)

    let id = keepDogId ?? parseInt(localStorage.getItem(SELECTED_KEY))
    if (!id || !allDogs.find(d => d.id === id)) {
      id = allDogs[0]?.id ?? null
    }
    if (id) localStorage.setItem(SELECTED_KEY, id)
    setSelectedDogId(id)

    if (id) {
      const w = await getWeights(id)
      setWeights(w)
    } else {
      setWeights([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const dog = dogs.find(d => d.id === selectedDogId) ?? null

  const selectDog = useCallback(async (id) => {
    localStorage.setItem(SELECTED_KEY, id)
    setSelectedDogId(id)
    const w = await getWeights(id)
    setWeights(w)
  }, [])

  const saveDogProfile = useCallback(async (data) => {
    if (data.id) {
      const { id, ...rest } = data
      await updateDog(id, rest)
      await reload(id)
    } else {
      const newId = await addDog(data)
      await reload(newId)
    }
  }, [reload])

  const removeDog = useCallback(async (id) => {
    await deleteDogById(id)
    if (id === selectedDogId) localStorage.removeItem(SELECTED_KEY)
    await reload()
  }, [selectedDogId, reload])

  const addWeightEntry = useCallback(async (value, date, note) => {
    if (!selectedDogId) return
    await addWeight(selectedDogId, value, date, note)
    const w = await getWeights(selectedDogId)
    setWeights(w)
  }, [selectedDogId])

  const removeWeight = useCallback(async (id) => {
    await deleteWeight(id)
    if (selectedDogId) {
      const w = await getWeights(selectedDogId)
      setWeights(w)
    }
  }, [selectedDogId])

  return { dog, dogs, weights, loading, selectDog, saveDogProfile, removeDog, addWeightEntry, removeWeight }
}
