const APP_ID        = '39d42d06-147f-44c2-a91e-03aa3007eb76'
const SAFARI_WEB_ID = 'web.onesignal.auto.30b8db8e-86b1-4367-8886-055d3d362718'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Run a callback once the OneSignal SDK is ready (times out after ms) */
function withOS(fn, ms = 6000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('OneSignal timeout')), ms)
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (OS) => {
      clearTimeout(t)
      try { resolve(await fn(OS)) } catch (e) { reject(e) }
    })
  })
}

// ── public API ────────────────────────────────────────────────────────────────

/** Call once on app startup */
export function initOneSignal() {
  window.OneSignalDeferred = window.OneSignalDeferred || []
  window.OneSignalDeferred.push(async (OS) => {
    await OS.init({
      appId: APP_ID,
      safari_web_id: SAFARI_WEB_ID,
      notifyButton: { enable: false },   // we show our own UI
      allowLocalhostAsSecureOrigin: true,
    })
  })
}

/** Ask the user for push-notification permission via OneSignal.
 *  Falls back to the native Notification API if OneSignal times out. */
export async function requestPushPermission() {
  try {
    return await withOS(async (OS) => {
      await OS.User.PushSubscription.optIn()
      return !!OS.User.PushSubscription.optedIn
    })
  } catch (e) {
    console.warn('[OneSignal] optIn failed, using native Notification API', e)
    if (!('Notification' in window)) return false
    const perm = await Notification.requestPermission()
    return perm === 'granted'
  }
}

/** Is the user currently subscribed to push? */
export async function isPushSubscribed() {
  try {
    return await withOS(async (OS) => !!OS.User.PushSubscription.optedIn, 3000)
  } catch {
    return Notification.permission === 'granted'
  }
}

/** OneSignal subscription ID for this device */
export async function getSubscriptionId() {
  return withOS(async (OS) => OS.User.PushSubscription.id ?? null)
}

/**
 * Tell our backend to schedule one OneSignal notification.
 * The backend will also store notif-next in the tag so we know when
 * the next delivery is expected.
 */
export async function scheduleNextNotification(intervalDays, notifTime, dogName = '') {
  try {
    const subId = await getSubscriptionId()
    if (!subId) return

    const [h, m] = notifTime.split(':').map(Number)
    const next = new Date()
    next.setDate(next.getDate() + intervalDays)
    next.setHours(h, m, 0, 0)
    if (next <= new Date()) next.setDate(next.getDate() + 1)

    const res = await fetch('/api/schedule-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subId,
        intervalDays,
        notifTime,
        dogName,
        sendAt: next.toISOString(),
      }),
    })

    return res.ok ? next : null
  } catch (e) {
    console.warn('[OneSignal] schedule failed', e)
    return null
  }
}
