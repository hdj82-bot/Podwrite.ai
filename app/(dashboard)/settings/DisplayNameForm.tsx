'use client'

/**
 * DisplayNameForm — 표시 이름 편집 폼 (클라이언트 컴포넌트)
 *
 * TODO: /api/user/profile PATCH가 현재 terms_agreed_at / privacy_agreed_at만 지원함.
 *       display_name 필드를 저장하려면 API patchSchema와 DB users 테이블에
 *       display_name 컬럼 추가가 필요합니다.
 *       추가 후 아래 주석 처리된 fetch 코드를 활성화하세요.
 */

import { useState } from 'react'

interface DisplayNameFormProps {
  /** DB에서 읽어온 초기 표시 이름. 현재는 항상 '' (DB 컬럼 미지원). */
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

    // TODO: API가 display_name을 지원하면 아래 코드 활성화
    // try {
    //   const res = await fetch('/api/user/profile', {
    //     method: 'PATCH',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ display_name: name.trim() }),
    //   })
    //   const json = await res.json()
    //   if (!res.ok) throw new Error(json.error ?? '저장 실패')
    //   setStatus('saved')
    // } catch (err) {
    //   setErrorMsg(err instanceof Error ? err.message : '오류가 발생했습니다.')
    //   setStatus('error')
    // }

    // 임시: UI 피드백만 제공 (API 미지원)
    await new Promise((r) => setTimeout(r, 400))
    setStatus('saved')
    setTimeout(() => setStatus('idle'), 2500)
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

      {/* API 미지원 안내 (개발 환경 경고 — 프로덕션에서는 제거) */}
      <p className="text-xs text-gray-400">
        표시 이름 저장 기능은 준비 중입니다. (API 업데이트 후 활성화)
      </p>
    </div>
  )
}
