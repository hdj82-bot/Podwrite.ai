'use client'

/**
 * VersionHistoryPanel — 챕터 버전 히스토리 패널
 *
 * 에디터 우측에서 슬라이드 인하는 오버레이 패널입니다.
 *
 * 동작:
 *   1. 마운트 시 GET /api/chapters/[id]/versions 로 버전 목록 로드
 *   2. 목록 항목 클릭 → GET /api/chapters/[id]/versions/[versionId] 로 content 로드
 *   3. 우측 미리보기 패널에 plain text 표시
 *   4. "이 버전으로 복원" → onRestore(content) 콜백 호출
 *
 * Trigger 뱃지 색상:
 *   manual   — 검정  (사용자가 직접 저장)
 *   autosave — 회색  (자동저장)
 *   ai_edit  — 파랑  (AI 편집 후 저장)
 */
import { useState, useEffect, useCallback } from 'react'
import { X, RotateCcw, Loader2, Clock, FileText } from 'lucide-react'
import { cn, formatDate, formatRelativeTime } from '@/lib/utils'
import type { TipTapDocument, TipTapNode, VersionTrigger } from '@/types'

// ── 타입 ─────────────────────────────────────────────────────────────

interface VersionListItem {
  id: string
  chapter_id: string
  trigger: VersionTrigger
  created_at: string
}

interface VersionDetail {
  id: string
  content: TipTapDocument
  trigger: VersionTrigger
  created_at: string
}

interface VersionHistoryPanelProps {
  chapterId: string
  onClose: () => void
  onRestore: (content: TipTapDocument) => void
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────

const TRIGGER_BADGE: Record<VersionTrigger, { label: string; className: string }> = {
  manual:   { label: '수동 저장', className: 'bg-gray-900 text-white' },
  autosave: { label: '자동 저장', className: 'bg-gray-200 text-gray-600' },
  ai_edit:  { label: 'AI 편집',   className: 'bg-blue-100 text-blue-700' },
}

/**
 * TipTap JSON 문서에서 plain text를 추출합니다.
 * 단락/제목 경계에 개행을 삽입합니다.
 */
function extractPlainText(doc: TipTapDocument): string {
  const parts: string[] = []

  function traverse(nodes: TipTapNode[]) {
    for (const node of nodes) {
      if (node.type === 'text') {
        parts.push(node.text ?? '')
      } else if (node.type === 'hardBreak') {
        parts.push('\n')
      } else if (node.content && node.content.length > 0) {
        traverse(node.content)
        // 블록 레벨 노드 뒤에 개행
        if (['paragraph', 'heading', 'blockquote', 'listItem', 'codeBlock'].includes(node.type)) {
          parts.push('\n')
        }
      } else if (['paragraph', 'heading'].includes(node.type)) {
        // 빈 단락에도 개행
        parts.push('\n')
      }
    }
  }

  traverse(doc.content ?? [])
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim()
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────

export default function VersionHistoryPanel({
  chapterId,
  onClose,
  onRestore,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<VersionListItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<VersionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)

  // 버전 목록 로드
  useEffect(() => {
    let cancelled = false
    setListLoading(true)
    setListError(null)

    fetch(`/api/chapters/${chapterId}/versions`)
      .then((r) => r.json())
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { setListError(error); return }
        setVersions(data ?? [])
      })
      .catch(() => {
        if (!cancelled) setListError('버전 목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setListLoading(false)
      })

    return () => { cancelled = true }
  }, [chapterId])

  // 버전 선택 → 상세 로드
  const handleSelectVersion = useCallback(async (id: string) => {
    if (id === selectedId) return
    setSelectedId(id)
    setDetail(null)
    setDetailLoading(true)

    try {
      const res = await fetch(`/api/chapters/${chapterId}/versions/${id}`)
      const { data, error } = await res.json()
      if (error) throw new Error(error)
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [selectedId, chapterId])

  // 복원
  const handleRestore = useCallback(() => {
    if (!detail?.content) return
    setRestoring(true)
    onRestore(detail.content)
    // 짧은 피드백 후 패널 닫기
    setTimeout(() => {
      setRestoring(false)
      onClose()
    }, 600)
  }, [detail, onRestore, onClose])

  const previewText = detail ? extractPlainText(detail.content) : ''

  return (
    <>
      {/* 백드롭 */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 패널 */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex bg-white shadow-2xl border-l border-gray-200 animate-slide-in-right"
        style={{ width: '580px' }}
        role="dialog"
        aria-label="버전 히스토리"
      >
        {/* ── 좌측: 버전 목록 (200px) ── */}
        <div className="w-[200px] flex-shrink-0 flex flex-col border-r border-gray-200 bg-gray-50">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              <Clock className="w-4 h-4" />
              버전 히스토리
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 목록 */}
          <div className="flex-1 overflow-y-auto py-1">
            {listLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            )}
            {listError && !listLoading && (
              <p className="text-xs text-red-500 px-3 py-3">{listError}</p>
            )}
            {!listLoading && versions.length === 0 && !listError && (
              <p className="text-xs text-gray-400 px-3 py-3 text-center">
                저장된 버전이 없습니다.
              </p>
            )}
            {versions.map((v) => {
              const badge = TRIGGER_BADGE[v.trigger]
              const isSelected = v.id === selectedId
              return (
                <button
                  key={v.id}
                  onClick={() => handleSelectVersion(v.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 border-l-2 transition-colors',
                    isSelected
                      ? 'bg-white border-black'
                      : 'border-transparent hover:bg-white hover:border-gray-300',
                  )}
                >
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {formatRelativeTime(v.created_at)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(v.created_at)}
                  </p>
                  <span className={cn(
                    'inline-block mt-1 px-1.5 py-0.5 rounded text-xs font-medium',
                    badge.className,
                  )}>
                    {badge.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 우측: 미리보기 (380px) ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 h-[49px]">
            {detail ? (
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {formatRelativeTime(detail.created_at)} 버전
                </p>
                <p className="text-xs text-gray-400">
                  {TRIGGER_BADGE[detail.trigger].label} · {formatDate(detail.created_at)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">버전을 선택하세요</p>
            )}

            {detail && (
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {restoring
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RotateCcw className="w-3.5 h-3.5" />
                }
                {restoring ? '복원 중...' : '이 버전으로 복원'}
              </button>
            )}
          </div>

          {/* 미리보기 본문 */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {detailLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            )}

            {!detailLoading && !detail && !selectedId && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400">
                <FileText className="w-10 h-10 opacity-20" />
                <p className="text-sm">좌측에서 버전을 선택하면<br />미리보기가 표시됩니다.</p>
              </div>
            )}

            {!detailLoading && detail && (
              <pre className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-sans">
                {previewText || <span className="text-gray-400 italic">(내용 없음)</span>}
              </pre>
            )}
          </div>

          {/* 복원 경고 안내 */}
          {detail && (
            <div className="flex-shrink-0 px-4 py-2.5 border-t border-gray-100 bg-amber-50">
              <p className="text-xs text-amber-700">
                복원하면 현재 작업 중인 내용이 교체됩니다.
                복원 전 스냅샷 버튼으로 현재 버전을 저장하세요.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
