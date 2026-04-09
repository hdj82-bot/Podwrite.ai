'use client'

/**
 * AccountDeleteModal — 계정 삭제 요청 안내 모달
 *
 * 실제 삭제 API가 없으므로 지원팀 이메일 안내로 처리합니다.
 * 삭제 전 내보내기 권고도 함께 표시합니다.
 */

import { useState, useEffect } from 'react'

export default function AccountDeleteModal() {
  const [open, setOpen] = useState(false)

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  // 모달 열릴 때 body 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* 트리거 버튼 */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
        계정 삭제 요청
      </button>

      {/* 모달 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 배경 오버레이 */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* 모달 본문 */}
          <div
            role="dialog"
            aria-modal
            aria-labelledby="delete-modal-title"
            className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5"
          >
            {/* 닫기 버튼 */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="닫기"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* 헤더 */}
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h2 id="delete-modal-title" className="text-base font-bold text-gray-900">
                  계정 삭제 요청
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  이 작업은 되돌릴 수 없습니다
                </p>
              </div>
            </div>

            {/* 경고 내용 */}
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 space-y-1.5">
              <p className="font-semibold">삭제 시 다음이 영구 제거됩니다:</p>
              <ul className="space-y-1 text-xs">
                <li className="flex items-center gap-1.5">
                  <span className="text-red-400">•</span> 모든 원고 및 챕터 데이터
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-red-400">•</span> 버전 스냅샷 및 저장된 파일
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-red-400">•</span> 계정 정보 및 결제 내역
                </li>
              </ul>
            </div>

            {/* 내보내기 권고 */}
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800 space-y-1">
              <p className="font-semibold text-amber-900">삭제 전 꼭 확인하세요</p>
              <p className="text-xs text-amber-700">
                원고를 <strong>DOCX / PDF</strong>로 내보낸 뒤 요청해 주세요.
                삭제 후에는 복구할 수 없습니다.
              </p>
            </div>

            {/* 문의 이메일 안내 */}
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-gray-600">고객 지원팀 이메일</p>
              <a
                href="mailto:support@podwrite.ai?subject=%EA%B3%84%EC%A0%95%20%EC%82%AD%EC%A0%9C%20%EC%9A%94%EC%B2%AD&body=%EC%95%88%EB%85%95%ED%95%98%EC%84%B8%EC%9A%94%2C%20%EA%B3%84%EC%A0%95%20%EC%82%AD%EC%A0%9C%EB%A5%BC%20%EC%9A%94%EC%B2%AD%ED%95%A9%EB%8B%88%EB%8B%A4."
                className="text-sm font-semibold text-gray-900 underline hover:text-gray-600 transition-colors"
              >
                support@podwrite.ai
              </a>
              <p className="text-xs text-gray-400">이메일 제목: 계정 삭제 요청</p>
            </div>

            {/* 액션 버튼 */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <a
                href="mailto:support@podwrite.ai?subject=%EA%B3%84%EC%A0%95%20%EC%82%AD%EC%A0%9C%20%EC%9A%94%EC%B2%AD"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                이메일로 요청하기
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
