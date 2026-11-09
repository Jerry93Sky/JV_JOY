import { Prisma } from '@prisma/client'

type JsonObject = { readonly [key: string]: JsonInput }
type JsonInput = string | number | boolean | null | readonly JsonInput[] | JsonObject

/** Convert JSON request data to Prisma's explicit nullable-JSON input contract. */
export function toPrismaJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined
  if (value === null) return Prisma.DbNull
  if (!isJsonInput(value)) throw new TypeError('Value is not valid JSON input')
  return value as Prisma.InputJsonValue
}

function isJsonInput(value: unknown): value is JsonInput {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonInput)
  if (typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return false
  return Object.values(value).every(isJsonInput)
}
