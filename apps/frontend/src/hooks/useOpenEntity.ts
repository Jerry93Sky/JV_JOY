import { useSearchParams, useNavigate } from 'react-router-dom'

type EntityType = 'deal' | 'lead' | 'contact' | 'company'

export function useOpenEntity(expectedType: EntityType): string | null {
  const [searchParams] = useSearchParams()
  const open = searchParams.get('open')
  if (!open) return null
  const [type, id] = open.split(':')
  if (type !== expectedType || !id) return null
  return id
}

export function useClearOpenEntity() {
  const navigate = useNavigate()
  return () => navigate(window.location.pathname, { replace: true })
}
