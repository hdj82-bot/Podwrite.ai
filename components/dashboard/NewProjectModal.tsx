'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Platform, Plan } from '@/types'
import { PLAN_LIMITS } from '@/types'
import { getWritingPrefs } from '@/lib/writing-prefs'

interface NewProjectModalProps {
  onClose: () => void
  currentCount: number
  plan: Plan
}

const PLATFORMS: { value: Platform; label: string; desc: string; color: string }[] = [
  {
    value: 'bookk',
    label: '부크크',
    desc: '국내 대표 POD 플랫폼',
    color: 'border-blue-400 bg-blue-50',
  },
  {
    value: 'kyobo',
    label: '교보문고 POD',
    desc: '교보문고 자가출판',
    color: 'border-green-400 bg-green-50',
  },
  {
    value: 'kdp',
    label: 'Amazon KDP',
    desc: '글로벌 전자책·종이책',
    color: 'border-orange-400 bg-orange-50',
  },
]

const GENRES = ['소설', '자기계발', '에세이', '시집', '비즈니스', '역사', '과학', '기타']

// 장르별 권장 목표 단어 수
const GENRE_TARGET_WORDS: Record<string, number> = {
  소설: 50000,
  자기계발: 35000,
  에세이: 30000,
  시집: 10000,
  비즈니스: 40000,
  역사: 45000,
  과학: 40000,
  기타: 30000,
}

export default function NewProjectModal({ onClose, currentCount, plan }: NewProjectModalProps) {
  const router = useRouter()
  const limit = PLAN_LIMITS[plan].projects
  const isAtLimit = limit !== Infinity && currentCount >= limit

  // 글쓰기 환경설정 기본값 적용
  const prefs = getWritingPrefs()

  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState<Platform>(prefs.defaultPlatform)
  const [genre, setGenre] = useState(prefs.defaultGenre)
  const [targetWords, setTargetWords] = useState(
    prefs.defaultGenre && GENRE_TARGET_WORDS[prefs.defaultGenre]
      ? GENRE_TARGET_WORDS[prefs.defaultGenre]
      : 30000,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), platform, genre, target_words: targetWords }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? '프로젝트 생성 중 오류가 발생했습니다.')
        return
      }

      // Window 3이 구현한 /api/projects POST 응답 형식: { data: Project }
      const projectId = json.data?.id ?? json.id
      router.push(`/editor/${projectId}`)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    /* 모달 오버레이 */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold">새 원고 시작하기</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 플랜 한도 초과 */}
        {isAtLimit ? (
          <div className="px-6 py-8 text-center">
            <p className="text-4xl mb-3">🔒</p>
            <p className="font-semibold mb-2">프로젝트 한도에 도달했어요</p>
            <p className="text-sm text-gray-500 mb-6">
              현재 {plan === 'free' ? '무료' : '베이직'} 플랜은 최대 {limit}개까지 가능합니다.
            </p>
            <a
              href="/dashboard/settings/billing"
              className="inline-flex items-center px-5 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              플랜 업그레이드
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                원고 제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={100}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="예: 나의 첫 번째 소설"
              />
            </div>

            {/* 플랫폼 선택 */}
            <div>
              <label className="block text-sm font-medium mb-2">출판 플랫폼</label>
              <div className="grid grid-cols-3 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPlatform(p.value)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-sm font-medium transition-all',
                      platform === p.value
                        ? p.color
                        : 'border-gray-200 hover:border-gray-300 bg-white',
                    )}
                  >
                    <span>{p.label}</span>
                    <span className="text-xs text-gray-500 font-normal">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 장르 */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                장르
                {genre && GENRE_TARGET_WORDS[genre] && (
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    권장 분량: {GENRE_TARGET_WORDS[genre].toLocaleString('ko-KR')}자
                  </span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      const next = genre === g ? '' : g
                      setGenre(next)
                      if (next && GENRE_TARGET_WORDS[next]) {
                        setTargetWords(GENRE_TARGET_WORDS[next])
                      }
                    }}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                      genre === g
                        ? 'border-black bg-black text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-400',
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* 목표 분량 */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                목표 분량
                <span className="ml-2 font-normal text-gray-500">
                  {targetWords.toLocaleString('ko-KR')}자
                </span>
              </label>
              <input
                type="range"
                min={5000}
                max={200000}
                step={5000}
                value={targetWords}
                onChange={(e) => setTargetWords(Number(e.target.value))}
                className="w-full accent-black"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>5,000자</span>
                <span>단편 소설</span>
                <span>200,000자</span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="flex-1 py-2.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {loading ? '생성 중...' : '원고 시작하기'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
