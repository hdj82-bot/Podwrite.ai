import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUserWithProfile } from '@/lib/supabase-server'
import { formatDate, planLabel, planColorClass } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Plan } from '@/types'
import PasswordResetButton from './PasswordResetButton'

export const metadata = { title: '계정 설정' }

export default async function SettingsPage() {
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser) redirect('/login')

  const plan = (profile?.plan ?? 'free') as Plan

  return (
    <main className="space-y-4">
        {/* 계정 정보 */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-800">계정 정보</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">이메일</span>
              <span className="text-sm font-medium text-gray-900">{authUser.email}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">가입일</span>
              <span className="text-sm text-gray-700">
                {formatDate(authUser.created_at ?? profile?.created_at ?? '')}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-500">비밀번호</span>
              <PasswordResetButton email={authUser.email ?? ''} />
            </div>
          </div>
        </section>

        {/* 플랜 현황 */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">플랜</h3>
            <span className={cn(
              'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold',
              planColorClass(plan),
            )}>
              {planLabel(plan)}
            </span>
          </div>

          {profile?.plan_expires_at && (
            <p className="text-sm text-gray-500">
              만료일: {formatDate(profile.plan_expires_at)}
            </p>
          )}

          {plan !== 'pro' && (
            <Link
              href="/dashboard/settings/billing"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-black hover:underline"
            >
              플랜 업그레이드
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </section>

        {/* 약관 동의 현황 */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h3 className="font-semibold text-gray-800">약관 동의</h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
              <span className="text-sm text-gray-500">이용약관</span>
              <span className="text-sm text-gray-700">
                {profile?.terms_agreed_at
                  ? formatDate(profile.terms_agreed_at)
                  : '미동의'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-500">개인정보 처리방침</span>
              <span className="text-sm text-gray-700">
                {profile?.privacy_agreed_at
                  ? formatDate(profile.privacy_agreed_at)
                  : '미동의'}
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-2">
            원고 데이터는 AI 학습에 사용되지 않습니다. 저작권은 100% 작가에게 귀속됩니다.
          </p>
        </section>

        {/* 위험 영역 */}
        <section className="bg-white rounded-xl border border-red-100 p-6 space-y-3">
          <h3 className="font-semibold text-red-700">위험 영역</h3>
          <p className="text-sm text-gray-500">
            계정을 삭제하면 모든 원고와 데이터가 영구적으로 제거됩니다.
          </p>
          <a
            href="mailto:support@podwrite.ai?subject=계정 삭제 요청"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            지원팀에 계정 삭제 요청
          </a>
        </section>
    </main>
  )
}
