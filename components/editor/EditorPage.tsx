'use client'

/**
 * EditorPage — 듀얼 페인 에디터 레이아웃
 *
 * [챕터 목록 패널] | [TipTap 에디터] | [AI 보조 사이드바]
 *   (토글 가능)      (flex-1)          (토글 가능)
 *
 * 변경 이력:
 *   - AIChatSidebar에 projectId / onInsert prop 전달
 *   - 상단 바에 "내보내기" 버튼 + ExportModal 추가
 *   - onInsert → editorBridge.insert(text) 호출
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Download,
  History,
  Check,
} from 'lucide-react'
import TipTapEditor from './TipTapEditor'
import AIChatSidebar from './AIChatSidebar'
import SpellCheckPanel from './SpellCheckPanel'
import ExportModal from './ExportModal'
import VersionHistoryPanel from './VersionHistoryPanel'
import { editorBridge } from './editorBridge'
import { cn } from '@/lib/utils'
import { getWritingPrefs } from '@/lib/writing-prefs'
import type { Chapter, Project, TipTapDocument } from '@/types'

interface EditorPageProps {
  project: Project
  chapters: Chapter[]
  initialChapterId: string | null
}

export default function EditorPage({
  project,
  chapters: initialChapters,
  initialChapterId,
}: EditorPageProps) {
  const [chapters, setChapters] = useState(initialChapters)
  const [selectedChapterId, setSelectedChapterId] = useState(initialChapterId)
  const [chapterPanelOpen, setChapterPanelOpen] = useState(true)
  // 집중 모드 기본값: focusModeDefault=true이면 AI 사이드바 기본 닫힘
  const [chatOpen, setChatOpen] = useState(() => !getWritingPrefs().focusModeDefault)
  const [spellCheckOpen, setSpellCheckOpen] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [adding, setAdding] = useState(false)

  // 챕터 인라인 이름 변경
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // 챕터별 글자 수 (TipTapEditor에서 실시간 업데이트)
  const [wordCounts, setWordCounts] = useState<Record<string, number>>(
    Object.fromEntries(initialChapters.map((c) => [c.id, c.word_count])),
  )

  const handleWordCountChange = useCallback((chapterId: string, count: number) => {
    setWordCounts((prev) => ({ ...prev, [chapterId]: count }))
  }, [])

  const totalWords = Object.values(wordCounts).reduce((a, b) => a + b, 0)

  // 챕터 추가
  const handleAddChapter = useCallback(async () => {
    if (adding) return
    setAdding(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `챕터 ${chapters.length + 1}` }),
      })
      if (res.ok) {
        const { data } = await res.json()
        setChapters((prev) => [...prev, data])
        setSelectedChapterId(data.id)
        setWordCounts((prev) => ({ ...prev, [data.id]: 0 }))
      }
    } finally {
      setAdding(false)
    }
  }, [adding, project.id, chapters.length])

  // AIChatSidebar → 에디터 텍스트 삽입
  const handleInsert = useCallback((text: string) => {
    editorBridge.insert(text)
  }, [])

  // 챕터 이름 변경 시작
  const startRename = useCallback((chapter: typeof chapters[0]) => {
    setRenamingId(chapter.id)
    setRenameValue(chapter.title)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }, [])

  // 챕터 이름 변경 확정
  const commitRename = useCallback(async (id: string) => {
    const trimmed = renameValue.trim()
    if (!trimmed) {
      setRenamingId(null)
      return
    }
    setChapters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)),
    )
    setRenamingId(null)
    await fetch(`/api/chapters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
  }, [renameValue])

  // VersionHistoryPanel → 버전 복원 후 패널 닫기
  const handleRestore = useCallback((content: TipTapDocument) => {
    editorBridge.restoreContent(content)
    setShowHistory(false)
  }, [])

  // AI 사이드바 / 맞춤법 패널이 닫힐 때 에디터 포커스 복원
  useEffect(() => {
    if (!chatOpen && !spellCheckOpen && selectedChapterId) {
      editorBridge.focus()
    }
  }, [chatOpen, spellCheckOpen, selectedChapterId])

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* ── 챕터 목록 패널 ─────────────────────────────────── */}
      <aside
        className={cn(
          'flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col transition-all duration-200 overflow-hidden',
          chapterPanelOpen ? 'w-52' : 'w-0',
        )}
        aria-label="챕터 목록"
      >
        {/* 뒤로가기 */}
        <div className="flex items-center px-3 py-3 border-b border-gray-200 flex-shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            원고 목록
          </Link>
        </div>

        {/* 프로젝트 정보 */}
        <div className="px-3 py-2.5 border-b border-gray-200 flex-shrink-0">
          <p className="text-xs font-semibold text-gray-900 truncate">{project.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            총 {totalWords.toLocaleString('ko-KR')}자
          </p>
        </div>

        {/* 챕터 목록 */}
        <nav className="flex-1 overflow-y-auto py-1">
          {chapters.map((chapter) => {
            const isSelected = selectedChapterId === chapter.id
            const wc = wordCounts[chapter.id] ?? chapter.word_count
            const readingMin = Math.max(1, Math.round(wc / 200))
            const isRenaming = renamingId === chapter.id
            return (
              <div
                key={chapter.id}
                className={cn(
                  'w-full text-left px-3 py-2 transition-colors border-l-2 cursor-pointer',
                  isSelected
                    ? 'bg-white text-gray-900 font-medium border-black'
                    : 'text-gray-600 hover:bg-white hover:text-gray-900 border-transparent',
                )}
                onClick={() => !isRenaming && setSelectedChapterId(chapter.id)}
                onDoubleClick={() => startRename(chapter)}
              >
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(chapter.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(chapter.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full text-sm bg-white border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:border-black"
                    autoFocus
                  />
                ) : (
                  <span className="block text-sm truncate">{chapter.title}</span>
                )}
                <span className="block text-xs text-gray-400 mt-0.5">
                  {wc.toLocaleString('ko-KR')}자 · {readingMin}분
                </span>
              </div>
            )
          })}
        </nav>

        {/* 챕터 추가 버튼 */}
        <div className="p-2 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={handleAddChapter}
            disabled={adding}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-gray-800 hover:bg-white rounded-md transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            {adding ? '추가 중...' : '챕터 추가'}
          </button>
        </div>
      </aside>

      {/* ── 에디터 영역 ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 상단 바 */}
        <header className="flex flex-col border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center justify-between px-3 py-2 h-11">
          {/* 좌측: 챕터 패널 토글 */}
          <button
            onClick={() => setChapterPanelOpen((v) => !v)}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title={chapterPanelOpen ? '챕터 패널 닫기' : '챕터 패널 열기'}
          >
            {chapterPanelOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </button>

          {/* 우측: 목표 진행률 + 버튼들 */}
          <div className="flex items-center gap-3">
            {/* 집필 목표 진행률 */}
            {project.target_words > 0 && (() => {
              const pct = Math.min(100, Math.round((totalWords / project.target_words) * 100))
              const done = pct >= 100
              return (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', done ? 'bg-green-500' : 'bg-orange-400')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={cn('text-xs tabular-nums', done ? 'text-green-600 font-medium' : 'text-gray-400')}>
                    {done
                      ? <span className="flex items-center gap-0.5"><Check className="w-3 h-3" />목표 달성</span>
                      : `${pct}%`}
                  </span>
                </div>
              )
            })()}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                showHistory
                  ? 'bg-gray-100 text-gray-800'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
              )}
              title="버전 히스토리"
            >
              <History className="w-4 h-4" />
              히스토리
            </button>

            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              title="DOCX / EPUB으로 내보내기"
            >
              <Download className="w-4 h-4" />
              내보내기
            </button>

            <button
              onClick={() => {
                setChatOpen((v) => !v)
                setSpellCheckOpen(false)
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                chatOpen
                  ? 'bg-gray-100 text-gray-800'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
              )}
            >
              <MessageSquare className="w-4 h-4" />
              AI 보조
            </button>
          </div>
          </div>
          </div>
        </header>

        {/* TipTap 에디터 */}
        {selectedChapterId ? (
          <TipTapEditor
            key={selectedChapterId}
            chapterId={selectedChapterId}
            onWordCountChange={(count) => handleWordCountChange(selectedChapterId, count)}
            onSpellCheck={() => {
              setSpellCheckOpen((v) => !v)
              setChatOpen(false)
            }}
            spellCheckActive={spellCheckOpen}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
            <p className="text-sm">챕터를 선택하거나 추가해주세요.</p>
            <button
              onClick={handleAddChapter}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              첫 챕터 만들기
            </button>
          </div>
        )}
      </div>

      {/* ── AI 보조 사이드바 ───────────────────────────────── */}
      <aside
        className={cn(
          'flex-shrink-0 border-l border-gray-200 transition-all duration-200 overflow-hidden',
          chatOpen ? 'w-80' : 'w-0',
        )}
        aria-label="AI 보조 채팅"
      >
        <AIChatSidebar
          projectId={project.id}
          chapterId={selectedChapterId ?? undefined}
          onInsert={handleInsert}
        />
      </aside>

      {/* ── 맞춤법 검사 패널 ────────────────────────────────── */}
      <aside
        className={cn(
          'flex-shrink-0 border-l border-gray-200 transition-all duration-200 overflow-hidden',
          spellCheckOpen ? 'w-80' : 'w-0',
        )}
        aria-label="맞춤법 검사"
      >
        {spellCheckOpen && (
          <SpellCheckPanel onClose={() => setSpellCheckOpen(false)} />
        )}
      </aside>

      {/* ── 내보내기 모달 ──────────────────────────────────── */}
      {showExport && (
        <ExportModal
          projectId={project.id}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* ── 버전 히스토리 패널 ─────────────────────────────── */}
      {showHistory && selectedChapterId && (
        <VersionHistoryPanel
          chapterId={selectedChapterId}
          onClose={() => setShowHistory(false)}
          onRestore={handleRestore}
        />
      )}
    </div>
  )
}
