'use client'

/**
 * ProjectFilterBar — 대시보드 프로젝트 검색·필터·정렬 바
 *
 * - 텍스트 검색: 제목 실시간 필터
 * - 플랫폼 필터: 전체 / 부크크 / 교보 / KDP (pill)
 * - 상태 필터: 전체 / 초안 / 집필 중 / 완료 / 출판됨 (pill)
 * - 정렬: 최신순 / 단어수 많은순 / 진행률순 (select)
 * - 클라이언트 사이드 필터링 (API 재호출 없음)
 */

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { Project, Platform, ProjectStatus } from '@/types'

interface ProjectFilterBarProps {
  allProjects: Project[]
  onFilterChange: (filtered: Project[]) => void
}

type SortOption     = 'recent' | 'words' | 'progress'
type PlatformFilter = 'all' | Platform
type StatusFilter   = 'all' | ProjectStatus

const PLATFORM_OPTIONS: Array<{ value: PlatformFilter; label: string }> = [
  { value: 'all',   label: '전체' },
  { value: 'bookk', label: '부크크' },
  { value: 'kyobo', label: '교보' },
  { value: 'kdp',   label: 'KDP' },
]

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all',         label: '전체' },
  { value: 'draft',       label: '초안' },
  { value: 'in_progress', label: '집필 중' },
  { value: 'completed',   label: '완료' },
  { value: 'published',   label: '출판됨' },
]

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'recent',   label: '최신순' },
  { value: 'words',    label: '단어수 많은순' },
  { value: 'progress', label: '진행률순' },
]

export default function ProjectFilterBar({
  allProjects,
  onFilterChange,
}: ProjectFilterBarProps) {
  const [query,    setQuery]    = useState('')
  const [platform, setPlatform] = useState<PlatformFilter>('all')
  const [status,   setStatus]   = useState<StatusFilter>('all')
  const [sort,     setSort]     = useState<SortOption>('recent')

  const applyFilter = useCallback(() => {
    let list = [...allProjects]

    // ── 텍스트 검색 ────────────────────────────────────────────
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((p) => p.title.toLowerCase().includes(q))
    }

    // ── 플랫폼 필터 ────────────────────────────────────────────
    if (platform !== 'all') {
      list = list.filter((p) => p.platform === platform)
    }

    // ── 상태 필터 ──────────────────────────────────────────────
    if (status !== 'all') {
      list = list.filter((p) => p.status === status)
    }

    // ── 정렬 ───────────────────────────────────────────────────
    if (sort === 'recent') {
      list.sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )
    } else if (sort === 'words') {
      list.sort((a, b) => b.current_words - a.current_words)
    } else {
      list.sort((a, b) => {
        const pa = a.target_words > 0 ? a.current_words / a.target_words : 0
        const pb = b.target_words > 0 ? b.current_words / b.target_words : 0
        return pb - pa
      })
    }

    onFilterChange(list)
  }, [allProjects, query, platform, status, sort, onFilterChange])

  useEffect(() => {
    applyFilter()
  }, [applyFilter])

  const isFiltered = query !== '' || platform !== 'all' || status !== 'all'

  function handleReset() {
    setQuery('')
    setPlatform('all')
    setStatus('all')
    setSort('recent')
  }

  return (
    <div className="space-y-2.5 mb-5">

      {/* ── 검색 + 정렬 행 ────────────────────────────────────── */}
      <div className="flex gap-2">
        {/* 텍스트 검색 */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목으로 검색…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="검색어 지우기"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 정렬 */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="shrink-0 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-600 cursor-pointer"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── 필터 pill 행 ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* 플랫폼 pills */}
        <div className="flex items-center gap-1.5">
          {PLATFORM_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setPlatform(o.value)}
              className={cn(
                'px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
                platform === o.value
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        <span className="h-3.5 w-px bg-gray-200" />

        {/* 상태 pills */}
        <div className="flex items-center gap-1.5">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setStatus(o.value)}
              className={cn(
                'px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
                status === o.value
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* 초기화 */}
        {isFiltered && (
          <button
            onClick={handleReset}
            className="ml-auto text-xs text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            초기화
          </button>
        )}
      </div>
    </div>
  )
}
