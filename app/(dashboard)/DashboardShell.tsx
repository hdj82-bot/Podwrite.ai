'use client'

import { useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import MobileSidebar from '@/components/layout/MobileSidebar'
import type { Plan } from '@/types'

interface DashboardShellProps {
  plan: Plan
  email: string
  children: React.ReactNode
}

export default function DashboardShell({ plan, email, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* 데스크톱 사이드바 (lg+) */}
      <div className="hidden lg:flex">
        <Sidebar plan={plan} email={email} />
      </div>

      {/* 모바일 드로어 사이드바 */}
      <MobileSidebar
        plan={plan}
        email={email}
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 모바일 상단 헤더 (lg 미만에서만 표시) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="메뉴 열기"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-gray-900">Podwrite.ai</span>
        </header>

        {children}
      </div>
    </div>
  )
}
