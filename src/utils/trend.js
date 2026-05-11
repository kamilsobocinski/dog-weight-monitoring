/**
 * Calculates a REAL weight trend using ordinary-least-squares linear regression
 * over the last N measurements (time-based, not just "last 2 points").
 *
 * @param {Array<{date: string, value: number}>} weights – sorted ascending by date
 * @returns {{ direction: 'up'|'down'|'stable', kgPerMonth: number, n: number }}
 */
export function calcRealTrend(weights) {
  if (!weights || weights.length === 0) {
    return { direction: 'stable', kgPerMonth: 0, n: 0 }
  }
  if (weights.length === 1) {
    return { direction: 'stable', kgPerMonth: 0, n: 1 }
  }

  // Use last 10 measurements (enough for a reliable trend)
  const recent = weights.slice(-Math.min(10, weights.length))
  const n = recent.length

  // Convert dates to "days from the first measurement in window"
  const t0 = new Date(recent[0].date).getTime()
  const points = recent.map(w => ({
    x: (new Date(w.date).getTime() - t0) / 86_400_000, // ms → days
    y: w.value,
  }))

  const xSpan = points[n - 1].x - points[0].x

  // All measurements on the same day → fall back to direct difference
  if (xSpan < 1) {
    const kgPerMonth = (recent[n - 1].value - recent[0].value) * 30
    return {
      direction: Math.abs(kgPerMonth) < 0.2 ? 'stable' : kgPerMonth > 0 ? 'up' : 'down',
      kgPerMonth: +kgPerMonth.toFixed(2),
      n,
    }
  }

  // Ordinary least-squares: slope = (n·Σxy - Σx·Σy) / (n·Σx² - (Σx)²)
  const sumX  = points.reduce((a, p) => a + p.x, 0)
  const sumY  = points.reduce((a, p) => a + p.y, 0)
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0)
  const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0)

  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return { direction: 'stable', kgPerMonth: 0, n }

  const slopePerDay = (n * sumXY - sumX * sumY) / denom
  const kgPerMonth  = slopePerDay * 30

  // Threshold: changes < 0.15 kg/month are considered noise → "stable"
  const THRESHOLD = 0.15
  const direction = kgPerMonth > THRESHOLD ? 'up' : kgPerMonth < -THRESHOLD ? 'down' : 'stable'

  return { direction, kgPerMonth: +kgPerMonth.toFixed(2), n }
}
