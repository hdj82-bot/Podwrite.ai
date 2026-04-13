'use client'

/**
 * PlatformCopyCard — 생성된 카피 한 블록 표시 카드
 *
 * variant:
 *   'text' — 단락 텍스트 (소개문)
 *   'list' — 번호 목록 (제목 후보)
 *   'tags' — 태그 칩 (키워드)
 *
 * platform + type='description' 조합 시:
 *   - 플랫폼별 권장 글자 수 가이드 표시
 *   - 현재 글자 수 색상 피드백
 *     · 부크크: 200–500자
 *     · 교보문고: 300–800자
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'

// ── 플랫폼별 소개문 권장 글자 수 ────────────────────────────────────
const DESCRIPTION_RANGE: Record<string, { min: number; max: number; guide: string }> = {
  bookk: { min: 200, max: 500, guide: '부크크 권장: 200–500자' },
  kyobo: { min: 300, max: 800, guide: '교보문고 권장: 300–800자' },
}

interface PlatformCopyCardProps {
  /** 카드 레이블 (섹션 제목) */
  label: string
  /** 표시할 콘텐츠 */
  content: string | string[]
  /** 'text' | 'list' | 'tags' */
  variant?: 'text' | 'list' | 'tags'
  /** 출판 플랫폼 — description 타입의 글자 수 가이드에 사용 */
  platform?: string
  /** 콘텐츠 종류 — 'description'일 때만 글자 수 피드백 활성화 */
  type?: 'description' | 'titles' | 'keywords'
}

export default function PlatformCopyCard({
  label,
  content,
  variant = 'text',
  platform,
  type,
}: PlatformCopyCardProps) {
  const [copied, setCopied] = useState(false)

  const textValue = Array.isArray(content) ? content.join('\n') : content
  const charCount = textValue.length

  // 글자 수 가이드 (description + 알려진 플랫폼일 때만)
  const range = type === 'description' && platform ? DESCRIPTION_RANGE[platform] : undefined

  // ── 글자 수 색상 피드백 ─────────────────────────────────────────
  // 미달: amber / 초과: red / 범위 내: gray
  function charColor(): string {
    if (!range) return 'text-gray-400'
    if (charCount < range.min) return 'text-amber-600'
    if (charCount > range.max) return 'text-red-500'
    return 'text-gray-400'
  }

  function charBadge(): { text: string; cls: string } | null {
    if (!range) return null
    if (charCount < range.min) return { text: '권장 범위보다 짧습니다', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
    if (charCount > range.max) return { text: '최대 글자 수 초과', cls: 'bg-red-50 text-red-600 border-red-200' }
    return null
  }

  // ── 클립보드 복사 ────────────────────────────────────────────────
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(textValue)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard 접근 불가 환경 무시
    }
  }

  const badge = charBadge()

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">

      {/* ── 헤더: 레이블 + 뱃지 + 복사 버튼 ────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
            {label}
          </span>
          {badge && (
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 text-xs rounded-full border font-medium whitespace-nowrap',
                badge.cls,
              )}
            >
              {badge.text}
            </span>
          )}
        </div>

        <button
          onClick={handleCopy}
          aria-label="클립보드에 복사"
          className={cn(
            'shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-colors',
            copied
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100',
          )}
        >
          {copied ? (
            <>
              {/* 체크 아이콘 */}
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              복사됨
            </>
          ) : (
            <>
              {/* 복사 아이콘 */}
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25" />
              </svg>
              복사
            </>
          )}
        </button>
      </div>

      {/* ── 콘텐츠 ──────────────────────────────────────────────── */}
      {variant === 'list' && Array.isArray(content) ? (
        <ol className="space-y-2.5">
          {content.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-sm text-gray-800">
              <span className="shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-semibold mt-0.5">
                {idx + 1}
              </span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      ) : variant === 'tags' && Array.isArray(content) ? (
        <div className="flex flex-wrap gap-1.5">
          {content.map((kw, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium"
            >
              {kw}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {Array.isArray(content) ? content.join('\n') : content}
        </p>
      )}

      {/* ── 글자 수 / 권장 범위 + 프로그레스 바 ───────────────── */}
      {range && (
        <div className="pt-2 border-t border-gray-100 space-y-1.5">
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                charCount < range.min
                  ? 'bg-amber-400'
                  : charCount > range.max
                  ? 'bg-red-400'
                  : 'bg-gray-300',
              )}
              style={{ width: `${Math.min((charCount / range.max) * 100, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">{range.guide}</p>
            <p className={cn('text-xs font-semibold tabular-nums', charColor())}>
              {charCount.toLocaleString('ko-KR')} / {range.max.toLocaleString('ko-KR')}자
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
