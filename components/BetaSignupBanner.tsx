'use client'

import { useState } from 'react'
import { Gift, Star, Check } from 'lucide-react'

const BENEFITS = ['Pro 3개월 무료 (₩59,700 상당)', '신기능 우선 체험', '1:1 온보딩 지원'] as const

export default function BetaSignupBanner() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || status === 'loading') return
    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json() as { message?: string; error?: string }

      if (!res.ok) {
        throw new Error(data.error ?? '등록 중 오류가 발생했습니다.')
      }

      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(
        err instanceof Error
          ? err.message
          : '등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      )
    }
  }

  return (
    <section className="py-20 px-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
      <div className="max-w-2xl mx-auto text-center">
        {/* 아이콘 */}
        <div className="mb-5 inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-white/20">
          <Gift className="h-7 w-7 text-white" />
        </div>

        {/* 배지 */}
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3.5 py-1 text-xs font-semibold">
          <Star className="h-3 w-3 fill-yellow-300 text-yellow-300" />
          베타 테스터 모집 중
        </div>

        <h2 className="text-2xl font-bold mb-3">
          첫 10명 베타 테스터에게
          <br />
          <span className="text-yellow-300">Pro 3개월 무료</span> 혜택을 드립니다
        </h2>
        <p className="text-orange-100 text-sm mb-8 leading-relaxed">
          실제 원고를 써보며 제품을 함께 만들어갈 작가를 찾습니다.
          <br />
          솔직한 피드백 하나로 Pro 플랜 3개월을 무료로 드립니다.
        </p>

        {/* 혜택 목록 */}
        <ul className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mb-8 text-sm">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-center gap-1.5 font-medium">
              <Check className="h-4 w-4 text-yellow-300 shrink-0" />
              {b}
            </li>
          ))}
        </ul>

        {/* 이메일 폼 */}
        {status === 'success' ? (
          <div className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-6 py-3.5 text-sm font-semibold">
            <Check className="h-5 w-5 text-yellow-300" />
            등록되었습니다! 곧 연락드리겠습니다.
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <input
              type="email"
              required
              placeholder="이메일 주소를 입력하세요"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === 'loading'}
              className="w-full sm:w-72 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="whitespace-nowrap rounded-xl bg-white px-6 py-3 text-sm font-bold text-orange-600 shadow-md transition-colors hover:bg-orange-50 disabled:opacity-60"
            >
              {status === 'loading' ? '등록 중…' : '베타 신청하기'}
            </button>
          </form>
        )}

        {errorMsg && (
          <p className="mt-3 text-xs text-orange-200">{errorMsg}</p>
        )}

        <p className="mt-4 text-xs text-orange-200/80">
          스팸 없음 · 언제든 수신 취소 가능
        </p>
      </div>
    </section>
  )
}
