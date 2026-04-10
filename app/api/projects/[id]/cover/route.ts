/**
 * POST /api/projects/[id]/cover
 *
 * multipart/form-data 표지 이미지 수신
 *   → Supabase Storage 업로드 (covers/{projectId}/{timestamp}.{ext})
 *   → projects.cover_image_url 업데이트
 *
 * 허용 형식: JPEG / PNG
 * 최대 크기: 10 MB
 * 인증: 필수 (본인 프로젝트만)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

const MAX_FILE_SIZE  = 10 * 1024 * 1024           // 10 MB
const ALLOWED_TYPES  = ['image/jpeg', 'image/png'] as const
const STORAGE_BUCKET = 'covers'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const supabase = await createServerClient()

  // ── 인증 확인 ────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  // ── 프로젝트 소유권 확인 ──────────────────────────────────────────────
  // Storage 업로드는 RLS가 없으므로, 앞에서 직접 소유권 검증
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
  }

  // ── FormData 파싱 ────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '파일 업로드 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: '파일을 첨부해 주세요.' }, { status: 400 })
  }

  // ── 파일 검증 ────────────────────────────────────────────────────────
  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: 'JPEG 또는 PNG 파일만 업로드할 수 있습니다.' },
      { status: 400 },
    )
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: '파일 크기는 10MB 이하여야 합니다.' },
      { status: 400 },
    )
  }

  // ── Supabase Storage 업로드 ───────────────────────────────────────────
  const ext         = file.type === 'image/png' ? 'png' : 'jpg'
  const storagePath = `${projectId}/${Date.now()}.${ext}`
  const buffer      = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('[cover] Storage upload error:', uploadError.message)
    return NextResponse.json({ error: '이미지 업로드 중 오류가 발생했습니다.' }, { status: 500 })
  }

  // ── 공개 URL 획득 → projects 테이블 업데이트 ─────────────────────────
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath)

  const { data: updated, error: updateError } = await supabase
    .from('projects')
    .update({
      cover_image_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .eq('user_id', user.id)
    .select('id, cover_image_url')
    .single()

  if (updateError || !updated) {
    console.error('[cover] DB update error:', updateError?.message)
    return NextResponse.json({ error: '표지 URL 저장 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ data: updated }, { status: 201 })
}
