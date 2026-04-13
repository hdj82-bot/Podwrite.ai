/**
 * /dashboard/settings/profile — 프로필 설정 페이지
 *
 * 섹션:
 *   1. 계정 정보  — 이메일(읽기전용), 표시 이름, 비밀번호 변경
 *   2. 현재 플랜  — 배지 + 업그레이드 링크
 *   3. 이번 달 사용량 — 원고 수, AI 자료 검색 횟수, 기능 가용 여부
 *   4. 가입 정보  — 가입일, 약관 동의
 *   5. 위험 구역  — 계정 삭제 요청
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUserWithProfile, createServerClient } from '@/lib/supabase-server'
import { cn, formatDate, planLabel, planColorClass } from '@/lib/utils'
import { PLAN_LIMITS } from '@/types'
import type { Plan, User } from '@/types'
import PasswordResetButton from '../PasswordResetButton'
import AccountDeleteModal from '../AccountDeleteModal'
import DisplayNameForm from '../DisplayNameForm'

export const metadata = { title: '프로필 설정' }

export default async function ProfileSettingsPage() {
  const { authUser, profile: rawProfile } = await getCurrentUserWithProfile()
  if (!authUser) redirect('/login')
  const profile = rawProfile as User | null

  const plan = (profile?.plan ?? 'free') as Plan
  const limits = PLAN_LIMITS[plan]

  // ── 사용량 조회 ────────────────────────────────────────────────
  const supabase = await createServerClient()
  const [projectsResult, searchUsageResult] = await Promise.all([
    supabase.from('projects').select('id'),
    supabase
      .from('search_usage')
      .select('count, reset_at')
      .eq('user_id', authUser.id)
      .maybeSingle(),
  ])

  const usedProjects = (projectsResult.data ?? []).length

  const searchRow = searchUsageResult.data as { count: number; reset_at: string } | null
  const isExpired = searchRow?.reset_at ? new Date(searchRow.reset_at) < new Date() : false
  const usedSearches = isExpired ? 0 : (searchRow?.count ?? 0)

  return (
    <main className="space-y-4">

      {/* ── 1. 계정 정보 ────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h3 className="font-semibold text-gray-800">계정 정보</h3>

        {/* 이메일 — 읽기 전용 */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">
            이메일
          </label>
          <div className="flex items-center gap-2">
            <input
              type="email"
              defaultValue={authUser.email ?? ''}
              readOnly
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
            />
            <span className="shrink-0 text-xs text-gray-400">변경 불가</span>
          </div>
        </div>

        {/* 표시 이름 */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">
            표시 이름
            <span className="ml-1 font-normal text-gray-400">(선택)</span>
          </label>
          <DisplayNameForm initialDisplayName={profile?.display_name ?? ''} />
        </div>

        {/* 비밀번호 변경 */}
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">비밀번호</p>
              <p className="text-xs text-gray-400 mt-0.5">이메일로 변경 링크를 발송합니다</p>
            </div>
            <PasswordResetButton email={authUser.email ?? ''} />
          </div>
        </div>
      </section>

      {/* ── 2. 현재 플랜 ────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">플랜</h3>
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold',
              planColorClass(plan),
            )}
          >
            {planLabel(plan)}
          </span>
        </div>

        {profile?.plan_expires_at && (
          <p className="text-sm text-gray-500 mb-3">
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

      {/* ── 3. 이번 달 사용량 ────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h3 className="font-semibold text-gray-800">이번 달 사용량</h3>

        <UsageRow
          label="원고 (프로젝트)"
          used={usedProjects}
          max={limits.projects}
          unit="개"
          plan={plan}
        />

        <UsageRow
          label="AI 자료 검색"
          used={usedSearches}
          max={limits.searchPerMonth}
          unit="회"
          plan={plan}
        />

        <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
          <FeatureFlag enabled={limits.sellingPage} label="판매 페이지" />
          <FeatureFlag enabled={limits.kdp} label="Amazon KDP" />
        </div>

        {plan !== 'pro' && (
          <p className="text-xs text-gray-400">
            AI 자료 검색 횟수는 가입일 기준 30일 주기로 초기화됩니다.
          </p>
        )}
      </section>

      {/* ── 4. 가입 정보 ────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">가입 정보</h3>

        <div className="divide-y divide-gray-100">
          <InfoRow label="가입일" value={formatDate(authUser.created_at ?? profile?.created_at ?? '')} />

          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-sm text-gray-500">이용약관 동의</span>
              <Link href="/terms" className="text-xs text-blue-600 hover:underline">
                약관 보기 →
              </Link>
            </div>
            <span className={cn('text-sm', profile?.terms_agreed_at ? 'text-gray-700' : 'text-gray-400')}>
              {profile?.terms_agreed_at ? formatDate(profile.terms_agreed_at) : '미동의'}
            </span>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-sm text-gray-500">개인정보처리방침 동의</span>
              <Link href="/privacy" className="text-xs text-blue-600 hover:underline">
                방침 보기 →
              </Link>
            </div>
            <span className={cn('text-sm', profile?.privacy_agreed_at ? 'text-gray-700' : 'text-gray-400')}>
              {profile?.privacy_agreed_at ? formatDate(profile.privacy_agreed_at) : '미동의'}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          원고 데이터는 AI 학습에 사용되지 않습니다. 저작권은 100% 작가에게 귀속됩니다.
        </p>
      </section>

      {/* ── 5. 위험 구역 ────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-red-100 p-6 space-y-3">
        <h3 className="font-semibold text-red-700">위험 구역</h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          계정을 삭제하면 모든 원고와 데이터가 영구적으로 제거됩니다.
          삭제 전에 DOCX·PDF로 내보내기를 완료해 주세요.
        </p>
        <AccountDeleteModal />
      </section>

    </main>
  )
}

// ── 헬퍼 컴포넌트 ────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-700">{value}</span>
    </div>
  )
}

function UsageRow({
  label,
  used,
  max,
  unit,
  plan,
}: {
  label: string
  used: number
  max: number
  unit: string
  plan: Plan
}) {
  const unlimited = max === Infinity
  const ratio = unlimited ? 0 : used / max
  const isWarn = ratio >= 0.9
  const isFull = ratio >= 1

  const barColor = isFull ? 'bg-red-500' : isWarn ? 'bg-amber-500' : 'bg-blue-500'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-600">{label}</span>
        <span className={cn('text-sm font-semibold tabular-nums', isWarn ? 'text-amber-600' : 'text-gray-900')}>
          {used.toLocaleString('ko-KR')}
          {unlimited ? (
            <span className="text-gray-400 font-normal"> (무제한)</span>
          ) : (
            <span className="text-gray-400 font-normal"> / {max.toLocaleString('ko-KR')}{unit}</span>
          )}
        </span>
      </div>

      {!unlimited && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${Math.min(100, ratio * 100)}%` }}
          />
        </div>
      )}

      {isWarn && plan !== 'pro' && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {isFull ? `${label} 한도 초과` : `${label} 90% 초과`}
          {' — '}
          <Link href="/dashboard/settings/billing" className="font-semibold underline hover:text-amber-800">
            플랜 업그레이드
          </Link>
        </p>
      )}
    </div>
  )
}

function FeatureFlag({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div className={cn('flex items-center gap-1.5 text-xs', enabled ? 'text-gray-700' : 'text-gray-400')}>
      {enabled ? (
        <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      )}
      {label}
    </div>
  )
}
