'use client'

/**
 * TranslationPanel — 한→영 번역 패널 (개선판)
 *
 * 개선 사항:
 *   - localStorage 자동저장 (500ms 디바운스) + 복원
 *   - 배치 번역 실패 챕터 추적 + 개별 재시도
 *   - 전체 진행률 progress bar
 *   - 번역 품질 지표 (원문/번역 단어수 비율)
 *   - 현재 번역 중인 챕터명 표시
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  CheckCircle2,
  Circle,
  Loader2,
  Globe,
  BookOpen,
  AlertCircle,
  ChevronDown,
  Sparkles,
  Save,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'

interface Chapter {
  id: string
  title: string
  order_idx: number
}

interface TranslationPanelProps {
  projectId: string
  chapters: Chapter[]
  onEpubReady: () => void
}

type BatchStatus = 'idle' | 'running' | 'done' | 'error'

// TipTap 문서 → 평문 텍스트 추출
function tiptapToText(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return ''
  const d = doc as { content?: unknown[] }
  if (!Array.isArray(d.content)) return ''

  function nodeToText(node: unknown): string {
    if (!node || typeof node !== 'object') return ''
    const n = node as { type?: string; text?: string; content?: unknown[] }
    if (n.type === 'text') return n.text ?? ''
    if (n.type === 'hardBreak') return '\n'
    if (n.type === 'paragraph') return (n.content ?? []).map(nodeToText).join('') + '\n\n'
    if (n.type === 'heading') return (n.content ?? []).map(nodeToText).join('') + '\n\n'
    if (n.content) return n.content.map(nodeToText).join('')
    return ''
  }

  return d.content.map(nodeToText).join('').trim()
}

/** 단어 수 카운트 (공백 분리) */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** localStorage 키 */
function storageKey(projectId: string, chapterId: string) {
  return `pod_translation_${projectId}_${chapterId}`
}

export default function TranslationPanel({ projectId, chapters, onEpubReady }: TranslationPanelProps) {
  const sortedChapters = [...chapters].sort((a, b) => a.order_idx - b.order_idx)

  // ── 챕터 선택 ──────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string>(sortedChapters[0]?.id ?? '')
  const selectedChapter = sortedChapters.find((c) => c.id === selectedId)

  // ── 챕터 콘텐츠 ────────────────────────────────────────────────────────
  const [koText, setKoText] = useState('')
  const [enText, setEnText] = useState('')
  const [loadingChapter, setLoadingChapter] = useState(false)
  const [translatingChapter, setTranslatingChapter] = useState(false)
  const [chapterError, setChapterError] = useState<string | null>(null)

  // ── 자동저장 ───────────────────────────────────────────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // ── 배치 번역 ──────────────────────────────────────────────────────────
  const [batchStatus, setBatchStatus] = useState<BatchStatus>('idle')
  const [translatedIds, setTranslatedIds] = useState<Set<string>>(new Set())
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set())
  const [currentTranslatingTitle, setCurrentTranslatingTitle] = useState<string | null>(null)
  const [batchError, setBatchError] = useState<string | null>(null)
  const [epubLoading, setEpubLoading] = useState(false)
  const [epubReady, setEpubReady] = useState(false)

  const allTranslated = sortedChapters.length > 0 && translatedIds.size >= sortedChapters.length
  const progressPct = sortedChapters.length > 0
    ? Math.round((translatedIds.size / sortedChapters.length) * 100)
    : 0

  // 번역 품질 지표
  const koWords = countWords(koText)
  const enWords = countWords(enText)
  const wordRatio = koWords > 0 ? enWords / koWords : null
  const qualityWarning = wordRatio !== null && enText.length > 0 && wordRatio < 0.5

  // ── 선택된 챕터 데이터 로드 ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return

    let cancelled = false
    setLoadingChapter(true)
    setChapterError(null)
    setKoText('')
    setEnText('')
    setSaveStatus('idle')

    async function fetchChapterData() {
      try {
        // 한국어 원문
        const res = await fetch(`/api/chapters/${selectedId}`)
        if (!res.ok) throw new Error('챕터를 불러올 수 없습니다.')
        const json = await res.json()
        if (!cancelled) setKoText(tiptapToText(json.data?.content))

        // 영어 번역 — DB 우선, 없으면 localStorage
        const supabase = createClient()
        const { data: versions } = await supabase
          .from('chapter_versions')
          .select('content, created_at')
          .eq('chapter_id', selectedId)
          .eq('trigger', 'ai_edit')
          .order('created_at', { ascending: false })
          .limit(1)

        if (cancelled) return

        if (versions && versions.length > 0) {
          const content = versions[0].content as {
            translation_en?: { content?: unknown }
          }
          const enContent = content?.translation_en?.content
          if (enContent) {
            const text = tiptapToText(enContent)
            setEnText(text)
            setTranslatedIds((prev) => new Set([...prev, selectedId]))
            return
          }
        }

        // localStorage 폴백
        const saved = localStorage.getItem(storageKey(projectId, selectedId))
        if (saved) {
          setEnText(saved)
          setSaveStatus('saved')
        }
      } catch (err) {
        if (!cancelled) setChapterError(err instanceof Error ? err.message : '로드 실패')
      } finally {
        if (!cancelled) setLoadingChapter(false)
      }
    }

    fetchChapterData()
    return () => { cancelled = true }
  }, [selectedId, projectId])

  // ── enText 변경 시 localStorage 자동저장 (500ms 디바운스) ────────────────
  useEffect(() => {
    if (!enText || loadingChapter) return

    setSaveStatus('saving')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem(storageKey(projectId, selectedId), enText)
      setSaveStatus('saved')
    }, 500)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [enText, projectId, selectedId, loadingChapter])

  // ── Realtime: 번역 완료 감지 ─────────────────────────────────────────────
  useEffect(() => {
    if (batchStatus !== 'running') return

    const supabase = createClient()
    const channel = supabase
      .channel(`translation-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chapter_versions',
          filter: `trigger=eq.ai_edit`,
        },
        (payload) => {
          const chapterId = (payload.new as { chapter_id?: string })?.chapter_id
          if (chapterId && chapters.some((c) => c.id === chapterId)) {
            setTranslatedIds((prev) => new Set([...prev, chapterId]))
            setFailedIds((prev) => { const s = new Set(prev); s.delete(chapterId); return s })

            // 현재 보고 있는 챕터가 완료되면 텍스트 갱신
            if (chapterId === selectedId) {
              const content = (payload.new as { content?: unknown }).content as {
                translation_en?: { content?: unknown }
              }
              const enContent = content?.translation_en?.content
              if (enContent) setEnText(tiptapToText(enContent))
            }

            // 다음 미번역 챕터명 표시
            const next = sortedChapters.find(
              (c) => c.id !== chapterId && !translatedIds.has(c.id)
            )
            setCurrentTranslatingTitle(next?.title ?? null)
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [batchStatus, projectId, chapters, selectedId, sortedChapters, translatedIds])

  // ── 전체 번역 완료 감지 ───────────────────────────────────────────────────
  useEffect(() => {
    if (batchStatus === 'running' && allTranslated) {
      setBatchStatus('done')
      setCurrentTranslatingTitle(null)
    }
  }, [batchStatus, allTranslated])

  // ── 폴링 (Realtime 백업, 10초 간격) ──────────────────────────────────────
  const startPolling = useCallback(() => {
    const supabase = createClient()
    const pollStart = Date.now()
    const timer = setInterval(async () => {
      if (Date.now() - pollStart > 30 * 60 * 1000) { clearInterval(timer); return }

      const { data } = await supabase
        .from('chapter_versions')
        .select('chapter_id')
        .eq('trigger', 'ai_edit')
        .in('chapter_id', chapters.map((c) => c.id))

      if (data) {
        const ids = new Set(data.map((r) => (r as { chapter_id: string }).chapter_id))
        setTranslatedIds(ids)
        if (ids.size >= chapters.length) {
          clearInterval(timer)
          setBatchStatus('done')
          setCurrentTranslatingTitle(null)
        }
      }
    }, 10_000)
    return () => clearInterval(timer)
  }, [chapters])

  // ── 이 챕터만 번역 ────────────────────────────────────────────────────────
  async function translateChapter() {
    if (!selectedId) return
    setTranslatingChapter(true)
    setChapterError(null)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, chapter_ids: [selectedId] }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '번역 요청 실패')
      startPolling()
    } catch (err) {
      setChapterError(err instanceof Error ? err.message : '번역 실패')
    } finally {
      setTranslatingChapter(false)
    }
  }

  // ── 전체 배치 번역 ────────────────────────────────────────────────────────
  async function startBatchTranslation() {
    setBatchStatus('running')
    setBatchError(null)
    setFailedIds(new Set())
    setTranslatedIds(new Set())
    setCurrentTranslatingTitle(sortedChapters[0]?.title ?? null)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, chapter_ids: [] }),
      })
      const json = await res.json()
      if (!res.ok) {
        setBatchStatus('error')
        setBatchError(json.error ?? '번역 요청 실패')
        return
      }
      startPolling()
    } catch {
      setBatchStatus('error')
      setBatchError('네트워크 오류가 발생했습니다.')
    }
  }

  // ── 실패/미번역 챕터만 재시도 ─────────────────────────────────────────────
  async function retryFailed() {
    const toRetry = sortedChapters
      .filter((c) => !translatedIds.has(c.id))
      .map((c) => c.id)

    if (toRetry.length === 0) return
    setBatchStatus('running')
    setBatchError(null)
    setFailedIds(new Set())
    setCurrentTranslatingTitle(
      sortedChapters.find((c) => c.id === toRetry[0])?.title ?? null
    )
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, chapter_ids: toRetry }),
      })
      const json = await res.json()
      if (!res.ok) {
        setBatchStatus('error')
        setBatchError(json.error ?? '재시도 실패')
        return
      }
      startPolling()
    } catch {
      setBatchStatus('error')
      setBatchError('네트워크 오류가 발생했습니다.')
    }
  }

  // ── EPUB 생성 ──────────────────────────────────────────────────────────────
  async function generateEpub() {
    setEpubLoading(true)
    try {
      const res = await fetch('/api/generate-epub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, language: 'en', include_toc: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setEpubReady(true)
      onEpubReady()
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : 'EPUB 생성 실패')
    } finally {
      setEpubLoading(false)
    }
  }

  const chapterTranslated = translatedIds.has(selectedId)
  const untranslatedCount = sortedChapters.length - translatedIds.size

  return (
    <div className="space-y-6">

      {/* ── 전체 번역 진행률 바 ── */}
      {(batchStatus === 'running' || batchStatus === 'done' || translatedIds.size > 0) && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-gray-700">
              전체 번역 진행률
              {currentTranslatingTitle && batchStatus === 'running' && (
                <span className="ml-2 text-xs text-blue-500 font-normal">
                  번역 중: {currentTranslatingTitle}
                </span>
              )}
            </span>
            <span className="text-sm font-semibold text-gray-800">
              {translatedIds.size}/{sortedChapters.length} ({progressPct}%)
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                batchStatus === 'done' ? 'bg-green-500' : 'bg-orange-400',
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {batchStatus === 'done' && untranslatedCount === 0 && (
            <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              모든 챕터 번역 완료
            </p>
          )}
          {batchStatus !== 'running' && untranslatedCount > 0 && translatedIds.size > 0 && (
            <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" />
              {untranslatedCount}개 챕터 미번역
              <button
                onClick={retryFailed}
                className="underline hover:no-underline font-medium"
              >
                재시도
              </button>
            </p>
          )}
        </div>
      )}

      {/* ── 챕터 선택 + 번역 버튼 ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full appearance-none rounded-lg border border-gray-300 bg-white pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {sortedChapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.order_idx + 1}. {ch.title}
                {translatedIds.has(ch.id) ? ' ✓' : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>

        <button
          onClick={translateChapter}
          disabled={translatingChapter || batchStatus === 'running'}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {translatingChapter ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          AI 번역
        </button>

        {(batchStatus === 'idle' || batchStatus === 'error') && (
          <button
            onClick={startBatchTranslation}
            disabled={sortedChapters.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Globe className="h-3.5 w-3.5" />
            전체 번역
          </button>
        )}

        {batchStatus === 'running' && (
          <span className="inline-flex items-center gap-1.5 text-sm text-blue-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            번역 중 ({translatedIds.size}/{sortedChapters.length})
          </span>
        )}

        {batchStatus === 'done' && (
          <span className="inline-flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            전체 완료
          </span>
        )}
      </div>

      {/* ── 챕터 에러 ── */}
      {chapterError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {chapterError}
        </div>
      )}

      {/* ── 좌/우 분할 패널 ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* 좌측: 한국어 원문 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">한국어 원문</span>
            <span className="text-xs text-gray-400">(읽기 전용)</span>
            {koWords > 0 && (
              <span className="text-xs text-gray-400 ml-auto">{koWords.toLocaleString()}단어</span>
            )}
          </div>
          <div
            className={cn(
              'flex-1 min-h-[320px] rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 overflow-y-auto whitespace-pre-wrap leading-relaxed',
              loadingChapter && 'animate-pulse',
            )}
          >
            {loadingChapter ? (
              <div className="space-y-2 pt-2">
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-5/6" />
              </div>
            ) : koText ? koText : (
              <span className="text-gray-400 italic">챕터 내용이 없습니다.</span>
            )}
          </div>
        </div>

        {/* 우측: 영어 번역 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">영어 번역</span>
              {chapterTranslated && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="h-3 w-3" />완료
                </span>
              )}
              {translatingChapter && (
                <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" />번역 중...
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* 단어수 비율 */}
              {enWords > 0 && koWords > 0 && (
                <span className={cn(
                  'text-xs',
                  qualityWarning ? 'text-amber-500' : 'text-gray-400',
                )}>
                  {enWords.toLocaleString()}단어
                  {qualityWarning && (
                    <span className="ml-1 inline-flex items-center gap-0.5">
                      <AlertTriangle className="h-3 w-3" />
                      번역이 짧습니다
                    </span>
                  )}
                </span>
              )}
              {/* 자동저장 상태 */}
              {saveStatus === 'saving' && (
                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                  <Loader2 className="h-3 w-3 animate-spin" />저장 중
                </span>
              )}
              {saveStatus === 'saved' && enText && (
                <span className="text-xs text-green-600 flex items-center gap-0.5">
                  <Save className="h-3 w-3" />저장됨
                </span>
              )}
            </div>
          </div>
          <textarea
            value={enText}
            onChange={(e) => setEnText(e.target.value)}
            placeholder={
              translatingChapter
                ? 'AI 번역 중입니다...'
                : '「AI 번역」 버튼을 눌러 번역을 시작하거나 직접 입력하세요.\n\n수정 내용은 자동으로 저장됩니다.'
            }
            className={cn(
              'flex-1 min-h-[320px] rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-orange-500',
              translatingChapter && 'opacity-60',
            )}
          />
        </div>
      </div>

      {/* ── 챕터별 번역 상태 목록 ── */}
      {sortedChapters.length > 1 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 list-none flex items-center gap-2">
            <span className="text-gray-400 group-open:rotate-90 inline-block transition-transform">▶</span>
            챕터별 번역 상태 ({translatedIds.size}/{sortedChapters.length})
            {untranslatedCount > 0 && batchStatus !== 'running' && translatedIds.size > 0 && (
              <button
                onClick={(e) => { e.preventDefault(); retryFailed() }}
                className="ml-auto inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
              >
                <RefreshCw className="h-3 w-3" />
                미번역 {untranslatedCount}개 재시도
              </button>
            )}
          </summary>
          <div className="mt-3 space-y-1.5">
            {sortedChapters.map((ch) => {
              const isDone = translatedIds.has(ch.id)
              const isFailed = failedIds.has(ch.id)
              const isActive = batchStatus === 'running' && !isDone && !isFailed
              return (
                <button
                  key={ch.id}
                  onClick={() => setSelectedId(ch.id)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-left transition-colors',
                    ch.id === selectedId && 'ring-1 ring-orange-300',
                    isDone ? 'bg-green-50' : isFailed ? 'bg-red-50' : isActive ? 'bg-blue-50' : 'bg-gray-50',
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : isFailed ? (
                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-gray-300 shrink-0" />
                  )}
                  <span className="text-xs text-gray-400 font-mono w-5 shrink-0">{ch.order_idx + 1}</span>
                  <span className={cn('flex-1 truncate', isDone ? 'text-green-800' : isFailed ? 'text-red-700' : 'text-gray-600')}>
                    {ch.title}
                  </span>
                  {isDone && <span className="text-xs text-green-600 font-medium shrink-0">완료</span>}
                  {isFailed && <span className="text-xs text-red-500 font-medium shrink-0">실패</span>}
                  {isActive && <span className="text-xs text-blue-500 font-medium shrink-0">번역 중</span>}
                </button>
              )
            })}
          </div>
        </details>
      )}

      {/* ── 배치 에러 ── */}
      {batchStatus === 'error' && batchError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{batchError}</p>
            <button
              onClick={retryFailed}
              className="mt-1.5 text-xs text-red-600 underline hover:no-underline font-medium"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      {/* ── EPUB 생성 ── */}
      <div className={cn(
        'rounded-xl border p-5 transition-all',
        allTranslated || batchStatus === 'done'
          ? 'border-orange-200 bg-orange-50'
          : 'border-gray-200 bg-gray-50 opacity-60',
      )}>
        <div className="flex items-center gap-3 mb-3">
          <BookOpen className={cn('h-5 w-5 shrink-0', allTranslated ? 'text-orange-500' : 'text-gray-400')} />
          <div>
            <p className="text-sm font-semibold text-gray-900">영문 EPUB 생성</p>
            <p className="text-xs text-gray-500">
              {allTranslated
                ? '모든 챕터 번역 완료 — EPUB 생성 가능'
                : `번역 완료 후 Kindle용 EPUB 생성 (${translatedIds.size}/${sortedChapters.length} 완료)`}
            </p>
          </div>
        </div>

        {epubReady ? (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-100 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-4 w-4" />
            EPUB 생성 완료 · 제출 패키지 탭에서 다운로드하세요
          </div>
        ) : (
          <button
            onClick={generateEpub}
            disabled={!allTranslated || epubLoading}
            className={cn(
              'w-full rounded-lg py-2.5 text-sm font-semibold transition-colors',
              allTranslated
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed',
            )}
          >
            {epubLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />EPUB 생성 중...
              </span>
            ) : 'Kindle EPUB 생성하기'}
          </button>
        )}
      </div>

      {/* ── 안내 ── */}
      <div className="text-xs text-gray-400 space-y-1">
        <p>• Claude AI가 한국어 원문을 영어권 독자에게 맞게 문화 현지화합니다.</p>
        <p>• 번역 완료 후 우측 패널에서 직접 수정할 수 있으며, 수정 내용은 자동 저장됩니다.</p>
        <p>• 번역본은 원본 원고에 영향을 주지 않습니다.</p>
      </div>
    </div>
  )
}
