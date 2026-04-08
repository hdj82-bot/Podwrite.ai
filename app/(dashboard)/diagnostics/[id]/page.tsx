/**
 * /dashboard/diagnostics/[id] — 저장된 진단 결과 상세 페이지 (서버 컴포넌트)
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser, createServiceClient } from '@/lib/supabase-server'
import DiagnosticReport from '@/components/diagnostics/DiagnosticReport'
import type { DiagnosticReport as ReportType } from '@/types'

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps) {
  return { title: `원고 진단 결과 — ${params.id.slice(0, 8)}` }
}

export default async function DiagnosticDetailPage({ params }: PageProps) {
  const authUser = await getCurrentUser()
  if (!authUser) redirect('/login')

  const supabase = createServiceClient()

  const { data: diagnostic, error } = await supabase
    .from('diagnostics')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !diagnostic) notFound()

  // 소유권 확인 (user_id가 일치하는 레코드만 조회 가능)
  if (diagnostic.user_id !== authUser.id) notFound()

  if (diagnostic.status !== 'completed' || !diagnostic.report) {
    return (
      <main className="flex-1 px-6 py-8 max-w-3xl">
        <BackButton />
        <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-10 text-center space-y-3">
          <p className="text-base font-semibold text-gray-900">
            {diagnostic.status === 'processing'
              ? '분석이 아직 진행 중입니다'
              : '분석에 실패했습니다'}
          </p>
          <p className="text-sm text-gray-500">
            {diagnostic.status === 'processing'
              ? '페이지를 새로 고침하거나 잠시 후 다시 확인해 주세요.'
              : '파일 형식을 확인하고 다시 시도해 주세요.'}
          </p>
          <Link
            href="/dashboard/diagnostics"
            className="inline-flex items-center px-5 py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            새 원고 분석하기
          </Link>
        </div>
      </main>
    )
  }

  const report = diagnostic.report as ReportType

  return (
    <main className="flex-1 px-6 py-8 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <BackButton />
        <p className="text-xs text-gray-400">
          분석일: {new Date(diagnostic.created_at).toLocaleDateString('ko-KR')}
        </p>
      </div>

      <DiagnosticReport report={report} isGuest={false} />
    </main>
  )
}

function BackButton() {
  return (
    <Link
      href="/dashboard/diagnostics"
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
      </svg>
      원고 진단으로 돌아가기
    </Link>
  )
}
