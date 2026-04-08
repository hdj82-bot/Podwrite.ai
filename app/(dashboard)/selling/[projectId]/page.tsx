/**
 * /dashboard/selling/[projectId] — 셀링 페이지 모듈 (서버 컴포넌트)
 * Pro 플랜 전용
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUserWithProfile, createServerClient } from '@/lib/supabase-server'
import CopyGenerator from '@/components/selling/CopyGenerator'
import type { Project } from '@/types'

interface PageProps {
  params: { projectId: string }
}

export async function generateMetadata({ params }: PageProps) {
  return { title: '셀링 페이지 — 카피 생성' }
}

export default async function SellingPage({ params }: PageProps) {
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser) redirect('/login')

  // Pro 플랜 전용
  if (profile?.plan !== 'pro') {
    return (
      <main className="flex-1 px-6 py-8 max-w-3xl">
        <ProGate />
      </main>
    )
  }

  const supabase = await createServerClient()

  // 프로젝트 조회 (소유권은 RLS 보장)
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
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/dashboard" className="hover:text-gray-900 transition-colors">
              내 원고
            </Link>
            <span>›</span>
            <span className="text-gray-700 font-medium truncate max-w-[180px]">{p.title}</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">셀링 페이지</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            AI가 플랫폼별 판매 카피와 키워드를 생성합니다
          </p>
        </div>

        <span className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
          Pro
        </span>
      </div>

      {/* 프로젝트 정보 요약 */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4 text-sm">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{p.title}</p>
          {p.genre && <p className="text-gray-500 text-xs mt-0.5">{p.genre}</p>}
        </div>
        <PlatformBadge platform={p.platform} />
      </div>

      {/* 카피 생성기 */}
      <CopyGenerator
        projectId={p.id}
        title={p.title}
        genre={p.genre}
      />
    </main>
  )
}

// ── 내부 컴포넌트 ────────────────────────────────────────────────

function ProGate() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center">
        <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <div>
        <p className="text-lg font-bold text-gray-900">Pro 플랜 전용 기능입니다</p>
        <p className="text-sm text-gray-500 mt-1">
          셀링 페이지 카피 생성은 Pro 플랜에서만 이용할 수 있습니다
        </p>
      </div>
      <Link
        href="/dashboard/settings/billing"
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
      >
        Pro로 업그레이드
      </Link>
    </div>
  )
}

function PlatformBadge({ platform }: { platform: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    bookk: { label: '부크크', cls: 'bg-blue-100 text-blue-700' },
    kyobo: { label: '교보문고', cls: 'bg-green-100 text-green-700' },
    kdp:   { label: 'Amazon KDP', cls: 'bg-orange-100 text-orange-700' },
  }
  const meta = map[platform] ?? { label: platform, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${meta.cls}`}>
      {meta.label}
    </span>
  )
}
