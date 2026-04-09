import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Supabase 세션 갱신 + 라우트 보호 미들웨어
 *
 * 보호 대상:
 *  - /dashboard/** → 로그인 필요
 *  - /editor/**    → 로그인 필요
 *
 * 리디렉션:
 *  - 비로그인 → /login?next=원래경로
 *  - 로그인 상태에서 /login, /signup 접근 → /dashboard
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabaseResponse.cookies.set(name, value, options as any),
          )
        },
      },
    },
  )

  // 세션 갱신 (항상 호출 필요 — 공식 문서 필수 패턴)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // 보호된 라우트 — 비로그인 시 /login으로
  // (dashboard) 그룹 레이아웃이 2차 검증하지만, 미들웨어에서 먼저 차단해 서버 컴포넌트 실행 비용 절감
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/editor') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/selling') ||
    pathname.startsWith('/kdp')

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 인증 페이지 — 이미 로그인 시 /dashboard로
  const isAuthPage = pathname === '/login' || pathname === '/signup'
  if (isAuthPage && user) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    dashboardUrl.search = ''
    return NextResponse.redirect(dashboardUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * 미들웨어 적용 대상:
     * - API Routes 제외 (/api/*)
     * - Static files 제외 (_next/static, _next/image, favicon 등)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|fonts|images).*)',
  ],
}
