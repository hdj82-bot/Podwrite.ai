import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { sendWelcomeEmail } from '@/lib/email'

/**
 * OAuth / 이메일 인증 콜백 처리
 * Supabase가 인증 완료 후 이 URL로 리디렉션함
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          },
        },
      },
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const user = data?.user
      const isRecovery = next === '/reset-password'

      // 신규 가입 환영 이메일 — recovery(비밀번호 재설정) 흐름에선 건너뜀
      if (!isRecovery && user?.email) {
        try {
          const serviceClient = createServiceClient()
          const { data: profile } = await serviceClient
            .from('users')
            .select('created_at, name')
            .eq('id', user.id)
            .single()

          if (profile) {
            const ageMs = Date.now() - new Date(profile.created_at).getTime()
            if (ageMs < 30_000) {
              const name =
                profile.name ??
                (user.user_metadata?.name as string | undefined) ??
                user.email.split('@')[0]
              sendWelcomeEmail(user.email, name).catch(() => {})
            }
          }
        } catch {
          // 신규 가입 판단 실패는 무시
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // 오류 시 로그인 페이지로
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
