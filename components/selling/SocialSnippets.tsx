'use client'

/**
 * SocialSnippets — 생성된 카피 기반 SNS용 자동 변환
 *
 * 지원 채널:
 *   - Twitter / X  : 280자 이하 + 해시태그 3개
 *   - 인스타그램   : 2,200자 이하 + 해시태그 10개
 *   - 블로그 서두  : 300자 요약
 */

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

interface SocialSnippetsProps {
  description: string
  titles: string[]
  keywords: string[]
}

interface Snippet {
  key:      'twitter' | 'instagram' | 'blog'
  label:    string
  icon:     string
  content:  string
  maxChars: number
}

// ── 해시태그 변환 ──────────────────────────────────────────────────
function toHashtag(kw: string): string {
  return '#' + kw.replace(/\s+/g, '').replace(/[^\w가-힣]/g, '')
}

// ── 스니펫 생성 ────────────────────────────────────────────────────
function buildSnippets(
  description: string,
  keywords: string[],
): Snippet[] {
  const tags3  = keywords.slice(0, 3).map(toHashtag).join(' ')
  const tags10 = keywords.slice(0, 10).map(toHashtag).join(' ')

  // Twitter/X: 본문 230자 + 줄바꿈 + 해시태그 3개
  const twitterBody =
    description.length > 230 ? description.slice(0, 229) + '…' : description
  const twitterContent = `${twitterBody}\n\n${tags3}`

  // Instagram: 최대 2,200자 (본문 + 구분선 + 해시태그 10개)
  const igSuffix = `\n\n.\n.\n.\n${tags10}`
  const igMaxBody = 2200 - igSuffix.length
  const igBody =
    description.length > igMaxBody
      ? description.slice(0, igMaxBody - 1) + '…'
      : description
  const igContent = `${igBody}${igSuffix}`

  // 블로그 서두: 300자 요약
  const blogContent =
    description.length > 300 ? description.slice(0, 299) + '…' : description

  return [
    {
      key:      'twitter',
      label:    'Twitter / X',
      icon:     'X',
      content:  twitterContent,
      maxChars: 280,
    },
    {
      key:      'instagram',
      label:    '인스타그램',
      icon:     'IG',
      content:  igContent,
      maxChars: 2200,
    },
    {
      key:      'blog',
      label:    '블로그 서두',
      icon:     'B',
      content:  blogContent,
      maxChars: 300,
    },
  ]
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────
export default function SocialSnippets({
  description,
  titles,
  keywords,
}: SocialSnippetsProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const snippets = useMemo(
    () => buildSnippets(description, keywords),
    [description, keywords],
  )

  async function handleCopy(key: string, content: string) {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      // clipboard 접근 불가 환경 무시
    }
  }

  return (
    <div className="space-y-3">
      {snippets.map((snippet) => {
        const isCopied = copiedKey === snippet.key
        const charRatio = (snippet.content.length / snippet.maxChars) * 100
        const isOver    = snippet.content.length > snippet.maxChars

        return (
          <div
            key={snippet.key}
            className="bg-white border border-gray-200 rounded-xl p-4 space-y-3"
          >
            {/* ── 헤더 ────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* 채널 아이콘 뱃지 */}
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold leading-none">
                  {snippet.icon}
                </span>
                <span className="text-xs font-semibold text-gray-700">
                  {snippet.label}
                </span>
                <span className="text-xs text-gray-400">
                  최대 {snippet.maxChars.toLocaleString('ko-KR')}자
                </span>
              </div>

              <button
                onClick={() => handleCopy(snippet.key, snippet.content)}
                aria-label={`${snippet.label} 복사`}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-colors',
                  isCopied
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100',
                )}
              >
                {isCopied ? (
                  <>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    복사됨
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25"
                      />
                    </svg>
                    복사
                  </>
                )}
              </button>
            </div>

            {/* ── 콘텐츠 미리보기 ─────────────────────────────── */}
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg px-3.5 py-3">
              {snippet.content}
            </p>

            {/* ── 글자 수 프로그레스 바 ────────────────────────── */}
            <div className="space-y-1.5">
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    isOver ? 'bg-amber-400' : 'bg-blue-400',
                  )}
                  style={{ width: `${Math.min(charRatio, 100)}%` }}
                />
              </div>
              <p
                className={cn(
                  'text-right text-xs tabular-nums',
                  isOver ? 'text-amber-600 font-semibold' : 'text-gray-400',
                )}
              >
                {snippet.content.length.toLocaleString('ko-KR')} /{' '}
                {snippet.maxChars.toLocaleString('ko-KR')}자
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
