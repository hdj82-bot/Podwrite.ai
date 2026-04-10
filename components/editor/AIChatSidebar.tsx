'use client'

/**
 * AIChatSidebar — AI 집필 보조 + 자료 검색 사이드바
 *
 * 모드:
 *   writing  — 집필 보조 (SSE 스트리밍, /api/chat/ai)
 *   outline  — 목차 기획 (SSE 스트리밍, /api/chat/ai)
 *   style    — 문체 교열 (SSE 스트리밍, /api/chat/ai)
 *   search   — 자료 검색 (단건 요청, /api/search)
 *
 * Props:
 *   projectId — 검색 캐시 키 (search_results 테이블)
 *   onInsert  — "에디터에 삽입" 클릭 시 호출 (EditorPage → editorBridge.insert)
 */
import { useState, useRef, useEffect, useCallback, useId } from 'react'
import { Send, Loader2, Trash2, Search, ExternalLink, Plus, CheckSquare, ArrowRight, ClipboardCopy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SearchResultItem } from '@/types'

// ── 타입 ─────────────────────────────────────────────────────────────

type ChatMode = 'writing' | 'outline' | 'style'
type SidebarMode = ChatMode | 'search' | 'proofread'

/** /api/spellcheck 응답 항목 */
interface SpellCheckCorrection {
  original: string
  corrected: string
  offset: number
  message: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

/** /api/search 응답의 results 필드 실제 구조 */
interface SearchResults {
  content: string
  sources: SearchResultItem[]
}

interface SearchState {
  query: string
  results: SearchResults | null
  loading: boolean
  error: string | null
  cached: boolean
}

// ── 상수 ─────────────────────────────────────────────────────────────

const MODE_TABS: { value: SidebarMode; label: string; title: string }[] = [
  { value: 'writing',   label: '집필', title: '집필 보조' },
  { value: 'outline',   label: '목차', title: '목차 기획' },
  { value: 'style',     label: '교열', title: '문체 교열' },
  { value: 'search',    label: '검색', title: '자료 검색' },
  { value: 'proofread', label: '맞춤', title: '맞춤법 검사' },
]

const CHAT_WELCOME: Record<ChatMode, string> = {
  writing:
    '안녕하세요! 집필 보조 모드입니다.\n글의 일부를 붙여넣으면 이어쓰기·수정 제안을 드립니다.',
  outline:
    '안녕하세요! 목차 기획 모드입니다.\n책의 주제와 대상 독자를 알려주시면 목차를 설계해 드립니다.',
  style:
    '안녕하세요! 문체 교열 모드입니다.\n교정이 필요한 문장이나 단락을 붙여넣어 주세요.',
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────

interface AIChatSidebarProps {
  projectId: string
  onInsert?: (text: string) => void
}

export default function AIChatSidebar({ projectId, onInsert }: AIChatSidebarProps) {
  const uid = useId()
  const [mode, setMode] = useState<SidebarMode>('writing')

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── 모드 탭 ── */}
      <div className="flex-shrink-0 border-b border-gray-200 px-3 pt-2.5 pb-0">
        <p className="text-xs font-semibold text-gray-700 mb-2">AI 보조</p>
        <div className="flex gap-1">
          {MODE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setMode(tab.value)}
              title={tab.title}
              className={cn(
                'flex-1 py-1.5 text-xs rounded-t transition-colors font-medium',
                mode === tab.value
                  ? 'bg-white border border-b-white border-gray-200 text-gray-900 -mb-px relative z-10'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 패널 내용 ── */}
      {mode === 'search' ? (
        <SearchPanel
          key="search"
          uid={uid}
          projectId={projectId}
          onInsert={onInsert}
        />
      ) : mode === 'proofread' ? (
        <ProofreadPanel
          key="proofread"
          onInsert={onInsert}
        />
      ) : (
        <ChatPanel
          key={mode}
          uid={uid}
          mode={mode}
          onInsert={onInsert}
        />
      )}
    </div>
  )
}

// ── 채팅 패널 (writing / outline / style) ────────────────────────────

interface ChatPanelProps {
  uid: string
  mode: ChatMode
  onInsert?: (text: string) => void
}

function ChatPanel({ uid, mode, onInsert }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: `${uid}-welcome`, role: 'assistant', content: CHAT_WELCOME[mode] },
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 모드 탭 전환(언마운트) 시 진행 중인 SSE 스트리밍 중단
  // cleanup 없으면 fetch가 백그라운드에서 계속 실행되고
  // 언마운트된 컴포넌트에 setMessages를 호출해 메모리 누수 발생
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  const handleClear = () => {
    setMessages([{ id: `${uid}-welcome-${Date.now()}`, role: 'assistant', content: CHAT_WELCOME[mode] }])
    setError(null)
  }

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: ChatMessage = { id: `${uid}-u-${Date.now()}`, role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setError(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const assistantId = `${uid}-a-${Date.now()}`
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])
    setStreaming(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch('/api/chat/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          mode,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      })

      if (!res.ok) {
        const { error: errMsg } = await res.json().catch(() => ({ error: '알 수 없는 오류' }))
        throw new Error(errMsg ?? `서버 오류 (${res.status})`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') break
          try {
            const { text: chunk } = JSON.parse(raw) as { text: string }
            finalText += chunk
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId ? { ...m, content: finalText } : m),
            )
          } catch { /* 파싱 실패 무시 */ }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message ?? '오류가 발생했습니다.')
      setMessages((prev) => prev.filter((m) => m.id !== assistantId))
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [input, streaming, messages, mode, uid])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* 초기화 버튼 */}
      <div className="flex justify-end px-3 py-1.5 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={handleClear}
          className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="대화 초기화"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex flex-col gap-1', msg.role === 'user' ? 'items-end' : 'items-start')}>
            <div
              className={cn(
                'max-w-[90%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap break-words',
                msg.role === 'user'
                  ? 'bg-black text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm',
              )}
            >
              {msg.content || <span className="inline-flex items-center"><span className="w-1 h-3.5 bg-gray-400 animate-pulse rounded-sm" /></span>}
            </div>
            {/* AI 응답 삽입 버튼 */}
            {msg.role === 'assistant' && msg.content && onInsert && (
              <button
                onClick={() => onInsert(msg.content)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                title="에디터에 삽입"
              >
                <Plus className="w-3 h-3" />
                삽입
              </button>
            )}
          </div>
        ))}
        {error && <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="flex-shrink-0 border-t border-gray-200 p-2.5">
        <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-gray-400 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="질문하거나 글 일부를 붙여넣으세요..."
            rows={1}
            disabled={streaming}
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none disabled:opacity-50 leading-relaxed"
            style={{ minHeight: '24px', maxHeight: '160px' }}
          />
          {streaming ? (
            <button onClick={() => { abortRef.current?.abort(); setStreaming(false) }}
              className="flex-shrink-0 p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors" title="중단">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim()}
              className="flex-shrink-0 p-1.5 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="전송 (Enter)">
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">Enter 전송 · Shift+Enter 줄바꿈</p>
      </div>
    </>
  )
}

// ── 검색 패널 ────────────────────────────────────────────────────────

interface SearchPanelProps {
  uid: string
  projectId: string
  onInsert?: (text: string) => void
}

function SearchPanel({ uid: _uid, projectId, onInsert }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>({
    query: '',
    results: null,
    loading: false,
    error: null,
    cached: false,
  })

  const inputRef = useRef<HTMLInputElement>(null)

  const handleSearch = useCallback(async () => {
    const q = query.trim()
    if (!q || state.loading) return

    setState({ query: q, results: null, loading: true, error: null, cached: false })

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, project_id: projectId }),
      })

      const json = await res.json()

      if (!res.ok) {
        setState((prev) => ({ ...prev, loading: false, error: json.error ?? `오류 (${res.status})` }))
        return
      }

      // data.results = { content, sources }
      const results = json.data?.results as SearchResults | undefined
      setState({
        query: q,
        results: results ?? null,
        loading: false,
        error: results ? null : '검색 결과가 없습니다.',
        cached: json.cached ?? false,
      })
    } catch {
      setState((prev) => ({ ...prev, loading: false, error: '검색 중 오류가 발생했습니다.' }))
    }
  }, [query, state.loading, projectId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSearch()
    }
  }

  /** 요약 전체를 에디터에 삽입 */
  const insertSummary = () => {
    if (!state.results || !onInsert) return
    const { content, sources } = state.results
    let text = content
    if (sources.length > 0) {
      text += '\n\n참고 자료:\n' + sources.map((s) => `- ${s.title}: ${s.url}`).join('\n')
    }
    onInsert(text)
  }

  /** 개별 출처를 에디터에 삽입 */
  const insertSource = (source: SearchResultItem) => {
    if (!onInsert) return
    onInsert(`[${source.title}](${source.url})`)
  }

  return (
    <>
      {/* 검색 입력 */}
      <div className="flex-shrink-0 px-3 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 px-3 py-2 focus-within:border-gray-400 transition-colors">
          <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="자료 검색..."
            disabled={state.loading}
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none disabled:opacity-50"
          />
          {state.loading ? (
            <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin flex-shrink-0" />
          ) : (
            <button
              onClick={handleSearch}
              disabled={!query.trim()}
              className="flex-shrink-0 p-0.5 text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="검색"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Perplexity AI 실시간 검색 · 24시간 캐시
        </p>
      </div>

      {/* 결과 영역 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {state.loading && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <p className="text-xs">검색 중...</p>
          </div>
        )}

        {state.error && !state.loading && (
          <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2.5">
            {state.error}
          </div>
        )}

        {state.results && !state.loading && (
          <>
            {/* 캐시 표시 */}
            {state.cached && (
              <p className="text-xs text-gray-400">캐시된 결과 · "{state.query}"</p>
            )}

            {/* AI 요약 카드 */}
            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">AI 요약</p>
                {onInsert && (
                  <button
                    onClick={insertSummary}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors"
                    title="요약 전체를 에디터에 삽입"
                  >
                    <Plus className="w-3 h-3" />
                    삽입
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {state.results.content}
              </p>
            </div>

            {/* 출처 목록 */}
            {state.results.sources.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-500">출처 ({state.results.sources.length})</p>
                {state.results.sources.map((source, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2"
                  >
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 truncate min-w-0"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{source.title}</span>
                    </a>
                    {onInsert && (
                      <button
                        onClick={() => insertSource(source)}
                        className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                        title="이 출처를 에디터에 삽입"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* 초기 안내 */}
        {!state.results && !state.loading && !state.error && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-gray-400">
            <Search className="w-8 h-8 opacity-30" />
            <p className="text-xs leading-relaxed">
              검색어를 입력하면 Perplexity AI가<br />
              실시간 자료를 조사해 드립니다.
            </p>
          </div>
        )}
      </div>
    </>
  )
}

// ── 맞춤법 검사 패널 ──────────────────────────────────────────────────

interface ProofreadPanelProps {
  onInsert?: (text: string) => void
}

/**
 * corrections의 offset 기반으로 원본 텍스트에 교정을 일괄 적용합니다.
 * offset 역순으로 처리하여 앞 교정이 뒤 offset에 영향을 주지 않습니다.
 */
function applyAllCorrections(text: string, corrections: SpellCheckCorrection[]): string {
  const sorted = [...corrections].sort((a, b) => b.offset - a.offset)
  let result = text
  for (const c of sorted) {
    if (!c.original || c.original === c.corrected) continue
    const before = result.slice(0, c.offset)
    const after = result.slice(c.offset + c.original.length)
    result = before + c.corrected + after
  }
  return result
}

function ProofreadPanel({ onInsert }: ProofreadPanelProps) {
  const [inputText, setInputText] = useState('')
  const [corrections, setCorrections] = useState<SpellCheckCorrection[] | null>(null)
  const [correctedText, setCorrectedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCheck = useCallback(async () => {
    const text = inputText.trim()
    if (!text || loading) return

    setLoading(true)
    setError(null)
    setCorrections(null)
    setCorrectedText('')

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

      const items: SpellCheckCorrection[] = json.data ?? []
      setCorrections(items)
      setCorrectedText(applyAllCorrections(text, items))
    } catch {
      setError('맞춤법 검사 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [inputText, loading])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleCheck()
    }
  }

  const handleCopyAndInsert = () => {
    if (!correctedText) return
    if (onInsert) {
      onInsert(correctedText)
    } else {
      navigator.clipboard.writeText(correctedText).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const hasErrors = corrections !== null && corrections.length > 0
  const noErrors  = corrections !== null && corrections.length === 0

  return (
    <>
      {/* 입력 영역 */}
      <div className="flex-shrink-0 px-3 py-2.5 border-b border-gray-100 space-y-2">
        <textarea
          value={inputText}
          onChange={(e) => { setInputText(e.target.value); setCorrections(null) }}
          onKeyDown={handleKeyDown}
          placeholder="교정할 텍스트를 붙여넣으세요..."
          rows={5}
          disabled={loading}
          className="w-full text-sm text-gray-900 placeholder-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-gray-400 transition-colors disabled:opacity-50 leading-relaxed"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">Ctrl+Enter 검사</p>
          <button
            onClick={handleCheck}
            disabled={!inputText.trim() || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckSquare className="w-3 h-3" />}
            {loading ? '검사 중...' : '맞춤법 검사'}
          </button>
        </div>
      </div>

      {/* 결과 영역 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {error && (
          <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2.5">{error}</div>
        )}

        {noErrors && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 rounded-lg border border-green-100">
            <CheckSquare className="w-4 h-4 text-green-600 flex-shrink-0" />
            <p className="text-xs text-green-700 font-medium">맞춤법 오류가 없습니다.</p>
          </div>
        )}

        {hasErrors && (
          <>
            {/* 요약 */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">
                오류 {corrections.length}건 발견
              </p>
              <button
                onClick={handleCopyAndInsert}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors"
                title={onInsert ? '교정문을 에디터에 삽입' : '교정문 복사'}
              >
                {copied
                  ? <CheckSquare className="w-3 h-3 text-green-600" />
                  : onInsert
                    ? <Plus className="w-3 h-3" />
                    : <ClipboardCopy className="w-3 h-3" />
                }
                {copied ? '복사됨' : onInsert ? '교정문 삽입' : '교정문 복사'}
              </button>
            </div>

            {/* 오류 항목 목록 */}
            <div className="space-y-2">
              {corrections.map((c, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 space-y-1"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-red-500 line-through">{c.original}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="text-green-700 font-medium">{c.corrected}</span>
                  </div>
                  {c.message && (
                    <p className="text-xs text-gray-500">{c.message}</p>
                  )}
                </div>
              ))}
            </div>

            {/* 교정된 전체 텍스트 미리보기 */}
            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700">교정문 미리보기</p>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap line-clamp-6">
                {correctedText}
              </p>
            </div>
          </>
        )}

        {/* 초기 안내 */}
        {corrections === null && !loading && !error && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-gray-400">
            <CheckSquare className="w-8 h-8 opacity-30" />
            <p className="text-xs leading-relaxed">
              텍스트를 붙여넣고 검사하면<br />
              맞춤법·띄어쓰기 오류를 알려드립니다.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
