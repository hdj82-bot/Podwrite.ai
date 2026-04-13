'use client'

import { useState, useCallback, useEffect } from 'react'
import ProjectGrid from '@/components/dashboard/ProjectGrid'
import EmptyState from '@/components/dashboard/EmptyState'
import NewProjectModal from '@/components/dashboard/NewProjectModal'
import DashboardStats from '@/components/dashboard/DashboardStats'
import ProjectFilterBar from '@/components/dashboard/ProjectFilterBar'
import OnboardingModal from '@/components/onboarding/OnboardingModal'
import type { Plan, Project } from '@/types'

interface DashboardClientProps {
  projects: Project[]
  plan: Plan
  limitLabel: string
  currentCount: number
}

export default function DashboardClient({
  projects,
  plan,
  limitLabel,
  currentCount,
}: DashboardClientProps) {
  const [showModal, setShowModal]           = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [filteredProjects, setFilteredProjects] = useState<Project[]>(projects)

  // 신규 사용자 온보딩: localStorage에 완료 기록이 없을 때만 표시
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const done = localStorage.getItem('pod_onboarding_done')
      if (!done) setShowOnboarding(true)
    }
  }, [])

  const handleFilterChange = useCallback((filtered: Project[]) => {
    setFilteredProjects(filtered)
  }, [])

  const isFiltering = filteredProjects.length !== projects.length

  return (
    <main className="flex-1 px-6 py-8">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">내 원고</h2>
          <p className="text-sm text-gray-500 mt-0.5">{limitLabel}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          새 원고
        </button>
      </div>

      {/* 집필 통계: 잔디밭 + 30일 그래프 + 요약 카드 */}
      <DashboardStats projects={projects} />

      {/* 검색·필터·정렬 바 */}
      {projects.length > 0 && (
        <ProjectFilterBar
          allProjects={projects}
          onFilterChange={handleFilterChange}
        />
      )}

      {/* 프로젝트 목록 */}
      {projects.length === 0 ? (
        <EmptyState onNew={() => setShowModal(true)} />
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg
            className="w-10 h-10 text-gray-300 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <p className="text-sm text-gray-500">검색 결과가 없습니다.</p>
          <p className="text-xs text-gray-400 mt-1">다른 검색어나 필터를 시도해 보세요.</p>
        </div>
      ) : (
        <ProjectGrid projects={filteredProjects} />
      )}

      {/* 새 프로젝트 모달 */}
      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          currentCount={currentCount}
          plan={plan}
        />
      )}

      {/* 온보딩 모달 (신규 사용자, localStorage 미완료 시) */}
      {showOnboarding && (
        <OnboardingModal
          onClose={() => setShowOnboarding(false)}
          onStartProject={() => {
            setShowOnboarding(false)
            setShowModal(true)
          }}
        />
      )}
    </main>
  )
}
