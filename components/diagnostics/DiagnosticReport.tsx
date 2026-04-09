'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ScoreGauge from './ScoreGauge'
import PlatformFitCard from './PlatformFitCard'
import { cn } from '@/lib/utils'
import type { DiagnosticReport as ReportType } from '@/types'

interface DiagnosticReportProps {
  report: ReportType
  /** 비회원일 때 true — 하단 클레임 CTA 표시 */
  isGuest?: boolean
  /**
   * "이 원고로 프로젝트 시작하기" 클릭 시 부모가 호출할 콜백
   * (localStorage에 pod_claim_pending 저장 등 사전 처리용)
   */
  onClaim?: () => void
}

type Section = 'strengths' | 'weaknesses' | 'suggestions'

const SECTION_META: Record<Section, { label: string; icon: string; color: string }> = {
  strengths:   { label: '강점',    icon: '✓', color: 'text-green-600' },
  weaknesses:  { label: '개선점',  icon: '△', color: 'text-amber-600' },
  suggestions: { label: '제안사항', icon: '→', color: 'text-blue-600' },
}

export default function DiagnosticReport({ report, isGuest, onClaim }: DiagnosticReportProps) {
  const router = useRouter()
  const [openSection, setOpenSection] = useState<Section | null>('strengths')

  function toggle(section: Section) {
    setOpenSection((prev) => (prev === section ? null : section))
  }

  /**
   * 비회원 CTA 클릭 처리
   * 1. 부모 onClaim() → localStorage에 pod_claim_pending 저장
   * 2. /login?next=/dashboard/diagnostics 로 이동
   *    → 로그인 후 대시보드 진단 페이지가 claim API 호출 후 /dashboard/new로 이동
   */
  function handleStartProject() {
    onClaim?.()
    router.push('/login?next=/dashboard/diagnostics')
  }

  return (
    <div className="space-y-6">
      {/* ── 상단: 종합 점수 + 기본 통계 ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <ScoreGauge score={report.overall_score} size={110} label="종합 점수" />

          <div className="flex-1 space-y-4 w-full">
            <div>
              <h2 className="text-lg font-bold text-gray-900">원고 분석 결과</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                AI가 원고를 분석하여 출판 준비도를 평가했습니다
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatBox label="단어 수" value={`${report.word_count.toLocaleString('ko-KR')}개`} />
              <StatBox label="예상 페이지" value={`${report.estimated_pages}쪽`} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 강점 / 개선점 / 제안사항 아코디언 ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
        {(Object.keys(SECTION_META) as Section[]).map((section) => {
          const meta = SECTION_META[section]
          const items: string[] = report[section] ?? []
          const isOpen = openSection === section

          return (
            <div key={section}>
              <button
                onClick={() => toggle(section)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-bold', meta.color)}>{meta.icon}</span>
                  <span className="text-sm font-semibold text-gray-900">{meta.label}</span>
                  <span className="text-xs text-gray-400">({items.length})</span>
                </div>
                <ChevronIcon open={isOpen} />
              </button>

              {isOpen && (
                <ul className="px-5 pb-4 space-y-2">
                  {items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className={cn('mt-0.5 text-xs font-medium flex-shrink-0', meta.color)}>
                        {meta.icon}
                      </span>
                      {item}
                    </li>
                  ))}
                  {items.length === 0 && (
                    <li className="text-sm text-gray-400">분석 항목이 없습니다.</li>
                  )}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {/* ── 플랫폼별 적합도 ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">플랫폼별 출판 적합도</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['bookk', 'kyobo', 'kdp'] as const).map((platform) => {
            const fit = report.platform_fit?.[platform]
            if (!fit) return null
            return <PlatformFitCard key={platform} platform={platform} fit={fit} />
          })}
        </div>
      </div>

      {/* ── CTA ── */}
      {!isGuest ? (
        /* 회원: 새 프로젝트 시작 */
        <div className="flex justify-end">
          <Link
            href="/dashboard/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            이 원고로 집필 시작하기
          </Link>
        </div>
      ) : (
        /* 비회원: 클레임 유도 */
        <div className="bg-gray-900 text-white rounded-2xl p-6 space-y-3">
          <div className="text-center space-y-1">
            <p className="text-base font-semibold">이 원고로 프로젝트를 시작해보세요</p>
            <p className="text-sm text-gray-400">
              로그인 후 진단 결과가 자동으로 계정에 저장되고 집필을 바로 시작할 수 있습니다
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
            {/* 메인 CTA — 로그인 후 claim 처리 */}
            <button
              type="button"
              onClick={handleStartProject}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-gray-900 text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              이 원고로 프로젝트 시작하기
            </button>

            {/* 회원가입 링크 */}
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-6 py-2.5 border border-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              무료 회원가입
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 내부 컴포넌트 ───────────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-base font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}
