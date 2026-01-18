import type { SeoRouteGroup, SeoSchemaType } from '../types.js'

export const normalizeBoolean = (value?: string | string[]) => {
  if (!value || Array.isArray(value)) return undefined
  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['false', '0', 'no', 'n'].includes(normalized)) return false
  return undefined
}

export const normalizeNumber = (value?: string | string[]) => {
  if (!value || Array.isArray(value)) return undefined
  const parsed = Number(value)
  if (Number.isFinite(parsed)) return parsed
  return undefined
}

export const normalizeGroup = (value?: string | string[]): SeoRouteGroup => {
  if (!value || Array.isArray(value)) return 'content'
  const normalized = value.trim().toLowerCase() as SeoRouteGroup
  if (['use-cases', 'company', 'resources', 'content'].includes(normalized)) {
    return normalized
  }
  return 'content'
}

export const normalizeSchemaType = (value?: string | string[]): SeoSchemaType | undefined => {
  if (!value || Array.isArray(value)) return undefined
  const normalized = value.trim().toLowerCase()
  if (['software', 'article', 'product', 'webpage'].includes(normalized)) {
    return normalized as SeoSchemaType
  }
  return undefined
}
