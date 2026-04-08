'use client'

/**
 * CancelConfirmModal — 구독 취소 확인 모달
 *
 * 취소 시 안내:
 *   - 만료일까지 혜택 유지
 *   - 원고 읽기/다운로드 30일 유지
 *   - 재구독 시 즉시 복원
 */

import { useState } from 'react'
import { X, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn, formatDate, planLabel } from '@/lib/utils'
import type { Plan, Subscription } from '@/types'

interface CancelConfirmModalProps {
  plan: Plan
  subscription: Subscription
  onConfirm: () => Promise<void>
  onClose: () => void
}

export default function CancelConfirmModal({
  plan,
  subscription,
  onConfirm,
  onClose,
}: CancelConfirmModalProps) {
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const expiryDate = subscription.next_billing_at
    ? formatDate(subscription.next_billing_at)
    : null

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm()
      setConfirmed(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!loading ? onClose : undefined}
      />

      {/* 모달 */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 z-10">
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-40"
        >
          <X className="h-5 w-5" />
        </button>

        {confirmed ? (
          /* 취소 완료 상태 */
          <div className="text-center py-2">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">구독이 취소되었습니다</h2>
            {expiryDate && (
              <p className="text-sm text-gray-600 mb-4">
                <strong>{expiryDate}</strong>까지 {planLabel(plan)} 기능을 계속 사용하실 수 있습니다.
              </p>
            )}
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-gray-900 text-white py-2.5 text-sm font-semibold hover:bg-gray-700 transition-colors"
            >
              확인
            </button>
          </div>
        ) : (
          /* 취소 확인 상태 */
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">구독을 취소하시겠습니까?</h2>
                <p className="text-sm text-gray-500">{planLabel(plan)} 플랜</p>
              </div>
            </div>

            {/* 안내 사항 */}
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-5 space-y-2 text-sm">
              {expiryDate && (
                <p className="font-medium text-amber-800">
                  {expiryDate}까지 {planLabel(plan)} 기능 유지
                </p>
              )}
              <ul className="space-y-1.5 text-amber-700">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">•</span>
                  원고 읽기·다운로드·내보내기는 계속 가능합니다
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">•</span>
                  편집·AI 기능은 만료일 이후 잠깁니다
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">•</span>
                  재구독하면 즉시 모든 기능이 복원됩니다
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">•</span>
                  원고 저작권은 항상 작가님께 있습니다
                </li>
              </ul>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 rounded-xl border border-gray-300 bg-white text-gray-700 py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                돌아가기
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className={cn(
                  'flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors',
                  loading
                    ? 'bg-red-300 text-white cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600 text-white',
                )}
              >
                {loading ? '처리 중...' : '구독 취소 확인'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
