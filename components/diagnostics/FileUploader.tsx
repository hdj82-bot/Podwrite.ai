'use client'

import { useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

// API가 허용하는 확장자만 표시 (route.ts: text/plain, text/markdown, .txt, .md)
const ACCEPTED_TYPES = ['.txt', '.md']
const MAX_SIZE_BYTES = 5 * 1024 * 1024  // 5MB — API와 동일
const MAX_SIZE_LABEL = '5MB'

interface FileUploaderProps {
  onFile: (file: File) => void
  disabled?: boolean
}

/**
 * 드래그앤드롭 + 클릭 파일 업로더 (2단계)
 * 1단계: 드롭존
 * 2단계: 선택된 파일명·크기 표시 + "진단 시작" 버튼
 */
export default function FileUploader({ onFile, disabled }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  function validate(file: File): string | null {
    if (file.size > MAX_SIZE_BYTES) {
      return `파일 크기는 ${MAX_SIZE_LABEL} 이하여야 합니다. (현재: ${formatBytes(file.size)})`
    }
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
    if (!ACCEPTED_TYPES.includes(ext)) {
      return `지원하지 않는 형식입니다. (허용: ${ACCEPTED_TYPES.join(', ')})`
    }
    return null
  }

  function pickFile(file: File) {
    const err = validate(file)
    if (err) {
      setError(err)
      setSelectedFile(null)
      return
    }
    setError(null)
    setSelectedFile(file)
  }

  function handleConfirm() {
    if (selectedFile && !disabled) onFile(selectedFile)
  }

  function handleReselect() {
    setSelectedFile(null)
    setError(null)
  }

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const file = e.dataTransfer.files[0]
      if (file) pickFile(file)
    },
    [disabled], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }
  const onDragLeave = () => setIsDragging(false)

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) pickFile(file)
    e.target.value = ''  // 같은 파일 재선택 허용
  }

  // ── 2단계: 파일 선택됨 → 미리보기 + 확인 버튼 ──────────────────
  if (selectedFile) {
    const ext = selectedFile.name.split('.').pop()?.toUpperCase() ?? 'TXT'

    return (
      <div className="space-y-3">
        {/* 파일 정보 카드 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4">
          {/* 확장자 뱃지 */}
          <div className="w-11 h-11 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-white tracking-wide">{ext}</span>
          </div>

          {/* 파일명 + 크기 */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{selectedFile.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatBytes(selectedFile.size)}</p>
          </div>

          {/* 다시 선택 */}
          <button
            type="button"
            onClick={handleReselect}
            disabled={disabled}
            aria-label="파일 다시 선택"
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 진단 시작 버튼 */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={disabled}
          className={cn(
            'w-full py-3 rounded-xl text-sm font-semibold transition-colors',
            disabled
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-black text-white hover:bg-gray-800 active:bg-gray-900',
          )}
        >
          진단 시작
        </button>
      </div>
    )
  }

  // ── 1단계: 드롭존 ────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
          isDragging
            ? 'border-black bg-gray-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50/50',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          !disabled && 'cursor-pointer',
        )}
      >
        {/* 아이콘 */}
        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>

        {isDragging ? (
          <p className="text-sm font-medium text-gray-700">파일을 놓으세요</p>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-900">
              파일을 드래그하거나{' '}
              <span className="underline underline-offset-2">클릭하여 선택</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {ACCEPTED_TYPES.join(', ')} · 최대 {MAX_SIZE_LABEL}
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={onInputChange}
          className="sr-only"
          tabIndex={-1}
        />
      </div>

      {/* 에러 메시지 */}
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1.5 px-1">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
