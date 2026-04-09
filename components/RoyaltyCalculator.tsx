'use client'

import { useState } from 'react'
import { Calculator } from 'lucide-react'

// 플랫폼별 예상 수익률 (플랫폼 공식 가이드 기준 근사치)
// 부크크·교보: 판매가 - 인쇄비 - 유통수수료 후 저자 수령분 ≈ 40%
// KDP: 60% 로열티 (인쇄비는 별도 차감)
const PLATFORMS = [
  {
    key: 'bookk',
    name: '부크크',
    rate: 0.4,
    note: '저자 수익 약 40% (인쇄·유통비 포함)',
    borderColor: 'border-blue-200',
    bgColor: 'bg-blue-50',
    labelColor: 'text-blue-700',
    barColor: 'bg-blue-400',
  },
  {
    key: 'kyobo',
    name: '교보문고 POD',
    rate: 0.4,
    note: '저자 수익 약 40% (인쇄·유통비 포함)',
    borderColor: 'border-green-200',
    bgColor: 'bg-green-50',
    labelColor: 'text-green-700',
    barColor: 'bg-green-400',
  },
  {
    key: 'kdp',
    name: 'Amazon KDP',
    rate: 0.6,
    note: '60% 로열티 (인쇄비 차감 전)',
    borderColor: 'border-orange-200',
    bgColor: 'bg-orange-50',
    labelColor: 'text-orange-700',
    barColor: 'bg-orange-400',
  },
] as const

export default function RoyaltyCalculator() {
  const [price, setPrice] = useState(15000)
  const [qty, setQty] = useState(100)

  const results = PLATFORMS.map((p) => ({
    ...p,
    perBook: Math.round(price * p.rate),
    total: Math.round(price * p.rate * qty),
  }))

  const maxTotal = Math.max(...results.map((r) => r.total), 1)

  return (
    <section className="py-20 px-6 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-center mb-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
            <Calculator className="h-5 w-5 text-orange-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
          로열티 수익 계산기
        </h2>
        <p className="text-gray-400 text-center text-sm mb-10">
          책 가격과 예상 판매량을 입력하면 플랫폼별 수익을 바로 확인합니다.
        </p>

        {/* 입력 영역 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <label className="block text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
              책 판매가 (원)
            </label>
            <input
              type="number"
              min={5000}
              max={50000}
              step={500}
              value={price}
              onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 mb-3"
            />
            <input
              type="range"
              min={5000}
              max={50000}
              step={500}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>₩5,000</span>
              <span>₩50,000</span>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <label className="block text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
              월 판매 수량 (권)
            </label>
            <input
              type="number"
              min={1}
              max={1000}
              step={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 mb-3"
            />
            <input
              type="range"
              min={1}
              max={1000}
              step={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1권</span>
              <span>1,000권</span>
            </div>
          </div>
        </div>

        {/* 결과 카드 */}
        <div className="space-y-4">
          {results.map((r) => (
            <div
              key={r.key}
              className={`rounded-2xl border p-5 ${r.borderColor} ${r.bgColor}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className={`text-sm font-bold ${r.labelColor}`}>{r.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{r.note}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold text-gray-900">
                    ₩{r.total.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">권당 ₩{r.perBook.toLocaleString()}</p>
                </div>
              </div>
              {/* 비율 바 */}
              <div className="h-1.5 rounded-full bg-white/70">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${r.barColor}`}
                  style={{ width: `${(r.total / maxTotal) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-center text-xs text-gray-400">
          * 수익률은 플랫폼 공식 가이드 기준 근사치입니다. 인쇄비·부가세 등에 따라 실제 금액이 달라질 수 있습니다.
        </p>
      </div>
    </section>
  )
}
