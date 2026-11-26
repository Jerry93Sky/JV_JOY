import { createHash } from 'node:crypto'

export function stableJson(value: unknown): string {
  const normalize = (v: unknown): unknown => Array.isArray(v) ? v.map(normalize)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([k, x]) => [k, normalize(x)]))
      : v
  return JSON.stringify(normalize(value))
}

export const contentDigest = (value: unknown) => createHash('sha256').update(stableJson(value)).digest('hex')

export function parseProposalTerms(terms: unknown) {
  if (!terms || typeof terms !== 'object' || Array.isArray(terms)) return null
  const raw = terms as Record<string, unknown>
  const keys = ['recipient', 'requisites', 'payment', 'timeframe', 'delivery']
  if (Object.keys(raw).some(key => !keys.includes(key))) return null
  const clean: Record<string, string> = {}
  for (const key of keys) {
    const value = raw[key]
    if (typeof value !== 'string' || !value.trim() || value.length > 2000) return null
    clean[key] = value.trim()
  }
  return clean
}
