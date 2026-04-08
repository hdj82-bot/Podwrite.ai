/**
 * POD 플랫폼별 판형·여백·폰트 규격 상수
 *
 * 부크크: 148×210mm, 여백 상하20 좌우25, 나눔고딕 11pt
 * 교보:   152×225mm, 여백 상하20 좌우25, 나눔고딕 10.5pt
 * KDP:    A5(148×210mm), 여백 인치 기준 (0.75"/0.5")
 */

import type { Platform, PlatformSpec } from '@/types'

// 1mm = 56.6929 twip (docx 라이브러리 단위)
// 1inch = 1440 twip
export const MM_TO_TWIP = 56.6929
export const INCH_TO_TWIP = 1440

export const PLATFORM_SPECS: Record<Platform, PlatformSpec> = {
  bookk: {
    name: '부크크',
    pageWidthMM: 148,
    pageHeightMM: 210,
    marginTopMM: 20,
    marginBottomMM: 20,
    marginLeftMM: 25,
    marginRightMM: 25,
    fontFamily: 'NanumGothic',
    fontSizePt: 11,
    lineHeightPt: 18,
    minWords: 5_000,
    maxWords: 200_000,
  },
  kyobo: {
    name: '교보문고 POD',
    pageWidthMM: 152,
    pageHeightMM: 225,
    marginTopMM: 20,
    marginBottomMM: 20,
    marginLeftMM: 25,
    marginRightMM: 25,
    fontFamily: 'NanumGothic',
    fontSizePt: 10.5,
    lineHeightPt: 17,
    minWords: 5_000,
    maxWords: 200_000,
  },
  kdp: {
    name: 'Amazon KDP',
    // A5 (5×8in ≈ 127×203mm, KDP 기본 6×9in)
    // 사용자 요구사항: A5 148×210mm
    pageWidthMM: 148,
    pageHeightMM: 210,
    // KDP 공식 여백: 상하 0.75" = 19.05mm, 좌우 0.5" = 12.7mm
    marginTopMM: 19.05,
    marginBottomMM: 19.05,
    marginLeftMM: 12.7,
    marginRightMM: 12.7,
    fontFamily: 'NanumGothic',
    fontSizePt: 11,
    lineHeightPt: 18,
    minWords: 10_000,
    maxWords: 300_000,
  },
}

/** mm → twip 변환 */
export function mmToTwip(mm: number): number {
  return Math.round(mm * MM_TO_TWIP)
}

/** inch → twip 변환 */
export function inchToTwip(inch: number): number {
  return Math.round(inch * INCH_TO_TWIP)
}

/** pt → half-point (docx lineSpacing 단위) */
export function ptToHalfPt(pt: number): number {
  return Math.round(pt * 2)
}

/** 플랫폼 스펙 반환 (없으면 부크크 기본값) */
export function getPlatformSpec(platform: Platform): PlatformSpec {
  return PLATFORM_SPECS[platform] ?? PLATFORM_SPECS.bookk
}

/** KDP 용지 규격 옵션 */
export const KDP_TRIM_SIZES = [
  { label: '5×8인치 (소설 표준)', widthMM: 127, heightMM: 203 },
  { label: '5.5×8.5인치', widthMM: 139.7, heightMM: 215.9 },
  { label: '6×9인치 (논픽션 표준)', widthMM: 152.4, heightMM: 228.6 },
  { label: 'A5 (148×210mm)', widthMM: 148, heightMM: 210 },
] as const

/** 월정기결제 금액 */
export const PLAN_PRICES: Record<'basic' | 'pro', { monthly: number; annual: number }> = {
  basic: { monthly: 9_900, annual: 99_000 },
  pro:   { monthly: 19_900, annual: 199_000 },
}
