'use client'

/**
 * CopyGenerator — AI 판매 소개문 생성기
 *
 * 지원 플랫폼: 부크크 / 교보문고 (KDP는 별도 모듈)
 * API: POST /api/selling/copy → JSON 단건 응답
 *      (스트리밍 응답이면 SSE 파싱으로 자동 전환)
 *
 * 섹션 순서:
 *   1. 소개문 생성 (플랫폼 선택 + 책 특성 메모 + 생성 버튼)
 *   2. 플랫폼별 카드 (소개문 · 제목 후보 · 키워드)
 *   3. 수정 요청 (대상 선택 + 지시사항 입력)
 *   4. 표지 제작 도구 (CanvaDeepLink)
 */

import { useState } from 'react'
import PlatformCopyCard from './PlatformCopyCard'
import CanvaDeepLink from './CanvaDeepLink'
import { cn } from '@/lib/utils'

// 셀링 페이지는 국내 플랫폼만 지원 (KDP = 별도 글로벌 모듈)
type SellingPlatform = 'bookk' | 'kyobo'

interface CopyGeneratorProps {
  projectId: string
  title: string
  genre: string | null
}

interface GeneratedCopy {
  titles:      string[]
  description: string
  author_bio:  string
  keywords:    string[]
}

type ApiType = 'all' | 'title' | 'description' | 'author_bio' | 'keywords'
type RevisionTarget = ApiType

// ── 플랫폼 메타 ────────────────────────────────────────────────────
const PLATFORMS: Array<{
  value: SellingPlatform
  label: string
  sub: string
}> = [
  {
    value: 'bookk',
    label: '부크크',
    sub: '국내 최대 POD 셀프 출판 · 검색 친화형 카피',
  },
  {
    value: 'kyobo',
    label: '교보문고',
    sub: '교양·실용 독자 중심 · 신뢰 어조 강조',
  },
]

const REVISION_TARGETS: Array<{ value: RevisionTarget; label: string }> = [
  { value: 'description', label: '소개문' },
  { value: 'title',       label: '제목 후보' },
  { value: 'author_bio',  label: '저자 소개' },
  { value: 'keywords',    label: '키워드' },
  { value: 'all',         label: '전체' },
]

// ── 메인 컴포넌트 ──────────────────────────────────────────────────
export default function CopyGenerator({ projectId, title, genre }: CopyGeneratorProps) {
  // ── 플랫폼 선택 ─────────────────────────────────────────────────
  const [platform, setPlatform] = useState<SellingPlatform>('bookk')

  // ── 책 특성 메모 (선택) ──────────────────────────────────────────
  const [memoOpen, setMemoOpen] = useState(false)
  const [coreContent, setCoreContent] = useState('')
  const [targetReader, setTargetReader] = useState('')

  // ── 생성 상태 ────────────────────────────────────────────────────
  const [result, setResult] = useState<GeneratedCopy | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── 수정 요청 ────────────────────────────────────────────────────
  const [revisionTarget, setRevisionTarget] = useState<RevisionTarget>('description')
  const [revisionText, setRevisionText] = useState('')

  // ── API 호출 ─────────────────────────────────────────────────────
  async function callApi(type: ApiType, withRevision = false) {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/selling/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          platform,
          type,
          // 작가 메모 — 항상 전달 (비어 있으면 API에서 무시)
          coreContent:  coreContent  || undefined,
          targetReader: targetReader || undefined,
          // 수정 요청 지시사항 — handleRevise()에서만 전달
          revisionText: withRevision ? (revisionText || undefined) : undefined,
        }),
      })

      // SSE 스트리밍 응답 처리
      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })
          }
        }
        // 마지막 "data: {...}" 라인 파싱
        const lastData = buf.split('\n').filter((l) => l.startsWith('data: ')).pop()
        const json = JSON.parse(lastData?.replace('data: ', '') ?? '{}')
        mergeResult(json.data ?? json, type)
        return
      }

      // 표준 JSON 응답
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '카피 생성 중 오류가 발생했습니다.')
        return
      }
      mergeResult(json.data, type)
    } catch {
      setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  function mergeResult(data: Partial<GeneratedCopy>, type: ApiType) {
    setResult((prev) => {
      // 전체 생성이거나 첫 생성
      if (!prev || type === 'all') return data as GeneratedCopy
      // 부분 수정: 해당 필드만 교체
      return {
        titles:      type === 'title'       ? (data.titles      ?? prev.titles)      : prev.titles,
        description: type === 'description' ? (data.description ?? prev.description) : prev.description,
        author_bio:  type === 'author_bio'  ? (data.author_bio  ?? prev.author_bio)  : prev.author_bio,
        keywords:    type === 'keywords'    ? (data.keywords    ?? prev.keywords)    : prev.keywords,
      }
    })
  }

  function handleGenerate() {
    setResult(null)
    callApi('all')
  }

  function handleRegenerate() {
    setResult(null)
    callApi('all')
  }

  function handleRevise() {
    callApi(revisionTarget, true)
    setRevisionText('')
  }

  // ── 렌더 ────────────────────────────────────────────────────────
  return (
    <div className="space-y-10">

      {/* ════════════════════════════════════════════════════════
          Section 1: 소개문 생성
      ════════════════════════════════════════════════════════ */}
      <section className="space-y-5">
        <div>
          <h3 className="text-base font-semibold text-gray-900">소개문 생성</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            플랫폼을 선택하고 AI 카피를 생성하세요
          </p>
        </div>

        {/* 플랫폼 라디오 */}
        <fieldset>
          <legend className="sr-only">출판 플랫폼 선택</legend>
          <div className="space-y-2.5">
            {PLATFORMS.map((p) => {
              const isSelected = platform === p.value
              return (
                <label
                  key={p.value}
                  className={cn(
                    'flex items-center gap-3.5 rounded-xl border-2 px-4 py-3.5 cursor-pointer transition-all select-none',
                    isSelected
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50',
                  )}
                >
                  <input
                    type="radio"
                    name="selling-platform"
                    value={p.value}
                    checked={isSelected}
                    onChange={() => {
                      setPlatform(p.value)
                      setResult(null)
                      setError(null)
                    }}
                    className="sr-only"
                  />
                  {/* 라디오 원형 */}
                  <span
                    className={cn(
                      'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      isSelected ? 'border-gray-900' : 'border-gray-300',
                    )}
                    style={{ width: '1.125rem', height: '1.125rem' }}
                  >
                    {isSelected && (
                      <span className="h-2 w-2 rounded-full bg-gray-900" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className={cn('text-sm font-semibold', isSelected ? 'text-gray-900' : 'text-gray-700')}>
                      {p.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.sub}</p>
                  </div>
                </label>
              )
            })}
          </div>
        </fieldset>

        {/* 책 특성 메모 (아코디언) */}
        <div className="rounded-xl border border-dashed border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => setMemoOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-gray-400 shrink-0"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
              <span className="text-sm font-medium text-gray-700">
                책 특성 메모
              </span>
              <span className="text-xs text-gray-400">(선택)</span>
              {(coreContent || targetReader) && (
                <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  입력됨
                </span>
              )}
            </div>
            <svg
              className={cn('w-4 h-4 text-gray-400 transition-transform shrink-0', memoOpen && 'rotate-180')}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {memoOpen && (
            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-gray-100 bg-white">
              {/* 핵심 내용 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  핵심 내용
                  <span className="ml-1 font-normal text-gray-400">— AI에 전달할 책의 핵심 메시지</span>
                </label>
                <textarea
                  value={coreContent}
                  onChange={(e) => setCoreContent(e.target.value)}
                  placeholder="예: 번아웃을 경험한 30대가 독서를 통해 삶의 방향을 재발견하는 에세이"
                  rows={2}
                  maxLength={300}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                />
                <p className="text-right text-xs text-gray-400 mt-1">{coreContent.length}/300</p>
              </div>

              {/* 타겟 독자 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  타겟 독자
                  <span className="ml-1 font-normal text-gray-400">— 주요 독자층</span>
                </label>
                <input
                  type="text"
                  value={targetReader}
                  onChange={(e) => setTargetReader(e.target.value)}
                  placeholder="예: 30–40대 직장인, 자기계발과 내면 성장에 관심 있는 독자"
                  maxLength={100}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <p className="text-xs text-gray-400 leading-relaxed">
                위 정보는 생성 품질 향상을 위한 참고용입니다.
                AI는 프로젝트 정보와 함께 이 메모를 반영해 카피를 작성합니다.
              </p>
            </div>
          )}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <svg
              className="w-4 h-4 text-red-500 mt-0.5 shrink-0"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* 생성 버튼 — 미생성 상태에만 표시 */}
        {!result && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                소개문 생성 중…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                AI 소개문 생성하기
              </>
            )}
          </button>
        )}

        {/* 로딩 인디케이터 (재생성 중) */}
        {loading && result && (
          <div className="flex items-center justify-center gap-2.5 py-4 text-sm text-gray-500">
            <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" />
            카피를 다시 생성하고 있습니다…
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════
          Section 2: 플랫폼별 카드 (생성 완료 후)
      ════════════════════════════════════════════════════════ */}
      {result && !loading && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              {PLATFORMS.find((p) => p.value === platform)?.label} 카피 결과
            </h3>
            <button
              onClick={handleRegenerate}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              다시 생성
            </button>
          </div>

          {/* 소개문 카드 — 플랫폼별 글자 수 가이드 포함 */}
          <PlatformCopyCard
            label="소개문"
            content={result.description}
            variant="text"
            platform={platform}
            type="description"
          />

          {/* 제목 후보 */}
          <PlatformCopyCard
            label="제목 후보 3개"
            content={result.titles}
            variant="list"
          />

          {/* 저자 소개 */}
          {result.author_bio && (
            <PlatformCopyCard
              label="저자 소개"
              content={result.author_bio}
              variant="text"
            />
          )}

          {/* 검색 키워드 */}
          <PlatformCopyCard
            label="검색 키워드 5개"
            content={result.keywords}
            variant="tags"
          />

          {/* ── 수정 요청 ───────────────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-3.5">
            <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
              수정 요청
            </p>

            {/* 수정 대상 선택 */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-gray-500 mr-1">수정 대상:</span>
              {REVISION_TARGETS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setRevisionTarget(t.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                    revisionTarget === t.value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* 지시사항 입력 */}
            <textarea
              value={revisionText}
              onChange={(e) => setRevisionText(e.target.value)}
              placeholder="예: 소개문을 더 짧고 감성적으로, 독자의 공감을 이끄는 표현으로 바꿔주세요"
              rows={2}
              maxLength={200}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
            />

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">{revisionText.length}/200</p>
              <button
                onClick={handleRevise}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    재생성 중…
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    수정 요청으로 재생성
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════
          Section 3: 표지 제작 도구 (생성 완료 후)
      ════════════════════════════════════════════════════════ */}
      {result && !loading && (
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-gray-900">표지 제작 도구</h3>
          <CanvaDeepLink platform={platform} />
        </section>
      )}
    </div>
  )
}
