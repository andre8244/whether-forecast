/** European AQI bands (EEA), labelled in Italian. */

export type AqiBand = 'buona' | 'discreta' | 'moderata' | 'scarsa' | 'molto scarsa' | 'pessima'

export interface AqiDescription {
  band: AqiBand
  token: string
  advice: string
}

const BANDS: { max: number; band: AqiBand; token: string; advice: string }[] = [
  { max: 20, band: 'buona', token: 'var(--aqi-1)', advice: 'Aria pulita, nessuna precauzione.' },
  { max: 40, band: 'discreta', token: 'var(--aqi-2)', advice: 'Qualità accettabile per tutti.' },
  { max: 60, band: 'moderata', token: 'var(--aqi-3)', advice: 'I soggetti sensibili riducano gli sforzi prolungati all’aperto.' },
  { max: 80, band: 'scarsa', token: 'var(--aqi-4)', advice: 'Limitare l’attività fisica intensa all’aperto.' },
  { max: 100, band: 'molto scarsa', token: 'var(--aqi-5)', advice: 'Evitare l’attività fisica all’aperto.' },
]

const WORST = {
  band: 'pessima' as AqiBand,
  token: 'var(--aqi-6)',
  advice: 'Restare in casa quando possibile.',
}

export function describeAqi(value: number | null | undefined): AqiDescription | null {
  if (value === null || value === undefined) return null
  const match = BANDS.find((entry) => value <= entry.max)
  const { band, token, advice } = match ?? WORST
  return { band, token, advice }
}
