/**
 * POST /api/emails/welcome
 *
 * 신규 가입 사용자에게 환영 이메일 발송
 *
 * 호출 시점:
 *   1. Supabase Auth 웹훅 (users 테이블 INSERT 트리거)
 *   2. 서버 액션에서 직접 호출
 *
 * 인증:
 *   Authorization: Bearer ${SUPABASE_WEBHOOK_SECRET}
 *
 * 요청 본문 (두 가지 형식 모두 지원):
 *   { to: string, name: string }
 *   또는 Supabase DB 웹훅: { type: "INSERT", record: { email: string, raw_user_meta_data: { name?: string } } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  // ── 인증 ────────────────────────────────────────────────────────────────
  const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET
  if (webhookSecret) {
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: '인증 실패' }, { status: 401 })
    }
  }

  // ── 페이로드 파싱 ────────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문' }, { status: 400 })
  }

  let to: string
  let name: string

  if (isSupabaseWebhookPayload(body)) {
    // Supabase DB 웹훅 형식
    if (body.type !== 'INSERT') {
      // INSERT 이벤트만 처리 (UPDATE/DELETE 무시)
      return NextResponse.json({ skipped: true })
    }
    to = body.record.email
    name = body.record.raw_user_meta_data?.name ?? to.split('@')[0]
  } else if (isDirectPayload(body)) {
    // 직접 호출 형식
    to = body.to
    name = body.name
  } else {
    return NextResponse.json({ error: '지원하지 않는 페이로드 형식' }, { status: 400 })
  }

  // ── 이메일 발송 ─────────────────────────────────────────────────────────
  try {
    await sendWelcomeEmail(to, name)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '이메일 발송 실패'
    console.error('[welcome-email] 발송 실패:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── 타입 가드 ───────────────────────────────────────────────────────────────

interface SupabaseWebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  record: {
    email: string
    raw_user_meta_data?: { name?: string }
  }
}

interface DirectPayload {
  to: string
  name: string
}

function isSupabaseWebhookPayload(v: unknown): v is SupabaseWebhookPayload {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return (
    typeof obj.type === 'string' &&
    typeof obj.record === 'object' &&
    obj.record !== null &&
    typeof (obj.record as Record<string, unknown>).email === 'string'
  )
}

function isDirectPayload(v: unknown): v is DirectPayload {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return typeof obj.to === 'string' && typeof obj.name === 'string'
}
