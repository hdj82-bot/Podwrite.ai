'use client'

/**
 * RoyaltyCalculator — 플랫폼별 로열티 계산기
 *
 * 탭:     부크크 / 교보문고 / Amazon KDP
 * 입력:   정가, 페이지 수(부크크), 판매 채널, 월 판매량 슬라이더
 * 결과:   권당 수익 / 월 수익 / 연 수익 / BEP(손익분기 판매량)
 * 상세:   계산 근거 토글 (컴팩트 ↔ 확장)
 */

import { useState } from 'react'
import { Calculator, TrendingUp, BookOpen, Globe, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── 상수 ─────────────────────────────────────────────────────────
const KDP_EXCHANGE_RATE = 1_350  // USD → KRW 고정 환율 (추정치)
const PRO_MONTHLY_FEE  = 19_900  // 프로 플랜 기준 BEP 계산

// 부크크 채널별 작가 수익률
const BOOKK_CHANNELS = [
  { id: 'direct',     label: '부크크 직판',       royaltyRate: 0.60 },
  { id: 'bookstore',  label: '서점(교보 등) 입점', royaltyRate: 0.25 },
]

// ── 계산 함수 ────────────────────────────────────────────────────

/** 부크크 권당 작가 순수익 = 정가 × 채널수익률 − 인쇄 원가 */
function calcBookk(price: number, pages: number, channelId: string) {
  const ch = BOOKK_CHANNELS.find((c) => c.id === channelId) ?? BOOKK_CHANNELS[0]
  const printCost    = 10 * pages + 500          // 흑백 단면 기준: 10원/페이지 + 기본 500원
  const commissionAmt = Math.round(price * (1 - ch.royaltyRate))
  const royalty       = Math.max(0, price * ch.royaltyRate - printCost)
  return { royalty: Math.round(royalty), printCost, commissionAmt, rate: ch.royaltyRate }
}

/** 교보문고 권당 작가 순수익 = 정가 × 30% */
function calcKyobo(price: number) {
  return Math.round(price * 0.30)
}

/** KDP eBook 권당 작가 수익
 *  $2.99 ~ $9.99 → 70%  /  기타 → 35%
 */
function calcKdp(priceUsd: number) {
  const rate       = priceUsd >= 2.99 && priceUsd <= 9.99 ? 0.70 : 0.35
  const royaltyUsd = priceUsd * rate
  const royaltyKrw = Math.round(royaltyUsd * KDP_EXCHANGE_RATE)
  return { royaltyKrw, royaltyUsd, rate }
}

// ── 포맷터 ───────────────────────────────────────────────────────
const fmt  = (n: number) => Math.round(n).toLocaleString('ko-KR')
const fmtd = (n: number) => n.toFixed(2)

type Tab = 'bookk' | 'kyobo' | 'kdp'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'bookk', label: '부크크',      icon: BookOpen },
  { id: 'kyobo', label: '교보문고',    icon: BookOpen },
  { id: 'kdp',   label: 'Amazon KDP', icon: Globe    },
]

export default function RoyaltyCalculator() {
  const [tab,      setTab]      = useState<Tab>('bookk')
  const [expanded, setExpanded] = useState(false)

  // 부크크 상태
  const [bookkPrice,   setBookkPrice]   = useState(15_000)
  const [bookkPages,   setBookkPages]   = useState(200)
  const [bookkChannel, setBookkChannel] = useState('direct')

  // 교보 상태
  const [kyoboPrice, setKyoboPrice] = useState(18_000)

  // KDP 상태 (달러)
  const [kdpPrice, setKdpPrice] = useState(4.99)

  // 공통: 월 판매량 슬라이더
  const [monthlyVol, setMonthlyVol] = useState(50)

  // ── 계산 결과 ──────────────────────────────────────────────────
  const bookkRes = calcBookk(bookkPrice, bookkPages, bookkChannel)
  const kyoboRes = calcKyobo(kyoboPrice)
  const kdpRes   = calcKdp(kdpPrice)

  const royaltyPerBook =
    tab === 'bookk' ? bookkRes.royalty :
    tab === 'kyobo' ? kyoboRes :
    kdpRes.royaltyKrw

  const monthlyIncome = royaltyPerBook * monthlyVol
  const annualIncome  = monthlyIncome * 12
  const bep           = royaltyPerBook > 0 ? Math.ceil(PRO_MONTHLY_FEE / royaltyPerBook) : 0

  return (
    <section className="py-20 px-6 bg-gray-50">
      <div className="max-w-3xl mx-auto">

        {/* 헤더 */}
        <div className="text-center mb-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-1 text-xs font-semibold text-gray-600">
            <Calculator className="h-3.5 w-3.5" />
            로열티 계산기
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            내 책, 얼마나 벌 수 있을까요?
          </h2>
          <p className="text-sm text-gray-400">
            정가와 판매량을 입력하면 플랫폼별 예상 수익을 계산합니다.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">

          {/* 플랫폼 탭 */}
          <div className="flex border-b border-gray-100">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors',
                  tab === id
                    ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/50'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* ── 부크크 입력 ── */}
            {tab === 'bookk' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    정가 (원)
                  </label>
                  <input
                    type="number" min={1000} max={100_000} step={500}
                    value={bookkPrice}
                    onChange={(e) => setBookkPrice(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    페이지 수
                  </label>
                  <input
                    type="number" min={50} max={1000} step={10}
                    value={bookkPages}
                    onChange={(e) => setBookkPages(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    판매 채널
                  </label>
                  <div className="flex gap-2">
                    {BOOKK_CHANNELS.map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => setBookkChannel(ch.id)}
                        className={cn(
                          'flex-1 rounded-lg border py-2 text-xs font-medium transition-colors',
                          bookkChannel === ch.id
                            ? 'border-orange-400 bg-orange-50 text-orange-700'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                        )}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── 교보 입력 ── */}
            {tab === 'kyobo' && (
              <div className="mb-6">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  정가 (원)
                </label>
                <input
                  type="number" min={1000} max={100_000} step={500}
                  value={kyoboPrice}
                  onChange={(e) => setKyoboPrice(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                />
                <p className="mt-1.5 text-xs text-gray-400">교보문고 POD 로열티 기준: 정가 × 30%</p>
              </div>
            )}

            {/* ── KDP 입력 ── */}
            {tab === 'kdp' && (
              <div className="mb-6">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  정가 (USD)
                  <span className={cn(
                    'ml-2 font-medium',
                    kdpRes.rate === 0.70 ? 'text-orange-600' : 'text-gray-400',
                  )}>
                    {kdpRes.rate === 0.70 ? '70% 로열티 구간' : '35% 로열티 구간'}
                  </span>
                </label>
                <input
                  type="number" min={0.99} max={200} step={0.01}
                  value={kdpPrice}
                  onChange={(e) => setKdpPrice(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  $2.99~$9.99 → 70% · 기타 → 35% | 환율 ₩{KDP_EXCHANGE_RATE.toLocaleString()}/달러 적용
                </p>
              </div>
            )}

            {/* 월 판매량 슬라이더 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600">
                  월 예상 판매량
                </label>
                <span className="text-sm font-bold text-gray-900">
                  {monthlyVol.toLocaleString('ko-KR')}권 / 월
                </span>
              </div>
              <input
                type="range" min={1} max={500} step={1}
                value={monthlyVol}
                onChange={(e) => setMonthlyVol(Number(e.target.value))}
                className="w-full accent-orange-500 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-300 mt-1">
                <span>1권</span>
                <span>250권</span>
                <span>500권</span>
              </div>
            </div>

            {/* 결과 카드 3개 */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">권당 수익</p>
                <p className="text-base font-extrabold text-gray-900 leading-tight">
                  ₩{fmt(royaltyPerBook)}
                </p>
              </div>
              <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 text-center">
                <p className="text-xs text-orange-500 font-medium mb-1">월 수익</p>
                <p className="text-base font-extrabold text-orange-700 leading-tight">
                  ₩{fmt(monthlyIncome)}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">연 수익</p>
                <p className="text-base font-extrabold text-gray-900 leading-tight">
                  ₩{fmt(annualIncome)}
                </p>
              </div>
            </div>

            {/* BEP 배너 */}
            {bep > 0 && (
              <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-xs text-green-700">
                    프로 구독료(₩19,900) 회수 손익분기
                  </span>
                </div>
                <span className="text-sm font-bold text-green-800 shrink-0">
                  {fmt(bep)}권
                </span>
              </div>
            )}

            {/* 상세 보기 토글 */}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {expanded ? (
                <><ChevronUp className="h-3.5 w-3.5" />계산 근거 접기</>
              ) : (
                <><ChevronDown className="h-3.5 w-3.5" />계산 근거 보기</>
              )}
            </button>

            {/* 상세 내역 */}
            {expanded && (
              <div className="mt-2 rounded-xl bg-gray-50 border border-gray-100 p-4 text-xs text-gray-600 space-y-1.5">
                <p className="font-semibold text-gray-800 mb-2">계산 근거</p>

                {tab === 'bookk' && (
                  <>
                    <div className="flex justify-between">
                      <span>정가</span>
                      <span className="font-medium">₩{fmt(bookkPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>인쇄 원가 ({bookkPages}p × 10원 + 500원)</span>
                      <span className="font-medium text-red-500">−₩{fmt(bookkRes.printCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>부크크 수수료 ({Math.round((1 - bookkRes.rate) * 100)}%)</span>
                      <span className="font-medium text-red-500">−₩{fmt(bookkRes.commissionAmt)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold text-gray-800">
                      <span>권당 순수익</span>
                      <span>₩{fmt(bookkRes.royalty)}</span>
                    </div>
                  </>
                )}

                {tab === 'kyobo' && (
                  <>
                    <div className="flex justify-between">
                      <span>정가</span>
                      <span className="font-medium">₩{fmt(kyoboPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>교보문고 로열티 (30%)</span>
                      <span className="font-medium text-green-600">₩{fmt(kyoboRes)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold text-gray-800">
                      <span>권당 순수익</span>
                      <span>₩{fmt(kyoboRes)}</span>
                    </div>
                  </>
                )}

                {tab === 'kdp' && (
                  <>
                    <div className="flex justify-between">
                      <span>정가 (USD)</span>
                      <span className="font-medium">${fmtd(kdpPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>로열티율</span>
                      <span className="font-medium">{Math.round(kdpRes.rate * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>권당 수익 (USD)</span>
                      <span className="font-medium">${fmtd(kdpRes.royaltyUsd)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>환율 (₩{KDP_EXCHANGE_RATE.toLocaleString()}/달러)</span>
                      <span className="font-medium">× {KDP_EXCHANGE_RATE.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold text-gray-800">
                      <span>권당 순수익 (원화 환산)</span>
                      <span>₩{fmt(kdpRes.royaltyKrw)}</span>
                    </div>
                  </>
                )}

                <p className="text-gray-400 pt-1 leading-relaxed">
                  * 부크크 인쇄 원가는 흑백 단면 기준 추정치(10원/페이지 + 기본 500원)입니다.
                  실제 수익은 채널·할인·도서 규격에 따라 달라질 수 있습니다.
                </p>
              </div>
            )}

          </div>
        </div>

        <p className="mt-5 text-center text-xs text-gray-400">
          * 수익률은 플랫폼 공식 가이드 기준 근사치입니다. 실제 금액은 인쇄비·부가세 등에 따라 달라질 수 있습니다.
        </p>
      </div>
    </section>
  )
}
