/**
 * Claude API 클라이언트 + 모드별 시스템 프롬프트
 *
 * 환경 변수:
 *   ANTHROPIC_API_KEY
 *
 * 사용 모델: claude-sonnet-4-6
 */
import type { AIChatMode } from '@/types'

// ── 상수 ─────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_VERSION = '2023-06-01'

// ── 모드별 시스템 프롬프트 ────────────────────────────────────────

/** AI 채팅 스트리밍에 사용하는 모드 (맞춤법·검색은 별도 API) */
export type StreamingChatMode = Extract<AIChatMode, 'writing' | 'outline' | 'style'>

const SYSTEM_PROMPTS: Record<StreamingChatMode, string> = {
  writing: `당신은 한국어 책 집필을 돕는 AI 보조 작가입니다.
작가의 창작 의도와 개성을 최대한 보존하면서 집필을 지원합니다.

역할 지침:
- 작가의 문체, 어조, 표현 방식을 분석하고 일관성을 유지합니다
- 구체적이고 실용적인 문장·단락 제안을 제공합니다
- 내러티브 흐름, 캐릭터 일관성, 주제 전개를 고려합니다
- 제안한 내용에 대해 간략한 이유를 덧붙입니다
- 모든 AI 제안은 작가가 최종 판단해야 함을 인지합니다

출력 형식:
- 한국어로만 응답합니다
- 제안 내용은 명확하게 구분하여 제시합니다
- 길이는 요청에 적절하게 조절합니다`,

  outline: `당신은 책의 목차와 구성을 기획하는 전문 편집자입니다.
한국 출판 시장과 플랫폼 특성(부크크, 교보문고, Amazon KDP)을 잘 알고 있습니다.

역할 지침:
- 장르, 타겟 독자, 예상 분량에 맞는 목차 구조를 제안합니다
- 각 챕터의 핵심 내용, 예상 분량, 서사적 역할을 명시합니다
- 도입-전개-결말의 논리적 흐름과 독자 몰입감을 고려합니다
- 플랫폼별 최적 분량과 구성 관례를 반영합니다
- 기존 목차가 있을 경우 구체적인 개선안을 제시합니다

출력 형식:
- 한국어로만 응답합니다
- 목차는 번호 구조(1장, 1.1 등)로 정리합니다
- 각 항목에 한 줄 요약을 포함합니다`,

  style: `당신은 한국어 문체를 교열하는 전문 교정자입니다.
맞춤법, 띄어쓰기, 문장 구조, 어휘 선택, 표현의 자연스러움을 종합적으로 교정합니다.

역할 지침:
- 원문의 의미와 작가의 의도를 최우선으로 보존합니다
- 어색한 표현, 반복, 불필요한 수동태를 개선합니다
- 한국어 문장 호흡과 리듬감을 고려합니다
- 각 교정 사항에 대해 이유를 간략히 설명합니다
- 원문과 교정문을 명확히 구분하여 제시합니다

출력 형식:
- 한국어로만 응답합니다
- [원문] → [교정문] (이유) 형식으로 제시합니다
- 전체 교정문도 별도로 제공합니다`,
}

// ── 타입 ─────────────────────────────────────────────────────────

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamUsage {
  input_tokens: number
  output_tokens: number
}

// ── 헬퍼 ─────────────────────────────────────────────────────────

function buildHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY!,
    'anthropic-version': ANTHROPIC_VERSION,
  }
}

// ── 스트리밍 채팅 ─────────────────────────────────────────────────

/**
 * Claude 스트리밍 응답을 SSE 텍스트 델타 스트림으로 변환
 *
 * 클라이언트 SSE 형식:
 *   data: {"text":"..."}   — 텍스트 청크
 *   data: [DONE]           — 스트림 종료
 *
 * @param messages  대화 히스토리
 * @param mode      집필모드
 * @param onUsage   실제 토큰 사용량 콜백 (스트림 종료 후 호출)
 */
export function streamClaudeChat(
  messages: ClaudeMessage[],
  mode: StreamingChatMode,
  onUsage: (usage: StreamUsage) => void,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      let response: Response

      try {
        response = await fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: 4096,
            stream: true,
            system: SYSTEM_PROMPTS[mode],
            messages,
          }),
        })
      } catch (err) {
        controller.error(err)
        return
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        controller.error(new Error(`Claude API ${response.status}: ${errorText}`))
        return
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let inputTokens = 0
      let outputTokens = 0

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (!raw) continue

            try {
              const event = JSON.parse(raw)

              switch (event.type) {
                case 'message_start':
                  inputTokens = event.message?.usage?.input_tokens ?? 0
                  break

                case 'content_block_delta':
                  if (event.delta?.type === 'text_delta') {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`),
                    )
                  }
                  break

                case 'message_delta':
                  outputTokens = event.usage?.output_tokens ?? 0
                  break

                case 'message_stop':
                  onUsage({ input_tokens: inputTokens, output_tokens: outputTokens })
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  break
              }
            } catch {
              // JSON 파싱 실패 → 무시
            }
          }
        }
      } finally {
        reader.releaseLock()
        controller.close()
      }
    },
  })
}

// ── 단건 호출 (비스트리밍) ────────────────────────────────────────

/**
 * Claude 단건 호출 — 원고 진단 등 구조화된 응답이 필요할 때 사용
 *
 * @param userPrompt  사용자 메시지
 * @param system      시스템 프롬프트
 * @param maxTokens   최대 출력 토큰 (기본 2048)
 */
export async function callClaude(
  userPrompt: string,
  system: string,
  maxTokens = 2048,
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Claude API ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  return (data.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
}

// ── 원고 진단 시스템 프롬프트 ────────────────────────────────────

export const DIAGNOSTIC_SYSTEM_PROMPT = `당신은 한국 출판 전문가이자 원고 진단 컨설턴트입니다.
제출된 원고를 분석하여 아래 JSON 형식으로만 응답하세요.

분석 기준:
- 부크크(Bookk), 교보문고 셀프 출판, Amazon KDP 각 플랫폼 적합성
- 한국어 독자 대상 원고 품질 (문체, 구성, 완성도)
- 장점과 개선 가능한 부분을 균형 있게 제시

응답 형식 (JSON만 출력, 다른 텍스트 없음):
{
  "strengths": ["장점1", "장점2", "장점3"],
  "weaknesses": ["개선점1", "개선점2", "개선점3"],
  "suggestions": ["제안1", "제안2", "제안3"],
  "platform_fit": {
    "bookk": { "score": 0~100, "reason": "한 줄 이유" },
    "kyobo": { "score": 0~100, "reason": "한 줄 이유" },
    "kdp":   { "score": 0~100, "reason": "한 줄 이유" }
  },
  "overall_score": 0~100,
  "word_count": 실제단어수,
  "estimated_pages": 예상쪽수
}`
