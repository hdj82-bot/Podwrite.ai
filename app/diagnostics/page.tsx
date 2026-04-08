'use client'

/**
 * /diagnostics — 비회원 공개 원고 진단 페이지
 *
 * 단계:
 *  1. 파일 선택 (FileUploader)
 *  2. POST /api/diagnostics — session_token 발급 후 업로드
 *  3. 폴링 GET /api/diagnostics?id=xxx (x-session-token 헤더)
 *  4. status=completed → DiagnosticReport 표시
 *  5. 비회원: 결과 하단 가입 CTA + 가입 완료 후 자동 claim
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import FileUploader from '@/components/diagnostics/FileUploader'
import DiagnosticReport from '@/components/diagnostics/DiagnosticReport'
import type { Diagnostic, DiagnosticReport as ReportType } from '@/types'

type Step = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error'

const POLL_INTERVAL_MS = 2000
const POLL_MAX_ATTEMPTS = 90  // 최대 3분

const SESSION_TOKEN_KEY = 'pod_diag_session'
const DIAGNOSTIC_ID_KEY = 'pod_diag_id'

export default function PublicDiagnosticsPage() {
  const [step, setStep] = useState<Step>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [report, setReport] = useState<ReportType | null>(null)
  const [diagnosticId, setDiagnosticId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCount = useRef(0)

  // 이전 세션 결과 복원
  useEffect(() => {
    const savedId = localStorage.getItem(DIAGNOSTIC_ID_KEY)
    const savedToken = localStorage.getItem(SESSION_TOKEN_KEY)
    if (savedId && savedToken) {
      setDiagnosticId(savedId)
      startPolling(savedId, savedToken)
    }
    return () => stopPolling()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const startPolling = useCallback((id: string, token: string) => {
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
        const res = await fetch(`/api/diagnostics?id=${id}`, {
          headers: { 'x-session-token': token },
        })

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
          setErrorMsg('원고 분석에 실패했습니다. 파일 형식을 확인 후 다시 시도해 주세요.')
        }
        // pending/processing → 계속 폴링
      } catch {
        // 네트워크 오류는 계속 시도
      }
    }, POLL_INTERVAL_MS)
  }, [])

  async function handleFile(file: File) {
    setStep('uploading')
    setErrorMsg(null)

    // session_token 생성 (기존 재사용 또는 신규)
    let sessionToken = localStorage.getItem(SESSION_TOKEN_KEY)
    if (!sessionToken) {
      sessionToken = generateId()
      localStorage.setItem(SESSION_TOKEN_KEY, sessionToken)
    }

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
      localStorage.setItem(DIAGNOSTIC_ID_KEY, id)
      startPolling(id, sessionToken)
    } catch {
      setStep('error')
      setErrorMsg('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  function handleReset() {
    stopPolling()
    localStorage.removeItem(DIAGNOSTIC_ID_KEY)
    setStep('idle')
    setErrorMsg(null)
    setReport(null)
    setDiagnosticId(null)
  }

  // 가입 후 claim (로그인 상태에서 돌아왔을 때 처리)
  // claim은 /api/diagnostics/[id]/claim 으로 처리
  // 실제 실행은 로그인/가입 흐름이 완료된 후 대시보드에서 처리하므로
  // 여기서는 단순히 /signup?claim=DIAGNOSTIC_ID 로 연결
  const signupHref = diagnosticId
    ? `/signup?claim=${diagnosticId}`
    : '/signup'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 네비게이션 바 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <Link href="/" className="text-base font-bold tracking-tight text-gray-900">
            Podwrite.ai
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
              로그인
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium px-4 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              무료 가입
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* 헤더 */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">원고 진단</h1>
          <p className="text-sm text-gray-500">
            원고를 업로드하면 AI가 출판 준비도를 분석하고 플랫폼별 적합도를 알려드립니다
          </p>
          <p className="text-xs text-gray-400">회원가입 없이 무료로 이용할 수 있습니다</p>
        </div>

        {/* ── step: idle ── */}
        {step === 'idle' && (
          <FileUploader onFile={handleFile} />
        )}

        {/* ── step: uploading ── */}
        {step === 'uploading' && (
          <StatusCard
            icon="upload"
            title="파일 업로드 중..."
            description="잠시만 기다려 주세요."
          />
        )}

        {/* ── step: analyzing ── */}
        {step === 'analyzing' && (
          <StatusCard
            icon="analyzing"
            title="원고를 분석하고 있습니다"
            description="AI가 원고를 읽고 있습니다. 최대 1~2분이 소요됩니다."
          />
        )}

        {/* ── step: error ── */}
        {step === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-4">
            <p className="text-sm font-medium text-red-700">{errorMsg ?? '오류가 발생했습니다.'}</p>
            <button
              onClick={handleReset}
              className="inline-flex items-center px-5 py-2 text-sm font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* ── step: done ── */}
        {step === 'done' && report && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">분석 완료</h2>
              <button
                onClick={handleReset}
                className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
              >
                다른 원고 분석하기
              </button>
            </div>
            <DiagnosticReport
              report={report}
              isGuest
              onClaim={() => {
                // signup 페이지에서 claim 처리
              }}
            />
            {/* 비회원 전용 하단 CTA — DiagnosticReport 내부에도 있지만 중복 없애고 페이지 레벨에서 처리 */}
          </>
        )}
      </main>
    </div>
  )
}

// ── 내부 컴포넌트 ─────────────────────────────────────────────────

function StatusCard({
  icon,
  title,
  description,
}: {
  icon: 'upload' | 'analyzing'
  title: string
  description: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-10 flex flex-col items-center gap-4 text-center">
      {icon === 'analyzing' ? (
        <div className="w-14 h-14 rounded-full border-4 border-gray-200 border-t-black animate-spin" />
      ) : (
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-gray-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
      )}
      <div>
        <p className="text-base font-semibold text-gray-900">{title}</p>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
    </div>
  )
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // fallback
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
