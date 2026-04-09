/**
 * /pricing — 공개 요금제 페이지
 *
 * 로그인/비로그인 모두 접근 가능 (공개 페이지).
 * 현재 로그인 사용자는 현재 플랜 하이라이트.
 * 유료 플랜 CTA:
 *   - 로그인 상태 → /settings/billing?plan=basic|pro
 *   - 비로그인 상태 → /login?next=/pricing
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import PricingCard from '@/components/payment/PricingCard'
import BillingForm from '@/components/payment/BillingForm'
import type { Plan } from '@/types'

type BillingType = 'monthly' | 'annual'

interface UserState {
  id: string
  plan: Plan
  loaded: boolean
}

const FAQ_ITEMS = [
  {
    q: '원고 저작권이 제 것인가요?',
    a: '네, 100% 작가님 것입니다. AI 학습에 사용하지 않으며, 언제든 DOCX/PDF로 내보낼 수 있습니다.',
  },
  {
    q: '해지하면 원고가 사라지나요?',
    a: '아니요. 해지 후에도 읽기·다운로드·내보내기는 30일간 유지됩니다. 재구독하면 편집 기능이 즉시 복원됩니다.',
  },
  {
    q: '환불 정책은 어떻게 되나요?',
    a: '결제일 기준 7일 이내 미사용 시 전액 환불됩니다. 이후에는 남은 기간에 대해 일할 계산 환불을 제공합니다.',
  },
  {
    q: 'AI가 원고를 대신 써주나요?',
    a: '아니요. Podwrite.ai는 집필 보조 도구입니다. 최종 원고는 작가님이 완성하시며, AI는 아이디어 제안·교정·번역을 지원합니다.',
  },
  {
    q: 'POD가 무엇인가요?',
    a: 'Print-on-Demand의 약자로, 주문 시마다 인쇄하는 방식입니다. 재고 위험 없이 출판할 수 있어 1인 작가에게 최적화되어 있습니다.',
  },
  {
    q: '베이직과 프로의 차이는 무엇인가요?',
    a: '프로 플랜에는 Amazon KDP 글로벌(한→영 번역, EPUB 생성), 셀링 페이지 생성, 무제한 프로젝트·검색이 포함됩니다.',
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [billingType, setBillingType] = useState<BillingType>('monthly')
  const [user, setUser] = useState<UserState>({ id: '', plan: 'free', loaded: false })
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        setUser({ id: '', plan: 'free', loaded: true })
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('plan')
        .eq('id', authUser.id)
        .single()

      setUser({
        id: authUser.id,
        plan: (profile?.plan as Plan) ?? 'free',
        loaded: true,
      })
    }
    load()
  }, [])

  function handleSelectPlan(plan: Plan) {
    if (plan === 'free') {
      if (!user.id) router.push('/signup')
      else router.push('/dashboard')
      return
    }
    if (!user.id) {
      // 비로그인: 로그인 후 pricing으로 복귀
      router.push('/login?next=/pricing')
      return
    }
    setSelectedPlan(plan as 'basic' | 'pro')
  }

  return (
    <div className="flex-1 min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* 헤더 */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">요금제</h1>
          <p className="text-gray-500 text-lg mb-2">
            책 한 권 판매 수익 &gt; 한 달 구독료. 팔리면 본전입니다.
          </p>
          <p className="text-xs text-gray-400">
            원고 저작권은 작가님께 있습니다. AI 학습에 사용하지 않습니다.
          </p>
        </div>

        {/* 월/연간 토글 */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <span
            className={cn(
              'text-sm font-medium',
              billingType === 'monthly' ? 'text-gray-900' : 'text-gray-400',
            )}
          >
            월간
          </span>
          <button
            onClick={() => setBillingType((t) => (t === 'monthly' ? 'annual' : 'monthly'))}
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors',
              billingType === 'annual' ? 'bg-purple-600' : 'bg-gray-300',
            )}
            aria-label="연간/월간 전환"
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                billingType === 'annual' && 'translate-x-5',
              )}
            />
          </button>
          <span
            className={cn(
              'text-sm font-medium',
              billingType === 'annual' ? 'text-gray-900' : 'text-gray-400',
            )}
          >
            연간
            <span className="ml-1.5 rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5 font-semibold">
              2개월 무료
            </span>
          </span>
        </div>

        {/* 결제 폼 뷰 */}
        {selectedPlan && user.id ? (
          <div className="max-w-md mx-auto">
            <button
              onClick={() => setSelectedPlan(null)}
              className="mb-6 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              ← 요금제 선택으로
            </button>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">결제 등록</h2>
            <BillingForm
              userId={user.id}
              targetPlan={selectedPlan}
              billingType={billingType}
              currentPlan={user.plan}
              onSuccess={(plan) => {
                setUser((prev) => ({ ...prev, plan }))
                setSelectedPlan(null)
                router.push('/dashboard')
              }}
              onCancel={() => setSelectedPlan(null)}
            />
          </div>
        ) : (
          <>
            {/* 플랜 카드 그리드 */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-14">
              {(['free', 'basic', 'pro'] as Plan[]).map((p) => (
                <PricingCard
                  key={p}
                  plan={p}
                  billingType={billingType}
                  currentPlan={user.loaded ? user.plan : 'free'}
                  onSelect={handleSelectPlan}
                  highlighted={p === 'pro'}
                />
              ))}
            </div>

            {/* 기능 비교표 */}
            <div className="mb-14">
              <h2 className="text-xl font-bold text-gray-900 text-center mb-6">기능 상세 비교</h2>
              <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-4 px-6 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">기능</th>
                      <th className="py-4 px-6 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">무료</th>
                      <th className="py-4 px-6 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">베이직</th>
                      <th className="py-4 px-6 text-center text-xs font-semibold text-purple-600 uppercase tracking-wide">프로</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['프로젝트 수', '1개', '3개', '무제한'],
                      ['월 자료 검색', '10회', '30회', '무제한'],
                      ['버전 스냅샷', '5개/챕터', '20개/챕터', '무제한'],
                      ['클라우드 저장소', '50 MB', '500 MB', '10 GB'],
                      ['내보내기 (DOCX/TXT/PDF)', true, true, true],
                      ['AI 집필 보조', true, true, true],
                      ['맞춤법·문체 교정', true, true, true],
                      ['원고 진단', true, true, true],
                      ['셀링 페이지 생성', false, false, true],
                      ['Amazon KDP 글로벌', false, false, true],
                      ['한→영 번역 (Claude AI)', false, false, true],
                      ['EPUB 생성 (Kindle)', false, false, true],
                      ['KDP 제출 패키지 ZIP', false, false, true],
                    ].map(([feat, free, basic, pro], i) => (
                      <tr
                        key={String(feat)}
                        className={cn(
                          'border-b border-gray-50 last:border-0',
                          i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30',
                        )}
                      >
                        <td className="py-3 px-6 text-gray-700">{feat}</td>
                        {[free, basic, pro].map((val, j) => (
                          <td key={j} className="py-3 px-6 text-center">
                            {val === true ? (
                              <Check className="h-4 w-4 text-green-500 mx-auto" />
                            ) : val === false ? (
                              <X className="h-4 w-4 text-gray-300 mx-auto" />
                            ) : (
                              <span
                                className={cn(
                                  'text-sm',
                                  j === 2 ? 'font-semibold text-purple-700' : 'text-gray-600',
                                )}
                              >
                                {val}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* FAQ */}
            <div className="mb-10">
              <h2 className="text-xl font-bold text-gray-900 text-center mb-6">자주 묻는 질문</h2>
              <div className="space-y-3 max-w-2xl mx-auto">
                {FAQ_ITEMS.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenFaq((prev) => (prev === i ? null : i))}
                      className="w-full flex items-center justify-between px-5 py-4 text-left"
                    >
                      <span className="text-sm font-medium text-gray-900">{item.q}</span>
                      <span className="ml-4 shrink-0 text-gray-400">
                        {openFaq === i ? '−' : '+'}
                      </span>
                    </button>
                    {openFaq === i && (
                      <div className="px-5 pb-4">
                        <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 하단 CTA */}
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-4">
                무료로 시작하고 필요할 때 업그레이드하세요.
              </p>
              <button
                onClick={() => router.push(user.id ? '/dashboard' : '/signup')}
                className="rounded-xl bg-gray-900 hover:bg-gray-700 text-white px-8 py-3 text-sm font-semibold transition-colors"
              >
                {user.id ? '대시보드로 이동' : '무료로 시작하기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
