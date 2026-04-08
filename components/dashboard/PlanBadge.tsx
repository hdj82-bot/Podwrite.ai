import { cn, planLabel, planColorClass } from '@/lib/utils'
import type { Plan } from '@/types'

interface PlanBadgeProps {
  plan: Plan
  className?: string
}

export default function PlanBadge({ plan, className }: PlanBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
      planColorClass(plan),
      className,
    )}>
      {planLabel(plan)}
    </span>
  )
}
