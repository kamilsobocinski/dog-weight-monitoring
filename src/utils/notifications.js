import { getSetting, setSetting } from './db'

/**
 * Calculate the next notification timestamp.
 * Result = (today + intervalDays days) at HH:mm.
 * If that moment is somehow already in the past, add one more day.
 */
export function calcNextNotif(intervalDays, time = '08:00') {
  const [h, m] = time.split(':').map(Number)
  const next = new Date()
  next.setDate(next.getDate() + intervalDays)
  next.setHours(h, m, 0, 0)
  if (next <= new Date()) next.setDate(next.getDate() + 1)
  return next
}

/**
 * Called on app open (and via setTimeout while app stays open).
 * If a scheduled notification is past-due, shows it and reschedules.
 * Returns the Date of the NEXT scheduled notification (or null).
 */
export async function checkAndShowNotification(dog) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return null

  const days = await getSetting('notif-interval')
  if (!days || days === 0) return null

  const time    = (await getSetting('notif-time')) || '08:00'
  const nextStr = await getSetting('notif-next')

  if (nextStr && Date.now() >= new Date(nextStr).getTime()) {
    // Due — show it
    try {
      new Notification('🐾 DogPass', {
        body: dog ? `Time to weigh ${dog.name}! 🐾` : 'Time to weigh your dog! 🐾',
        icon: '/icons/icon-192.png',
      })
    } catch (_) {
      // Notification API may be unavailable in some contexts (e.g. iOS page scope)
    }
    // Reschedule
    const next = calcNextNotif(days, time)
    await setSetting('notif-next', next.toISOString())
    return next
  }

  return nextStr ? new Date(nextStr) : null
}
