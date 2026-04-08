/**
 * KDP 프로젝트 레이아웃 — 서버 사이드 Pro 플랜 게이트
 *
 * 모든 /kdp/[projectId]/* 라우트에 적용됩니다.
 * - 비인증 → /login 리다이렉트
 * - Non-Pro → 업그레이드 안내 화면으로 교체
 * - Pro → {children} 렌더링
 *
 * 탭: [번역] / [메타데이터] / [제출 패키지] (page.tsx 내부에서 관리)
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Lock, Zap } from 'lucide-react'
import { getCurrentUserWithProfile } from '@/lib/supabase-server'

export default async function KdpProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { projectId: string }
}) {
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser) redirect('/login')

  // Pro 플랜 게이트 — 서버에서 검사하여 클라이언트 우회 불가
  if (!profile || profile.plan !== 'pro') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[70vh] px-6">
        <div className="max-w-sm w-full text-center space-y-6">
          {/* 아이콘 */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
            <Lock className="h-8 w-8 text-purple-600" />
          </div>

          {/* 안내 문구 */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-900">
              KDP 글로벌은 Pro 플랜 전용입니다
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Amazon KDP 제출용 한→영 번역, EPUB 생성, 메타데이터, 제출 패키지 ZIP은
              Pro 플랜에서만 이용할 수 있습니다.
            </p>
          </div>

          {/* 현재 플랜 안내 */}
          {profile && (
            <p className="text-xs text-gray-400">
              현재 플랜:{' '}
              <span className="font-semibold text-gray-600">
                {profile.plan === 'free' ? '무료' : '베이직'}
              </span>
            </p>
          )}

          {/* CTA */}
          <div className="space-y-3">
            <Link
              href="/settings/billing?plan=pro"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 text-sm font-semibold transition-colors"
            >
              <Zap className="h-4 w-4" />
              Pro로 업그레이드
            </Link>
            <Link
              href="/pricing"
              className="block text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors"
            >
              요금제 비교 보기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Pro 플랜 확인됨 — 하위 페이지 렌더링
  return <>{children}</>
}
