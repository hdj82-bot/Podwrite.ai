/**
 * Inngest 백그라운드 잡: 원고 진단 분석
 *
 * 이벤트: 'diagnostic/analyze'
 * 처리:
 *   1. Claude API로 원고 분석 (최대 8,000자)
 *   2. 분석 결과를 diagnostics 테이블에 저장
 *      - 비회원(user_id=null): expires_at = now + 7일 (자동 만료)
 *      - 회원: expires_at = null (영구 보존)
 *
 * POST /api/diagnostics 에서 즉시 반환 후 비동기로 실행됨
 */

import { inngest } from './client'
import { callClaude, DIAGNOSTIC_SYSTEM_PROMPT } from '@/lib/claude'
import { createServiceClient } from '@/lib/supabase-server'
import * as Sentry from '@sentry/nextjs'
import type { DiagnosticReport } from '@/types'

export const analyzeDiagnosticJob = inngest.createFunction(
  {
    id: 'analyze-diagnostic',
    name: '원고 진단 분석',
    concurrency: { limit: 10 },
    retries: 1,
  },
  { event: 'diagnostic/analyze' },
  async ({ event, step }) => {
    const { diagnosticId, textContent, wordCount, fileName } = event.data
    const supabase = createServiceClient()

    try {
      // ── 1. Claude 원고 분석 ─────────────────────────────────────────
      const report = await step.run('analyze-with-claude', async () => {
        const analysisText = textContent.slice(0, 8_000)

        const userPrompt = `다음 원고를 분석해 주세요.

[원고 정보]
- 파일명: ${fileName}
- 총 글자 수: ${textContent.length.toLocaleString()}자
- 단어 수: ${wordCount.toLocaleString()}개

[원고 내용 (최대 8,000자)]
${analysisText}

위 원고를 분석하여 지정된 JSON 형식으로만 응답하세요.`

        const rawResponse = await callClaude(userPrompt, DIAGNOSTIC_SYSTEM_PROMPT, 2048)
        const parsed = JSON.parse(extractJson(rawResponse))

        const result: DiagnosticReport = {
          strengths:       parsed.strengths       ?? [],
          weaknesses:      parsed.weaknesses      ?? [],
          suggestions:     parsed.suggestions     ?? [],
          platform_fit:    parsed.platform_fit    ?? {},
          overall_score:   Number(parsed.overall_score) || 0,
          word_count:      wordCount,
          estimated_pages: Math.ceil(wordCount / 250),
        }
        return result
      }) as DiagnosticReport

      // ── 2. 결과 저장 ────────────────────────────────────────────────
      // 비회원(user_id=null): expires_at = now + 7일 (스토리지 절약)
      // 회원: expires_at = null (영구 보존)
      await step.run('save-report', async () => {
        const { data: diagnostic } = await supabase
          .from('diagnostics')
          .select('user_id')
          .eq('id', diagnosticId)
          .single()

        const isGuest    = !diagnostic?.user_id
        const expiresAt  = isGuest
          ? new Date(Date.now() + 7 * 24 * 3_600_000).toISOString()
          : null

        const { error } = await supabase
          .from('diagnostics')
          .update({
            status:     'completed',
            report,
            expires_at: expiresAt,
          })
          .eq('id', diagnosticId)

        if (error) throw new Error(`진단 결과 저장 실패: ${error.message}`)
      })

      return { success: true, diagnosticId }
    } catch (error) {
      Sentry.captureException(error, {
        extra: { diagnosticId, fileName },
        tags:  { job: 'analyze-diagnostic' },
      })

      // 분석 실패 → failed 상태로 업데이트 (폴링에서 감지)
      await supabase
        .from('diagnostics')
        .update({ status: 'failed' })
        .eq('id', diagnosticId)
        .catch(() => {})

      throw error
    }
  },
)

// ── 유틸리티 ────────────────────────────────────────────────────────

/** Claude 응답에서 JSON 블록만 추출 */
function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text.trim()
}
