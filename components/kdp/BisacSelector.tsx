'use client'

/**
 * BisacSelector — BISAC 카테고리 선택기
 *
 * - 정적 목록 기반 검색 (GET /api/kdp/bisac fallback)
 * - genre prop 전달 시 장르 기반 추천 2개 표시
 * - 최대 2개 선택 (KDP 정책)
 */

import { useState, useMemo, useEffect } from 'react'
import { Search, X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BisacCategory {
  code: string
  label: string
  description: string
}

// 한국 작가에게 적합한 BISAC 카테고리 (우선순위 정렬)
export const BISAC_CATEGORIES: BisacCategory[] = [
  // 자기계발
  { code: 'SEL016000', label: 'Self-Help / Personal Growth / Success', description: '성공, 자기계발' },
  { code: 'SEL031000', label: 'Self-Help / Motivational & Inspirational', description: '동기부여' },
  { code: 'SEL021000', label: 'Self-Help / Personal Finance', description: '재정 관리' },
  { code: 'SEL027000', label: 'Self-Help / Self-Management / Stress Management', description: '스트레스 관리' },
  // 비즈니스
  { code: 'BUS000000', label: 'Business & Economics / General', description: '비즈니스 일반' },
  { code: 'BUS041000', label: 'Business & Economics / Management', description: '경영 관리' },
  { code: 'BUS025000', label: 'Business & Economics / Entrepreneurship', description: '창업' },
  { code: 'BUS069000', label: 'Business & Economics / Leadership', description: '리더십' },
  { code: 'BUS097000', label: 'Business & Economics / Skills', description: '비즈니스 스킬' },
  // 소설/문학
  { code: 'FIC000000', label: 'Fiction / General', description: '소설 일반' },
  { code: 'FIC019000', label: 'Fiction / Literary', description: '문학 소설' },
  { code: 'FIC009000', label: 'Fiction / Fantasy / General', description: '판타지' },
  { code: 'FIC028000', label: 'Fiction / Science Fiction / General', description: 'SF' },
  { code: 'FIC022000', label: 'Fiction / Mystery & Detective / General', description: '미스터리' },
  { code: 'FIC027000', label: 'Fiction / Romance / General', description: '로맨스' },
  // 에세이/회고록
  { code: 'BIO026000', label: 'Biography & Autobiography / Personal Memoirs', description: '개인 회고록' },
  { code: 'LCO010000', label: 'Literary Collections / Essays', description: '에세이' },
  // 교육/학습
  { code: 'EDU000000', label: 'Education / General', description: '교육 일반' },
  { code: 'STU000000', label: 'Study Aids / General', description: '학습 보조' },
  // 건강/라이프스타일
  { code: 'HEA000000', label: 'Health & Fitness / General', description: '건강 일반' },
  { code: 'HEA047000', label: 'Health & Fitness / Diet & Nutrition', description: '다이어트, 영양' },
  { code: 'HEA006000', label: 'Health & Fitness / Healthy Living', description: '건강한 삶' },
  // 역사/사회
  { code: 'HIS000000', label: 'History / General', description: '역사 일반' },
  { code: 'SOC000000', label: 'Social Science / General', description: '사회과학' },
  // 철학/심리
  { code: 'PHI000000', label: 'Philosophy / General', description: '철학' },
  { code: 'PSY000000', label: 'Psychology / General', description: '심리학 일반' },
  { code: 'PSY022000', label: 'Psychology / Interpersonal Relations', description: '대인 관계' },
  // 종교/영성
  { code: 'REL000000', label: 'Religion / General', description: '종교 일반' },
  { code: 'OCC000000', label: 'Body, Mind & Spirit / General', description: '마음/영성' },
  // 요리/생활
  { code: 'CKB000000', label: 'Cooking / General', description: '요리' },
  { code: 'HOM000000', label: 'House & Home / General', description: '홈/생활' },
  // 여행
  { code: 'TRV000000', label: 'Travel / General', description: '여행' },
  // 과학/기술
  { code: 'SCI000000', label: 'Science / General', description: '과학 일반' },
  { code: 'COM000000', label: 'Computers / General', description: 'IT/컴퓨터' },
]

// 장르 → BISAC 코드 로컬 매핑 (API 없을 때 fallback)
const GENRE_BISAC_MAP: Record<string, string[]> = {
  '소설': ['FIC000000', 'FIC019000'],
  '자기계발': ['SEL016000', 'SEL031000'],
  '에세이': ['LCO010000', 'BIO026000'],
  '비즈니스': ['BUS000000', 'BUS041000'],
  '역사': ['HIS000000', 'SOC000000'],
  '과학': ['SCI000000', 'EDU000000'],
  '시집': ['LCO010000', 'FIC019000'],
  '기타': ['FIC000000', 'SEL016000'],
}

interface BisacSelectorProps {
  value: BisacCategory[]
  onChange: (categories: BisacCategory[]) => void
  max?: number
  /** 프로젝트 장르 — 추천 카테고리 표시에 사용 */
  genre?: string | null
}

export default function BisacSelector({ value, onChange, max = 2, genre }: BisacSelectorProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [recommendations, setRecommendations] = useState<BisacCategory[]>([])
  const [loadingRec, setLoadingRec] = useState(false)

  // 장르 기반 추천 로드 (API or 로컬 fallback)
  useEffect(() => {
    if (!genre) return

    let cancelled = false
    setLoadingRec(true)

    async function fetchRecommendations() {
      try {
        const res = await fetch(`/api/kdp/bisac?genre=${encodeURIComponent(genre!)}`)
        if (!cancelled && res.ok) {
          const json = await res.json()
          const recs: BisacCategory[] = json.data?.recommendations ?? []
          setRecommendations(recs.slice(0, 2))
          return
        }
      } catch {
        // API 없음 → 로컬 fallback
      }

      if (!cancelled) {
        // 로컬 매핑으로 fallback
        const codes = GENRE_BISAC_MAP[genre!] ?? []
        setRecommendations(
          BISAC_CATEGORIES.filter((c) => codes.includes(c.code)).slice(0, 2),
        )
      }
    }

    fetchRecommendations().finally(() => {
      if (!cancelled) setLoadingRec(false)
    })

    return () => { cancelled = true }
  }, [genre])

  const filtered = useMemo(() => {
    if (!query.trim()) return BISAC_CATEGORIES
    const q = query.toLowerCase()
    return BISAC_CATEGORIES.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.description.includes(q) ||
        c.code.toLowerCase().includes(q),
    )
  }, [query])

  function toggle(cat: BisacCategory) {
    const isSelected = value.some((v) => v.code === cat.code)
    if (isSelected) {
      onChange(value.filter((v) => v.code !== cat.code))
    } else if (value.length < max) {
      onChange([...value, cat])
    }
  }

  function remove(code: string) {
    onChange(value.filter((v) => v.code !== code))
  }

  return (
    <div className="space-y-2">
      {/* AI 추천 카테고리 */}
      {genre && recommendations.length > 0 && (
        <div className="rounded-lg bg-purple-50 border border-purple-200 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
            <span className="text-xs font-semibold text-purple-700">
              장르 &lsquo;{genre}&rsquo; 추천 카테고리
            </span>
            {loadingRec && (
              <span className="text-xs text-purple-400">로딩 중...</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {recommendations.map((cat) => {
              const isSelected = value.some((v) => v.code === cat.code)
              const isDisabled = !isSelected && value.length >= max
              return (
                <button
                  key={cat.code}
                  type="button"
                  onClick={() => toggle(cat)}
                  disabled={isDisabled}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border text-xs font-medium px-2.5 py-1 transition-colors',
                    isSelected
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : isDisabled
                        ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                        : 'border-purple-300 bg-white text-purple-700 hover:bg-purple-100',
                  )}
                >
                  <span className="font-mono text-[10px]">{cat.code}</span>
                  {cat.description}
                  {isSelected && <X className="h-3 w-3 ml-0.5" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 선택된 카테고리 (추천 외) */}
      {value.filter((v) => !recommendations.some((r) => r.code === v.code)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value
            .filter((v) => !recommendations.some((r) => r.code === v.code))
            .map((cat) => (
              <span
                key={cat.code}
                className="inline-flex items-center gap-1 rounded-lg bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-1"
              >
                <span className="font-mono text-orange-500">{cat.code}</span>
                <span>{cat.description}</span>
                <button
                  type="button"
                  onClick={() => remove(cat.code)}
                  className="ml-1 hover:text-orange-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
        </div>
      )}

      {/* 선택 버튼 */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={value.length >= max}
        className={cn(
          'w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors',
          value.length >= max
            ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
            : 'border-gray-300 text-gray-700 hover:border-gray-400 bg-white',
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-gray-400" />
        {value.length >= max
          ? `카테고리 최대 ${max}개 선택됨`
          : `BISAC 카테고리 검색 (${value.length}/${max})`}
      </button>

      {/* 드롭다운 */}
      {open && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="카테고리 이름 또는 설명 검색..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">검색 결과가 없습니다.</p>
            ) : (
              filtered.map((cat) => {
                const isSelected = value.some((v) => v.code === cat.code)
                return (
                  <button
                    key={cat.code}
                    type="button"
                    onClick={() => toggle(cat)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors',
                      isSelected && 'bg-orange-50',
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center',
                        isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300',
                      )}
                    >
                      {isSelected && (
                        <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                          <path d="M8.5 2.5L4 7.5 1.5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-mono text-xs text-orange-500 mr-1">{cat.code}</span>
                      <span className="text-gray-900">{cat.description}</span>
                      <p className="text-xs text-gray-400 truncate">{cat.label}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div className="border-t border-gray-100 px-4 py-2.5 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              완료
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        KDP 카테고리는 최대 2개 선택. BISAC 코드는 KDP 제출 시 필요합니다.
      </p>
    </div>
  )
}
