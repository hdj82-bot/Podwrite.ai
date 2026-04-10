/**
 * Inngest 이벤트 수신 엔드포인트
 *
 * Inngest Dev Server 또는 Inngest Cloud에서 이 라우트로 이벤트를 전달합니다.
 * 모든 inngest 함수를 여기에 등록합니다.
 */

import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { generateDocxJob } from '@/inngest/generate-docx'
import { generateEpubJob } from '@/inngest/generate-epub'
import { translateJob } from '@/inngest/translate'
import { billingCycleJob } from '@/inngest/billing-cycle'
import { analyzeDiagnosticJob } from '@/inngest/analyze-diagnostic'
import { generateKdpPackageJob } from '@/inngest/generate-kdp-package'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateDocxJob,
    generateEpubJob,
    translateJob,
    billingCycleJob,
    analyzeDiagnosticJob,
    generateKdpPackageJob,
  ],
})
