'use client'

/**
 * CoverTextEditor — 업로드 이미지 위에 텍스트 오버레이 드래그 편집
 *
 * - 제목 / 부제목 / 저자명 레이어 — 드래그로 위치 이동
 * - 폰트 크기·색상 조절
 * - Canvas API로 최종 이미지를 PNG로 내보내기
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Download, Eye, EyeOff, Move } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Platform } from '@/types'

// ── 레이어 타입 ───────────────────────────────────────────────────────────────

type LayerId = 'title' | 'subtitle' | 'author'

interface TextLayer {
  id: LayerId
  label: string
  text: string
  /** 0~1 — 캔버스 너비/높이 대비 상대 위치 (anchor: 텍스트 시작점) */
  x: number
  y: number
  fontSize: number   // 참조 높이(EXPORT_H) 기준 px
  color: string
  fontWeight: '300' | '400' | '700'
  visible: boolean
}

const FONT_WEIGHT_OPTIONS: { value: TextLayer['fontWeight']; label: string }[] = [
  { value: '300', label: '얇게' },
  { value: '400', label: '보통' },
  { value: '700', label: '굵게' },
]

// 내보내기 해상도
const EXPORT_W = 1200
const EXPORT_H = 1800

// ── 유틸 ─────────────────────────────────────────────────────────────────────

function scaleFont(fontSize: number, canvasH: number): number {
  return Math.round((fontSize / EXPORT_H) * canvasH)
}

function fontStr(layer: TextLayer, canvasH: number): string {
  const size = scaleFont(layer.fontSize, canvasH)
  return `${layer.fontWeight} ${size}px "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`
}

/** 텍스트 레이어 히트 테스트 (클릭 위치가 해당 레이어 위인지) */
function hitTest(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  clickX: number,
  clickY: number,
  cW: number,
  cH: number,
): boolean {
  if (!layer.visible) return false
  ctx.font = fontStr(layer, cH)
  const textW = ctx.measureText(layer.text).width
  const textH = scaleFont(layer.fontSize, cH)
  const lx = layer.x * cW
  const ly = layer.y * cH
  const pad = 8
  return (
    clickX >= lx - pad &&
    clickX <= lx + textW + pad &&
    clickY >= ly - textH - pad &&
    clickY <= ly + pad
  )
}

/** 이벤트 좌표를 캔버스 좌표로 변환 */
function toCanvasXY(
  canvas: HTMLCanvasElement,
  e: MouseEvent | React.MouseEvent,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CoverTextEditorProps {
  imageUrl: string
  platform: Platform
  title?: string
  authorName?: string
  onExport: (dataUrl: string) => void
  onClose: () => void
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default function CoverTextEditor({
  imageUrl,
  platform,
  title = '',
  authorName = '',
  onExport,
  onClose,
}: CoverTextEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const isDragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const [layers, setLayers] = useState<TextLayer[]>([
    {
      id: 'title',
      label: '제목',
      text: title || '제목을 입력하세요',
      x: 0.1,
      y: 0.42,
      fontSize: 96,
      color: '#ffffff',
      fontWeight: '700',
      visible: true,
    },
    {
      id: 'subtitle',
      label: '부제목',
      text: '부제목 (선택)',
      x: 0.1,
      y: 0.52,
      fontSize: 56,
      color: '#eeeeee',
      fontWeight: '300',
      visible: false,
    },
    {
      id: 'author',
      label: '저자명',
      text: authorName || '저자명',
      x: 0.1,
      y: 0.88,
      fontSize: 60,
      color: '#ffffff',
      fontWeight: '400',
      visible: true,
    },
  ])

  const [selectedId, setSelectedId] = useState<LayerId | null>('title')
  const selectedLayer = layers.find((l) => l.id === selectedId) ?? null

  // ── 렌더 ────────────────────────────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)

    // 배경 이미지
    if (bgImageRef.current) {
      ctx.drawImage(bgImageRef.current, 0, 0, W, H)
    } else {
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, W, H)
    }

    // 텍스트 레이어 렌더
    layers.forEach((layer) => {
      if (!layer.visible) return
      ctx.font = fontStr(layer, H)
      ctx.textBaseline = 'alphabetic'
      ctx.textAlign = 'left'
      const lx = layer.x * W
      const ly = layer.y * H
      const textH = scaleFont(layer.fontSize, H)
      const textW = ctx.measureText(layer.text).width

      // 드롭 섀도
      ctx.shadowColor = 'rgba(0,0,0,0.6)'
      ctx.shadowBlur = Math.round(textH * 0.15)
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = Math.round(textH * 0.04)

      ctx.fillStyle = layer.color
      ctx.fillText(layer.text, lx, ly)

      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0

      // 선택 표시 (편집 모드)
      if (layer.id === selectedId) {
        ctx.strokeStyle = 'rgba(99,102,241,0.9)'
        ctx.lineWidth = Math.max(1, H * 0.002)
        ctx.setLineDash([Math.round(H * 0.006), Math.round(H * 0.004)])
        const pad = Math.round(H * 0.008)
        ctx.strokeRect(lx - pad, ly - textH - pad, textW + pad * 2, textH + pad * 2)
        ctx.setLineDash([])
      }
    })
  }, [layers, selectedId])

  // 배경 이미지 로드
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      bgImageRef.current = img
      render()
    }
    img.src = imageUrl
  }, [imageUrl, render])

  // 레이어 변경 시 리렌더
  useEffect(() => {
    render()
  }, [render])

  // ── 마우스 이벤트 ────────────────────────────────────────────────────────────

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = toCanvasXY(canvas, e)

    // 역순 순회 (위 레이어 우선)
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]
      if (hitTest(ctx, layer, x, y, canvas.width, canvas.height)) {
        setSelectedId(layer.id)
        isDragging.current = true
        dragOffset.current = {
          x: x - layer.x * canvas.width,
          y: y - layer.y * canvas.height,
        }
        return
      }
    }
    // 빈 영역 클릭 시 선택 해제
    setSelectedId(null)
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDragging.current || !selectedId) return
    const canvas = canvasRef.current
    if (!canvas) return
    const { x, y } = toCanvasXY(canvas, e)
    setLayers((prev) =>
      prev.map((l) =>
        l.id === selectedId
          ? {
              ...l,
              x: Math.max(0, Math.min(0.95, (x - dragOffset.current.x) / canvas.width)),
              y: Math.max(0.05, Math.min(0.98, (y - dragOffset.current.y) / canvas.height)),
            }
          : l,
      ),
    )
  }

  function handleMouseUp() {
    isDragging.current = false
  }

  // ── 레이어 속성 업데이트 ─────────────────────────────────────────────────────

  function updateLayer(id: LayerId, patch: Partial<TextLayer>) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  // ── 내보내기 ─────────────────────────────────────────────────────────────────

  function handleExport() {
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = EXPORT_W
    exportCanvas.height = EXPORT_H
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return

    // 배경
    if (bgImageRef.current) {
      ctx.drawImage(bgImageRef.current, 0, 0, EXPORT_W, EXPORT_H)
    } else {
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, EXPORT_W, EXPORT_H)
    }

    // 텍스트 레이어 (선택 표시 없이)
    layers.forEach((layer) => {
      if (!layer.visible) return
      ctx.font = fontStr(layer, EXPORT_H)
      ctx.textBaseline = 'alphabetic'
      ctx.textAlign = 'left'
      const lx = layer.x * EXPORT_W
      const ly = layer.y * EXPORT_H
      const textH = scaleFont(layer.fontSize, EXPORT_H)
      ctx.shadowColor = 'rgba(0,0,0,0.55)'
      ctx.shadowBlur = textH * 0.15
      ctx.shadowOffsetY = textH * 0.04
      ctx.fillStyle = layer.color
      ctx.fillText(layer.text, lx, ly)
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
    })

    onExport(exportCanvas.toDataURL('image/png'))
  }

  // ── 렌더 ─────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">텍스트 오버레이 편집</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex flex-1 overflow-hidden">

          {/* 캔버스 */}
          <div className="flex-1 flex items-center justify-center bg-gray-900 p-4 overflow-auto">
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={400}
                height={600}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="block rounded-lg shadow-xl cursor-crosshair"
                style={{ maxHeight: 'calc(95vh - 160px)', width: 'auto' }}
              />
              <p className="text-center text-xs text-gray-500 mt-2">
                <Move className="w-3 h-3 inline mr-1" />
                텍스트를 클릭 후 드래그하여 위치를 이동하세요
              </p>
            </div>
          </div>

          {/* 컨트롤 패널 */}
          <div className="w-64 shrink-0 border-l border-gray-200 overflow-y-auto">
            {/* 레이어 선택 */}
            <div className="p-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">레이어</p>
              <div className="space-y-1">
                {layers.map((layer) => (
                  <div key={layer.id} className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedId(layer.id)}
                      className={cn(
                        'flex-1 text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                        selectedId === layer.id
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'text-gray-600 hover:bg-gray-50 border border-transparent',
                      )}
                    >
                      {layer.label}
                    </button>
                    <button
                      onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      title={layer.visible ? '숨기기' : '보이기'}
                    >
                      {layer.visible
                        ? <Eye className="w-3.5 h-3.5" />
                        : <EyeOff className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 선택된 레이어 편집 */}
            {selectedLayer && (
              <div className="p-4 space-y-4">
                <p className="text-xs font-semibold text-gray-500">
                  {selectedLayer.label} 편집
                </p>

                {/* 텍스트 */}
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">텍스트</label>
                  <textarea
                    value={selectedLayer.text}
                    onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                    rows={2}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>

                {/* 폰트 크기 */}
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">
                    폰트 크기 — {selectedLayer.fontSize}px
                  </label>
                  <input
                    type="range"
                    min={24}
                    max={200}
                    value={selectedLayer.fontSize}
                    onChange={(e) =>
                      updateLayer(selectedLayer.id, { fontSize: parseInt(e.target.value) })
                    }
                    className="w-full accent-indigo-600"
                  />
                </div>

                {/* 폰트 굵기 */}
                <div>
                  <label className="text-[11px] text-gray-500 mb-1.5 block">굵기</label>
                  <div className="flex gap-1">
                    {FONT_WEIGHT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateLayer(selectedLayer.id, { fontWeight: opt.value })}
                        className={cn(
                          'flex-1 py-1.5 rounded-lg text-xs transition-colors border',
                          selectedLayer.fontWeight === opt.value
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 색상 */}
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">색상</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedLayer.color}
                      onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                      className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
                    />
                    <span className="text-xs text-gray-500 font-mono">{selectedLayer.color}</span>
                  </div>
                  {/* 빠른 색상 선택 */}
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {['#ffffff', '#000000', '#f8f0ff', '#1a1a2e', '#ffd93d', '#ff6b6b', '#4895ef', '#95d5b2'].map((c) => (
                      <button
                        key={c}
                        onClick={() => updateLayer(selectedLayer.id, { color: c })}
                        style={{ background: c }}
                        className={cn(
                          'w-5 h-5 rounded-full border transition-transform hover:scale-110',
                          selectedLayer.color === c ? 'border-indigo-500 scale-110' : 'border-gray-300',
                        )}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 shrink-0">
          <p className="text-xs text-gray-400">
            {EXPORT_W.toLocaleString('ko-KR')}×{EXPORT_H.toLocaleString('ko-KR')}px PNG로 내보내기
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              PNG 내보내기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
