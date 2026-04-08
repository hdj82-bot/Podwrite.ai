/**
 * Perplexity Sonar API 클라이언트
 *
 * 환경 변수:
 *   PERPLEXITY_API_KEY
 *
 * 모델: sonar (실시간 웹 검색 + 출처 포함)
 */
import type { SearchResultItem } from '@/types'

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions'
const PERPLEXITY_MODEL = 'sonar'

export interface PerplexitySearchResponse {
  /** Perplexity가 생성한 답변 (한국어 요약) */
  content: string
  /** 인용된 출처 목록 */
  sources: SearchResultItem[]
}

/**
 * Perplexity Sonar로 자료 검색
 *
 * @param query  검색 쿼리 (한국어 가능)
 * @returns      content + sources
 */
export async function searchWithPerplexity(query: string): Promise<PerplexitySearchResponse> {
  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify({
      model: PERPLEXITY_MODEL,
      messages: [
        {
          role: 'system',
          content:
            '당신은 책 집필을 위한 자료 조사 전문가입니다. 검색 결과를 바탕으로 핵심 정보를 한국어로 간결하게 요약하세요. 사실에 근거한 정보만 제공하고, 출처를 명확히 활용하세요.',
        },
        {
          role: 'user',
          content: query,
        },
      ],
      return_citations: true,
      return_related_questions: false,
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Perplexity API ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const content: string = data.choices?.[0]?.message?.content ?? ''

  // citations는 URL 문자열 배열로 반환됨
  const citations: string[] = data.citations ?? []

  const sources: SearchResultItem[] = citations.map((url, idx) => ({
    title: extractDomainTitle(url, idx),
    url,
    snippet: '',
  }))

  return { content, sources }
}

/** URL에서 도메인명을 추출해 출처 제목으로 사용 */
function extractDomainTitle(url: string, fallbackIdx: number): string {
  try {
    const { hostname } = new URL(url)
    return hostname.replace(/^www\./, '')
  } catch {
    return `출처 ${fallbackIdx + 1}`
  }
}
