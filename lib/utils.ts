import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Plan } from '@/types'

/** Tailwind 클래스 병합 헬퍼 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 단어 수 포맷 (10000 → "10,000자") */
export function formatWordCount(count: number): string {
  return `${count.toLocaleString('ko-KR')}자`
}

/** 상대 시간 포맷 ("3시간 전", "2일 전") */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay < 7) return `${diffDay}일 전`
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

/** 날짜 포맷 ("2026. 4. 8.") */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR')
}

/** 플랜 표시 이름 */
export function planLabel(plan: Plan): string {
  return { free: '무료', basic: '베이직', pro: '프로' }[plan]
}

/** 플랜 색상 클래스 */
export function planColorClass(plan: Plan): string {
  return {
    free: 'bg-gray-100 text-gray-600',
    basic: 'bg-blue-100 text-blue-700',
    pro: 'bg-purple-100 text-purple-700',
  }[plan]
}

/** 진행률 계산 (0~100) */
export function calcProgress(current: number, target: number): number {
  if (target === 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}
