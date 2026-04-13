'use client'

/**
 * OnboardingModal — 신규 사용자 4단계 온보딩
 *
 * Step 1: 환영 메시지
 * Step 2: 출판 플랫폼 선택 안내 (정보 제공용, 실제 설정 변경 없음)
 * Step 3: 핵심 기능 소개
 * Step 4: 첫 프로젝트 시작 CTA
 *
 * localStorage 키: pod_onboarding_done
 *   - "새 프로젝트 만들기" 완료 시 무조건 저장
 *   - "다시 보지 않기" 체크 후 닫기 시 저장
 */

import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'

const TOTAL_STEPS = 4

// ── 플랫폼 데이터 (Step 2) ────────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: 'bookk',
    name: '부크크',
    desc: '국내 대표 POD 플랫폼 · 빠른 심사',
    emoji: '📘',
    active: 'border-blue-400 bg-blue-50',
  },
  {
    id: 'kyobo',
    name: '교보문고 POD',
    desc: '교보문고 자가출판 · 오프라인 유통',
    emoji: '📗',
    active: 'border-green-400 bg-green-50',
  },
  {
    id: 'kdp',
    name: 'Amazon KDP',
    desc: '글로벌 전자책·종이책 · 한→영 번역',
    emoji: '🌎',
    active: 'border-orange-400 bg-orange-50',
  },
] as const

// ── 기능 데이터 (Step 3) ──────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '✍️',
    title: 'AI 집필 보조',
    desc: '막막한 챕터도 AI와 대화로 돌파',
  },
  {
    icon: '🌍',
    title: 'KDP 글로벌',
    desc: '한→영 번역부터 EPUB까지 자동',
  },
  {
    icon: '📊',
    title: '원고 진단',
    desc: '출판 준비도를 점수로 바로 확인',
  },
] as const

// ── Props ─────────────────────────────────────────────────────────────────────

export interface OnboardingModalProps {
  onClose: () => void
  /** "새 프로젝트 만들기" 클릭 시 — 온보딩 닫기 + NewProjectModal 열기 */
  onStartProject: () => void
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default function OnboardingModal({ onClose, onStartProject }: OnboardingModalProps) {
  const [step, setStep]                         = useState(1)
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [dontShowAgain, setDontShowAgain]       = useState(false)

  function markDone() {
    localStorage.setItem('pod_onboarding_done', '1')
  }

  /** X 버튼 또는 오버레이 클릭 */
  function handleClose() {
    if (dontShowAgain) markDone()
    onClose()
  }

  /** Step 4 "새 프로젝트 만들기" */
  function handleStartProject() {
    markDone() // 플로우 완료 시 항상 저장
    onStartProject()
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">

        {/* ── 헤더: 스텝 표시 + 닫기 ──────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          {/* 스텝 인디케이터 */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-full transition-all duration-300',
                  i + 1 === step   ? 'w-6 h-2 bg-indigo-500' :
                  i + 1 < step     ? 'w-2 h-2 bg-indigo-300' :
                                     'w-2 h-2 bg-gray-200',
                )}
              />
            ))}
            <span className="ml-2 text-[10px] text-gray-400 font-medium tabular-nums">
              {step} / {TOTAL_STEPS}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── 콘텐츠 ───────────────────────────────────────────────── */}
        <div className="flex-1 px-6 pb-2 min-h-[280px] flex flex-col">

          {/* Step 1: 환영 */}
          {step === 1 && (
            <div className="flex flex-col items-center text-center flex-1 justify-center py-4">
              <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center mb-5 shadow-sm">
                <span className="text-4xl select-none">📝</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                Podwrite.ai에 오신 걸 환영합니다 👋
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed max-w-sm">
                AI와 함께 책을 쓰고, 출판까지 한 번에 완료하세요.
                기획부터 최종 파일까지, 모든 과정을 한 화면에서.
              </p>
            </div>
          )}

          {/* Step 2: 플랫폼 선택 안내 */}
          {step === 2 && (
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                어디에 출판할 계획인가요?
              </h2>
              <p className="text-xs text-gray-400 mb-4">
                참고용이며 나중에 프로젝트마다 자유롭게 변경할 수 있어요.
              </p>
              <div className="space-y-2">
                {PLATFORMS.map((p) => {
                  const isSelected = selectedPlatform === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlatform(isSelected ? null : p.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
                        isSelected ? p.active : 'border-gray-200 hover:border-gray-300 bg-white',
                      )}
                    >
                      <span className="text-2xl select-none shrink-0">{p.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>
                      </div>
                      {isSelected && (
                        <div className="shrink-0 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 3: 핵심 기능 소개 */}
          {step === 3 && (
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 mb-1">이런 기능을 드려요</h2>
              <p className="text-xs text-gray-400 mb-4">
                모든 기능은 대시보드에서 바로 사용할 수 있어요.
              </p>
              <div className="space-y-3">
                {FEATURES.map((f) => (
                  <div
                    key={f.title}
                    className="flex items-start gap-3.5 p-4 rounded-xl bg-gray-50 border border-gray-100"
                  >
                    <span className="text-2xl select-none shrink-0 mt-0.5">{f.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: 시작하기 */}
          {step === 4 && (
            <div className="flex flex-col items-center text-center flex-1 justify-center py-4">
              <div className="w-20 h-20 rounded-2xl bg-green-50 flex items-center justify-center mb-5 shadow-sm">
                <span className="text-4xl select-none">🚀</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                첫 프로젝트를 만들어 보세요
              </h2>
              <p className="text-sm text-gray-500 mb-6 max-w-xs leading-relaxed">
                지금 바로 새 원고를 시작하고, AI의 도움으로 첫 챕터를 완성해 보세요.
              </p>
              <button
                onClick={handleStartProject}
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-md shadow-indigo-200"
              >
                <PenLine className="w-4 h-4" />
                새 프로젝트 만들기
              </button>
              {/* 다시 보지 않기 */}
              <label className="flex items-center gap-2 mt-5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer"
                />
                <span className="text-xs text-gray-400 group-hover:text-gray-500 transition-colors select-none">
                  다시 보지 않기
                </span>
              </label>
            </div>
          )}
        </div>

        {/* ── 하단 네비게이션 ───────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          {/* 이전 버튼 */}
          <button
            onClick={() => setStep((s) => s - 1)}
            className={cn(
              'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors',
              step === 1 && 'invisible pointer-events-none',
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            이전
          </button>

          {/* 다음 / 건너뛰기 */}
          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              다음
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-50"
            >
              건너뛰기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
