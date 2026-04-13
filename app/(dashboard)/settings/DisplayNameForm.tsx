'use client'

import { useState } from 'react'

interface DisplayNameFormProps {
  initialDisplayName?: string
}

type Status = 'idle' | 'saving' | 'saved' | 'error'

export default function DisplayNameForm({ initialDisplayName = '' }: DisplayNameFormProps) {
  const [name, setName] = useState(initialDisplayName)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const isDirty = name !== initialDisplayName
  const isEmpty = !name.trim()

  async function handleSave() {
    if (isEmpty || !isDirty) return

    setStatus('saving')
    setErrorMsg('')

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '저장 실패')
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2500)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '오류가 발생했습니다.')
      setStatus('error')
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (status !== 'idle') setStatus('idle')
          }}
          placeholder="표시 이름 입력"
          maxLength={50}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
          disabled={status === 'saving'}
        />
        <button
          onClick={handleSave}
          disabled={status === 'saving' || isEmpty || !isDirty}
          className="shrink-0 px-3.5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'saving' ? '저장 중…' : status === 'saved' ? '저장됨 ✓' : '저장'}
        </button>
      </div>

      {status === 'error' && errorMsg && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}

    </div>
  )
}
