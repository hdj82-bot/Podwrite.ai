import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

// ── GET /api/chapters/[id]/versions/[versionId] ───────────────
// 특정 버전의 TipTap JSON content 반환 (버전 복원 시 호출)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { id: chapterId, versionId } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  // 버전 소유권 검증: version → chapter → project → user_id
  const { data: version, error } = await supabase
    .from('chapter_versions')
    .select(`
      id,
      content,
      trigger,
      created_at,
      chapters!inner (
        id,
        projects!inner (
          user_id
        )
      )
    `)
    .eq('id', versionId)
    .eq('chapter_id', chapterId)
    .single()

  if (error || !version) {
    return NextResponse.json({ error: '버전을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 소유권 확인
  const chapter = (version.chapters as unknown as { projects: { user_id: string } })
  if (chapter.projects.user_id !== user.id) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({
    data: {
      id: version.id,
      content: version.content,
      trigger: version.trigger,
      created_at: version.created_at,
    },
  })
}
