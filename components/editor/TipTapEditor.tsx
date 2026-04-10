'use client'

/**
 * TipTapEditor — TipTap 기반 글쓰기 에디터
 *
 * 주요 기능:
 * - 한글 IME 처리: ProseMirror의 view.composing 플래그를 활용해
 *   자모 조합 중에는 자동저장을 억제하고 compositionend 후 트리거
 * - 자동저장: 2초 debounce, PATCH /api/chapters/[id] (trigger: 'autosave')
 * - 수동 스냅샷: PATCH /api/chapters/[id] (trigger: 'manual')
 * - 글자 수: CharacterCount extension (한국어는 글자 단위가 의미 있음)
 */
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useEffect, useRef, useCallback, useState } from 'react'
import EditorToolbar from './EditorToolbar'
import { editorBridge } from './editorBridge'

export type SaveStatus = 'saved' | 'saving' | 'unsaved'

interface TipTapEditorProps {
  chapterId: string
  onWordCountChange: (count: number) => void
}

export default function TipTapEditor({ chapterId, onWordCountChange }: TipTapEditorProps) {
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [snapshotting, setSnapshotting] = useState(false)
  const [wordCount, setWordCount] = useState(0)

  // 최신 콘텐츠를 ref로 보관 (closure stale 문제 방지)
  const latestContent = useRef<unknown>(null)
  const latestWordCount = useRef(0)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 언마운트 cleanup에서 chapterId를 안전하게 참조하기 위한 ref
  const chapterIdRef = useRef(chapterId)
  chapterIdRef.current = chapterId

  // ── 저장 함수 ──────────────────────────────────────────────────────────
  const doSave = useCallback(
    async (trigger: 'autosave' | 'manual') => {
      if (latestContent.current === null) return
      setSaveStatus('saving')
      try {
        const res = await fetch(`/api/chapters/${chapterId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: latestContent.current,
            word_count: latestWordCount.current,
            trigger,
          }),
        })
        setSaveStatus(res.ok ? 'saved' : 'unsaved')
      } catch {
        setSaveStatus('unsaved')
      }
    },
    [chapterId],
  )

  // ── 자동저장 debounce (2초) ────────────────────────────────────────────
  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      doSave('autosave')
    }, 2000)
  }, [doSave])

  // ── 수동 스냅샷 ───────────────────────────────────────────────────────
  const handleSnapshot = useCallback(async () => {
    setSnapshotting(true)
    // 대기 중인 자동저장 타이머 취소 (중복 방지)
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    await doSave('manual')
    setSnapshotting(false)
  }, [doSave])

  // ── TipTap 에디터 초기화 ──────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      Placeholder.configure({ placeholder: '여기에 글을 써보세요...' }),
      CharacterCount,
    ],
    editorProps: {
      attributes: {
        // prose-sm으로 기본 타이포그래피, 좌우 패딩으로 원고지 느낌
        class: 'prose prose-sm max-w-none focus:outline-none px-16 py-10',
      },
      handleDOMEvents: {
        // 한글 IME 조합 중 Enter 키 이중 처리 방지
        // 일부 브라우저(Chrome/Windows)에서 compositionend 전에 keydown이 발화되어
        // 미완성 음절이 확정되는 동시에 새 단락이 삽입되는 버그를 막음
        keydown: (view, event) => {
          if (view.composing && event.key === 'Enter') {
            return true
          }
          return false
        },
      },
    },
    // onUpdate는 useEffect에서 editor.on()으로 등록 (stale closure 방지)
  })

  // ── onUpdate 이벤트 등록 (IME 처리 포함) ──────────────────────────────
  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      const doc = editor.getJSON()
      const chars = editor.storage.characterCount?.characters?.() ?? 0

      latestContent.current = doc
      latestWordCount.current = chars
      setWordCount(chars)
      onWordCountChange(chars)
      setSaveStatus('unsaved')

      // ProseMirror 내장 composing 플래그:
      // 한글 자모 조합 중(compositionstart ~ compositionend)에는 true
      // → 조합 완료 후 scheduleAutosave()가 별도로 호출됨
      if (!editor.view.composing) {
        scheduleAutosave()
      }
    }

    editor.on('update', handleUpdate)
    return () => { editor.off('update', handleUpdate) }
  }, [editor, scheduleAutosave, onWordCountChange])

  // ── compositionend: 한글 조합 완료 후 자동저장 트리거 ─────────────────
  // ProseMirror의 view.composing이 false로 전환된 직후이므로
  // setTimeout(0)으로 onUpdate가 끝난 다음 tick에 실행
  useEffect(() => {
    if (!editor) return

    const el = editor.view.dom

    const handleCompositionEnd = () => {
      setTimeout(() => {
        if (latestContent.current !== null) {
          scheduleAutosave()
        }
      }, 0)
    }

    el.addEventListener('compositionend', handleCompositionEnd)
    return () => { el.removeEventListener('compositionend', handleCompositionEnd) }
  }, [editor, scheduleAutosave])

  // ── 챕터 콘텐츠 로드 ─────────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return

    let cancelled = false
    setLoading(true)
    setSaveStatus('saved')
    latestContent.current = null
    latestWordCount.current = 0

    fetch(`/api/chapters/${chapterId}`)
      .then((r) => r.json())
      .then(({ data }) => {
        if (cancelled) return
        if (data?.content) {
          editor.commands.setContent(data.content, false)
          const chars = editor.storage.characterCount?.characters?.() ?? 0
          latestContent.current = data.content
          latestWordCount.current = chars
          setWordCount(chars)
          onWordCountChange(chars)
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [chapterId, editor, onWordCountChange])

  // ── editorBridge 등록 (AIChatSidebar 등 외부 삽입 요청용) ─────────────
  useEffect(() => {
    editorBridge.register(editor)
    return () => { editorBridge.register(null) }
  }, [editor])

  // ── 언마운트 정리 ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      // 타이머가 살아 있는 경우 = debounce 대기 중 = 미저장 변경 있음
      // 타이머를 취소하고 즉시 플러시하여 챕터 전환 시 내용 손실 방지
      // doSave()는 setState를 호출하므로 언마운트 후엔 직접 fetch 사용
      const hasPending = autosaveTimer.current !== null
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
      if (hasPending && latestContent.current !== null) {
        fetch(`/api/chapters/${chapterIdRef.current}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: latestContent.current,
            word_count: latestWordCount.current,
            trigger: 'autosave',
          }),
        }).catch(() => {})
      }
    }
  }, [])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 툴바 */}
      <EditorToolbar
        editor={editor}
        saveStatus={saveStatus}
        wordCount={wordCount}
        snapshotting={snapshotting}
        onSnapshot={handleSnapshot}
      />

      {/* 에디터 본문 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            불러오는 중...
          </div>
        ) : (
          <EditorContent
            editor={editor}
            className="min-h-full"
          />
        )}
      </div>
    </div>
  )
}
