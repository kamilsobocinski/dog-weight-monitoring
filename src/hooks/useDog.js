import { useState, useEffect, useCallback } from 'react'
import { getDog, saveDog, getWeights, addWeight, deleteWeight } from '../utils/db'

export function useDog() {
  const [dog, setDog] = useState(null)
  const [weights, setWeights] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const d = await getDog()
    setDog(d)
    if (d) {
      const w = await getWeights(d.id)
      setWeights(w)
    } else {
      setWeights([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const saveDogProfile = useCallback(async (data) => {
    await saveDog(data)
    await reload()
  }, [reload])

  const addWeightEntry = useCallback(async (value, date, note) => {
    if (!dog) return
    await addWeight(dog.id, value, date, note)
    await reload()
  }, [dog, reload])

  const removeWeight = useCallback(async (id) => {
    await deleteWeight(id)
    await reload()
  }, [reload])

  return { dog, weights, loading, saveDogProfile, addWeightEntry, removeWeight, reload }
}
