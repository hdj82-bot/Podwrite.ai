'use client'

/**
 * CanvaDeepLink — Canva 표지 제작 딥링크 컴포넌트
 *
 * Canva API 승인 전 대응:
 *   → "새 디자인 만들기 (books 카테고리)" 링크로 직접 연결
 *   → 플랫폼별 권장 사이즈(mm + px@300dpi) 표 제공
 *   → 사이즈 텍스트 클립보드 복사 버튼
 *
 * 표지 규격 (작업 지시서 기준):
 *   부크크   : 130 × 188 mm
 *   교보문고 : 148 × 210 mm
 *   KDP      : 6 × 9 inch (152.4 × 228.6 mm)
 *
 * 픽셀 환산 기준: 300 dpi (1 mm = 300/25.4 ≈ 11.811 px)
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Platform } from '@/types'

interface CanvaDeepLinkProps {
  platform: Platform
}

// ── mm → px (300dpi) ────────────────────────────────────────────────
function mmToPx(mm: number): number {
  return Math.round((mm / 25.4) * 300)
}

// ── 플랫폼별 표지 규격 ──────────────────────────────────────────────
interface CoverSpec {
  platformLabel: string
  widthMM: number
  heightMM: number
  note?: string
}

const COVER_SPECS: Record<Platform, CoverSpec> = {
  bookk: {
    platformLabel: '부크크',
    widthMM: 130,
    heightMM: 188,
  },
  kyobo: {
    platformLabel: '교보문고',
    widthMM: 148,
    heightMM: 210,
  },
  kdp: {
    platformLabel: 'Amazon KDP',
    widthMM: 152.4,
    heightMM: 228.6,
    note: '6 × 9 인치 기준',
  },
}

// Canva 새 디자인 페이지 — books 카테고리
const CANVA_DESIGN_URL = 'https://www.canva.com/design/new?category=books'

export default function CanvaDeepLink({ platform }: CanvaDeepLinkProps) {
  const [copied, setCopied] = useState(false)

  const spec = COVER_SPECS[platform] ?? COVER_SPECS.bookk
  const widthPx  = mmToPx(spec.widthMM)
  const heightPx = mmToPx(spec.heightMM)

  // 복사할 사이즈 텍스트
  const copyText = `${spec.widthMM} × ${spec.heightMM} mm / ${widthPx} × ${heightPx} px (300dpi)`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard 접근 불가 무시
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4">

      {/* ── 헤더 ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Canva 브랜드 아이콘 */}
        <div className="h-9 w-9 rounded-xl bg-[#8B3DFF]/10 flex items-center justify-center shrink-0">
          <span className="text-[#8B3DFF] font-bold text-base leading-none">C</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Canva 표지 제작</p>
          <p className="text-xs text-gray-500">
            {spec.platformLabel} 권장 규격 · 300dpi 기준
          </p>
        </div>
      </div>

      {/* ── 사이즈 표 ────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80">
              <th className="px-3.5 py-2.5 text-left font-semibold text-gray-500 w-2/5">단위</th>
              <th className="px-3.5 py-2.5 text-right font-semibold text-gray-500">가로</th>
              <th className="px-3.5 py-2.5 text-right font-semibold text-gray-500">세로</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-50">
              <td className="px-3.5 py-2.5 text-gray-600 font-medium">
                mm
                {spec.note && (
                  <span className="ml-1 text-gray-400 font-normal">({spec.note})</span>
                )}
              </td>
              <td className="px-3.5 py-2.5 text-right font-semibold text-gray-900">
                {spec.widthMM} mm
              </td>
              <td className="px-3.5 py-2.5 text-right font-semibold text-gray-900">
                {spec.heightMM} mm
              </td>
            </tr>
            <tr>
              <td className="px-3.5 py-2.5 text-gray-600 font-medium">
                px
                <span className="ml-1 text-gray-400 font-normal">(300 dpi)</span>
              </td>
              <td className="px-3.5 py-2.5 text-right font-semibold text-indigo-600">
                {widthPx.toLocaleString('ko-KR')} px
              </td>
              <td className="px-3.5 py-2.5 text-right font-semibold text-indigo-600">
                {heightPx.toLocaleString('ko-KR')} px
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── 규격 복사 버튼 ───────────────────────────────────────── */}
      <button
        onClick={handleCopy}
        className={cn(
          'w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors',
          copied
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300',
        )}
      >
        {copied ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            규격 복사됨
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
            </svg>
            Canva에 붙여넣을 규격 복사
          </>
        )}
      </button>

      {/* ── Canva 이동 버튼 ─────────────────────────────────────── */}
      <a
        href={CANVA_DESIGN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#8B3DFF] text-white text-sm font-semibold rounded-xl hover:bg-[#7B2FEF] transition-colors"
      >
        <span className="font-bold text-base leading-none">C</span>
        Canva에서 표지 만들기
        <svg className="w-3.5 h-3.5 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
      </a>

      {/* ── 사용 가이드 ─────────────────────────────────────────── */}
      <ol className="text-xs text-gray-400 space-y-1 leading-relaxed list-decimal list-inside">
        <li>위 규격 텍스트를 복사합니다</li>
        <li>Canva에서 <strong className="text-gray-500">커스텀 크기</strong> 선택 후 px 값을 입력합니다</li>
        <li>디자인 완료 후 <strong className="text-gray-500">PDF 인쇄 (300dpi)</strong> 또는 PNG로 내보냅니다</li>
      </ol>
    </div>
  )
}
