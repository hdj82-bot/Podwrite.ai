import UserMenu from './UserMenu'
import type { Plan } from '@/types'

interface TopNavProps {
  title?: string
  plan: Plan
  email: string
}

export default function TopNav({ title, plan, email }: TopNavProps) {
  return (
    <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-gray-200 flex-shrink-0">
      {title && (
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      )}
      <div className="ml-auto">
        <UserMenu plan={plan} email={email} />
      </div>
    </header>
  )
}
