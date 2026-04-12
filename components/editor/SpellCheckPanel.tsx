'use client'

/**
 * SpellCheckPanel — 맞춤법 검사 사이드 패널
 *
 * 에디터 내용(TipTap 평문 추출 → editorBridge.getText())을
 * /api/spellcheck 에 전송하고 교정 결과를 표시합니다.
 *
 * 기능:
 *   - "검사 시작" 버튼: 에디터 텍스트 추출 후 API 호출
 *   - 교정 항목별 "교정 적용" 버튼: editorBridge.replaceText()로 서식 유지 교체
 *   - "전체 적용" 버튼: 모든 항목 순차 적용
 *   - 로딩 / 오류 / 오류없음 / 초기 안내 상태
 */

import { useState, useCallback } from 'react'
import {
  SpellCheck,
  Loader2,
  ArrowRight,
  CheckSquare,
  X,
  Check,
} from 'lucide-react'
import { editorBridge } from './editorBridge'
import type { SpellCheckCorrection } from '@/lib/spellcheck'
import { cn } from '@/lib/utils'

interface SpellCheckPanelProps {
  onClose: () => void
}

export default function SpellCheckPanel({ onClose }: SpellCheckPanelProps) {
  const [corrections, setCorrections] = useState<SpellCheckCorrection[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState<Set<number>>(new Set())

  const handleCheck = useCallback(async () => {
    if (loading) return

    const text = editorBridge.getText()
    if (!text.trim()) {
      setError('에디터에 내용이 없습니다.')
      return
    }

    setLoading(true)
    setError(null)
    setCorrections(null)
    setApplied(new Set())

    try {
      const res = await fetch('/api/spellcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? `오류 (${res.status})`)
        return
      }
      setCorrections(json.data ?? [])
    } catch {
      setError('맞춤법 검사 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [loading])

  const handleApplyOne = useCallback((c: SpellCheckCorrection, idx: number) => {
    editorBridge.replaceText(c.original, c.corrected)
    setApplied((prev) => new Set(prev).add(idx))
  }, [])

  const handleApplyAll = useCallback(() => {
    if (!corrections) return
    // offset 역순으로 처리하여 앞 교정이 뒤 위치에 영향을 주지 않도록 함
    const sorted = [...corrections]
      .map((c, idx) => ({ ...c, idx }))
      .filter((c) => c.original !== c.corrected && !applied.has(c.idx))
      .sort((a, b) => b.offset - a.offset)

    const newApplied = new Set(applied)
    for (const c of sorted) {
      editorBridge.replaceText(c.original, c.corrected)
      newApplied.add(c.idx)
    }
    setApplied(newApplied)
  }, [corrections, applied])

  const pendingCount = corrections
    ? corrections.filter((c, i) => c.original !== c.corrected && !applied.has(i)).length
    : 0

  const hasErrors = corrections !== null && corrections.length > 0
  const noErrors = corrections !== null && corrections.length === 0

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <SpellCheck className="w-4 h-4 text-gray-700" />
          <span className="text-sm font-semibold text-gray-900">맞춤법 검사</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 검사 버튼 */}
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={handleCheck}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              검사 중...
            </>
          ) : (
            <>
              <SpellCheck className="w-4 h-4" />
              에디터 맞춤법 검사
            </>
          )}
        </button>
      </div>

      {/* 결과 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* 오류 상태 */}
        {error && (
          <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2.5">
            {error}
          </div>
        )}

        {/* 오류 없음 */}
        {noErrors && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 rounded-lg border border-green-100">
            <CheckSquare className="w-4 h-4 text-green-600 flex-shrink-0" />
            <p className="text-xs text-green-700 font-medium">맞춤법 오류가 없습니다.</p>
          </div>
        )}

        {/* 오류 목록 */}
        {hasErrors && (
          <>
            {/* 요약 + 전체 적용 */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">
                오류 {corrections.length}건
                {pendingCount < corrections.length && (
                  <span className="ml-1 text-gray-400">
                    ({corrections.length - pendingCount}건 적용됨)
                  </span>
                )}
              </p>
              {pendingCount > 0 && (
                <button
                  onClick={handleApplyAll}
                  className="text-xs text-gray-500 hover:text-gray-900 underline transition-colors"
                >
                  전체 적용
                </button>
              )}
            </div>

            {/* 항목 목록 */}
            <div className="space-y-2">
              {corrections.map((c, idx) => {
                const isApplied = applied.has(idx)
                const isNoChange = c.original === c.corrected
                return (
                  <div
                    key={idx}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 space-y-1.5 transition-colors',
                      isApplied
                        ? 'border-green-100 bg-green-50'
                        : 'border-gray-100 bg-gray-50',
                    )}
                  >
                    {/* 오류 → 교정 */}
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span
                        className={cn(
                          'font-medium',
                          isApplied ? 'text-gray-400 line-through' : 'text-red-500 line-through',
                        )}
                      >
                        {c.original}
                      </span>
                      <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className={cn('font-medium', isApplied ? 'text-green-600' : 'text-green-700')}>
                        {c.corrected}
                      </span>
                    </div>

                    {/* 오류 설명 */}
                    {c.message && (
                      <p className="text-xs text-gray-500">{c.message}</p>
                    )}

                    {/* 교정 적용 버튼 */}
                    {!isNoChange && (
                      <button
                        onClick={() => handleApplyOne(c, idx)}
                        disabled={isApplied}
                        className={cn(
                          'flex items-center gap-1 text-xs font-medium rounded px-2 py-0.5 transition-colors',
                          isApplied
                            ? 'text-green-600 cursor-default'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200',
                        )}
                      >
                        {isApplied ? (
                          <>
                            <Check className="w-3 h-3" />
                            적용됨
                          </>
                        ) : (
                          '교정 적용'
                        )}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* 초기 안내 */}
        {corrections === null && !loading && !error && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-gray-400">
            <SpellCheck className="w-8 h-8 opacity-30" />
            <p className="text-xs leading-relaxed">
              버튼을 눌러 에디터 내용의<br />
              맞춤법·띄어쓰기를 검사합니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
