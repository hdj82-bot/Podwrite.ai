/**
 * POST /api/kdp/metadata
 *
 * Claude API로 한국어 프로젝트 정보 → KDP 영문 메타데이터 자동 생성
 *
 * body: { projectId, field: 'title' | 'description' | 'keywords' }
 *
 * 응답: { data: { value: string | string[] } }
 *
 * 인증: 필수, Pro 플랜 전용
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserWithProfile, createServerClient } from '@/lib/supabase-server'
import { callClaude } from '@/lib/claude'
import { checkPlanAccess } from '@/lib/plan-guard'

const schema = z.object({
  projectId: z.string().uuid(),
  field: z.enum(['title', 'description', 'keywords']),
})

// ── KDP 메타데이터 생성 프롬프트 ────────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional Amazon KDP book publishing consultant specializing in Korean-to-English book metadata localization.

Your role is to create compelling, KDP-compliant English metadata that will maximize discoverability and sales on Amazon.

Guidelines:
- Translate and adapt Korean titles/descriptions for Western readers, not literal translation
- Follow KDP content policies (no claims of "best-seller", no misleading metadata)
- Use natural, engaging English appropriate for the genre
- Optimize for Amazon search (include relevant keywords naturally)
- For descriptions: use proper HTML formatting (bold, italic, line breaks) as KDP allows
- Always output ONLY the requested field, nothing else`

function buildPrompt(
  field: string,
  title: string,
  genre: string | null,
  chapterTitles: string[],
  description: string | null,
): string {
  const context = `Korean book information:
Title: ${title}
Genre: ${genre ?? 'Not specified'}
Description: ${description ?? 'Not provided'}
Chapter structure:
${chapterTitles.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`

  switch (field) {
    case 'title':
      return `${context}

Generate an English book title (and optional subtitle) for Amazon KDP.
Format: "Main Title: Subtitle" (subtitle optional)
Requirements:
- Compelling and marketable for English-speaking readers
- Reflects the book's core theme and content
- Under 200 characters total
- Do NOT include the author name
Output ONLY the title, nothing else.`

    case 'description':
      return `${context}

Generate an Amazon KDP book description in English.
Requirements:
- Maximum 4000 characters
- Start with a hook that grabs attention
- Use <br> for line breaks, <b> for bold, <i> for italic (KDP HTML tags)
- Structure: Hook → Problem/Topic → What reader will learn/experience → Call to action
- Engaging and optimized for Amazon search
- Appropriate for the genre
Output ONLY the HTML-formatted description, nothing else.`

    case 'keywords':
      return `${context}

Generate exactly 7 Amazon KDP search keywords/phrases for this book.
Requirements:
- Based on BISAC category optimization
- Mix of broad and specific terms readers would search
- Each keyword/phrase: 1-50 characters
- Think about what English-speaking readers type when searching
Output ONLY a JSON array of 7 strings, e.g.: ["keyword1","keyword2","keyword3","keyword4","keyword5","keyword6","keyword7"]`

    default:
      return ''
  }
}

export async function POST(req: Request) {
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser || !profile) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const access = await checkPlanAccess(authUser.id, 'kdp')
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.reason ?? 'KDP 메타데이터 생성은 Pro 플랜 전용 기능입니다.' },
      { status: 403 },
    )
  }

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const supabase = await createServerClient()

  // 프로젝트 + 챕터 조회
  const { data: project } = await supabase
    .from('projects')
    .select('id, title, genre, description')
    .eq('id', body.projectId)
    .eq('user_id', authUser.id)
    .single()

  if (!project) {
    return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
  }

  const { data: chapters } = await supabase
    .from('chapters')
    .select('title, order_idx')
    .eq('project_id', body.projectId)
    .order('order_idx', { ascending: true })

  const chapterTitles = (chapters ?? []).map((c) => c.title)

  const prompt = buildPrompt(
    body.field,
    project.title,
    project.genre,
    chapterTitles,
    project.description,
  )

  try {
    const raw = await callClaude(prompt, SYSTEM_PROMPT, 1024)

    // keywords는 JSON 배열로 파싱
    if (body.field === 'keywords') {
      try {
        const match = raw.match(/\[[\s\S]*\]/)
        const keywords: string[] = match ? JSON.parse(match[0]) : []
        return NextResponse.json({ data: { value: keywords.slice(0, 7) } })
      } catch {
        // 파싱 실패 시 줄 분리로 폴백
        const lines = raw.split('\n').filter((l) => l.trim()).slice(0, 7)
        return NextResponse.json({ data: { value: lines } })
      }
    }

    return NextResponse.json({ data: { value: raw.trim() } })
  } catch (err) {
    console.error('[kdp/metadata] Claude API 오류:', err)
    return NextResponse.json({ error: 'AI 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
