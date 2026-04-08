'use client'

/**
 * BillingHistory — 결제 내역 테이블
 *
 * subscriptions 테이블에서 사용자의 구독 이력을 표시.
 * (billing_history 테이블이 없으므로 subscription 레코드를 사용)
 *
 * 컬럼: 날짜, 플랜, 금액, 상태
 */

import { useEffect, useState } from 'react'
import { Receipt, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react'
import { cn, formatDate, planLabel } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import type { Subscription } from '@/types'

interface BillingHistoryProps {
  userId: string
}

const STATUS_CONFIG = {
  active: {
    label: '활성',
    icon: CheckCircle,
    className: 'text-green-600 bg-green-50',
  },
  cancelled: {
    label: '취소됨',
    icon: XCircle,
    className: 'text-gray-500 bg-gray-50',
  },
  expired: {
    label: '만료',
    icon: XCircle,
    className: 'text-red-500 bg-red-50',
  },
  pending: {
    label: '대기 중',
    icon: Clock,
    className: 'text-yellow-600 bg-yellow-50',
  },
}

export default function BillingHistory({ userId }: BillingHistoryProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

      setSubscriptions((data ?? []) as unknown as Subscription[])
      setLoading(false)
    }
    load()
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <Receipt className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">결제 내역</h3>
      </div>

      {subscriptions.length === 0 ? (
        <div className="py-12 text-center">
          <Receipt className="h-8 w-8 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">결제 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  날짜
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  플랜
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  금액
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  다음 결제일
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {subscriptions.map((sub) => {
                const statusConfig =
                  STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.pending
                const StatusIcon = statusConfig.icon

                return (
                  <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                      {formatDate(sub.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900 capitalize">
                        {planLabel(sub.plan)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                      ₩{sub.amount.toLocaleString('ko-KR')}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                          statusConfig.className,
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                      {sub.next_billing_at ? formatDate(sub.next_billing_at) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
