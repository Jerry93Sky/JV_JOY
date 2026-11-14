import { rationalToDecimalExact, type ExactRational } from '@bms/shared/jv'
export type RecordData = Record<string, any>
export const object = (v: unknown): RecordData =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as RecordData) : {}
export const rational = (v: unknown): v is ExactRational => {
  const x = object(v)
  return (
    typeof x.numerator === 'string' &&
    typeof x.denominator === 'string' &&
    /^-?\d+$/.test(x.numerator) &&
    /^\d+$/.test(x.denominator) &&
    x.denominator !== '0'
  )
}
export const exact = (v: unknown): string =>
  rational(v)
    ? (rationalToDecimalExact(v) ?? `${v.numerator}/${v.denominator}`)
    : typeof v === 'string' || typeof v === 'number'
      ? String(v)
      : 'нет данных'
export const numericText = (v: unknown): v is string =>
  typeof v === 'string' && /^[+-]?\d+(?:\.\d+)?$/.test(v)
export const measured = (v: unknown): boolean =>
  numericText(object(v).value) && typeof object(v).unit === 'string'
export const scalar = (v: unknown): string =>
  rational(v)
    ? exact(v)
    : measured(v)
      ? `${object(v).value} ${object(v).unit}`
      : numericText(v) || typeof v === 'number' || typeof v === 'boolean'
        ? String(v)
        : '—'
export const address = (v: unknown): string => {
  const x = object(v)
  return typeof x.sheet === 'string' && typeof x.cell === 'string' ? `${x.sheet}!${x.cell}` : '—'
}
