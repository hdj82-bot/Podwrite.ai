/**
 * POST /api/selling/copy
 *
 * 플랫폼별 출판 카피 생성 (Pro 플랜 전용)
 *
 * Request body:
 *   {
 *     projectId: string (UUID)
 *     platform:  'bookk' | 'kyobo' | 'kdp'
 *     type:      'all' | 'title' | 'description' | 'keywords'
 *   }
 *
 * Response:
 *   {
 *     data: {
 *       titles?:      string[]  // 제목 후보 3개
 *       description?: string    // 소개 문구 (200자 이내)
 *       keywords?:    string[]  // 검색 키워드 5개
 *     }
 *   }
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserWithProfile, createServerClient } from '@/lib/supabase-server'
import { checkPlanAccess } from '@/lib/plan-guard'
import { callClaude } from '@/lib/claude'
import type { Platform } from '@/types'

const bodySchema = z.object({
  projectId:    z.string().uuid(),
  platform:     z.enum(['bookk', 'kyobo', 'kdp']),
  type:         z.enum(['all', 'title', 'description', 'keywords', 'author_bio']).default('all'),
  // 작가가 입력한 메모 (선택) — Claude 컨텍스트 보강
  coreContent:  z.string().max(300).optional(),
  targetReader: z.string().max(100).optional(),
  // 수정 요청 지시사항 (선택)
  revisionText: z.string().max(200).optional(),
})

// ── 플랫폼별 가이드라인 ──────────────────────────────────────────

const PLATFORM_GUIDE: Record<Platform, string> = {
  bookk: `플랫폼: 부크크 (국내 최대 POD 셀프 출판 플랫폼)
독자 성향: 한국어 독자, 니치 분야 관심도 높음, 가격 대비 가치 중시
제목 가이드:
  - 핵심 키워드를 앞부분에 배치 (검색 노출 극대화)
  - 독자의 고민 또는 결과를 암시하는 표현 활용
  - 30자 이내, 부제를 활용해 구체성 추가 가능
소개 문구 (200–500자):
  - 첫 문장에서 독자의 핵심 고민을 정확히 짚어라
  - 이 책을 읽으면 얻는 구체적 변화 2–3가지 명시
  - 감성적 어조보다 실용적·직접적 어조 선호
  - 부크크 권장 200–500자 엄수 (300자 내외 목표)
저자 소개: 권위와 공감을 동시에 전달 (1인칭 가능), 실제 경험담·숫자 활용
키워드 (한국어 5개): 장르, 주제, 독자층, 감정, 해결책 키워드 조합`,

  kyobo: `플랫폼: 교보문고 전자책 셀프 출판 (eBook)
독자 성향: 교양·실용 서적 선호, 품질과 신뢰도 중시, 완독률 높은 콘텐츠 추구
제목 가이드:
  - 전문성·신뢰감을 주는 어조 (과장된 자극적 표현 지양)
  - 저자 전문성 또는 독자 성장을 암시
  - 30자 이내, 명확하고 품격 있는 표현
소개 문구 (300–800자):
  - 책의 핵심 가치와 차별점을 첫 단락에 명확히 제시
  - 신뢰 어조: 통계, 사례, 인용 등으로 설득력 보강
  - 독자가 얻을 구체적 통찰 또는 스킬 2–3가지 언급
  - 교보문고 권장 300–800자 엄수 (500자 내외 목표)
저자 소개: 직함·경력·수상 등 공신력 있는 정보 우선, 독자와의 공감 포인트 포함
키워드 (한국어 5개): 교보문고 카테고리 분류어 + 독자 검색 패턴 기반`,

  kdp: `플랫폼: Amazon Kindle Direct Publishing (글로벌)
독자 성향: 영어권이지만 여기서는 한국어 KDP 타겟으로 작성
제목 가이드: 글로벌 마켓 고려, 간결하고 강렬한 표현
소개 문구: SEO 최적화, 키워드 자연 포함, 200자 이내
키워드: Amazon 검색 알고리즘 친화적, 영어 혼용 가능`,
}

// ── 시스템 프롬프트 ───────────────────────────────────────────────

function buildSystemPrompt(platform: Platform, type: string): string {
  const jsonSchema =
    type === 'all'
      ? `{
  "titles":      ["제목후보1", "제목후보2", "제목후보3"],
  "description": "플랫폼 권장 글자 수에 정확히 맞는 소개 문구",
  "author_bio":  "저자를 소개하는 2–3문장 (전문성·신뢰감 중심, 1인칭 가능)",
  "keywords":    ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"]
}`
      : type === 'title'
      ? `{ "titles": ["제목후보1", "제목후보2", "제목후보3"] }`
      : type === 'description'
      ? `{ "description": "플랫폼 권장 글자 수에 정확히 맞는 소개 문구" }`
      : type === 'author_bio'
      ? `{ "author_bio": "저자를 소개하는 2–3문장 (전문성·신뢰감 중심, 1인칭 가능)" }`
      : `{ "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"] }`

  const descLengthNote =
    platform === 'bookk'
      ? '⚠️ 소개 문구는 반드시 200–500자(공백 포함) 범위를 지켜야 합니다. 300자 내외를 목표로 하세요.'
      : platform === 'kyobo'
      ? '⚠️ 소개 문구는 반드시 300–800자(공백 포함) 범위를 지켜야 합니다. 500자 내외를 목표로 하세요.'
      : ''

  return `당신은 한국 셀프 출판 전문 카피라이터입니다. 베스트셀러급 판매 카피를 작성하는 것이 목표입니다.

${PLATFORM_GUIDE[platform]}

${descLengthNote}

글쓰기 원칙:
1. 독자의 고민(Pain Point)에서 시작해 해결(Gain)으로 이어지는 구조
2. 추상적 표현 대신 구체적 수치·사례·결과로 신뢰 구축
3. 각 플랫폼 독자의 언어와 어조에 맞게 톤 조정
4. 클리셰("당신의 삶을 바꿔줄", "필독서") 사용 금지
5. 제목 후보 3개는 서로 다른 컨셉(직접형·질문형·결과형)으로 작성

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없음):
${jsonSchema}`
}

// ── Route Handler ─────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── 인증 + Pro 플랜 확인 (plan-guard 사용) ──────────────────────
  const { authUser } = await getCurrentUserWithProfile()
  if (!authUser) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const guard = await checkPlanAccess(authUser.id, 'selling')
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.reason }, { status: 403 })
  }

  // ── 요청 파싱 ─────────────────────────────────────────────────
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const supabase = await createServerClient()

  // ── 프로젝트 조회 ─────────────────────────────────────────────
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, title, genre, description')
    .eq('id', body.projectId)
    .eq('user_id', authUser.id)
    .single()

  if (projectError || !project) {
    return NextResponse.json(
      { error: '프로젝트를 찾을 수 없거나 접근 권한이 없습니다.' },
      { status: 404 },
    )
  }

  // ── 챕터 목록 조회 (컨텍스트용) ─────────────────────────────
  const { data: chapters } = await supabase
    .from('chapters')
    .select('order_idx, title')
    .eq('project_id', body.projectId)
    .order('order_idx', { ascending: true })
    .limit(20)

  const chapterList = (chapters ?? [])
    .map((c) => `${c.order_idx}. ${c.title}`)
    .join('\n')

  // ── 프롬프트 구성 ─────────────────────────────────────────────
  const memoSection = [
    body.coreContent  ? `핵심 내용: ${body.coreContent}`   : null,
    body.targetReader ? `타겟 독자: ${body.targetReader}` : null,
  ].filter(Boolean).join('\n')

  const revisionSection = body.revisionText
    ? `\n[수정 요청]\n${body.revisionText}`
    : ''

  const userPrompt = `다음 책 정보를 바탕으로 ${PLATFORM_DISPLAY[body.platform]} 카피를 생성해 주세요.

[책 정보]
제목: ${project.title}
장르: ${project.genre ?? '미지정'}
소개: ${project.description ?? '없음'}
${memoSection ? `\n[작가 메모]\n${memoSection}` : ''}
[목차]
${chapterList || '목차 정보 없음'}
${revisionSection}
위 정보를 기반으로 플랫폼에 최적화된 카피를 JSON 형식으로 생성하세요.`

  // ── Claude 호출 ──────────────────────────────────────────────
  let rawResponse: string
  try {
    rawResponse = await callClaude(
      userPrompt,
      buildSystemPrompt(body.platform, body.type),
      1024,
    )
  } catch {
    return NextResponse.json({ error: '카피 생성 중 오류가 발생했습니다.' }, { status: 502 })
  }

  // ── JSON 파싱 ─────────────────────────────────────────────────
  try {
    const clean = extractJson(rawResponse)
    const parsed = JSON.parse(clean)

    return NextResponse.json({
      data: {
        titles:      Array.isArray(parsed.titles)            ? parsed.titles.filter(Boolean).slice(0, 3)      : undefined,
        description: typeof parsed.description === 'string'  ? parsed.description                              : undefined,
        author_bio:  typeof parsed.author_bio  === 'string'  ? parsed.author_bio                               : undefined,
        keywords:    Array.isArray(parsed.keywords)          ? parsed.keywords.filter(Boolean).slice(0, 5)    : undefined,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'AI 응답을 파싱하는 중 오류가 발생했습니다. 다시 시도해 주세요.' },
      { status: 500 },
    )
  }
}

// ── 유틸리티 ─────────────────────────────────────────────────────

const PLATFORM_DISPLAY: Record<Platform, string> = {
  bookk: '부크크',
  kyobo: '교보문고',
  kdp:   'Amazon KDP',
}

function extractJson(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) return codeBlock[1].trim()
  const jsonBlock = text.match(/\{[\s\S]*\}/)
  if (jsonBlock) return jsonBlock[0]
  return text.trim()
}
