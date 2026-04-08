'use client'

/**
 * TossScript — 토스페이먼츠 SDK v2 동적 로드
 *
 * 결제가 필요한 페이지 최상단에 배치하세요:
 *   <TossScript />
 *
 * SDK 로드 후 window.TossPayments() 사용 가능.
 * strategy="lazyOnload" → 페이지 hydration 후 비동기 로드
 *
 * 전역 타입 선언:
 *   window.TossPayments — SDK 초기화 함수
 */

import Script from 'next/script'

// Toss Payments v2 타입 (최소 필요 인터페이스)
declare global {
  interface Window {
    TossPayments: (clientKey: string) => TossPaymentsInstance
  }
}

export interface TossPaymentsInstance {
  billing: (options: { customerKey: string }) => TossBillingInstance
  payment: (options: { customerKey: string }) => TossPaymentInstance
}

export interface TossBillingInstance {
  requestBillingAuth: (options: {
    method: '카드'
    successUrl: string
    failUrl: string
    customerEmail?: string
    customerName?: string
  }) => Promise<void>
}

export interface TossPaymentInstance {
  requestPayment: (method: string, options: Record<string, unknown>) => Promise<void>
}

export default function TossScript() {
  return (
    <Script
      src="https://js.tosspayments.com/v2/standard"
      strategy="lazyOnload"
      id="toss-payments-sdk-v2"
    />
  )
}
