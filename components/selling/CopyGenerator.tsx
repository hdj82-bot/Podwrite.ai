'use client'

/**
 * CopyGenerator — AI 판매 소개문 생성기 (고도화)
 *
 * 지원 플랫폼: 부크크 / 교보문고 (KDP는 별도 모듈)
 * API: POST /api/selling/copy → JSON 단건 응답
 *
 * 섹션 순서:
 *   1. 소개문 생성 (플랫폼 탭 선택 + 책 특성 메모 + 생성 버튼)
 *   2. 결과 탭 뷰 (소개문 · 제목후보 · 저자소개 · 키워드 · 전체비교)
 *   3. 수정 요청
 *   4. SNS 스니펫
 *   5. 표지 제작 도구 (CanvaDeepLink)
 *
 * 추가 기능:
 *   - 카피 히스토리 (localStorage, 최대 5개)
 *   - 버전 비교 모달 (좌우 diff)
 *   - 카피 전체 복사 (마크다운) + TXT 다운로드
 */

import { useState, useEffect } from 'react'
import PlatformCopyCard from './PlatformCopyCard'
import CanvaDeepLink from './CanvaDeepLink'
import SocialSnippets from './SocialSnippets'
import { cn } from '@/lib/utils'

// ── 타입 ──────────────────────────────────────────────────────────
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

interface CopyVersion {
  id:        string
  timestamp: number
  platform:  SellingPlatform
  result:    GeneratedCopy
}

type ApiType        = 'all' | 'title' | 'description' | 'author_bio' | 'keywords'
type RevisionTarget = ApiType
type ResultTab      = 'description' | 'titles' | 'author_bio' | 'keywords' | 'compare'

// ── 상수 ──────────────────────────────────────────────────────────
const PLATFORMS: Array<{ value: SellingPlatform; label: string; sub: string }> = [
  { value: 'bookk', label: '부크크',   sub: 'POD · 검색 친화형' },
  { value: 'kyobo', label: '교보문고', sub: '교양·실용 · 신뢰 어조' },
]

const REVISION_TARGETS: Array<{ value: RevisionTarget; label: string }> = [
  { value: 'description', label: '소개문' },
  { value: 'title',       label: '제목 후보' },
  { value: 'author_bio',  label: '저자 소개' },
  { value: 'keywords',    label: '키워드' },
  { value: 'all',         label: '전체' },
]

const RESULT_TABS: Array<{ value: ResultTab; label: string }> = [
  { value: 'description', label: '소개문' },
  { value: 'titles',      label: '제목 후보' },
  { value: 'author_bio',  label: '저자 소개' },
  { value: 'keywords',    label: '키워드' },
  { value: 'compare',     label: '전체 비교' },
]

// 플랫폼별 소개문 권장 범위 (비교 탭 진행률 바용)
const DESC_RANGE: Record<SellingPlatform, { min: number; max: number }> = {
  bookk: { min: 200, max: 500 },
  kyobo: { min: 300, max: 800 },
}

const HISTORY_MAX = 5
const historyKey  = (pid: string) => `podwrite_copy_history_${pid}`

// ── 로컬스토리지 ──────────────────────────────────────────────────
function loadHistory(projectId: string): CopyVersion[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(historyKey(projectId))
    return raw ? (JSON.parse(raw) as CopyVersion[]) : []
  } catch {
    return []
  }
}

function persistHistory(projectId: string, versions: CopyVersion[]) {
  try {
    localStorage.setItem(historyKey(projectId), JSON.stringify(versions))
  } catch {}
}

// ── 내보내기 유틸리티 ─────────────────────────────────────────────
function toMarkdown(
  platform: SellingPlatform,
  result: GeneratedCopy,
  bookTitle: string,
): string {
  const label = platform === 'bookk' ? '부크크' : '교보문고'
  return [
    `# ${bookTitle} — ${label} 카피`,
    '',
    '## 소개문',
    '',
    result.description,
    '',
    '## 제목 후보',
    '',
    ...result.titles.map((t, i) => `${i + 1}. ${t}`),
    '',
    '## 저자 소개',
    '',
    result.author_bio,
    '',
    '## 검색 키워드',
    '',
    result.keywords.join(', '),
  ].join('\n')
}

function toPlainText(
  platform: SellingPlatform,
  result: GeneratedCopy,
  bookTitle: string,
): string {
  const label = platform === 'bookk' ? '부크크' : '교보문고'
  return [
    `[${bookTitle} — ${label} 카피]`,
    '',
    '[소개문]',
    result.description,
    '',
    '[제목 후보]',
    ...result.titles.map((t, i) => `${i + 1}. ${t}`),
    '',
    '[저자 소개]',
    result.author_bio,
    '',
    '[검색 키워드]',
    result.keywords.join(', '),
  ].join('\n')
}

function formatTs(ts: number): string {
  const d = new Date(ts)
  return (
    d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────
export default function CopyGenerator({ projectId, title, genre }: CopyGeneratorProps) {
  // ── 플랫폼 ──────────────────────────────────────────────────────
  const [platform, setPlatform] = useState<SellingPlatform>('bookk')

  // ── 책 특성 메모 ─────────────────────────────────────────────────
  const [memoOpen,     setMemoOpen]     = useState(false)
  const [coreContent,  setCoreContent]  = useState('')
  const [targetReader, setTargetReader] = useState('')

  // ── 플랫폼별 결과 저장 ───────────────────────────────────────────
  const [allResults, setAllResults] = useState<Partial<Record<SellingPlatform, GeneratedCopy>>>({})
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const result = allResults[platform] ?? null

  // ── 결과 탭 ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ResultTab>('description')

  // ── 수정 요청 ────────────────────────────────────────────────────
  const [revisionTarget, setRevisionTarget] = useState<RevisionTarget>('description')
  const [revisionText,   setRevisionText]   = useState('')

  // ── 히스토리 ─────────────────────────────────────────────────────
  const [history,     setHistory]     = useState<CopyVersion[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds,  setCompareIds]  = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)

  // ── 내보내기 피드백 ──────────────────────────────────────────────
  const [exportCopied, setExportCopied] = useState(false)

  useEffect(() => {
    setHistory(loadHistory(projectId))
  }, [projectId])

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
          coreContent:  coreContent  || undefined,
          targetReader: targetReader || undefined,
          revisionText: withRevision ? (revisionText || undefined) : undefined,
        }),
      })

      // SSE 스트리밍 응답 처리
      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        const reader  = res.body?.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })
          }
        }
        const lastData = buf.split('\n').filter((l) => l.startsWith('data: ')).pop()
        const json = JSON.parse(lastData?.replace('data: ', '') ?? '{}')
        mergeResult(json.data ?? json, type)
        return
      }

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
    setAllResults((prev) => {
      const current = prev[platform] ?? null
      let next: GeneratedCopy
      if (!current || type === 'all') {
        next = data as GeneratedCopy
      } else {
        next = {
          titles:      type === 'title'       ? (data.titles      ?? current.titles)      : current.titles,
          description: type === 'description' ? (data.description ?? current.description) : current.description,
          author_bio:  type === 'author_bio'  ? (data.author_bio  ?? current.author_bio)  : current.author_bio,
          keywords:    type === 'keywords'    ? (data.keywords    ?? current.keywords)    : current.keywords,
        }
      }
      return { ...prev, [platform]: next }
    })
  }

  function handleGenerate() {
    setAllResults((prev) => ({ ...prev, [platform]: undefined }))
    callApi('all')
  }

  function handleRegenerate() {
    setAllResults((prev) => ({ ...prev, [platform]: undefined }))
    callApi('all')
  }

  function handleRevise() {
    callApi(revisionTarget, true)
    setRevisionText('')
  }

  // ── 히스토리 저장 ────────────────────────────────────────────────
  function handleSaveVersion() {
    if (!result) return
    const version: CopyVersion = {
      id:        Date.now().toString(),
      timestamp: Date.now(),
      platform,
      result,
    }
    const updated = [version, ...history].slice(0, HISTORY_MAX)
    setHistory(updated)
    persistHistory(projectId, updated)
  }

  function handleRestoreVersion(version: CopyVersion) {
    setAllResults((prev) => ({ ...prev, [version.platform]: version.result }))
    setPlatform(version.platform)
    setHistoryOpen(false)
    setCompareMode(false)
    setCompareIds([])
  }

  function toggleCompareSelect(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  function openCompareModal() {
    setShowCompare(true)
    setHistoryOpen(false)
  }

  // ── 내보내기 ─────────────────────────────────────────────────────
  async function handleExportMarkdown() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(toMarkdown(platform, result, title))
      setExportCopied(true)
      setTimeout(() => setExportCopied(false), 2000)
    } catch {}
  }

  function handleExportTxt() {
    if (!result) return
    const text  = toPlainText(platform, result, title)
    const blob  = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url   = URL.createObjectURL(blob)
    const a     = document.createElement('a')
    const label = platform === 'bookk' ? '부크크' : '교보문고'
    a.href     = url
    a.download = `${title}_${label}_카피.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── 비교 모달에서 보여줄 버전 2개 ────────────────────────────────
  const compareVersions = compareIds
    .map((id) => history.find((v) => v.id === id))
    .filter((v): v is CopyVersion => !!v)

  // ── 렌더 ────────────────────────────────────────────────────────
  return (
    <div className="space-y-10">

      {/* ════════════════════════════════════════════════════════
          히스토리 사이드 패널 (슬라이드 인)
      ════════════════════════════════════════════════════════ */}
      {historyOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          onClick={() => {
            setHistoryOpen(false)
            setCompareMode(false)
            setCompareIds([])
          }}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full max-w-sm bg-white h-full flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900">
                저장된 버전
                {history.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {history.length}/{HISTORY_MAX}
                  </span>
                )}
              </h4>
              <button
                onClick={() => {
                  setHistoryOpen(false)
                  setCompareMode(false)
                  setCompareIds([])
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 비교 모드 토글 */}
            {history.length >= 2 && (
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
                <button
                  onClick={() => {
                    setCompareMode((v) => !v)
                    setCompareIds([])
                  }}
                  className={cn(
                    'text-xs font-medium transition-colors',
                    compareMode ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800',
                  )}
                >
                  {compareMode ? '버전 선택 중 (최대 2개)' : '버전 비교하기'}
                </button>
                {compareMode && compareIds.length === 2 && (
                  <button
                    onClick={openCompareModal}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
                  >
                    비교 보기
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* 버전 목록 */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-14 px-5 text-center">
                  <svg className="w-8 h-8 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                  </svg>
                  <p className="text-sm text-gray-400">
                    저장된 버전이 없습니다.<br />
                    카피 생성 후 &quot;이 버전 저장&quot;을 눌러보세요.
                  </p>
                </div>
              ) : (
                history.map((v) => {
                  const pLabel     = v.platform === 'bookk' ? '부크크' : '교보문고'
                  const isSelected = compareIds.includes(v.id)
                  return (
                    <div
                      key={v.id}
                      className={cn(
                        'px-5 py-4 transition-colors',
                        compareMode && isSelected ? 'bg-blue-50' : 'hover:bg-gray-50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold text-gray-600 bg-gray-100 rounded-md">
                              {pLabel}
                            </span>
                            <span className="text-xs text-gray-400">{formatTs(v.timestamp)}</span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">
                            {v.result.description}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {compareMode ? (
                            <button
                              onClick={() => toggleCompareSelect(v.id)}
                              className={cn(
                                'text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors',
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400',
                              )}
                            >
                              {isSelected ? '선택됨' : '선택'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestoreVersion(v)}
                              className="text-xs px-2.5 py-1.5 rounded-lg border bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-400 font-medium transition-colors"
                            >
                              불러오기
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          버전 비교 모달 (좌우 diff)
      ════════════════════════════════════════════════════════ */}
      {showCompare && compareVersions.length === 2 && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={() => {
            setShowCompare(false)
            setCompareMode(false)
            setCompareIds([])
          }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h4 className="text-sm font-semibold text-gray-900">버전 비교</h4>
              <button
                onClick={() => {
                  setShowCompare(false)
                  setCompareMode(false)
                  setCompareIds([])
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-6">
                {compareVersions.map((v) => (
                  <div key={v.id} className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-md">
                        {v.platform === 'bookk' ? '부크크' : '교보문고'}
                      </span>
                      <span className="text-xs text-gray-400">{formatTs(v.timestamp)}</span>
                      <button
                        onClick={() => handleRestoreVersion(v)}
                        className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                      >
                        이 버전 적용
                      </button>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">소개문</p>
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                        {v.result.description}
                      </p>
                      <p className="text-xs text-gray-400 text-right mt-1">{v.result.description.length}자</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">제목 후보</p>
                      <ol className="space-y-1">
                        {v.result.titles.map((t, i) => (
                          <li key={i} className="text-sm text-gray-700">{i + 1}. {t}</li>
                        ))}
                      </ol>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">키워드</p>
                      <div className="flex flex-wrap gap-1">
                        {v.result.keywords.map((kw, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          Section 1: 소개문 생성
      ════════════════════════════════════════════════════════ */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">소개문 생성</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              플랫폼을 선택하고 AI 카피를 생성하세요
            </p>
          </div>

          {/* 히스토리 버튼 */}
          <button
            onClick={() => setHistoryOpen(true)}
            className="relative inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            히스토리
            {history.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-gray-900 text-white text-[10px] flex items-center justify-center font-bold">
                {history.length}
              </span>
            )}
          </button>
        </div>

        {/* ── 플랫폼 탭 ────────────────────────────────────────────── */}
        <div className="flex items-stretch gap-2 p-1 bg-gray-100 rounded-xl">
          {PLATFORMS.map((p) => {
            const isSelected = platform === p.value
            const hasResult  = !!allResults[p.value]
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  setPlatform(p.value)
                  setError(null)
                  setActiveTab('description')
                }}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-lg transition-all',
                  isSelected
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold">{p.label}</span>
                  {hasResult && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  )}
                </div>
                <span className={cn('text-xs', isSelected ? 'text-gray-500' : 'text-gray-400')}>
                  {p.sub}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── 책 특성 메모 (아코디언) ──────────────────────────────── */}
        <div className="rounded-xl border border-dashed border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => setMemoOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
              <span className="text-sm font-medium text-gray-700">책 특성 메모</span>
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
            <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

        {/* 재생성 로딩 인디케이터 */}
        {loading && result && (
          <div className="flex items-center justify-center gap-2.5 py-4 text-sm text-gray-500">
            <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" />
            카피를 다시 생성하고 있습니다…
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════
          Section 2: 결과 탭 뷰 (생성 완료 후)
      ════════════════════════════════════════════════════════ */}
      {result && !loading && (
        <section className="space-y-4">

          {/* 섹션 헤더 */}
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-gray-900">
              {PLATFORMS.find((p) => p.value === platform)?.label} 카피 결과
            </h3>
            <div className="flex items-center gap-2">
              {/* 이 버전 저장 */}
              <button
                onClick={handleSaveVersion}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
                이 버전 저장
              </button>

              {/* 다시 생성 */}
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
          </div>

          {/* 결과 탭 바 */}
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {RESULT_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'shrink-0 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
                  activeTab === tab.value
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── 탭 콘텐츠 ──────────────────────────────────────────── */}
          <div>
            {activeTab === 'description' && (
              <PlatformCopyCard
                label="소개문"
                content={result.description}
                variant="text"
                platform={platform}
                type="description"
              />
            )}

            {activeTab === 'titles' && (
              <PlatformCopyCard
                label="제목 후보 3개"
                content={result.titles}
                variant="list"
              />
            )}

            {activeTab === 'author_bio' && (
              <PlatformCopyCard
                label="저자 소개"
                content={result.author_bio}
                variant="text"
              />
            )}

            {activeTab === 'keywords' && (
              <PlatformCopyCard
                label="검색 키워드 5개"
                content={result.keywords}
                variant="tags"
              />
            )}

            {/* 전체 비교 탭 — 두 플랫폼 나란히 */}
            {activeTab === 'compare' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">
                  양쪽 플랫폼에서 카피를 먼저 생성하면 나란히 비교할 수 있습니다.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {PLATFORMS.map((p) => {
                    const pResult = allResults[p.value]
                    const range   = DESC_RANGE[p.value]
                    return (
                      <div key={p.value} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700">{p.label}</span>
                          {pResult && (
                            <span className="text-xs text-gray-400">{pResult.description.length}자</span>
                          )}
                        </div>
                        {pResult ? (
                          <div className="p-4 space-y-3">
                            <div className="space-y-1.5">
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all duration-300',
                                    pResult.description.length < range.min
                                      ? 'bg-red-400'
                                      : pResult.description.length > range.max
                                      ? 'bg-amber-400'
                                      : 'bg-green-400',
                                  )}
                                  style={{
                                    width: `${Math.min(
                                      (pResult.description.length / range.max) * 100,
                                      100,
                                    )}%`,
                                  }}
                                />
                              </div>
                              <p className="text-xs text-gray-400 text-right">
                                {pResult.description.length} / {range.max}자
                              </p>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed line-clamp-5">
                              {pResult.description}
                            </p>
                          </div>
                        ) : (
                          <div className="p-5 flex flex-col items-center gap-2.5 min-h-[120px] justify-center">
                            <p className="text-xs text-gray-400 text-center">카피가 아직 생성되지 않았습니다</p>
                            <button
                              onClick={() => {
                                setPlatform(p.value)
                                setActiveTab('description')
                              }}
                              className="text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              {p.label} 카피 생성하기
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── 내보내기 버튼 ─────────────────────────────────────── */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleExportMarkdown}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors',
                exportCopied
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300',
              )}
            >
              {exportCopied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  복사됨
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                  카피 전체 복사
                </>
              )}
            </button>

            <button
              onClick={handleExportTxt}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              TXT 다운로드
            </button>
          </div>

          {/* ── 수정 요청 ─────────────────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-3.5">
            <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
              수정 요청
            </p>

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
          Section 3: SNS 스니펫 (생성 완료 후)
      ════════════════════════════════════════════════════════ */}
      {result && !loading && (
        <section className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">SNS 스니펫</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              생성된 카피를 SNS 채널별 형식으로 자동 변환합니다
            </p>
          </div>
          <SocialSnippets
            description={result.description}
            titles={result.titles}
            keywords={result.keywords}
          />
        </section>
      )}

      {/* ════════════════════════════════════════════════════════
          Section 4: 표지 제작 도구 (생성 완료 후)
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
