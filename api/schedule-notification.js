const APP_ID = '39d42d06-147f-44c2-a91e-03aa3007eb76'

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { subId, intervalDays, notifTime, dogName, sendAt } = req.body ?? {}

  if (!subId || !intervalDays || !notifTime || !sendAt) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const apiKey = process.env.ONESIGNAL_REST_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Server not configured (missing ONESIGNAL_REST_API_KEY)' })
  }

  const dog = dogName || 'your dog'

  const payload = {
    app_id: APP_ID,
    // subId from SDK v16 maps to player_id in v1 REST API
    include_player_ids: [subId],
    headings: { en: '🐾 Dog Weight Monitoring' },
    contents: {
      en: `Time to weigh ${dog}! 🐾`,
      pl: `Czas na ważenie — ${dog}! 🐾`,
      de: `Zeit zum Wiegen — ${dog}! 🐾`,
      es: `¡Hora de pesar a ${dog}! 🐾`,
    },
    // When the notification is tapped, payload lets App.jsx reschedule the next one
    data: { action: 'weight_reminder', intervalDays, notifTime, dogName },
    send_after: sendAt,                // ISO-8601, OneSignal accepts this format
    isAnyWeb: true,
  }

  try {
    const osRes = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    const osData = await osRes.json()

    if (!osRes.ok || osData.errors) {
      console.error('[OneSignal API error]', JSON.stringify(osData))
      return res.status(502).json({ error: 'OneSignal rejected the request', detail: osData })
    }

    return res.status(200).json({ ok: true, notificationId: osData.id, sendAt })
  } catch (err) {
    console.error('[schedule-notification] fetch error', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
