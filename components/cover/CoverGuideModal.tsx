'use client'

/**
 * CoverGuideModal — 플랫폼별 표지 규격 가이드 + 캔바 딥링크 + 이미지 업로드
 *
 * 표지 규격 (작업 지시서 기준):
 *   부크크   : 148 × 210 mm
 *   교보문고 : 152 × 225 mm
 *   KDP      : 6 × 9 인치 (152.4 × 228.6 mm)
 *
 * 픽셀 환산: 300 dpi (1 mm = 300/25.4 ≈ 11.811 px)
 *
 * 업로드 API: POST /api/projects/[id]/cover
 */

import { useState, useRef } from 'react'
import { X, Upload, Check, Loader2, AlertCircle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Platform } from '@/types'

// ── 상수 ─────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * 플랫폼별 최소 권장 픽셀 해상도 (300 dpi 기준)
 *   부크크   : 148×210mm  → 1748×2480px
 *   교보문고 : 152×225mm  → 1795×2657px
 *   KDP      : 1800×2700px (Amazon 공식 권장)
 */
const REQUIRED_PX: Record<Platform, { w: number; h: number }> = {
  bookk: { w: 1748, h: 2480 },
  kyobo: { w: 1795, h: 2657 },
  kdp:   { w: 1800, h: 2700 },
}

/** 척추(Spine) 두께 계산: 페이지 수 × 0.0572mm (80gsm 일반지 기준) */
const SPINE_MM_PER_PAGE = 0.0572

// Canva "새 디자인" — books 카테고리로 바로 연결
const CANVA_URL = 'https://www.canva.com/design/new?category=books'

interface CoverSpec {
  label: string
  widthMM: number
  heightMM: number
  note?: string
}

const COVER_SPECS: Record<Platform, CoverSpec> = {
  bookk: { label: '부크크',      widthMM: 148,   heightMM: 210   },
  kyobo: { label: '교보문고',    widthMM: 152,   heightMM: 225   },
  kdp:   { label: 'Amazon KDP', widthMM: 152.4, heightMM: 228.6, note: '6×9인치 기준' },
}

// ── 유틸 ─────────────────────────────────────────────────────────────

/** mm → px 변환 (300 dpi) */
function mmToPx(mm: number): number {
  return Math.round((mm / 25.4) * 300)
}

// ── Props ─────────────────────────────────────────────────────────────

export interface CoverGuideModalProps {
  projectId: string
  platform: Platform
  /** 이미 저장된 표지 URL (있으면 미리보기에 표시) */
  currentCoverUrl?: string | null
  onClose: () => void
  /** 업로드 성공 시 새 공개 URL 전달 */
  onUploaded?: (url: string) => void
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────

export default function CoverGuideModal({
  projectId,
  platform,
  currentCoverUrl,
  onClose,
  onUploaded,
}: CoverGuideModalProps) {
  const spec     = COVER_SPECS[platform] ?? COVER_SPECS.bookk
  const widthPx  = mmToPx(spec.widthMM)
  const heightPx = mmToPx(spec.heightMM)
  const copyText = `${spec.widthMM} × ${spec.heightMM} mm / ${widthPx.toLocaleString()} × ${heightPx.toLocaleString()} px (300dpi)`

  const [copied, setCopied]           = useState(false)
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [uploadMsg, setUploadMsg]     = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 해상도 적합성 체크
  const [resCheck, setResCheck] = useState<'ok' | 'warn' | null>(null)
  const [resDetail, setResDetail] = useState('')

  // 척추 두께 계산기
  const [pageCount, setPageCount] = useState('')
  const [spineOpen, setSpineOpen] = useState(false)

  // ── 유틸 ────────────────────────────────────────────────────────────

  function checkResolution(file: File) {
    const objUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objUrl)
      const req = REQUIRED_PX[platform]
      const { naturalWidth: w, naturalHeight: h } = img
      if (w >= req.w && h >= req.h) {
        setResCheck('ok')
        setResDetail(`${w.toLocaleString('ko-KR')}×${h.toLocaleString('ko-KR')}px — 규격 적합`)
      } else {
        setResCheck('warn')
        setResDetail(
          `${w.toLocaleString('ko-KR')}×${h.toLocaleString('ko-KR')}px — 권장 ${req.w.toLocaleString('ko-KR')}×${req.h.toLocaleString('ko-KR')}px 미달`,
        )
      }
    }
    img.src = objUrl
  }

  // ── 핸들러 ──────────────────────────────────────────────────────────

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API 미지원 환경 무시
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setUploadStatus('error')
      setUploadMsg('JPEG 또는 PNG 파일만 업로드할 수 있습니다.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadStatus('error')
      setUploadMsg('파일 크기는 10MB 이하여야 합니다.')
      return
    }

    // 즉시 로컬 미리보기
    setPreviewUrl(URL.createObjectURL(file))
    setUploadStatus('idle')
    setUploadMsg('')
    setResCheck(null)
    checkResolution(file)
    void doUpload(file)
  }

  async function doUpload(file: File) {
    setUploadStatus('loading')
    setUploadMsg('')

    try {
      const form = new FormData()
      form.append('file', file)

      const res  = await fetch(`/api/projects/${projectId}/cover`, { method: 'POST', body: form })
      const json = await res.json()

      if (!res.ok) {
        setUploadStatus('error')
        setUploadMsg(json.error ?? '업로드 중 오류가 발생했습니다.')
        return
      }

      setUploadStatus('success')
      setUploadMsg('표지 이미지가 저장되었습니다.')
      onUploaded?.(json.data.cover_image_url)
    } catch {
      setUploadStatus('error')
      setUploadMsg('네트워크 오류가 발생했습니다.')
    }
  }

  const displayUrl = previewUrl ?? currentCoverUrl ?? null

  // ── 렌더 ────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* ── 헤더 ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">표지 규격 가이드</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── 스크롤 영역 ──────────────────────────────────────────── */}
        <div className="overflow-y-auto px-5 py-4 space-y-5">

          {/* ── 캔바 규격 카드 ────────────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">

            {/* 헤더 */}
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-[#8B3DFF]/10 flex items-center justify-center shrink-0">
                <span className="text-[#8B3DFF] font-bold text-sm">C</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Canva 표지 제작</p>
                <p className="text-xs text-gray-500">{spec.label} 권장 규격 · 300 dpi</p>
              </div>
            </div>

            {/* 규격 표 */}
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 w-2/5">단위</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-500">가로</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-500">세로</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-50">
                    <td className="px-3 py-2.5 text-gray-600 font-medium">
                      mm
                      {spec.note && (
                        <span className="ml-1 text-gray-400 font-normal">({spec.note})</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{spec.widthMM} mm</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{spec.heightMM} mm</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5 text-gray-600 font-medium">
                      px <span className="text-gray-400 font-normal">(300 dpi)</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-indigo-600">
                      {widthPx.toLocaleString('ko-KR')} px
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-indigo-600">
                      {heightPx.toLocaleString('ko-KR')} px
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 규격 복사 */}
            <button
              onClick={handleCopy}
              className={cn(
                'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
                copied
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300',
              )}
            >
              {copied ? (
                <><Check className="w-3.5 h-3.5" />규격 복사됨</>
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

            {/* Canva 이동 */}
            <a
              href={CANVA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#8B3DFF] text-white text-sm font-semibold rounded-xl hover:bg-[#7B2FEF] transition-colors"
            >
              <span className="font-bold text-sm leading-none">C</span>
              Canva에서 표지 만들기
              <ExternalLink className="w-3.5 h-3.5 opacity-75" />
            </a>

            {/* 단계별 안내 */}
            <ol className="text-xs text-gray-400 space-y-1 leading-relaxed list-decimal list-inside">
              <li>위 규격 복사 후 Canva에서 <strong className="text-gray-500">커스텀 크기</strong> 선택</li>
              <li>디자인 완료 후 <strong className="text-gray-500">PDF 인쇄 (300 dpi)</strong> 또는 PNG로 내보내기</li>
              <li>아래에서 완성된 이미지 업로드</li>
            </ol>
          </div>

          {/* ── 이미지 업로드 ───────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">표지 이미지 업로드</p>
            <p className="text-xs text-gray-400">JPEG / PNG · 최대 10 MB</p>

            {/* 미리보기 */}
            {displayUrl && (
              <div className="relative w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-50"
                style={{ aspectRatio: `${spec.widthMM} / ${spec.heightMM}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displayUrl}
                  alt="표지 미리보기"
                  className="w-full h-full object-contain"
                />
                {uploadStatus === 'loading' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                  </div>
                )}
              </div>
            )}

            {/* 업로드 버튼 */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadStatus === 'loading'}
              className={cn(
                'w-full flex flex-col items-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed transition-colors',
                uploadStatus === 'loading'
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 cursor-pointer',
              )}
            >
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">
                {displayUrl ? '다른 이미지로 교체' : '이미지 파일 선택'}
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* 업로드 결과 */}
            {uploadStatus !== 'idle' && (
              <div className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs',
                uploadStatus === 'success' && 'bg-green-50 text-green-700',
                uploadStatus === 'error'   && 'bg-red-50 text-red-600',
                uploadStatus === 'loading' && 'bg-gray-50 text-gray-500',
              )}>
                {uploadStatus === 'success' && <Check className="w-3.5 h-3.5 shrink-0" />}
                {uploadStatus === 'error'   && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                {uploadStatus === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
                <span>{uploadStatus === 'loading' ? '업로드 중...' : uploadMsg}</span>
              </div>
            )}

            {/* ── 해상도 적합성 뱃지 ────────────────────────────────── */}
            {resCheck === 'ok' && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700">
                <Check className="w-3.5 h-3.5 shrink-0 text-green-600" />
                <div>
                  <span className="font-semibold">규격 적합</span>
                  <span className="ml-1.5 text-green-600">{resDetail}</span>
                </div>
              </div>
            )}
            {resCheck === 'warn' && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px text-amber-600" />
                <div>
                  <span className="font-semibold">해상도 부족 (업로드는 가능)</span>
                  <p className="mt-0.5 text-amber-700">{resDetail}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── 척추(Spine) 두께 계산기 ─────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setSpineOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <div>
                <p className="text-sm font-semibold text-gray-800">척추(Spine) 두께 계산기</p>
                <p className="text-xs text-gray-400 mt-0.5">페이지 수 → 척추 두께 자동 계산</p>
              </div>
              {spineOpen
                ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
              }
            </button>

            {spineOpen && (
              <div className="px-4 py-4 space-y-4 bg-white">
                {/* 입력 */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-gray-700 shrink-0">페이지 수</label>
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    value={pageCount}
                    onChange={(e) => setPageCount(e.target.value)}
                    placeholder="예: 250"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <span className="text-xs text-gray-400 shrink-0">쪽</span>
                </div>

                {/* 결과 */}
                {pageCount && parseInt(pageCount) > 0 && (() => {
                  const pages = parseInt(pageCount)
                  const spineMM = pages * SPINE_MM_PER_PAGE
                  const spinePx = Math.round((spineMM / 25.4) * 300)
                  return (
                    <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-indigo-500 font-medium">척추 두께</span>
                        <span className="text-lg font-bold text-indigo-700">
                          {spineMM.toFixed(2)} <span className="text-sm font-normal">mm</span>
                        </span>
                      </div>
                      <p className="text-xs text-indigo-500">
                        {spinePx.toLocaleString('ko-KR')}px (300dpi) · 80gsm 일반지 기준
                      </p>
                      {/* 플랫폼별 척추 가이드 */}
                      <div className="pt-2 border-t border-indigo-100 space-y-1.5 text-xs text-gray-600">
                        <div className="flex justify-between">
                          <span className="font-medium">부크크</span>
                          <span className={cn(spineMM < 5 ? 'text-amber-600' : 'text-green-600')}>
                            {spineMM < 5 ? '척추 표시 불가 (5mm 미만)' : '척추 텍스트 표시 가능'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">교보문고</span>
                          <span className={cn(spineMM < 8 ? 'text-amber-600' : 'text-green-600')}>
                            {spineMM < 8 ? '척추 영역 협소 (8mm 미만)' : '척추 레이아웃 권장'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">Amazon KDP</span>
                          <span className={cn(spineMM < 6.4 ? 'text-amber-600' : 'text-green-600')}>
                            {spineMM < 6.4 ? '척추 텍스트 금지 (6.4mm 미만)' : '척추 텍스트 허용'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 pt-1">
                        * 실제 두께는 인쇄소 용지 규격(gsm·종류)에 따라 차이가 있을 수 있습니다.
                      </p>
                    </div>
                  )
                })()}

                {/* 공식 설명 */}
                <p className="text-[11px] text-gray-400">
                  계산식: 페이지 수 × 0.0572mm (백색 80gsm 모조지 기준)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── 푸터 ─────────────────────────────────────────────────── */}
        <div className="flex justify-end px-5 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            {uploadStatus === 'success' ? '완료' : '닫기'}
          </button>
        </div>
      </div>
    </div>
  )
}
