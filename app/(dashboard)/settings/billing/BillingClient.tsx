'use client'

/**
 * BillingClient — 구독·결제 페이지의 인터랙티브 부분
 *
 * 서버 컴포넌트(billing/page.tsx)에서 user + subscription 데이터를
 * props로 받아 클라이언트 상태(취소 모달, 알림)를 관리합니다.
 */

import { useState } from 'react'
import Link from 'next/link'
import { cn, planLabel, planColorClass, formatDate } from '@/lib/utils'
import CancelConfirmModal from '@/components/payment/CancelConfirmModal'
import type { Plan, Subscription } from '@/types'

interface BillingClientProps {
  plan: Plan
  planExpiresAt: string | null
  subscription: Subscription | null
}

type AlertKind = 'success' | 'error'
interface Alert { kind: AlertKind; message: string }

export default function BillingClient({ plan, planExpiresAt, subscription }: BillingClientProps) {
  const [currentPlan, setCurrentPlan] = useState<Plan>(plan)
  const [currentSub, setCurrentSub] = useState<Subscription | null>(subscription)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [alert, setAlert] = useState<Alert | null>(null)

  const isActive   = currentSub?.status === 'active'
  const isCancelled = currentSub?.status === 'cancelled'
  const isPaid     = currentPlan !== 'free'

  async function handleCancelConfirm() {
    const res = await fetch('/api/subscriptions/cancel', { method: 'POST' })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? '취소 실패')

    // 로컬 상태 반영 (다음 방문 시 서버에서 최신 데이터)
    setCurrentSub((prev) => prev ? { ...prev, status: 'cancelled' } : null)
    setAlert({ kind: 'success', message: json.data.message })
    setShowCancelModal(false)
  }

  return (
    <div className="space-y-4">

      {/* 알림 배너 */}
      {alert && (
        <div
          className={cn(
            'flex items-start gap-3 rounded-xl border p-4 text-sm',
            alert.kind === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800',
          )}
        >
          {alert.kind === 'success' ? (
            <svg className="h-4 w-4 shrink-0 mt-0.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0 mt-0.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          )}
          <p>{alert.message}</p>
        </div>
      )}

      {/* ── 현재 플랜 카드 ─────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">현재 플랜</p>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900">{planLabel(currentPlan)}</h2>
              <span
                className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
                  planColorClass(currentPlan),
                )}
              >
                {currentPlan === 'free' ? '무료' : isCancelled ? '취소됨' : '활성'}
              </span>
            </div>
          </div>

          {currentPlan !== 'pro' && (
            <Link
              href="/pricing"
              className="shrink-0 rounded-lg bg-black hover:bg-gray-800 text-white px-4 py-2 text-sm font-semibold transition-colors"
            >
              업그레이드
            </Link>
          )}
        </div>

        {/* 취소 경고 */}
        {isCancelled && currentSub?.next_billing_at && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 p-3">
            <svg className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">구독이 취소되었습니다</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {formatDate(currentSub.next_billing_at)}까지 {planLabel(currentPlan)} 기능을 사용할 수 있습니다.
              </p>
            </div>
          </div>
        )}

        {/* 메타 정보 */}
        <div className="space-y-2">
          {currentSub?.next_billing_at && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
              </svg>
              <span>
                {isCancelled ? '만료일: ' : '다음 결제일: '}
                <strong>{formatDate(currentSub.next_billing_at)}</strong>
              </span>
            </div>
          )}

          {isActive && currentSub?.amount != null && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
              <span>
                월 결제: <strong>₩{currentSub.amount.toLocaleString('ko-KR')}</strong>
              </span>
            </div>
          )}

          {currentPlan === 'free' && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="h-4 w-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>영원히 무료 · 신용카드 불필요</span>
            </div>
          )}
        </div>

        {/* 구독 취소 링크 */}
        {isActive && isPaid && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowCancelModal(true)}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors underline"
            >
              구독 취소하기
            </button>
          </div>
        )}
      </section>

      {/* ── 원고 보호 정책 ────────────────────────────────────── */}
      <section className="rounded-xl bg-gray-50 border border-gray-100 p-5 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-700 mb-2">원고 보호 정책</p>
        <p>• 원고 저작권은 100% 작가님께 있습니다. AI 학습에 사용하지 않습니다.</p>
        <p>• 구독 취소 후에도 읽기·다운로드는 만료일까지 유지됩니다.</p>
        <p>• 서비스 종료 시 30일 전 사전 통보 및 원고 내보내기 기간을 보장합니다.</p>
      </section>

      {/* 취소 확인 모달 */}
      {showCancelModal && currentSub && (
        <CancelConfirmModal
          plan={currentPlan}
          subscription={currentSub}
          onConfirm={handleCancelConfirm}
          onClose={() => setShowCancelModal(false)}
        />
      )}
    </div>
  )
}
