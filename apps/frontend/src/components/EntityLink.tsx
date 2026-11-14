import { useNavigate } from 'react-router-dom'

type EntityType = 'deal' | 'lead' | 'contact' | 'company'

interface Props {
  type: EntityType
  id: string
  label: string
  className?: string
  children?: React.ReactNode
}

const ROUTES: Record<EntityType, string> = {
  deal: '/deals',
  lead: '/leads',
  contact: '/clients',
  company: '/clients',
}

export default function EntityLink({ type, id, label, className, children }: Props) {
  const navigate = useNavigate()

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    // Передаём id через URL query параметр — надёжнее sessionStorage
    navigate(`${ROUTES[type]}?open=${type}:${id}`)
  }

  return (
    <button type="button" onClick={handleClick}
      className={`text-primary hover:underline text-left ${className || ''}`}>
      {children || label}
    </button>
  )
}
