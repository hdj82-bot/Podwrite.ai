/**
 * /selling/[projectId] — 셀링 페이지 모듈
 *
 * 접근 제어:
 *   Pro  → 전체 기능 이용 가능
 *   Free/Basic → 업그레이드 유도 배너 표시 (페이지 구조는 보임)
 *
 * 섹션 순서 (CopyGenerator 내부):
 *   1. 소개문 생성 (플랫폼 라디오 + 책 특성 메모 + 생성 버튼)
 *   2. 플랫폼별 카드 (소개문 · 제목 후보 · 키워드)
 *   3. 표지 제작 도구 (CanvaDeepLink)
 */

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUserWithProfile, createServerClient } from '@/lib/supabase-server'
import CopyGenerator from '@/components/selling/CopyGenerator'
import type { Project, Plan } from '@/types'

interface PageProps {
  params: { projectId: string }
}

export async function generateMetadata({ params }: PageProps) {
  return { title: '셀링 페이지 — 카피 생성' }
}

export default async function SellingPage({ params }: PageProps) {
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser) redirect('/login')

  const plan: Plan = (profile?.plan as Plan) ?? 'free'
  const isPro = plan === 'pro'

  const supabase = await createServerClient()

  // 프로젝트 조회 (RLS로 소유권 보장)
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, title, genre, platform, status')
    .eq('id', params.projectId)
    .eq('user_id', authUser.id)
    .single()

  if (error || !project) notFound()

  const p = project as Pick<Project, 'id' | 'title' | 'genre' | 'platform' | 'status'>

  return (
    <main className="flex-1 px-6 py-8 max-w-3xl space-y-6">

      {/* ── 헤더 ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {/* 브레드크럼 */}
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
            <Link href="/dashboard" className="hover:text-gray-900 transition-colors">
              내 원고
            </Link>
            <span className="text-gray-300">›</span>
            <span className="text-gray-700 font-medium truncate max-w-[180px]">{p.title}</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">셀링 페이지</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            AI가 플랫폼별 판매 카피와 키워드를 생성합니다
          </p>
        </div>

        {/* 플랜 뱃지 */}
        <span
          className={
            isPro
              ? 'flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700'
              : 'flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600'
          }
        >
          {isPro ? 'Pro' : plan === 'basic' ? 'Basic' : 'Free'}
        </span>
      </div>

      {/* ── 프로젝트 정보 요약 ─────────────────────────────────────── */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4 text-sm">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{p.title}</p>
          {p.genre && <p className="text-gray-500 text-xs mt-0.5">{p.genre}</p>}
        </div>
        <PlatformBadge platform={p.platform} />
      </div>

      {/* ── Pro 전용 업그레이드 배너 (Free / Basic) ──────────────── */}
      {!isPro && (
        <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-6">
          <div className="flex items-start gap-4">
            {/* 아이콘 */}
            <div className="shrink-0 w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-purple-500"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-gray-900">
                Pro 플랜 전용 기능입니다
              </p>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                셀링 페이지 카피 생성은 Pro 플랜에서만 이용할 수 있습니다.
                AI가 플랫폼별 소개문·제목·키워드를 자동 작성하고,
                Canva 표지 제작 가이드도 함께 제공합니다.
              </p>

              {/* 기능 목록 미리보기 */}
              <ul className="mt-3 space-y-1.5">
                {[
                  '부크크 / 교보문고 맞춤 소개문 생성',
                  '제목 후보 3개 · 검색 키워드 5개',
                  '글자 수 권장 범위 색상 피드백',
                  'Canva 표지 사이즈 가이드 (mm · px)',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-gray-600">
                    <svg className="w-3.5 h-3.5 text-purple-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <Link
                  href="/settings/billing"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition-colors"
                >
                  Pro로 업그레이드 — ₩19,900/월
                </Link>
                <Link
                  href="/pricing"
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors"
                >
                  요금제 비교 →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 카피 생성기 (Pro만 활성화) ────────────────────────────── */}
      {isPro && (
        <CopyGenerator
          projectId={p.id}
          title={p.title}
          genre={p.genre}
        />
      )}

    </main>
  )
}

// ── 내부 헬퍼 컴포넌트 ───────────────────────────────────────────────

function PlatformBadge({ platform }: { platform: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    bookk: { label: '부크크',     cls: 'bg-blue-100 text-blue-700' },
    kyobo: { label: '교보문고',   cls: 'bg-green-100 text-green-700' },
    kdp:   { label: 'Amazon KDP', cls: 'bg-orange-100 text-orange-700' },
  }
  const meta = map[platform] ?? { label: platform, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${meta.cls}`}>
      {meta.label}
    </span>
  )
}
