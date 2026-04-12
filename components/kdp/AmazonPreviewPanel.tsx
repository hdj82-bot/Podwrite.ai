'use client'

/**
 * AmazonPreviewPanel — KDP 메타데이터 Amazon 상품 페이지 목업 미리보기
 *
 * 실제 Amazon 화면과 유사한 레이아웃으로 입력된 메타데이터를 시각화.
 * 미리보기 전용 (수정 불가).
 */

import type { BisacCategory } from './BisacSelector'
import type { KdpMaturityRating } from '@/types'

interface PreviewMetadata {
  title: string
  subtitle: string
  author: string
  description: string
  keywords: string[]
  bisacCategories: BisacCategory[]
  price_usd: string
  publisher: string
  publication_date: string
  language: string
  estimated_pages: number
  maturity_rating: KdpMaturityRating
  series_name: string
  series_number: string
}

const MATURITY_LABEL: Record<KdpMaturityRating, string> = {
  general: '전체 이용가',
  teen: '청소년 (13+)',
  mature: '성인 (18+)',
}

const LANGUAGE_LABEL: Record<string, string> = {
  en: 'English',
  ko: 'Korean (한국어)',
}

function StarRating() {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4].map((i) => (
        <svg key={i} className="h-4 w-4 text-[#FFA41C]" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <svg className="h-4 w-4" viewBox="0 0 20 20">
        <defs>
          <linearGradient id="half">
            <stop offset="50%" stopColor="#FFA41C" />
            <stop offset="50%" stopColor="#D1D5DB" />
          </linearGradient>
        </defs>
        <path fill="url(#half)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span className="text-xs text-[#007185] ml-0.5">4.5 (미리보기)</span>
    </div>
  )
}

export default function AmazonPreviewPanel({ meta }: { meta: PreviewMetadata }) {
  const displayTitle = meta.title || '제목을 입력하세요'
  const displayAuthor = meta.author || '저자명을 입력하세요'
  const displayPrice = meta.price_usd ? `$${parseFloat(meta.price_usd).toFixed(2)}` : '$2.99'
  const royalty70 = meta.price_usd ? (parseFloat(meta.price_usd) * 0.7).toFixed(2) : '2.09'

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden text-sm font-sans">
      {/* Amazon 헤더 */}
      <div className="bg-[#131921] px-4 py-2 flex items-center gap-2">
        <span className="text-[#FF9900] font-bold text-base tracking-tight">amazon</span>
        <span className="text-xs text-gray-300 ml-1">KDP 미리보기 (실제 화면과 다를 수 있음)</span>
      </div>

      {/* 상품 영역 */}
      <div className="p-5 grid grid-cols-1 gap-5 md:grid-cols-[160px_1fr]">
        {/* 커버 플레이스홀더 */}
        <div className="mx-auto md:mx-0 flex-shrink-0">
          <div className="w-32 h-44 md:w-40 md:h-52 rounded border border-gray-200 bg-gradient-to-br from-orange-100 to-orange-200 flex flex-col items-center justify-center p-3 text-center shadow-md">
            <p className="text-xs font-bold text-orange-800 leading-tight line-clamp-3">{displayTitle}</p>
            {meta.subtitle && (
              <p className="text-[10px] text-orange-700 mt-1 leading-tight line-clamp-2">{meta.subtitle}</p>
            )}
            <p className="text-[10px] text-orange-600 mt-2">{displayAuthor}</p>
          </div>
          <p className="text-[10px] text-center text-gray-400 mt-1">표지 이미지 없음</p>
        </div>

        {/* 상품 정보 */}
        <div className="space-y-2.5">
          {/* 카테고리 Breadcrumb */}
          {meta.bisacCategories.length > 0 && (
            <p className="text-xs text-[#007185]">
              {meta.bisacCategories.map((c, i) => (
                <span key={c.code}>
                  {i > 0 && <span className="mx-1 text-gray-400">›</span>}
                  <span className="hover:underline cursor-default">{c.label}</span>
                </span>
              ))}
            </p>
          )}

          {/* 제목 */}
          <div>
            <h1 className="text-lg font-medium text-[#0F1111] leading-snug">
              {displayTitle}
              {meta.subtitle && (
                <span className="text-base text-gray-600"> — {meta.subtitle}</span>
              )}
            </h1>
            {meta.series_name && (
              <p className="text-xs text-[#007185] mt-0.5">
                {meta.series_name}
                {meta.series_number && ` 제${meta.series_number}권`} 시리즈
              </p>
            )}
          </div>

          {/* 저자 */}
          <p className="text-sm">
            <span className="text-gray-500">지은이: </span>
            <span className="text-[#007185] hover:text-[#C7511F] cursor-default font-medium">{displayAuthor}</span>
          </p>

          {/* 별점 */}
          <StarRating />

          {/* Kindle 가격 */}
          <div className="border-t border-b border-gray-100 py-3 space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-gray-500">Kindle 가격</span>
              <span className="text-2xl font-medium text-[#0F1111]">{displayPrice}</span>
            </div>
            <p className="text-xs text-gray-500">
              예상 로열티 (70%): <span className="text-green-700 font-medium">${royalty70}</span>
              {' '}· KDP Select 등록 시 Kindle Unlimited 포함 가능
            </p>
            <div className="mt-2">
              <button
                disabled
                className="rounded bg-[#FFD814] border border-[#FCD200] text-[#0F1111] text-sm font-medium px-5 py-1.5 opacity-60 cursor-default"
              >
                지금 구매 (미리보기)
              </button>
            </div>
          </div>

          {/* 상품 상세 */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
            <div>
              <span className="text-gray-400">언어</span>
              <span className="ml-1 text-[#0F1111]">{LANGUAGE_LABEL[meta.language] ?? meta.language}</span>
            </div>
            {meta.estimated_pages > 0 && (
              <div>
                <span className="text-gray-400">페이지 수</span>
                <span className="ml-1 text-[#0F1111]">{meta.estimated_pages}p (추정)</span>
              </div>
            )}
            {meta.publisher && (
              <div>
                <span className="text-gray-400">출판사</span>
                <span className="ml-1 text-[#0F1111]">{meta.publisher}</span>
              </div>
            )}
            {meta.publication_date && (
              <div>
                <span className="text-gray-400">출판일</span>
                <span className="ml-1 text-[#0F1111]">{meta.publication_date}</span>
              </div>
            )}
            <div>
              <span className="text-gray-400">연령 등급</span>
              <span className="ml-1 text-[#0F1111]">{MATURITY_LABEL[meta.maturity_rating]}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 책 설명 */}
      {meta.description && (
        <div className="border-t border-gray-100 px-5 py-4">
          <h2 className="text-sm font-bold text-[#0F1111] mb-2">책 소개</h2>
          <div
            className="text-sm text-[#0F1111] leading-relaxed prose prose-sm max-w-none line-clamp-6 overflow-hidden"
            dangerouslySetInnerHTML={{ __html: meta.description }}
          />
          <button className="text-xs text-[#007185] mt-1 hover:text-[#C7511F]">더 보기...</button>
        </div>
      )}

      {/* 검색 키워드 */}
      {meta.keywords.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-3">
          <span className="text-xs text-gray-500 mr-2">검색 키워드:</span>
          {meta.keywords.map((kw) => (
            <span
              key={kw}
              className="inline-block text-xs text-[#007185] bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 mr-1 mb-1 hover:bg-gray-100 cursor-default"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* 안내 메시지 */}
      <div className="bg-amber-50 border-t border-amber-100 px-5 py-2">
        <p className="text-xs text-amber-700">
          이 미리보기는 참고용입니다. 실제 Amazon 상품 페이지는 KDP 대시보드에서 확인하세요.
        </p>
      </div>
    </div>
  )
}
