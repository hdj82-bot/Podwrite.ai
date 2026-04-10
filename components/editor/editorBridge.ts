/**
 * editorBridge — TipTap 에디터 인스턴스 전역 접근자
 *
 * TipTapEditor 컴포넌트가 마운트될 때 자신을 등록(register)하고,
 * AIChatSidebar / VersionHistoryPanel 등 외부 컴포넌트에서
 * 텍스트 삽입 또는 버전 복원이 필요할 때 EditorPage를 통해 호출합니다.
 *
 * 사용 흐름:
 *   TipTapEditor         →  editorBridge.register(editor)
 *   AIChatSidebar        →  onInsert(text)  →  EditorPage  →  editorBridge.insert(text)
 *   VersionHistoryPanel  →  onRestore(doc)  →  EditorPage  →  editorBridge.restoreContent(doc)
 */
import type { Editor } from '@tiptap/react'
import type { TipTapDocument } from '@/types'

let _editor: Editor | null = null

export const editorBridge = {
  /** TipTapEditor 마운트/언마운트 시 호출 */
  register(editor: Editor | null) {
    _editor = editor
  },

  /**
   * 현재 커서 위치에 텍스트 삽입
   * @returns 삽입 성공 여부 (에디터 미등록 시 false)
   */
  insert(text: string): boolean {
    if (!_editor) return false
    _editor.chain().focus().insertContent(text).run()
    return true
  },

  /**
   * 에디터 전체 콘텐츠를 교체 (버전 복원용)
   * emitUpdate=true 로 호출하여 자동저장·글자수 재계산이 트리거됩니다.
   * @returns 복원 성공 여부
   */
  restoreContent(content: TipTapDocument): boolean {
    if (!_editor) return false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _editor.commands.setContent(content as any, true)
    _editor.commands.focus('end')
    return true
  },

  /**
   * 에디터에 포커스 복원
   * AI 사이드바 닫기 등 외부 요소에서 포커스가 이동한 후 복원할 때 사용
   * @returns 포커스 성공 여부
   */
  focus(): boolean {
    if (!_editor) return false
    _editor.commands.focus()
    return true
  },

  /** 에디터 인스턴스가 등록되어 있는지 확인 */
  isReady(): boolean {
    return _editor !== null
  },
}
