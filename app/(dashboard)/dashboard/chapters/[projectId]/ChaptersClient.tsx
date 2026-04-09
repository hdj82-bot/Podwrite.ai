'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn, formatWordCount, formatRelativeTime } from '@/lib/utils'
import ConfirmModal from '@/components/ui/ConfirmModal'
import type { Project, Chapter } from '@/types'

interface ChaptersClientProps {
  project: Project
  chapters: Chapter[]
}

const PLATFORM_LABEL: Record<Project['platform'], string> = {
  bookk: '부크크',
  kyobo: '교보',
  kdp: 'KDP',
}

export default function ChaptersClient({ project, chapters: initialChapters }: ChaptersClientProps) {
  const router = useRouter()
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters)

  // 챕터 추가
  const [addingChapter, setAddingChapter] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // 제목 인라인 편집
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<Chapter | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // 드래그 앤 드롭
  const dragIndexRef = useRef<number | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropOverId, setDropOverId] = useState<string | null>(null)
  const [reorderLoading, setReorderLoading] = useState(false)

  // ── 챕터 추가 ────────────────────────────────────────────────
  async function handleAddChapter(e: React.FormEvent) {
    e.preventDefault()
    const title = newTitle.trim() || '새 챕터'
    setAddLoading(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '챕터 생성 실패')
      setChapters((prev) => [...prev, json.data as Chapter])
      setNewTitle('')
      setAddingChapter(false)
    } catch {
      // 실패 시 무시 (toast 없이 조용히)
    } finally {
      setAddLoading(false)
    }
  }

  // ── 제목 편집 ────────────────────────────────────────────────
  function startEdit(chapter: Chapter) {
    setEditingId(chapter.id)
    setEditTitle(chapter.title)
  }

  async function handleSaveTitle(id: string) {
    const title = editTitle.trim()
    if (!title) return cancelEdit()
    setEditLoading(true)
    try {
      const res = await fetch(`/api/chapters/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) throw new Error()
      setChapters((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c)),
      )
    } catch {
      // noop
    } finally {
      setEditLoading(false)
      setEditingId(null)
    }
  }

  function cancelEdit() {
    setEditingId(null)
    setEditTitle('')
  }

  // ── 챕터 삭제 ────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/chapters/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? '삭제 실패')
      }
      setChapters((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.')
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── 드래그 앤 드롭 ───────────────────────────────────────────
  function handleDragStart(e: React.DragEvent, index: number, id: string) {
    dragIndexRef.current = index
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    // 반투명 드래그 이미지
    e.dataTransfer.setDragImage(e.currentTarget as HTMLElement, 20, 20)
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropOverId(id)
  }

  function handleDragLeave() {
    setDropOverId(null)
  }

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetIndex: number, targetId: string) => {
      e.preventDefault()
      const fromIndex = dragIndexRef.current
      if (fromIndex === null || fromIndex === targetIndex) {
        setDraggingId(null)
        setDropOverId(null)
        dragIndexRef.current = null
        return
      }

      const draggedChapter = chapters[fromIndex]

      // 낙관적 업데이트
      const reordered = [...chapters]
      reordered.splice(fromIndex, 1)
      reordered.splice(targetIndex, 0, draggedChapter)
      setChapters(reordered)

      setDraggingId(null)
      setDropOverId(null)
      dragIndexRef.current = null

      // API 호출
      setReorderLoading(true)
      try {
        await fetch(`/api/chapters/${draggedChapter.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_idx: targetIndex }),
        })
        // 서버 상태와 동기화
        router.refresh()
      } catch {
        // 실패 시 원본 복구
        setChapters(chapters)
      } finally {
        setReorderLoading(false)
      }
    },
    [chapters, router],
  )

  function handleDragEnd() {
    setDraggingId(null)
    setDropOverId(null)
    dragIndexRef.current = null
  }

  return (
    <main className="flex-1 px-6 py-8 max-w-3xl">
      {/* 브레드크럼 + 헤더 */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          내 원고
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">{project.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">{PLATFORM_LABEL[project.platform]}</span>
              <span className="text-gray-300">·</span>
              <span className="text-xs text-gray-500">챕터 {chapters.length}개</span>
            </div>
          </div>

          <Link
            href={`/editor/${project.id}`}
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            에디터 열기
          </Link>
        </div>
      </div>

      {/* 챕터 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">챕터 목록</span>
          {reorderLoading && (
            <span className="text-xs text-gray-400">순서 저장 중...</span>
          )}
        </div>

        {/* 빈 상태 */}
        {chapters.length === 0 && !addingChapter && (
          <div className="py-12 text-center text-gray-400 text-sm">
            아직 챕터가 없어요. 첫 번째 챕터를 추가해보세요.
          </div>
        )}

        {/* 챕터 행 */}
        <ul>
          {chapters.map((chapter, index) => (
            <li
              key={chapter.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index, chapter.id)}
              onDragOver={(e) => handleDragOver(e, chapter.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index, chapter.id)}
              onDragEnd={handleDragEnd}
              className={cn(
                'group flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 last:border-b-0 transition-all',
                draggingId === chapter.id ? 'opacity-40' : 'opacity-100',
                dropOverId === chapter.id && draggingId !== chapter.id
                  ? 'bg-blue-50 border-blue-200'
                  : 'hover:bg-gray-50',
              )}
            >
              {/* 드래그 핸들 */}
              <button
                className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors touch-none"
                aria-label="드래그하여 순서 변경"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                </svg>
              </button>

              {/* 순서 번호 */}
              <span className="flex-shrink-0 w-5 text-xs text-gray-400 font-mono text-right">
                {index + 1}
              </span>

              {/* 제목 (편집 모드) */}
              <div className="flex-1 min-w-0">
                {editingId === chapter.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle(chapter.id)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="flex-1 text-sm border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      maxLength={200}
                    />
                    <button
                      onClick={() => handleSaveTitle(chapter.id)}
                      disabled={editLoading}
                      className="text-xs px-2 py-0.5 bg-black text-white rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      저장
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-xs px-2 py-0.5 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {chapter.title}
                    </span>
                    <button
                      onClick={() => startEdit(chapter)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-gray-600 transition-all"
                      aria-label="제목 수정"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* 메타 정보 */}
                {editingId !== chapter.id && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {chapter.word_count > 0 ? formatWordCount(chapter.word_count) : '내용 없음'}
                    </span>
                    <span className="text-gray-200">·</span>
                    <span className="text-xs text-gray-400">
                      {formatRelativeTime(chapter.updated_at)}
                    </span>
                  </div>
                )}
              </div>

              {/* 액션 버튼들 */}
              {editingId !== chapter.id && (
                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* 에디터에서 열기 */}
                  <Link
                    href={`/editor/${project.id}`}
                    className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    aria-label="에디터에서 열기"
                    title="에디터에서 열기"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </Link>

                  {/* 삭제 */}
                  <button
                    onClick={() => setDeleteTarget(chapter)}
                    disabled={chapters.length <= 1}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="챕터 삭제"
                    title={chapters.length <= 1 ? '마지막 챕터는 삭제할 수 없어요' : '챕터 삭제'}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </li>
          ))}

          {/* 새 챕터 입력 행 */}
          {addingChapter && (
            <li className="px-4 py-3 border-b border-gray-100 last:border-b-0 bg-blue-50">
              <form onSubmit={handleAddChapter} className="flex items-center gap-2">
                <div className="w-4 flex-shrink-0" />
                <span className="flex-shrink-0 w-5 text-xs text-gray-400 font-mono text-right">
                  {chapters.length + 1}
                </span>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="챕터 제목"
                  maxLength={200}
                  className="flex-1 text-sm border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                />
                <button
                  type="submit"
                  disabled={addLoading}
                  className="text-xs px-3 py-1 bg-black text-white rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {addLoading ? '추가 중...' : '추가'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingChapter(false); setNewTitle('') }}
                  className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  취소
                </button>
              </form>
            </li>
          )}
        </ul>

        {/* 챕터 추가 버튼 */}
        {!addingChapter && (
          <div className="px-4 py-3 border-t border-gray-100">
            <button
              onClick={() => setAddingChapter(true)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              챕터 추가
            </button>
          </div>
        )}
      </div>

      {/* 드래그 안내 */}
      {chapters.length > 1 && (
        <p className="mt-3 text-xs text-gray-400 text-center">
          드래그하여 챕터 순서를 변경할 수 있습니다
        </p>
      )}

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="챕터를 삭제할까요?"
        description={`"${deleteTarget?.title}" 챕터가 영구적으로 삭제됩니다.`}
        confirmLabel="삭제"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  )
}
