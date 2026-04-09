import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUserWithProfile, createServerClient } from '@/lib/supabase-server'
import { formatDate, planLabel, planColorClass } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { PLAN_LIMITS } from '@/types'
import type { Plan } from '@/types'
import PasswordResetButton from './PasswordResetButton'
import DisplayNameForm from './DisplayNameForm'
import AccountDeleteModal from './AccountDeleteModal'

export const metadata = { title: '계정 설정' }

export default async function SettingsPage() {
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser) redirect('/login')

  const plan = (profile?.plan ?? 'free') as Plan
  const limits = PLAN_LIMITS[plan]

  // ── 사용량 조회 ────────────────────────────────────────────────
  const supabase = await createServerClient()
  const [projectsResult, searchUsageResult] = await Promise.all([
    supabase.from('projects').select('id'),
    supabase
      .from('search_usage')
      .select('count, reset_at')       // reset_at 포함 — 만료 여부 확인용
      .eq('user_id', authUser.id)
      .maybeSingle(),
  ])

  const usedProjects = (projectsResult.data ?? []).length
  const maxProjects  = limits.projects

  // /api/user/usage 와 동일한 만료 로직: reset_at이 지난 경우 0으로 처리
  const searchRow = searchUsageResult.data as { count: number; reset_at: string } | null
  const isSearchExpired = searchRow?.reset_at
    ? new Date(searchRow.reset_at) < new Date()
    : false
  const usedSearches = isSearchExpired ? 0 : (searchRow?.count ?? 0)
  const maxSearches  = limits.searchPerMonth

  // ── 사용률 계산 ────────────────────────────────────────────────
  const projectRatio = maxProjects !== Infinity ? usedProjects / maxProjects : 0
  const searchRatio  = maxSearches !== Infinity ? usedSearches / maxSearches : 0

  const isProjectWarn = projectRatio >= 0.9
  const isSearchWarn  = searchRatio  >= 0.9
  const isProjectFull = projectRatio >= 1
  const isSearchFull  = searchRatio  >= 1

  // ── 렌더 ──────────────────────────────────────────────────────
  return (
    <main className="space-y-4">

      {/* ══════════════════════════════════════════════════
          1. 프로필 수정
      ══════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h3 className="font-semibold text-gray-800">프로필 수정</h3>

        <div className="space-y-5">
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
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed select-none"
              />
              <span className="shrink-0 text-xs text-gray-400">변경 불가</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              이메일은 계정 식별자로 변경할 수 없습니다.
            </p>
          </div>

          {/* 표시 이름 — TODO: API 지원 후 연결 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              표시 이름
              <span className="ml-1 font-normal text-gray-400">(선택)</span>
            </label>
            {/*
              TODO: /api/user/profile PATCH가 현재 terms_agreed_at / privacy_agreed_at만 지원합니다.
                    display_name 저장을 위해 API patchSchema + DB users 테이블 컬럼 추가가 필요합니다.
                    준비되면 DisplayNameForm에서 주석 처리된 fetch 코드를 활성화하세요.
            */}
            <DisplayNameForm initialDisplayName="" />
          </div>

          {/* 비밀번호 변경 */}
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">비밀번호</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  이메일로 변경 링크를 발송합니다
                </p>
              </div>
              <PasswordResetButton email={authUser.email ?? ''} />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          2. 플랜
      ══════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════
          3. 이번 달 사용량
      ══════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h3 className="font-semibold text-gray-800">이번 달 사용량</h3>

        <div className="space-y-5">

          {/* 원고(프로젝트) 수 */}
          <UsageRow
            label="원고 (프로젝트)"
            used={usedProjects}
            max={maxProjects}
            unit="개"
            isWarn={isProjectWarn}
            isFull={isProjectFull}
            ratio={projectRatio}
            plan={plan}
          />

          {/* AI 자료 검색 */}
          <UsageRow
            label="AI 자료 검색"
            used={usedSearches}
            max={maxSearches}
            unit="회"
            isWarn={isSearchWarn}
            isFull={isSearchFull}
            ratio={searchRatio}
            plan={plan}
          />

          {/* 플랜별 기능 가용 여부 */}
          <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
            <FeatureFlag enabled={limits.sellingPage} label="판매 페이지" />
            <FeatureFlag enabled={limits.kdp}         label="Amazon KDP" />
          </div>
        </div>

        {plan !== 'pro' && (
          <p className="text-xs text-gray-400">
            AI 자료 검색 횟수는 매월 1일 자정(KST) 초기화됩니다.
          </p>
        )}
      </section>

      {/* ══════════════════════════════════════════════════
          4. 계정 정보
      ══════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">계정 정보</h3>

        <div className="space-y-0 divide-y divide-gray-100">
          {/* 가입일 */}
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-gray-500">가입일</span>
            <span className="text-sm text-gray-700">
              {formatDate(authUser.created_at ?? profile?.created_at ?? '')}
            </span>
          </div>

          {/* 이용약관 동의 */}
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-sm text-gray-500">이용약관 동의</span>
              <Link
                href="/terms"
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                약관 보기 →
              </Link>
            </div>
            <span className={cn(
              'text-sm',
              profile?.terms_agreed_at ? 'text-gray-700' : 'text-gray-400',
            )}>
              {profile?.terms_agreed_at
                ? formatDate(profile.terms_agreed_at)
                : '미동의'}
            </span>
          </div>

          {/* 개인정보처리방침 동의 */}
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-sm text-gray-500">개인정보처리방침 동의</span>
              <Link
                href="/privacy"
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                방침 보기 →
              </Link>
            </div>
            <span className={cn(
              'text-sm',
              profile?.privacy_agreed_at ? 'text-gray-700' : 'text-gray-400',
            )}>
              {profile?.privacy_agreed_at
                ? formatDate(profile.privacy_agreed_at)
                : '미동의'}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          원고 데이터는 AI 학습에 사용되지 않습니다. 저작권은 100% 작가에게 귀속됩니다.
        </p>
      </section>

      {/* ══════════════════════════════════════════════════
          5. 위험 구역 (Danger Zone)
      ══════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl border border-red-100 p-6 space-y-3">
        <h3 className="font-semibold text-red-700">위험 구역</h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          계정을 삭제하면 모든 원고와 데이터가 영구적으로 제거됩니다.
          삭제 전에 DOCX / PDF로 내보내기를 완료해 주세요.
        </p>
        {/* 실제 삭제 API 없음 — 지원팀 이메일 안내 모달로 처리 */}
        <AccountDeleteModal />
      </section>

    </main>
  )
}

// ── 내부 헬퍼 컴포넌트 ───────────────────────────────────────────────

/**
 * UsageRow — 사용량 한 줄 (레이블 + 수치 + 프로그레스 바 + 경고)
 */
function UsageRow({
  label,
  used,
  max,
  unit,
  isWarn,
  isFull,
  ratio,
  plan,
}: {
  label: string
  used: number
  max: number
  unit: string
  isWarn: boolean
  isFull: boolean
  ratio: number
  plan: Plan
}) {
  const isUnlimited = max === Infinity

  // 프로그레스 바 색상
  const barCls = isFull
    ? 'bg-red-500'
    : isWarn
    ? 'bg-amber-500'
    : 'bg-blue-500'

  return (
    <div className="space-y-1.5">
      {/* 레이블 + 수치 */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-600">{label}</span>
        <span className={cn('text-sm font-semibold tabular-nums', isWarn ? 'text-amber-600' : 'text-gray-900')}>
          {used.toLocaleString('ko-KR')}
          {isUnlimited ? (
            <span className="text-gray-400 font-normal"> (무제한)</span>
          ) : (
            <span className="text-gray-400 font-normal">
              {' '}/ {max.toLocaleString('ko-KR')}{unit}
            </span>
          )}
        </span>
      </div>

      {/* 프로그레스 바 */}
      {!isUnlimited && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', barCls)}
            style={{ width: `${Math.min(100, ratio * 100)}%` }}
          />
        </div>
      )}

      {/* 90% 초과 경고 + 업그레이드 링크 */}
      {isWarn && plan !== 'pro' && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600">
          <svg
            className="w-3.5 h-3.5 shrink-0"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {isFull ? `${label} 한도 초과` : `${label} 한도의 90% 초과`}
          {' '}—{' '}
          <Link
            href="/dashboard/settings/billing"
            className="font-semibold underline hover:text-amber-800 transition-colors"
          >
            플랜 업그레이드
          </Link>
        </p>
      )}
    </div>
  )
}

/**
 * FeatureFlag — 플랜별 기능 허용 여부 표시 (체크 / X)
 */
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
