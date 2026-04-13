'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Globe, Tag, Lock } from 'lucide-react'
import { cn, formatRelativeTime, calcProgress } from '@/lib/utils'
import ConfirmModal from '@/components/ui/ConfirmModal'
import type { Project, Plan, ProjectStatus } from '@/types'

interface ProjectCardProps {
  project: Project
  plan?: Plan
  onDeleted?: (id: string) => void
}

const PLATFORM_BADGE: Record<Project['platform'], { label: string; className: string }> = {
  bookk: { label: '📚 부크크', className: 'bg-blue-100 text-blue-700' },
  kyobo: { label: '📖 교보', className: 'bg-green-100 text-green-700' },
  kdp:   { label: '🌐 KDP',  className: 'bg-orange-100 text-orange-700' },
}

const STATUS_BADGE: Record<Project['status'], { label: string; className: string }> = {
  draft:       { label: '초안',   className: 'bg-gray-100 text-gray-600' },
  in_progress: { label: '집필 중', className: 'bg-blue-100 text-blue-700' },
  completed:   { label: '완성',   className: 'bg-green-100 text-green-700' },
  published:   { label: '출판됨', className: 'bg-purple-100 text-purple-700' },
}

const STATUS_BORDER: Record<Project['status'], string> = {
  draft:       'border-l-gray-300',
  in_progress: 'border-l-blue-400',
  completed:   'border-l-green-400',
  published:   'border-l-purple-400',
}

const STATUS_CYCLE: Record<ProjectStatus, ProjectStatus> = {
  draft:       'in_progress',
  in_progress: 'completed',
  completed:   'published',
  published:   'draft',
}

export default function ProjectCard({ project, plan = 'free', onDeleted }: ProjectCardProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [status, setStatus] = useState<ProjectStatus>(project.status)
  const [statusUpdating, setStatusUpdating] = useState(false)

  const progress = calcProgress(project.current_words, project.target_words)
  const platform = PLATFORM_BADGE[project.platform]
  const statusBadge = STATUS_BADGE[status]
  const isPro = plan === 'pro'

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('삭제 실패')
      setConfirmOpen(false)
      onDeleted?.(project.id)
      router.refresh()
    } catch {
      setDeleting(false)
    }
  }

  async function handleStatusCycle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (statusUpdating) return
    const next = STATUS_CYCLE[status]
    setStatus(next)
    setStatusUpdating(true)
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
    } catch {
      setStatus(status) // 실패 시 롤백
    } finally {
      setStatusUpdating(false)
    }
  }

  return (
    <>
      <div className={cn('group relative flex flex-col gap-4 p-5 bg-white rounded-xl border border-gray-200 hover:border-gray-400 hover:shadow-sm transition-all border-l-4', STATUS_BORDER[status])}>
        {/* 삭제 버튼 (hover 시 표시) */}
        <button
          onClick={(e) => {
            e.preventDefault()
            setConfirmOpen(true)
          }}
          className="absolute top-3 right-3 p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
          aria-label="프로젝트 삭제"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>

        {/* 카드 본문 → 에디터 링크 */}
        <Link href={`/editor/${project.id}`} className="flex flex-col gap-4 flex-1">
          {/* 헤더: 플랫폼 + 상태 뱃지 */}
          <div className="flex items-center justify-between gap-2 pr-6">
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', platform.className)}>
              {platform.label}
            </span>
            {/* 상태 뱃지 — 클릭 시 순환 변경 */}
            <button
              onClick={handleStatusCycle}
              title="클릭하여 상태 변경"
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium transition-opacity',
                statusBadge.className,
                statusUpdating ? 'opacity-50' : 'hover:opacity-80',
              )}
            >
              {statusBadge.label}
            </button>
          </div>

          {/* 제목 */}
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-black line-clamp-2 leading-snug">
              {project.title}
            </h3>
            {project.genre && (
              <p className="mt-1 text-xs text-gray-500">{project.genre}</p>
            )}
          </div>

          {/* 진행률 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{project.current_words.toLocaleString('ko-KR')}자</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  progress >= 100 ? 'bg-green-500' : 'bg-blue-500',
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              목표 {project.target_words.toLocaleString('ko-KR')}자
            </p>
          </div>

          {/* 수정일 */}
          <p className="text-xs text-gray-400 mt-auto">
            {formatRelativeTime(project.updated_at)}
          </p>
        </Link>

        {/* 하단 액션 링크들 */}
        <div className="border-t border-gray-100 pt-3 -mx-5 px-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* 챕터 관리 */}
          <Link
            href={`/dashboard/chapters/${project.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            챕터 관리
          </Link>

          {/* KDP 글로벌 (KDP 플랫폼만) */}
          {project.platform === 'kdp' && (
            <Link
              href={isPro ? `/kdp/${project.id}` : '/settings/billing'}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'flex items-center gap-1 text-xs transition-colors',
                isPro
                  ? 'text-orange-600 hover:text-orange-800'
                  : 'text-gray-400 hover:text-gray-600',
              )}
              title={isPro ? 'KDP 글로벌 모듈' : 'Pro 플랜 전용'}
            >
              {isPro ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              KDP 글로벌
            </Link>
          )}

          {/* 셀링 페이지 */}
          <Link
            href={isPro ? `/selling/${project.id}` : '/settings/billing'}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'flex items-center gap-1 text-xs transition-colors',
              isPro
                ? 'text-purple-600 hover:text-purple-800'
                : 'text-gray-400 hover:text-gray-600',
            )}
            title={isPro ? '셀링 페이지' : 'Pro 플랜 전용'}
          >
            {isPro ? <Tag className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            셀링
          </Link>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        title="프로젝트를 삭제할까요?"
        description={`"${project.title}" 프로젝트와 모든 챕터가 영구적으로 삭제됩니다.`}
        confirmLabel="삭제"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
