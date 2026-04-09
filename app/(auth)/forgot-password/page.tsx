'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold">
            Podwrite.ai
          </Link>
          <p className="mt-2 text-sm text-gray-600">비밀번호 재설정</p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
            <svg
              className="mx-auto mb-3 h-10 w-10 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <p className="font-medium text-gray-900">이메일을 확인해 주세요</p>
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-medium">{email}</span>으로<br />
              비밀번호 재설정 링크를 보냈습니다.
            </p>
            <p className="mt-3 text-xs text-gray-500">
              이메일이 오지 않으면 스팸함을 확인하거나<br />
              아래에서 다시 시도해 주세요.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-sm font-medium text-black hover:underline"
            >
              다시 보내기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">
              가입 시 사용한 이메일을 입력하면 재설정 링크를 보내드립니다.
            </p>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-black py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {loading ? '전송 중...' : '재설정 링크 보내기'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link href="/login" className="font-medium text-black hover:underline">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  )
}
