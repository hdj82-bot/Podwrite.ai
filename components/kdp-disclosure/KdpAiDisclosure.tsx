'use client'

/**
 * KdpAiDisclosure — Amazon KDP AI 생성 콘텐츠 공개 선택
 *
 * KDP 정책에 따라 AI 생성/보조 콘텐츠 공개 여부를 반드시 선택해야 합니다.
 * https://kdp.amazon.com/help/topic/GR4AJVWNYNKWETFG
 */

import { cn } from '@/lib/utils'

export type AiDisclosureLevel = 'none' | 'some' | 'primary'

interface KdpAiDisclosureProps {
  value: AiDisclosureLevel | null
  onChange: (level: AiDisclosureLevel) => void
  /** 읽기 전용 (이미 제출된 경우) */
  readonly?: boolean
}

const OPTIONS: Array<{
  value: AiDisclosureLevel
  label: string
  kdpLabel: string
  description: string
  color: string
  selectedColor: string
}> = [
  {
    value: 'none',
    label: 'AI 사용 없음',
    kdpLabel: 'Not AI-generated',
    description: '원고·표지·번역 등 모든 콘텐츠를 직접 창작하였습니다.',
    color: 'border-gray-200 bg-white hover:border-gray-400',
    selectedColor: 'border-green-400 bg-green-50',
  },
  {
    value: 'some',
    label: '일부 AI 활용',
    kdpLabel: 'AI-assisted (some content)',
    description: '교정·아이디어 제안·번역 보조 등 일부에 AI를 활용했습니다.',
    color: 'border-gray-200 bg-white hover:border-gray-400',
    selectedColor: 'border-orange-400 bg-orange-50',
  },
  {
    value: 'primary',
    label: '주요 AI 생성',
    kdpLabel: 'Primarily AI-generated',
    description: '원고 본문 또는 표지 이미지 등 핵심 콘텐츠를 AI로 생성했습니다.',
    color: 'border-gray-200 bg-white hover:border-gray-400',
    selectedColor: 'border-purple-400 bg-purple-50',
  },
]

export default function KdpAiDisclosure({ value, onChange, readonly }: KdpAiDisclosureProps) {
  return (
    <div className="space-y-3">
      {/* 안내 */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
        <p className="text-xs text-amber-800 font-semibold mb-0.5">Amazon KDP 정책 요구사항</p>
        <p className="text-xs text-amber-700">
          2024년부터 KDP는 AI 생성 콘텐츠 포함 여부를 의무적으로 공개해야 합니다.
          허위 기재 시 게시 거절 또는 계정 제재를 받을 수 있습니다.
        </p>
      </div>

      {/* 선택 옵션 */}
      <div className="space-y-2">
        {OPTIONS.map((opt) => {
          const isSelected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => !readonly && onChange(opt.value)}
              disabled={readonly}
              className={cn(
                'w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all',
                isSelected ? opt.selectedColor : opt.color,
                readonly && 'cursor-default opacity-70',
              )}
            >
              <div className="flex items-start gap-3">
                {/* 라디오 인디케이터 */}
                <div
                  className={cn(
                    'mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                    isSelected
                      ? 'border-current'
                      : 'border-gray-300',
                  )}
                >
                  {isSelected && (
                    <div className="h-2 w-2 rounded-full bg-current" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{opt.label}</span>
                    <span className="text-xs text-gray-400 font-mono">{opt.kdpLabel}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{opt.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 선택됨 표시 */}
      {value && (
        <p className="text-xs text-gray-500">
          선택됨:{' '}
          <span className="font-medium text-gray-700">
            {OPTIONS.find((o) => o.value === value)?.kdpLabel}
          </span>
        </p>
      )}
    </div>
  )
}
