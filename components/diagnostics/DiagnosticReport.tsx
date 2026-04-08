'use client'

import { useState } from 'react'
import Link from 'next/link'
import ScoreGauge from './ScoreGauge'
import PlatformFitCard from './PlatformFitCard'
import { cn } from '@/lib/utils'
import type { DiagnosticReport as ReportType } from '@/types'

interface DiagnosticReportProps {
  report: ReportType
  /** 비회원일 때 true — 하단 가입 CTA 표시 */
  isGuest?: boolean
  /** 가입 후 claim 처리용 콜백 */
  onClaim?: () => void
}

type Section = 'strengths' | 'weaknesses' | 'suggestions'

const SECTION_META: Record<Section, { label: string; icon: string; color: string }> = {
  strengths:   { label: '강점',    icon: '✓', color: 'text-green-600' },
  weaknesses:  { label: '개선점',  icon: '△', color: 'text-amber-600' },
  suggestions: { label: '제안사항', icon: '→', color: 'text-blue-600' },
}

export default function DiagnosticReport({ report, isGuest, onClaim }: DiagnosticReportProps) {
  const [openSection, setOpenSection] = useState<Section | null>('strengths')

  function toggle(section: Section) {
    setOpenSection((prev) => (prev === section ? null : section))
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
        /* 비회원 CTA */
        <div className="bg-gray-900 text-white rounded-2xl p-6 text-center space-y-3">
          <p className="text-base font-semibold">결과를 저장하고 집필을 시작하세요</p>
          <p className="text-sm text-gray-400">
            회원가입 후 진단 결과가 자동으로 계정에 저장됩니다
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
            <Link
              href="/signup"
              onClick={onClaim}
              className="inline-flex items-center justify-center px-6 py-2.5 bg-white text-gray-900 text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              무료로 가입하기
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-2.5 border border-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              이미 계정이 있어요
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
