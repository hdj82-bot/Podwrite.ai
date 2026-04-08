/**
 * 캔바 표지 디자인 딥링크 컴포넌트
 *
 * 캔바 API 미승인 상태 대응:
 *  - 공식 딥링크 대신 Book Cover 템플릿 검색 페이지로 연결
 *  - 플랫폼별 규격을 툴팁 + 클립보드 복사 버튼으로 제공
 *
 * 규격:
 *   bookk  148 × 210 mm (A5)
 *   kyobo  152 × 225 mm
 *   kdp    6 × 9 인치 (152.4 × 228.6 mm)
 */
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Platform } from '@/types'

interface CanvaDeepLinkProps {
  platform: Platform
}

const PLATFORM_SPEC: Record<Platform, { label: string; size: string; canvaSearch: string }> = {
  bookk: {
    label: '부크크',
    size: '148 × 210 mm (A5)',
    canvaSearch: 'https://www.canva.com/ko_kr/templates/?query=book+cover+a5',
  },
  kyobo: {
    label: '교보문고',
    size: '152 × 225 mm',
    canvaSearch: 'https://www.canva.com/ko_kr/templates/?query=book+cover',
  },
  kdp: {
    label: 'Amazon KDP',
    size: '6 × 9 인치 (152.4 × 228.6 mm)',
    canvaSearch: 'https://www.canva.com/ko_kr/templates/?query=book+cover+kdp',
  },
}

export default function CanvaDeepLink({ platform }: CanvaDeepLinkProps) {
  const [copied, setCopied] = useState(false)
  const spec = PLATFORM_SPEC[platform]

  async function copySize() {
    try {
      await navigator.clipboard.writeText(spec.size)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard 실패 무시
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      {/* 규격 안내 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {spec.label} 표지 규격
          </p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5">{spec.size}</p>
        </div>
        <button
          onClick={copySize}
          title="규격 복사"
          className={cn(
            'flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-colors',
            copied
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100',
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
                  d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
              </svg>
              복사
            </>
          )}
        </button>
      </div>

      {/* 캔바 이동 버튼 */}
      <a
        href={spec.canvaSearch}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#8B3DFF] text-white text-sm font-medium rounded-lg hover:bg-[#7B2FEF] transition-colors"
      >
        {/* Canva 브랜드 아이콘 (단순 C 문자) */}
        <span className="font-bold text-base leading-none">C</span>
        캔바에서 표지 디자인하기
        <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
      </a>

      <p className="text-xs text-gray-400 text-center">
        캔바 템플릿에서 위 규격으로 커스텀 크기를 설정하세요
      </p>
    </div>
  )
}
