'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface PlatformCopyCardProps {
  label: string
  content: string | string[]
  /** 텍스트 형태: 'list'이면 배열을 번호 목록으로, 'text'이면 단락으로 표시 */
  variant?: 'list' | 'text'
}

/**
 * 생성된 카피 한 블록을 표시하는 카드
 * 클립보드 복사 버튼 포함
 */
export default function PlatformCopyCard({ label, content, variant = 'text' }: PlatformCopyCardProps) {
  const [copied, setCopied] = useState(false)

  const textValue = Array.isArray(content) ? content.join('\n') : content

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(textValue)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 무시
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      {/* 레이블 + 복사 버튼 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </span>
        <button
          onClick={handleCopy}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-colors',
            copied
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100',
          )}
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              복사됨
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9 3.664l1.049 1.049-5.207 5.207-2.098-2.098 1.049-1.049 1.049 1.049 4.158-4.158z" />
              </svg>
              복사
            </>
          )}
        </button>
      </div>

      {/* 콘텐츠 */}
      {variant === 'list' && Array.isArray(content) ? (
        <ol className="space-y-2">
          {content.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-gray-800">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-medium mt-0.5">
                {idx + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {Array.isArray(content) ? content.join('\n') : content}
        </p>
      )}
    </div>
  )
}
