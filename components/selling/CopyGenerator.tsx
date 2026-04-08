'use client'

import { useState } from 'react'
import PlatformCopyCard from './PlatformCopyCard'
import CanvaDeepLink from './CanvaDeepLink'
import { cn } from '@/lib/utils'
import type { Platform } from '@/types'

interface CopyGeneratorProps {
  projectId: string
  title: string
  genre: string | null
}

type Tab = Platform
const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'bookk', label: '부크크' },
  { value: 'kyobo', label: '교보문고' },
  { value: 'kdp', label: 'Amazon KDP' },
]

interface GeneratedCopy {
  titles: string[]
  description: string
  keywords: string[]
}

/**
 * 플랫폼별 출판 카피 생성기
 * - 탭 선택 후 "생성하기" 클릭
 * - API POST /api/selling/copy 호출
 * - 결과: 제목 후보 3개 / 소개 문구 / 키워드 5개
 */
export default function CopyGenerator({ projectId, title, genre }: CopyGeneratorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('bookk')
  // 플랫폼별 결과 캐시
  const [results, setResults] = useState<Partial<Record<Tab, GeneratedCopy>>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = results[activeTab]

  async function handleGenerate() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/selling/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          platform: activeTab,
          type: 'all',
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? '카피 생성 중 오류가 발생했습니다.')
        return
      }

      setResults((prev) => ({ ...prev, [activeTab]: json.data }))
    } catch {
      setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  function handleRegenerate() {
    // 현재 탭 캐시 삭제 후 재생성
    setResults((prev) => {
      const next = { ...prev }
      delete next[activeTab]
      return next
    })
    handleGenerate()
  }

  return (
    <div className="space-y-5">
      {/* 플랫폼 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setActiveTab(tab.value)
              setError(null)
            }}
            className={cn(
              'flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
              activeTab === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="space-y-4">
        {/* 생성 전: 생성하기 버튼 */}
        {!current && !loading && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {TABS.find((t) => t.value === activeTab)?.label} 카피 생성
              </p>
              <p className="text-xs text-gray-500 mt-1">
                &ldquo;{title}&rdquo;
                {genre ? ` · ${genre}` : ''}
              </p>
            </div>
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              AI 카피 생성하기
            </button>
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-black animate-spin" />
            <p className="text-sm text-gray-500">카피를 생성하고 있습니다…</p>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 결과 */}
        {current && !loading && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {TABS.find((t) => t.value === activeTab)?.label} 카피 생성 완료
              </p>
              <button
                onClick={handleRegenerate}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                재생성
              </button>
            </div>

            <div className="space-y-3">
              <PlatformCopyCard
                label="책 제목 후보"
                content={current.titles}
                variant="list"
              />
              <PlatformCopyCard
                label="소개 문구 (200자)"
                content={current.description}
                variant="text"
              />
              <PlatformCopyCard
                label="검색 키워드"
                content={current.keywords}
                variant="list"
              />
            </div>

            {/* 캔바 딥링크 */}
            <CanvaDeepLink platform={activeTab} />
          </>
        )}
      </div>
    </div>
  )
}
