import type { DecimalString } from './types.ts'

export interface ExactRational { readonly numerator: string; readonly denominator: string }
function gcd(a: bigint, b: bigint): bigint { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a || 1n }
function normalized(n: bigint, d: bigint): ExactRational { if (d === 0n) throw new RangeError('Division by zero'); if (d < 0n) { n = -n; d = -d } const g = gcd(n, d); return Object.freeze({ numerator: String(n / g), denominator: String(d / g) }) }
export function rationalFromDecimal(value: DecimalString | string): ExactRational { const m = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/.exec(value); if (!m) throw new TypeError(`Invalid decimal: ${value}`); const fraction = m[3] ?? m[4] ?? ''; const digits = `${m[2] ?? '0'}${fraction}`; const n = BigInt((m[1] === '-' ? '-' : '') + digits); return normalized(n, 10n ** BigInt(fraction.length)) }
export function multiplyRational(a: ExactRational, b: ExactRational): ExactRational { return normalized(BigInt(a.numerator) * BigInt(b.numerator), BigInt(a.denominator) * BigInt(b.denominator)) }
export function divideRational(a: ExactRational, b: ExactRational): ExactRational { return normalized(BigInt(a.numerator) * BigInt(b.denominator), BigInt(a.denominator) * BigInt(b.numerator)) }
export function addRational(a: ExactRational, b: ExactRational): ExactRational { return normalized(BigInt(a.numerator) * BigInt(b.denominator) + BigInt(b.numerator) * BigInt(a.denominator), BigInt(a.denominator) * BigInt(b.denominator)) }
/** Excel ROUNDUP(x, digits): round any non-zero discarded fraction away from zero. */
export function roundRationalAwayFromZero(value: ExactRational, digits: number): DecimalString {
  if (!Number.isSafeInteger(digits) || digits < 0 || digits > 30) throw new RangeError('digits must be an integer from 0 to 30')
  const n = BigInt(value.numerator), d = BigInt(value.denominator)
  const scale = 10n ** BigInt(digits)
  const scaled = n * scale
  const quotient = scaled / d
  const remainder = scaled % d
  const rounded = remainder === 0n ? quotient : quotient + (scaled < 0n ? -1n : 1n)
  if (digits === 0) return String(rounded) as DecimalString
  const negative = rounded < 0n
  const digitsText = (negative ? -rounded : rounded).toString().padStart(digits + 1, '0')
  const whole = digitsText.slice(0, -digits)
  const fraction = digitsText.slice(-digits).replace(/0+$/, '')
  return `${negative && rounded !== 0n ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}` as DecimalString
}
/** Returns an exact decimal only when the reduced denominator has no prime factors except 2 and 5. */
export function rationalToDecimalExact(value: ExactRational): DecimalString | undefined {
  let d = BigInt(value.denominator); let twos = 0; let fives = 0
  while (d % 2n === 0n) { d /= 2n; twos++ } while (d % 5n === 0n) { d /= 5n; fives++ }
  if (d !== 1n) return undefined
  const scale = Math.max(twos, fives); const factor = 10n ** BigInt(scale); const n = BigInt(value.numerator) * (factor / BigInt(value.denominator))
  const negative = n < 0n; let digits = (negative ? -n : n).toString().padStart(scale + 1, '0')
  if (scale) digits = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
  if (digits.includes('.')) digits = digits.replace(/0+$/, '').replace(/\.$/, '')
  return `${negative && digits !== '0' ? '-' : ''}${digits}` as DecimalString
}
