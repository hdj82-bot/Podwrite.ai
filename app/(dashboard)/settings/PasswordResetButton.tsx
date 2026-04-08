'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

interface PasswordResetButtonProps {
  email: string
}

export default function PasswordResetButton({ email }: PasswordResetButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'sent'>('idle')
  const supabase = createClient()

  async function handleReset() {
    setState('loading')
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/dashboard/settings`,
    })
    setState('sent')
  }

  if (state === 'sent') {
    return <span className="text-sm text-green-600">이메일을 확인해주세요</span>
  }

  return (
    <button
      onClick={handleReset}
      disabled={state === 'loading'}
      className="text-sm font-medium text-black hover:underline disabled:opacity-50"
    >
      {state === 'loading' ? '처리 중...' : '비밀번호 변경'}
    </button>
  )
}
