/**
 * 맞춤법 교정 어댑터 — CLOVA Spell Checker (Naver Cloud Platform) 우선
 *
 * 환경 변수:
 *   CLOVA_SPELL_API_URL       예: https://naveropenapi.apigw.ntruss.com/v1/api-gate/grammar-checker
 *   CLOVA_API_KEY_ID          X-NCP-APIGW-API-KEY-ID
 *   CLOVA_API_KEY             X-NCP-APIGW-API-KEY
 *
 * 텍스트를 500자 단위로 분할하여 병렬 처리합니다.
 * 나라인포테크 계약 후 API URL 및 파싱 로직만 교체하세요.
 */

const CHUNK_SIZE = 500

export interface SpellCheckCorrection {
  /** 원본 오류 토큰 */
  original: string
  /** 교정 제안 (첫 번째 추천) */
  corrected: string
  /** 원본 텍스트 내 시작 오프셋 */
  offset: number
  /** 오류 유형 설명 */
  message: string
}

// ── 퍼블릭 API ───────────────────────────────────────────────────

/**
 * 텍스트 전체 맞춤법 교정
 *
 * @param text  교정할 전체 텍스트 (최대 50,000자)
 * @returns     교정 항목 배열
 */
export async function checkSpelling(text: string): Promise<SpellCheckCorrection[]> {
  if (!text.trim()) return []

  // 500자 단위로 청크 분할
  const chunks: Array<{ text: string; offset: number }> = []
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push({ text: text.slice(i, i + CHUNK_SIZE), offset: i })
  }

  // 청크별 병렬 교정
  const results = await Promise.allSettled(
    chunks.map(({ text: chunk, offset }) => checkChunk(chunk, offset)),
  )

  const corrections: SpellCheckCorrection[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      corrections.push(...result.value)
    }
    // 실패한 청크는 건너뜀 (전체 실패 방지)
  }

  return corrections
}

// ── 내부 ─────────────────────────────────────────────────────────

async function checkChunk(text: string, baseOffset: number): Promise<SpellCheckCorrection[]> {
  const apiUrl = process.env.CLOVA_SPELL_API_URL
  if (!apiUrl) {
    // CLOVA 미설정 시 빈 배열 반환 (개발/스테이징 환경 fallback)
    return []
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-NCP-APIGW-API-KEY-ID': process.env.CLOVA_API_KEY_ID!,
      'X-NCP-APIGW-API-KEY': process.env.CLOVA_API_KEY!,
    },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    // 일시적 오류는 빈 배열 반환 (전체 교정 중단 방지)
    return []
  }

  const data = await response.json()
  return parseApiResponse(data, baseOffset)
}

/**
 * CLOVA Grammar Checker API 응답 파싱
 *
 * 예상 응답 구조:
 * {
 *   "message": {
 *     "result": {
 *       "errata_count": 2,
 *       "errata": [
 *         {
 *           "token": "오류토큰",
 *           "suggestions": ["교정제안"],
 *           "startIdx": 5,
 *           "endIdx": 8,
 *           "type": "SPELLING",
 *           "help": "설명"
 *         }
 *       ]
 *     }
 *   }
 * }
 *
 * 실제 계약한 API 응답 구조가 다를 경우 이 함수만 수정하세요.
 */
function parseApiResponse(data: unknown, baseOffset: number): SpellCheckCorrection[] {
  if (!data || typeof data !== 'object') return []

  // CLOVA API 응답 구조 접근
  const result = (data as Record<string, unknown>)?.message as Record<string, unknown> | undefined
  const innerResult = result?.result as Record<string, unknown> | undefined
  const errata = innerResult?.errata

  if (!Array.isArray(errata)) return []

  return errata.map((item: Record<string, unknown>) => ({
    original: String(item.token ?? ''),
    corrected: Array.isArray(item.suggestions) && item.suggestions.length > 0
      ? String(item.suggestions[0])
      : String(item.token ?? ''),
    offset: (Number(item.startIdx) || 0) + baseOffset,
    message: String(item.help ?? item.type ?? '맞춤법 오류'),
  }))
}
