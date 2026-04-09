'use client'

import { useState } from 'react'
import ProjectGrid from '@/components/dashboard/ProjectGrid'
import EmptyState from '@/components/dashboard/EmptyState'
import NewProjectModal from '@/components/dashboard/NewProjectModal'
import DashboardStats from '@/components/dashboard/DashboardStats'
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
  const [showModal, setShowModal] = useState(false)

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

      {/* 집필 통계: 스트릭 + 30일 그래프 */}
      <DashboardStats />

      {/* 프로젝트 목록 */}
      {projects.length === 0 ? (
        <EmptyState onNew={() => setShowModal(true)} />
      ) : (
        <ProjectGrid projects={projects} />
      )}

      {/* 새 프로젝트 모달 */}
      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          currentCount={currentCount}
          plan={plan}
        />
      )}
    </main>
  )
}
