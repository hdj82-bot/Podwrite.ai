'use client'

/**
 * TranslationPanel — 한→영 번역 패널
 *
 * - "전체 번역 시작" → POST /api/translate (Inngest 잡 트리거)
 * - 번역 진행 상태: Supabase Realtime으로 chapter_versions 변경 감지
 * - 챕터별 번역 완료 체크리스트
 * - 완료 후 EPUB 생성 버튼 활성화
 */

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, Circle, Loader2, Globe, BookOpen, AlertCircle } from 'lucide-react'
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

type TranslationStatus = 'idle' | 'running' | 'done' | 'error'

export default function TranslationPanel({
  projectId,
  chapters,
  onEpubReady,
}: TranslationPanelProps) {
  const [status, setStatus] = useState<TranslationStatus>('idle')
  const [translatedIds, setTranslatedIds] = useState<Set<string>>(new Set())
  const [jobId, setJobId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [epubLoading, setEpubLoading] = useState(false)
  const [epubUrl, setEpubUrl] = useState<string | null>(null)
  const [startTime, setStartTime] = useState<number | null>(null)

  const sortedChapters = [...chapters].sort((a, b) => a.order_idx - b.order_idx)
  const allTranslated = sortedChapters.length > 0 && translatedIds.size >= sortedChapters.length

  // ── Supabase Realtime으로 번역 완료 감지 ────────────────────────────
  useEffect(() => {
    if (status !== 'running' || !startTime) return

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
          // chapter_id가 현재 프로젝트 챕터에 속하는지 확인
          const chapterId = payload.new?.chapter_id as string | undefined
          if (chapterId && chapters.some((c) => c.id === chapterId)) {
            setTranslatedIds((prev) => new Set([...prev, chapterId]))
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [status, startTime, projectId, chapters])

  // ── 번역 완료 감지 ────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'running' && allTranslated) {
      setStatus('done')
    }
  }, [status, allTranslated])

  // ── 번역 시작 ──────────────────────────────────────────────────────
  async function startTranslation(chapterIds: string[] = []) {
    setStatus('running')
    setErrorMsg(null)
    setStartTime(Date.now())
    setTranslatedIds(new Set())

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, chapter_ids: chapterIds }),
      })
      const json = await res.json()

      if (!res.ok) {
        setStatus('error')
        setErrorMsg(json.error ?? '번역 요청 실패')
        return
      }

      setJobId(json.data.job_id)

      // 폴링: 주기적으로 챕터 번역 완료 수 확인
      startPolling()
    } catch {
      setStatus('error')
      setErrorMsg('네트워크 오류가 발생했습니다.')
    }
  }

  // ── 상태 폴링 (Realtime 백업) ─────────────────────────────────────
  const startPolling = useCallback(() => {
    const supabase = createClient()
    const pollStart = Date.now()

    const timer = setInterval(async () => {
      if (Date.now() - pollStart > 30 * 60 * 1000) {
        clearInterval(timer)
        return
      }

      // chapter_versions에서 현재 프로젝트 챕터의 번역 완료 수 조회
      const { data } = await supabase
        .from('chapter_versions')
        .select('chapter_id')
        .eq('trigger', 'ai_edit')
        .in(
          'chapter_id',
          chapters.map((c) => c.id),
        )

      if (data) {
        const ids = new Set(data.map((r) => r.chapter_id as string))
        setTranslatedIds(ids)
        if (ids.size >= chapters.length) {
          clearInterval(timer)
          setStatus('done')
        }
      }
    }, 10_000) // 10초마다 폴링

    return () => clearInterval(timer)
  }, [chapters])

  // ── EPUB 생성 ──────────────────────────────────────────────────────
  async function generateEpub() {
    setEpubLoading(true)
    try {
      const res = await fetch('/api/generate-epub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          language: 'en',
          include_toc: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setEpubUrl(json.data.job_id)
      onEpubReady()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'EPUB 생성 실패')
    } finally {
      setEpubLoading(false)
    }
  }

  const estimatedMinutes = Math.max(1, Math.ceil(sortedChapters.length * 1.5))

  return (
    <div className="space-y-6">
      {/* 헤더 상태 */}
      <div
        className={cn(
          'rounded-xl p-5 flex items-start gap-4',
          status === 'idle' && 'bg-gray-50 border border-gray-200',
          status === 'running' && 'bg-blue-50 border border-blue-200',
          status === 'done' && 'bg-green-50 border border-green-200',
          status === 'error' && 'bg-red-50 border border-red-200',
        )}
      >
        <div className="mt-0.5 shrink-0">
          {status === 'idle' && <Globe className="h-6 w-6 text-gray-400" />}
          {status === 'running' && <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />}
          {status === 'done' && <CheckCircle2 className="h-6 w-6 text-green-500" />}
          {status === 'error' && <AlertCircle className="h-6 w-6 text-red-500" />}
        </div>
        <div className="flex-1 min-w-0">
          {status === 'idle' && (
            <>
              <p className="font-semibold text-gray-900">번역 준비 완료</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {sortedChapters.length}개 챕터, 예상 소요 시간: 약 {estimatedMinutes}분
              </p>
            </>
          )}
          {status === 'running' && (
            <>
              <p className="font-semibold text-blue-900">번역 진행 중...</p>
              <p className="text-sm text-blue-700 mt-0.5">
                {translatedIds.size}/{sortedChapters.length}개 챕터 완료 · 백그라운드에서 처리 중
                (약 {estimatedMinutes}분 소요)
              </p>
              {jobId && (
                <p className="text-xs text-blue-400 mt-1">Job ID: {jobId}</p>
              )}
            </>
          )}
          {status === 'done' && (
            <>
              <p className="font-semibold text-green-900">번역 완료!</p>
              <p className="text-sm text-green-700 mt-0.5">
                전체 {sortedChapters.length}개 챕터 번역이 완료되었습니다.
              </p>
            </>
          )}
          {status === 'error' && (
            <>
              <p className="font-semibold text-red-900">번역 실패</p>
              <p className="text-sm text-red-700 mt-0.5">{errorMsg}</p>
            </>
          )}
        </div>
      </div>

      {/* 번역 시작 버튼 */}
      {(status === 'idle' || status === 'error') && (
        <div className="flex gap-3">
          <button
            onClick={() => startTranslation([])}
            disabled={sortedChapters.length === 0}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white py-3 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Globe className="h-4 w-4" />
            전체 번역 시작 ({sortedChapters.length}개 챕터)
          </button>
        </div>
      )}

      {/* 챕터별 체크리스트 */}
      {sortedChapters.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">챕터별 번역 상태</h3>
          <div className="space-y-2">
            {sortedChapters.map((ch) => {
              const isDone = translatedIds.has(ch.id)
              const isActive = status === 'running' && !isDone
              return (
                <div
                  key={ch.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-3 text-sm',
                    isDone ? 'bg-green-50' : isActive ? 'bg-blue-50' : 'bg-gray-50',
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-gray-300 shrink-0" />
                  )}
                  <span className="text-xs text-gray-400 font-mono w-6 shrink-0">
                    {ch.order_idx}
                  </span>
                  <span
                    className={cn(
                      'flex-1 truncate',
                      isDone ? 'text-green-800' : 'text-gray-600',
                    )}
                  >
                    {ch.title}
                  </span>
                  {isDone && (
                    <span className="text-xs text-green-600 font-medium shrink-0">완료</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* EPUB 생성 버튼 */}
      <div
        className={cn(
          'rounded-xl border p-5 transition-all',
          allTranslated || status === 'done'
            ? 'border-orange-200 bg-orange-50'
            : 'border-gray-200 bg-gray-50 opacity-60',
        )}
      >
        <div className="flex items-center gap-3 mb-3">
          <BookOpen
            className={cn(
              'h-5 w-5 shrink-0',
              allTranslated ? 'text-orange-500' : 'text-gray-400',
            )}
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">영문 EPUB 생성</p>
            <p className="text-xs text-gray-500">번역 완료 후 Kindle용 EPUB 생성</p>
          </div>
        </div>

        {epubUrl ? (
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
                <Loader2 className="h-4 w-4 animate-spin" />
                EPUB 생성 중...
              </span>
            ) : (
              'Kindle EPUB 생성하기'
            )}
          </button>
        )}
      </div>

      {/* 번역 안내 */}
      <div className="text-xs text-gray-400 space-y-1">
        <p>• Claude AI가 한국어 원문을 영어권 독자에게 맞게 문화 현지화합니다.</p>
        <p>• 번역 완료 후 각 챕터를 검토하고 필요하면 편집기에서 수정하세요.</p>
        <p>• 번역본은 원본 원고에 영향을 주지 않습니다.</p>
      </div>
    </div>
  )
}
