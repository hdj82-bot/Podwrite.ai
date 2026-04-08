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
import { NextResponse } from 'next/server'
import { getCurrentUser, createServiceClient } from '@/lib/supabase-server'
import { callClaude, DIAGNOSTIC_SYSTEM_PROMPT } from '@/lib/claude'
import type { DiagnosticReport } from '@/types'

// Supabase Storage 버킷명
const STORAGE_BUCKET = 'diagnostics'
// 최대 파일 크기: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024
// 허용 MIME 타입 / 확장자 (텍스트 추출 가능한 형식만)
const ALLOWED_TYPES = ['text/plain', 'text/markdown', 'application/octet-stream']

// ── POST: 원고 업로드 + 진단 ──────────────────────────────────────

export async function POST(req: Request) {
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

  // ── 4. Claude 분석 (동기 — Vercel 60초 제한 유의) ────────────
  // 원고가 긴 경우 앞 8,000자만 분석 (컨텍스트 절약)
  const analysisText = textContent.slice(0, 8_000)
  const wordCount = countKoreanWords(textContent)

  const userPrompt = `다음 원고를 분석해 주세요.

[원고 정보]
- 파일명: ${file.name}
- 총 글자 수: ${textContent.length.toLocaleString()}자
- 단어 수: ${wordCount.toLocaleString()}개

[원고 내용 (최대 8,000자)]
${analysisText}

위 원고를 분석하여 지정된 JSON 형식으로만 응답하세요.`

  let report: DiagnosticReport | null = null

  try {
    const rawResponse = await callClaude(userPrompt, DIAGNOSTIC_SYSTEM_PROMPT, 2048)
    const parsed = JSON.parse(extractJson(rawResponse))

    report = {
      strengths: parsed.strengths ?? [],
      weaknesses: parsed.weaknesses ?? [],
      suggestions: parsed.suggestions ?? [],
      platform_fit: parsed.platform_fit ?? {},
      overall_score: Number(parsed.overall_score) || 0,
      word_count: wordCount,
      estimated_pages: Math.ceil(wordCount / 250), // 한국어 기준 페이지당 약 250단어
    }
  } catch (err) {
    // Claude 분석 실패 → failed 상태로 업데이트
    await supabase
      .from('diagnostics')
      .update({ status: 'failed' })
      .eq('id', diagnostic.id)

    return NextResponse.json({ error: '원고 분석 중 오류가 발생했습니다.' }, { status: 502 })
  }

  // ── 5. 결과 저장 ──────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from('diagnostics')
    .update({ status: 'completed', report })
    .eq('id', diagnostic.id)

  if (updateError) {
    return NextResponse.json({ error: '진단 결과 저장 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({
    data: { id: diagnostic.id, status: 'completed' },
  })
}

// ── GET: 진단 상태·결과 폴링 ─────────────────────────────────────

export async function GET(req: Request) {
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

/** Claude 응답에서 JSON 블록만 추출 */
function extractJson(text: string): string {
  // ```json ... ``` 블록 처리
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  // 중괄호로 시작하는 JSON 직접 추출
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text.trim()
}
