import { cn } from '@/lib/utils'
import type { Platform, PlatformFitScore } from '@/types'

interface PlatformFitCardProps {
  platform: Platform
  fit: PlatformFitScore
}

const PLATFORM_META: Record<Platform, { label: string; colorClass: string; badgeClass: string }> = {
  bookk: {
    label: '부크크',
    colorClass: 'border-blue-200 bg-blue-50',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  kyobo: {
    label: '교보문고',
    colorClass: 'border-green-200 bg-green-50',
    badgeClass: 'bg-green-100 text-green-700',
  },
  kdp: {
    label: 'Amazon KDP',
    colorClass: 'border-orange-200 bg-orange-50',
    badgeClass: 'bg-orange-100 text-orange-700',
  },
}

export default function PlatformFitCard({ platform, fit }: PlatformFitCardProps) {
  const meta = PLATFORM_META[platform]
  const score = Math.max(0, Math.min(100, Math.round(fit.score)))

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', meta.colorClass)}>
      {/* 플랫폼 뱃지 + 점수 */}
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', meta.badgeClass)}>
          {meta.label}
        </span>
        <span className="text-lg font-bold text-gray-900">{score}점</span>
      </div>

      {/* 점수 바 */}
      <div className="h-2 bg-white/70 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* 이유 */}
      <p className="text-xs text-gray-600 leading-relaxed">{fit.reason}</p>
    </div>
  )
}

function barColor(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-blue-500'
  if (score >= 40) return 'bg-amber-400'
  return 'bg-red-400'
}
