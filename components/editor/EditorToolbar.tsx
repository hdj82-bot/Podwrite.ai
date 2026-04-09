'use client'

/**
 * EditorToolbar — TipTap 서식 툴바
 *
 * 버튼 그룹:
 *   1. 제목 (H1, H2)
 *   2. 글자 서식 (굵게, 기울임, 밑줄, 취소선, 하이라이트)
 *   3. 정렬 (좌, 가운데, 우)
 *   4. 목록 (불릿, 번호)
 *   5. 저장 상태 + 글자 수 + 스냅샷 버튼
 */
import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Heading1,
  Heading2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Camera,
  Loader2,
  Check,
  Dot,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SaveStatus } from './TipTapEditor'

interface EditorToolbarProps {
  editor: Editor | null
  saveStatus: SaveStatus
  wordCount: number
  snapshotting: boolean
  onSnapshot: () => void
}

interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-gray-200 text-gray-900'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
        disabled && 'opacity-30 cursor-not-allowed pointer-events-none',
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-1" />
}

const SAVE_STATUS_MAP: Record<SaveStatus, { label: string; icon: React.ReactNode; className: string }> = {
  saved: {
    label: '저장됨',
    icon: <Check className="w-3 h-3" />,
    className: 'text-green-600',
  },
  saving: {
    label: '저장 중',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    className: 'text-gray-400',
  },
  unsaved: {
    label: '저장 안 됨',
    icon: <Dot className="w-3 h-3" />,
    className: 'text-orange-400',
  },
}

export default function EditorToolbar({
  editor,
  saveStatus,
  wordCount,
  snapshotting,
  onSnapshot,
}: EditorToolbarProps) {
  const status = SAVE_STATUS_MAP[saveStatus]

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-200 bg-white flex-shrink-0 flex-wrap">

      {/* ── 제목 ── */}
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor?.isActive('heading', { level: 1 })}
        disabled={!editor}
        title="제목 1 (H1)"
      >
        <Heading1 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor?.isActive('heading', { level: 2 })}
        disabled={!editor}
        title="제목 2 (H2)"
      >
        <Heading2 className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      {/* ── 글자 서식 ── */}
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleBold().run()}
        active={editor?.isActive('bold')}
        disabled={!editor}
        title="굵게 (Ctrl+B)"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleItalic().run()}
        active={editor?.isActive('italic')}
        disabled={!editor}
        title="기울임 (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
        active={editor?.isActive('underline')}
        disabled={!editor}
        title="밑줄 (Ctrl+U)"
      >
        <Underline className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleStrike().run()}
        active={editor?.isActive('strike')}
        disabled={!editor}
        title="취소선"
      >
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleHighlight().run()}
        active={editor?.isActive('highlight')}
        disabled={!editor}
        title="형광펜"
      >
        <Highlighter className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      {/* ── 정렬 ── */}
      <ToolbarButton
        onClick={() => editor?.chain().focus().setTextAlign('left').run()}
        active={editor?.isActive({ textAlign: 'left' })}
        disabled={!editor}
        title="왼쪽 정렬"
      >
        <AlignLeft className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor?.chain().focus().setTextAlign('center').run()}
        active={editor?.isActive({ textAlign: 'center' })}
        disabled={!editor}
        title="가운데 정렬"
      >
        <AlignCenter className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor?.chain().focus().setTextAlign('right').run()}
        active={editor?.isActive({ textAlign: 'right' })}
        disabled={!editor}
        title="오른쪽 정렬"
      >
        <AlignRight className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      {/* ── 목록 ── */}
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
        active={editor?.isActive('bulletList')}
        disabled={!editor}
        title="불릿 목록"
      >
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        active={editor?.isActive('orderedList')}
        disabled={!editor}
        title="번호 목록"
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>

      {/* ── 우측: 저장 상태 + 글자 수 + 스냅샷 ── */}
      <div className="ml-auto flex items-center gap-3">
        {/* 저장 상태 */}
        <span className={cn('flex items-center gap-1 text-xs', status.className)}>
          {status.icon}
          {status.label}
        </span>

        {/* 글자 수 */}
        <span className="text-xs text-gray-400">
          {wordCount.toLocaleString('ko-KR')}자
        </span>

        {/* 버전 스냅샷 */}
        <button
          onClick={onSnapshot}
          disabled={snapshotting || !editor}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="현재 내용을 버전으로 저장"
        >
          {snapshotting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Camera className="w-3 h-3" />
          )}
          스냅샷
        </button>
      </div>
    </div>
  )
}
