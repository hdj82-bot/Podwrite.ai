/**
 * /api/diagnostics
 *
 * POST — 원고 파일 업로드 + Claude 진단 분석
 *   - 비회원 가능 (session_token으로 임시 저장)
 *   - 파일 → Supabase Storage (diagnostics 버킷)
 *   - Claude로 분석 후 report(jsonb) 저장
 *
 * GET  — 진단 상태·결과 폴링
 *   모드 A: ?id=UUID               본인 확인: 인증 사용자(user_id 일치) 또는 x-session-token 헤더
 *   모드 B: ?token=SESSION_TOKEN   session_token으로 최신 진단 직접 조회 (비회원 폴링용)
 *
 * 요청 (POST, FormData):
 *   file           File        원고 파일 (.txt / .md — 바이너리는 텍스트 추출 불포함)
 *   session_token  string      클라이언트 생성 UUID (비회원 식별자)
 *
 * 응답 (POST):
 *   { data: { id, status } }
 *
 * 응답 (GET):
 *   { data: { id, status, report } }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, createServiceClient } from '@/lib/supabase-server'
import { diagnosticsRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { inngest } from '@/inngest/client'

// Supabase Storage 버킷명
const STORAGE_BUCKET = 'diagnostics'
// 최대 파일 크기: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024
// 허용 MIME 타입 / 확장자 (텍스트 추출 가능한 형식만)
const ALLOWED_TYPES = ['text/plain', 'text/markdown', 'application/octet-stream']

// ── POST: 원고 업로드 + 진단 ──────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Rate Limiting (IP 기반, 분당 1회) ───────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'anon'
  const { success, reset } = await diagnosticsRateLimit.limit(ip)
  if (!success) return rateLimitResponse(reset)

  // 비회원도 허용 — authUser가 없으면 session_token만 사용
  const authUser = await getCurrentUser()

  // FormData 파싱
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '파일 업로드 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const sessionToken = formData.get('session_token') as string | null

  if (!file) {
    return NextResponse.json({ error: '파일을 첨부해 주세요.' }, { status: 400 })
  }
  if (!sessionToken || sessionToken.length < 10) {
    return NextResponse.json({ error: 'session_token이 필요합니다.' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: '파일 크기는 5MB 이하여야 합니다.' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(txt|md)$/i)) {
    return NextResponse.json(
      { error: '지원하지 않는 파일 형식입니다. .txt 또는 .md 파일을 업로드하세요.' },
      { status: 400 },
    )
  }

  // Service client (RLS 우회 — 비회원도 진단 레코드 생성 가능)
  const supabase = createServiceClient()

  // ── 1. 파일 텍스트 추출 ───────────────────────────────────────
  const buffer = await file.arrayBuffer()
  const textContent = new TextDecoder('utf-8', { fatal: false }).decode(buffer).trim()

  if (textContent.length < 100) {
    return NextResponse.json(
      { error: '원고 내용이 너무 짧습니다. 최소 100자 이상의 텍스트가 필요합니다.' },
      { status: 400 },
    )
  }

  // ── 2. Supabase Storage 업로드 ───────────────────────────────
  const storagePath = `${sessionToken}/${Date.now()}_${encodeFileName(file.name)}`

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || 'text/plain',
      upsert: false,
    })

  if (uploadError) {
    // Storage 업로드 실패해도 진단은 계속 (경로 없이 진행)
    console.error('[diagnostics] Storage upload error:', uploadError.message)
  }

  // ── 3. 진단 레코드 생성 (pending) ───────────────────────────
  const { data: diagnostic, error: insertError } = await supabase
    .from('diagnostics')
    .insert({
      user_id: authUser?.id ?? null,
      session_token: sessionToken,
      file_storage_path: uploadError ? null : storagePath,
      status: 'processing',
    })
    .select('id')
    .single()

  if (insertError || !diagnostic) {
    return NextResponse.json({ error: '진단 레코드 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }

  // ── 4. Inngest 비동기 분석 이벤트 전송 ──────────────────────────
  // Claude 분석은 Inngest 백그라운드 잡(analyze-diagnostic)에서 처리
  // → POST는 즉시 반환, 클라이언트는 GET 폴링으로 완료 여부 확인
  const wordCount = countKoreanWords(textContent)

  await inngest.send({
    name: 'diagnostic/analyze',
    data: {
      diagnosticId: diagnostic.id,
      textContent,
      wordCount,
      fileName: file.name,
    },
  })

  return NextResponse.json({
    data: { id: diagnostic.id, status: 'processing' },
  })
}

// ── GET: 진단 상태·결과 폴링 ─────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const token = searchParams.get('token')   // 비회원 폴링: session_token 직접 전달

  if (!id && !token) {
    return NextResponse.json({ error: 'id 또는 token 파라미터가 필요합니다.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // ── 모드 B: ?token=SESSION_TOKEN ─────────────────────────────
  // session_token으로 최신 진단을 바로 조회 — 별도 인증 불필요
  if (token && !id) {
    const { data: diagnostic, error } = await supabase
      .from('diagnostics')
      .select('id, status, report')
      .eq('session_token', token)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !diagnostic) {
      return NextResponse.json({ error: '진단을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ data: diagnostic })
  }

  // ── 모드 A: ?id=UUID ─────────────────────────────────────────
  const { data: diagnostic, error } = await supabase
    .from('diagnostics')
    .select('id, status, report, user_id, session_token')
    .eq('id', id!)
    .single()

  if (error || !diagnostic) {
    return NextResponse.json({ error: '진단을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 접근 권한 확인: 인증 사용자(user_id 일치) 또는 x-session-token 헤더
  const authUser = await getCurrentUser()
  const headerToken = req.headers.get('x-session-token')

  const isOwner = authUser && diagnostic.user_id === authUser.id
  const hasSessionToken = headerToken && diagnostic.session_token === headerToken
  // ?token 쿼리도 id 모드에서 fallback으로 허용
  const hasQueryToken = token && diagnostic.session_token === token

  if (!isOwner && !hasSessionToken && !hasQueryToken) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  return NextResponse.json({
    data: {
      id: diagnostic.id,
      status: diagnostic.status,
      report: diagnostic.report,
    },
  })
}

// ── 유틸리티 ──────────────────────────────────────────────────────

function encodeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_').slice(0, 100)
}

function countKoreanWords(text: string): number {
  // 한국어: 어절(띄어쓰기 단위) 기준
  return text.split(/\s+/).filter((w) => w.length > 0).length
}

