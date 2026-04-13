import { BookOpen, Book, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Platform, PlatformFitScore } from '@/types'

interface PlatformFitCardProps {
  platform: Platform
  fit: PlatformFitScore
}

const PLATFORM_META: Record<Platform, { label: string; icon: React.ElementType; colorClass: string; badgeClass: string }> = {
  bookk: {
    label: '부크크',
    icon: BookOpen,
    colorClass: 'border-blue-200 bg-blue-50',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  kyobo: {
    label: '교보문고',
    icon: Book,
    colorClass: 'border-green-200 bg-green-50',
    badgeClass: 'bg-green-100 text-green-700',
  },
  kdp: {
    label: 'Amazon KDP',
    icon: Globe,
    colorClass: 'border-orange-200 bg-orange-50',
    badgeClass: 'bg-orange-100 text-orange-700',
  },
}

function fitLabel(score: number): { text: string; cls: string } {
  if (score >= 70) return { text: '적합',     cls: 'text-green-600 bg-green-50 border-green-200' }
  if (score >= 50) return { text: '보통',     cls: 'text-amber-600 bg-amber-50 border-amber-200' }
  return               { text: '검토 필요', cls: 'text-red-600 bg-red-50 border-red-200'         }
}

export default function PlatformFitCard({ platform, fit }: PlatformFitCardProps) {
  const meta = PLATFORM_META[platform]
  const score = Math.max(0, Math.min(100, Math.round(fit.score)))
  const fit_label = fitLabel(score)
  const Icon = meta.icon

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', meta.colorClass)}>
      {/* 플랫폼 아이콘 + 이름 + 적합도 라벨 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-full', meta.badgeClass)}>
            <Icon className="w-3.5 h-3.5" />
          </span>
          <span className="text-xs font-semibold text-gray-800">
            {meta.label}
          </span>
        </div>
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', fit_label.cls)}>
          {fit_label.text}
        </span>
      </div>

      {/* 점수 바 */}
      <div className="h-2 bg-white/70 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-orange-400 transition-all duration-500"
          style={{ width: `${score}%` }}
        />
      </div>

      {/* 이유 */}
      <p className="text-xs text-gray-600 leading-relaxed">{fit.reason}</p>
    </div>
  )
}
