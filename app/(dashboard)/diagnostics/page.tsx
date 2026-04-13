'use client'

/**
 * /dashboard/diagnostics — 회원 원고 진단 페이지
 *
 * - 마운트 시: pod_claim_pending (localStorage) 확인
 *   → 비회원 진단 결과를 로그인 후 claim 처리 + /dashboard/new 이동
 * - 새 원고 업로드 (FileUploader → 2단계 확인 UI)
 * - 분석 완료 시 DiagnosticReport 표시
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle2 } from 'lucide-react'
import FileUploader from '@/components/diagnostics/FileUploader'
import DiagnosticReport from '@/components/diagnostics/DiagnosticReport'
import { cn } from '@/lib/utils'
import type { Diagnostic, DiagnosticReport as ReportType } from '@/types'

type Step = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error'

const POLL_INTERVAL_MS = 3000
const POLL_MAX_ATTEMPTS = 60  // 최대 3분
const CLAIM_PENDING_KEY = 'pod_claim_pending'

export default function DashboardDiagnosticsPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [report, setReport] = useState<ReportType | null>(null)
  const [diagnosticId, setDiagnosticId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCount = useRef(0)

  // ── 비회원 → 회원 클레임 처리 ─────────────────────────────────
  // /diagnostics에서 "이 원고로 프로젝트 시작하기" 클릭 후 로그인하면
  // /login?next=/dashboard/diagnostics → 여기 도착, pod_claim_pending을 처리
  useEffect(() => {
    const handlePendingClaim = async () => {
      const raw = localStorage.getItem(CLAIM_PENDING_KEY)
      if (!raw) return

      let id: string, token: string
      try {
        const parsed = JSON.parse(raw) as { id: string; token: string }
        id = parsed.id
        token = parsed.token
      } catch {
        localStorage.removeItem(CLAIM_PENDING_KEY)
        return
      }

      try {
        const res = await fetch(`/api/diagnostics/${id}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_token: token }),
        })
        localStorage.removeItem(CLAIM_PENDING_KEY)
        if (res.ok) {
          // claim 성공 → 새 프로젝트 생성 페이지로
          router.push('/dashboard/new')
        }
      } catch {
        localStorage.removeItem(CLAIM_PENDING_KEY)
      }
    }

    handlePendingClaim()
  }, [router])

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const startPolling = useCallback((id: string) => {
    stopPolling()
    pollCount.current = 0
    setStep('analyzing')

    pollRef.current = setInterval(async () => {
      pollCount.current++

      if (pollCount.current > POLL_MAX_ATTEMPTS) {
        stopPolling()
        setStep('error')
        setErrorMsg('분석 시간이 초과되었습니다. 다시 시도해 주세요.')
        return
      }

      try {
        const res = await fetch(`/api/diagnostics?id=${id}`)

        if (!res.ok) {
          stopPolling()
          setStep('error')
          setErrorMsg('분석 결과를 불러오는 중 오류가 발생했습니다.')
          return
        }

        const json = await res.json()
        const diagnostic: Diagnostic = json.data

        if (diagnostic.status === 'completed' && diagnostic.report) {
          stopPolling()
          setReport(diagnostic.report as ReportType)
          setStep('done')
        } else if (diagnostic.status === 'failed') {
          stopPolling()
          setStep('error')
          setErrorMsg('원고 분석에 실패했습니다. 파일을 확인 후 다시 시도해 주세요.')
        }
      } catch {
        // 네트워크 오류 → 재시도
      }
    }, POLL_INTERVAL_MS)
  }, [])

  async function handleFile(file: File) {
    setStep('uploading')
    setErrorMsg(null)

    const sessionToken = crypto.randomUUID()

    const formData = new FormData()
    formData.append('file', file)
    formData.append('session_token', sessionToken)

    try {
      const res = await fetch('/api/diagnostics', { method: 'POST', body: formData })
      const json = await res.json()

      if (!res.ok) {
        setStep('error')
        setErrorMsg(json.error ?? '업로드 중 오류가 발생했습니다.')
        return
      }

      const id: string = json.data.id
      setDiagnosticId(id)
      startPolling(id)
    } catch {
      setStep('error')
      setErrorMsg('서버에 연결할 수 없습니다.')
    }
  }

  function handleReset() {
    stopPolling()
    setStep('idle')
    setErrorMsg(null)
    setReport(null)
    setDiagnosticId(null)
  }

  return (
    <main className="flex-1 px-6 py-8 max-w-3xl">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">원고 진단</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            원고 파일을 업로드하면 AI가 출판 준비도를 분석합니다
          </p>
        </div>
        {(step === 'done' || step === 'error') && (
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
          >
            새 분석
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* idle */}
        {step === 'idle' && (
          <FileUploader onFile={handleFile} />
        )}

        {/* uploading / analyzing */}
        {(step === 'uploading' || step === 'analyzing') && (
          <AnalysisSteps step={step} />
        )}

        {/* error */}
        {step === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-4">
            <p className="text-sm font-medium text-red-700">
              {errorMsg ?? '오류가 발생했습니다.'}
            </p>
            <button
              onClick={handleReset}
              className="inline-flex items-center px-5 py-2 text-sm font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* done */}
        {step === 'done' && report && (
          <>
            {diagnosticId && (
              <p className="text-xs text-gray-400 text-right">
                진단 ID:{' '}
                <Link
                  href={`/dashboard/diagnostics/${diagnosticId}`}
                  className="underline hover:text-gray-600"
                >
                  {diagnosticId.slice(0, 8)}…
                </Link>
              </p>
            )}
            <DiagnosticReport report={report} isGuest={false} />
          </>
        )}
      </div>
    </main>
  )
}

function AnalysisSteps({ step }: { step: 'uploading' | 'analyzing' }) {
  const statuses = step === 'uploading'
    ? ['active', 'pending', 'pending'] as const
    : ['done', 'active', 'pending'] as const
  const labels = ['파일 업로드', 'AI 분석 중', '결과 생성']

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col items-center gap-6">
      <div className="w-full max-w-xs">
        <div className="flex items-center">
          <StepCircle status={statuses[0]} />
          <div className={cn('flex-1 h-px', statuses[0] === 'done' ? 'bg-gray-400' : 'bg-gray-200')} />
          <StepCircle status={statuses[1]} />
          <div className={cn('flex-1 h-px', statuses[1] === 'done' ? 'bg-gray-400' : 'bg-gray-200')} />
          <StepCircle status={statuses[2]} />
        </div>
        <div className="grid grid-cols-3 mt-2">
          {labels.map((label, i) => (
            <span
              key={i}
              className={cn(
                'text-xs',
                i === 0 ? 'text-left' : i === 2 ? 'text-right' : 'text-center',
                statuses[i] === 'done' && 'text-green-600 font-medium',
                statuses[i] === 'active' && 'text-gray-900 font-semibold',
                statuses[i] === 'pending' && 'text-gray-400',
              )}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-900">
          {step === 'uploading' ? '파일을 업로드하고 있습니다' : '원고를 분석하고 있습니다'}
        </p>
        <p className="text-xs text-gray-400 mt-1">약 30–60초 소요</p>
      </div>
    </div>
  )
}

function StepCircle({ status }: { status: 'done' | 'active' | 'pending' }) {
  return (
    <div
      className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
        status === 'done' && 'bg-green-50 ring-1 ring-green-200',
        status === 'active' && 'bg-gray-900',
        status === 'pending' && 'bg-gray-100',
      )}
    >
      {status === 'done' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
      {status === 'active' && <Loader2 className="w-4 h-4 text-white animate-spin" />}
      {status === 'pending' && <span className="w-2.5 h-2.5 rounded-full bg-gray-300 block" />}
    </div>
  )
}
