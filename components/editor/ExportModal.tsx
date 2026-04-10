'use client'

/**
 * ExportModal — DOCX / EPUB 내보내기 모달
 *
 * DOCX 탭:
 *   - 플랫폼(bookk/kyobo/kdp) 선택
 *   - 표지 포함 여부 체크박스
 *   - POST /api/generate-docx → 202 즉시 반환 (Inngest 백그라운드 잡)
 *
 * EPUB 탭 (Pro 플랜 전용):
 *   - 언어(ko/en) 선택
 *   - 목차 포함 여부 체크박스
 *   - POST /api/generate-epub → 202 즉시 반환
 *
 * API가 202를 반환하면 "생성 요청됨" 상태를 표시합니다.
 * 실제 파일 전달은 Inngest 잡 완료 후 이루어집니다.
 */
import { useState } from 'react'
import { X, FileText, BookOpen, Loader2, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Platform } from '@/types'
import CoverGuideModal from '@/components/cover/CoverGuideModal'

// ── 타입 ─────────────────────────────────────────────────────────────

type ExportFormat = 'docx' | 'epub'
type RequestStatus = 'idle' | 'loading' | 'success' | 'error'

interface DocxOptions {
  platform: Platform
  include_cover: boolean
}

interface EpubOptions {
  language: 'ko' | 'en'
  include_toc: boolean
}

interface ExportModalProps {
  projectId: string
  onClose: () => void
}

// ── 상수 ─────────────────────────────────────────────────────────────

const PLATFORM_OPTIONS: { value: Platform; label: string; description: string }[] = [
  { value: 'bookk',  label: '부크크',     description: 'A5 (148×210mm), 나눔고딕' },
  { value: 'kyobo',  label: '교보문고',   description: 'A5 (148×210mm), 맑은고딕' },
  { value: 'kdp',    label: 'Amazon KDP', description: '6×9인치, Pro 플랜 전용' },
]

// ── 컴포넌트 ─────────────────────────────────────────────────────────

export default function ExportModal({ projectId, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('docx')

  // DOCX 옵션
  const [docxOpts, setDocxOpts] = useState<DocxOptions>({
    platform: 'bookk',
    include_cover: false,
  })

  // EPUB 옵션
  const [epubOpts, setEpubOpts] = useState<EpubOptions>({
    language: 'ko',
    include_toc: true,
  })

  // 요청 상태
  const [status, setStatus] = useState<RequestStatus>('idle')
  const [message, setMessage] = useState<string>('')

  // 표지 규격 가이드 모달
  const [showCoverGuide, setShowCoverGuide] = useState(false)

  const handleSubmit = async () => {
    setStatus('loading')
    setMessage('')

    try {
      let res: Response

      if (format === 'docx') {
        res = await fetch('/api/generate-docx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            platform: docxOpts.platform,
            include_cover: docxOpts.include_cover,
          }),
        })
      } else {
        res = await fetch('/api/generate-epub', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            language: epubOpts.language,
            include_toc: epubOpts.include_toc,
          }),
        })
      }

      const json = await res.json()

      if (!res.ok) {
        // 403: 플랜 제한
        if (res.status === 403) {
          setStatus('error')
          setMessage(json.error ?? 'Pro 플랜 전용 기능입니다.')
          return
        }
        setStatus('error')
        setMessage(json.error ?? `오류가 발생했습니다. (${res.status})`)
        return
      }

      // 202 성공
      setStatus('success')
      setMessage(json.data?.message ?? '생성 요청이 완료되었습니다.')
    } catch {
      setStatus('error')
      setMessage('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  const isLoading = status === 'loading'

  return (
    <>
    {/* 표지 규격 가이드 모달 (ExportModal 위에 렌더, z-[60]) */}
    {showCoverGuide && (
      <CoverGuideModal
        projectId={projectId}
        platform={docxOpts.platform}
        onClose={() => setShowCoverGuide(false)}
      />
    )}

    {/* 오버레이 */}
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">원고 내보내기</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 형식 탭 */}
        <div className="flex gap-2 px-5 pt-4">
          <button
            onClick={() => { setFormat('docx'); setStatus('idle') }}
            className={cn(
              'flex items-center gap-2 flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors',
              format === 'docx'
                ? 'border-black bg-black text-white'
                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50',
            )}
          >
            <FileText className="w-4 h-4" />
            DOCX
          </button>
          <button
            onClick={() => { setFormat('epub'); setStatus('idle') }}
            className={cn(
              'flex items-center gap-2 flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors',
              format === 'epub'
                ? 'border-black bg-black text-white'
                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50',
            )}
          >
            <BookOpen className="w-4 h-4" />
            EPUB
            <span className="ml-auto text-xs font-normal opacity-70">Pro</span>
          </button>
        </div>

        {/* 옵션 영역 */}
        <div className="px-5 pt-4 pb-2 space-y-4">
          {format === 'docx' ? (
            <>
              {/* 플랫폼 선택 */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">출판 플랫폼</p>
                <div className="space-y-1.5">
                  {PLATFORM_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
                        docxOpts.platform === opt.value
                          ? 'border-gray-800 bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300',
                      )}
                    >
                      <input
                        type="radio"
                        name="platform"
                        value={opt.value}
                        checked={docxOpts.platform === opt.value}
                        onChange={() => setDocxOpts((prev) => ({ ...prev, platform: opt.value }))}
                        className="w-3.5 h-3.5 accent-black"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                        <p className="text-xs text-gray-500">{opt.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 표지 포함 */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={docxOpts.include_cover}
                    onChange={(e) => setDocxOpts((prev) => ({ ...prev, include_cover: e.target.checked }))}
                    className="w-4 h-4 rounded accent-black"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">표지 페이지 포함</p>
                    <p className="text-xs text-gray-500">책 제목, 저자명 표지를 첫 페이지에 추가</p>
                  </div>
                </label>
                <button
                  type="button"
                  onClick={() => setShowCoverGuide(true)}
                  className="shrink-0 px-2.5 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  규격 보기
                </button>
              </div>
            </>
          ) : (
            <>
              {/* 언어 선택 */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">언어</p>
                <div className="flex gap-2">
                  {(['ko', 'en'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setEpubOpts((prev) => ({ ...prev, language: lang }))}
                      className={cn(
                        'flex-1 py-2 rounded-lg border text-sm font-medium transition-colors',
                        epubOpts.language === lang
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                      )}
                    >
                      {lang === 'ko' ? '한국어' : 'English'}
                    </button>
                  ))}
                </div>
              </div>

              {/* TOC 포함 */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={epubOpts.include_toc}
                  onChange={(e) => setEpubOpts((prev) => ({ ...prev, include_toc: e.target.checked }))}
                  className="w-4 h-4 rounded accent-black"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">목차(TOC) 포함</p>
                  <p className="text-xs text-gray-500">챕터 제목 기반 자동 목차 생성</p>
                </div>
              </label>

              {/* EPUB Pro 안내 */}
              <div className="flex items-start gap-2 px-3 py-2.5 bg-purple-50 rounded-lg border border-purple-100">
                <AlertCircle className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-purple-700 leading-relaxed">
                  EPUB 생성은 Pro 플랜 전용입니다. Amazon KDP 글로벌 출판에 사용됩니다.
                </p>
              </div>
            </>
          )}
        </div>

        {/* 결과 메시지 */}
        {status !== 'idle' && (
          <div className={cn(
            'mx-5 mb-2 flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm',
            status === 'success' ? 'bg-green-50 text-green-700' : '',
            status === 'error'   ? 'bg-red-50 text-red-600'     : '',
            status === 'loading' ? 'bg-gray-50 text-gray-500'   : '',
          )}>
            {status === 'success' && <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            {status === 'error'   && <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            {status === 'loading' && <Loader2 className="w-4 h-4 flex-shrink-0 mt-0.5 animate-spin" />}
            <span>{status === 'loading' ? '생성 요청 중...' : message}</span>
          </div>
        )}

        {/* 푸터 버튼 */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            {format === 'docx'
              ? '생성 완료 후 다운로드 링크가 이메일로 전송됩니다.'
              : '약 2-5분 후 이메일로 전송됩니다.'}
          </p>
          <div className="flex gap-2">
            {status === 'success' ? (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                확인
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  내보내기
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
