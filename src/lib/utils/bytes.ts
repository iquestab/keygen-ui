/**
 * Keygen expresses the memory and disk limits in bytes, which is unreasonable
 * to type into a form. The UI collects mebibytes and converts at the boundary.
 */

const BYTES_PER_MIB = 1024 * 1024

export function mibToBytes(mib: number): number {
  return Math.round(mib * BYTES_PER_MIB)
}

export function bytesToMib(bytes: number): number {
  return Math.round(bytes / BYTES_PER_MIB)
}

/**
 * Parse an optional numeric form field. Returns `undefined` for a blank or
 * unparseable field, meaning "omit this key" — i.e. inherit from the policy.
 */
export function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const parsed = parseInt(trimmed, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}
