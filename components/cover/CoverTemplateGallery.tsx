'use client'

/**
 * CoverTemplateGallery — Canvas API 기반 커버 템플릿 갤러리
 *
 * - 6개 장르: 소설 / 자기계발 / 에세이 / 비즈니스 / 시집 / 아동
 * - 장르당 3종 배경 팔레트 × 2종 폰트 스타일 = 6개 조합
 * - 선택 시 프로젝트 제목/저자명 자동 반영
 * - "이 커버 사용하기" 클릭 → 600×900 PNG dataURL 반환
 */

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Platform } from '@/types'

// ── 썸네일 캔버스 크기 ────────────────────────────────────────────────────────

const TW = 120
const TH = 180

// ── 장르 목록 ─────────────────────────────────────────────────────────────────

const GENRE_LIST = [
  { id: 'novel',    label: '소설' },
  { id: 'selfhelp', label: '자기계발' },
  { id: 'essay',    label: '에세이' },
  { id: 'business', label: '비즈니스' },
  { id: 'poetry',   label: '시집' },
  { id: 'children', label: '아동' },
] as const

type GenreId = typeof GENRE_LIST[number]['id']

// ── 팔레트: [배경색, 강조색, 텍스트색] ───────────────────────────────────────

const PALETTES: Record<GenreId, [string, string, string][]> = {
  novel: [
    ['#1a1a2e', '#e94560', '#ffffff'],
    ['#2d1b69', '#a855f7', '#f0e6ff'],
    ['#1c2333', '#4895ef', '#e8f4ff'],
  ],
  selfhelp: [
    ['#ff6b35', '#ffffff', '#1a1a1a'],
    ['#023e8a', '#4cc9f0', '#ffffff'],
    ['#1b4332', '#95d5b2', '#f0fff4'],
  ],
  essay: [
    ['#fdf6e3', '#8b7355', '#3d2b1f'],
    ['#f0f8ff', '#4a90d9', '#2c3e50'],
    ['#fff0f3', '#c2185b', '#2d1b3d'],
  ],
  business: [
    ['#121212', '#c9a84c', '#ffffff'],
    ['#003049', '#fcbf49', '#edf2f4'],
    ['#1b4332', '#52b788', '#f0fff4'],
  ],
  poetry: [
    ['#fafaf0', '#b5936b', '#2c2016'],
    ['#0d0d0d', '#d4a853', '#f5f0e8'],
    ['#f8f0ff', '#9b59b6', '#3d1f4e'],
  ],
  children: [
    ['#ffd93d', '#ff6b6b', '#1a1a2e'],
    ['#6bcb77', '#4d96ff', '#1a1a2e'],
    ['#ffb3de', '#54a0ff', '#1a1a2e'],
  ],
}

// 폰트 스타일 레이블
const FONT_STYLE_LABELS = ['중앙 굵게', '좌측 날씬'] as const

// ── 캔버스 그리기 함수 ────────────────────────────────────────────────────────

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  centerY: number,
  maxWidth: number,
  lineH: number,
) {
  const chars = Array.from(text)
  const lines: string[] = []
  let cur = ''
  for (const ch of chars) {
    const test = cur + ch
    if (ctx.measureText(test).width > maxWidth && cur.length > 0) {
      lines.push(cur)
      cur = ch
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  const startY = centerY - ((lines.length - 1) * lineH) / 2
  lines.forEach((ln, i) => ctx.fillText(ln, x, startY + i * lineH))
}

function drawDecoration(
  ctx: CanvasRenderingContext2D,
  genreId: GenreId,
  W: number,
  H: number,
  accent: string,
) {
  ctx.save()
  switch (genreId) {
    case 'novel': {
      ctx.fillStyle = accent
      ctx.fillRect(0, 0, W, H * 0.055)
      ctx.fillRect(0, H * 0.945, W, H * 0.055)
      break
    }
    case 'selfhelp': {
      ctx.fillStyle = accent
      ctx.fillRect(0, 0, W * 0.038, H)
      ctx.font = `900 ${H * 0.48}px sans-serif`
      ctx.fillStyle = accent
      ctx.globalAlpha = 0.06
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText('1', W * 0.95, H * 0.85)
      ctx.globalAlpha = 1
      break
    }
    case 'essay': {
      const grad = ctx.createLinearGradient(0, 0, 0, H * 0.5)
      grad.addColorStop(0, accent + '28')
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H * 0.5)
      ctx.strokeStyle = accent
      ctx.lineWidth = Math.max(0.5, H * 0.002)
      ctx.globalAlpha = 0.4
      ctx.beginPath()
      ctx.moveTo(W * 0.15, H * 0.28)
      ctx.lineTo(W * 0.85, H * 0.28)
      ctx.stroke()
      ctx.globalAlpha = 1
      break
    }
    case 'business': {
      ctx.fillStyle = accent
      ctx.fillRect(0, 0, W, H * 0.022)
      ctx.fillRect(W * 0.07, H * 0.1, W * 0.014, H * 0.28)
      break
    }
    case 'poetry': {
      ctx.strokeStyle = accent
      ctx.lineWidth = Math.max(0.5, H * 0.002)
      ctx.globalAlpha = 0.45
      ctx.beginPath()
      ctx.moveTo(W * 0.32, H * 0.265)
      ctx.lineTo(W * 0.68, H * 0.265)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(W / 2, H * 0.185, W * 0.04, 0, Math.PI * 2)
      ctx.globalAlpha = 0.35
      ctx.stroke()
      ctx.globalAlpha = 1
      break
    }
    case 'children': {
      ctx.fillStyle = accent
      ctx.globalAlpha = 0.18
      ctx.beginPath()
      ctx.arc(W * 0.84, H * 0.11, W * 0.18, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(W * 0.12, H * 0.88, W * 0.13, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = accent
      ctx.globalAlpha = 0.12
      ctx.beginPath()
      ctx.moveTo(0, H * 0.77)
      ctx.quadraticCurveTo(W * 0.25, H * 0.71, W * 0.5, H * 0.77)
      ctx.quadraticCurveTo(W * 0.75, H * 0.83, W, H * 0.77)
      ctx.lineTo(W, H)
      ctx.lineTo(0, H)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1
      break
    }
  }
  ctx.restore()
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  genreId: GenreId,
  paletteIdx: number,
  fontStyleIdx: number,
  title: string,
  author: string,
) {
  const palette = PALETTES[genreId]?.[paletteIdx]
  if (!palette) return
  const [bg, accent, textColor] = palette

  ctx.clearRect(0, 0, W, H)

  // 배경
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // 장르별 장식
  drawDecoration(ctx, genreId, W, H, accent)

  // 텍스트
  ctx.textBaseline = 'middle'
  const isCentered = fontStyleIdx === 0

  if (isCentered) {
    const fontSize = Math.round(H * 0.082)
    ctx.font = `700 ${fontSize}px "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`
    ctx.fillStyle = textColor
    ctx.textAlign = 'center'
    wrapText(ctx, title, W / 2, H * 0.42, W * 0.78, fontSize * 1.5)
    ctx.font = `400 ${Math.round(H * 0.046)}px "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`
    ctx.globalAlpha = 0.75
    ctx.fillText(author, W / 2, H * 0.87)
    ctx.globalAlpha = 1
  } else {
    const px = W * 0.11
    const fontSize = Math.round(H * 0.072)
    ctx.font = `300 ${fontSize}px "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`
    ctx.fillStyle = textColor
    ctx.textAlign = 'left'
    wrapText(ctx, title, px, H * 0.42, W * 0.78, fontSize * 1.5)
    ctx.font = `300 ${Math.round(H * 0.042)}px "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`
    ctx.globalAlpha = 0.7
    ctx.fillText(author, px, H * 0.87)
    ctx.globalAlpha = 1
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CoverTemplateGalleryProps {
  /** 화면 비율 계산용 (현재 썸네일은 2:3 고정, export 시 플랫폼 비율 적용) */
  platform: Platform
  title: string
  authorName?: string
  /** 선택 후 "사용하기" 클릭 시 600×900 PNG dataURL 전달 */
  onSelect: (dataUrl: string) => void
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default function CoverTemplateGallery({
  title,
  authorName = '저자명',
  onSelect,
}: CoverTemplateGalleryProps) {
  const [activeGenre, setActiveGenre] = useState<GenreId>('novel')
  const [selected, setSelected] = useState<{ pIdx: number; fIdx: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 장르/제목/저자 변경 시 전체 캔버스 리렌더
  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current
      .querySelectorAll<HTMLCanvasElement>('canvas[data-p]')
      .forEach((canvas) => {
        const pIdx = parseInt(canvas.dataset.p!)
        const fIdx = parseInt(canvas.dataset.f!)
        const ctx = canvas.getContext('2d')
        if (ctx) drawCover(ctx, TW, TH, activeGenre, pIdx, fIdx, title || '제목', authorName)
      })
  }, [activeGenre, title, authorName])

  function handleUse() {
    if (!selected) return
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = 1600
    exportCanvas.height = 2560
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return
    drawCover(ctx, 1600, 2560, activeGenre, selected.pIdx, selected.fIdx, title || '제목', authorName)
    onSelect(exportCanvas.toDataURL('image/png'))
  }

  return (
    <div className="space-y-4">

      {/* 장르 탭 */}
      <div className="flex flex-wrap gap-1.5">
        {GENRE_LIST.map((g) => (
          <button
            key={g.id}
            onClick={() => { setActiveGenre(g.id); setSelected(null) }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              activeGenre === g.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* 폰트 스타일 헤더 */}
      <div className="grid grid-cols-2 gap-2 text-center px-px">
        {FONT_STYLE_LABELS.map((label, fi) => (
          <p key={fi} className="text-[10px] text-gray-400 font-medium tracking-wide">{label}</p>
        ))}
      </div>

      {/* 템플릿 그리드: 3 팔레트 × 2 폰트 → 6개, 2열 배치 */}
      <div ref={containerRef} className="grid grid-cols-2 gap-2">
        {[0, 1, 2].map((pIdx) =>
          [0, 1].map((fIdx) => {
            const isSelected = selected?.pIdx === pIdx && selected.fIdx === fIdx
            return (
              <button
                key={`${pIdx}-${fIdx}`}
                onClick={() => setSelected({ pIdx, fIdx })}
                className={cn(
                  'relative rounded-xl overflow-hidden border-2 transition-all focus:outline-none',
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-md'
                    : 'border-gray-200 hover:border-gray-400',
                )}
                title={`팔레트 ${pIdx + 1} · ${FONT_STYLE_LABELS[fIdx]}`}
              >
                <canvas
                  width={TW}
                  height={TH}
                  data-p={pIdx}
                  data-f={fIdx}
                  ref={(el) => {
                    if (el) {
                      const ctx = el.getContext('2d')
                      if (ctx) drawCover(ctx, TW, TH, activeGenre, pIdx, fIdx, title || '제목', authorName)
                    }
                  }}
                  className="w-full h-auto block"
                />
                {/* 팔레트 번호 뱃지 */}
                <span className="absolute top-1 left-1 text-[9px] font-bold bg-black/30 text-white rounded px-1 leading-relaxed">
                  P{pIdx + 1}
                </span>
                {/* 선택 체크 */}
                {isSelected && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* 사용 버튼 */}
      <button
        onClick={handleUse}
        disabled={!selected}
        className={cn(
          'w-full py-2.5 rounded-xl text-sm font-semibold transition-colors',
          selected
            ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed',
        )}
      >
        {selected ? '이 커버 사용하기' : '템플릿을 선택하세요'}
      </button>
    </div>
  )
}
