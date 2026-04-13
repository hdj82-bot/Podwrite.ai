'use client'

/**
 * /dashboard/settings/writing — 글쓰기 환경설정 페이지
 *
 * 섹션:
 *   1. 목표 설정  — 일일 목표 단어 수, 목표 달성 알림
 *   2. 에디터 환경 — 글꼴 크기, 집중 모드, 자동저장 간격
 *   3. 기본 설정  — 기본 플랫폼, 기본 장르
 *
 * 저장: localStorage `pod_writing_prefs` (Supabase 저장 없음)
 */

import { useEffect, useState } from 'react'
import { getWritingPrefs, saveWritingPrefs } from '@/lib/writing-prefs'
import type { WritingPrefs } from '@/lib/writing-prefs'
import { cn } from '@/lib/utils'

// ── 토글 컴포넌트 ─────────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  id: string
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
        checked ? 'bg-gray-900' : 'bg-gray-200',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

// ── 라벨 + 서브텍스트 행 ──────────────────────────────────────────────
function SettingRow({
  label,
  sub,
  htmlFor,
  children,
}: {
  label: string
  sub?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-800 cursor-pointer">
          {label}
        </label>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

const inputCls =
  'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900'

export default function WritingPrefsPage() {
  const [prefs, setPrefs] = useState<WritingPrefs | null>(null)
  const [saved, setSaved] = useState(false)

  // 클라이언트에서만 localStorage 읽기
  useEffect(() => {
    setPrefs(getWritingPrefs())
  }, [])

  if (!prefs) return null   // hydration 전 렌더 방지

  function set<K extends keyof WritingPrefs>(key: K, value: WritingPrefs[K]) {
    setPrefs((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  function handleSave() {
    if (!prefs) return
    saveWritingPrefs(prefs)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <main className="space-y-4">

      {/* ── 섹션 1: 목표 설정 ────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-1 divide-y divide-gray-100">
        <h3 className="font-semibold text-gray-800 pb-3">목표 설정</h3>

        <SettingRow
          label="일일 목표 단어 수"
          sub="하루에 목표로 하는 집필 단어 수"
          htmlFor="daily-goal"
        >
          <div className="flex items-center gap-1.5">
            <input
              id="daily-goal"
              type="number"
              min={0}
              max={99999}
              step={100}
              value={prefs.dailyWordGoal}
              onChange={(e) =>
                set('dailyWordGoal', Math.max(0, parseInt(e.target.value, 10) || 0))
              }
              className={cn(inputCls, 'w-24 text-right tabular-nums')}
            />
            <span className="text-sm text-gray-400">자</span>
          </div>
        </SettingRow>

        <SettingRow
          label="목표 달성 알림"
          sub="일일 목표 달성 시 브라우저 알림 표시"
          htmlFor="goal-notif"
        >
          <Toggle
            id="goal-notif"
            checked={prefs.goalNotification}
            onChange={(v) => set('goalNotification', v)}
          />
        </SettingRow>
      </section>

      {/* ── 섹션 2: 에디터 환경 ─────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-1 divide-y divide-gray-100">
        <h3 className="font-semibold text-gray-800 pb-3">에디터 환경</h3>

        <SettingRow
          label="기본 글꼴 크기"
          sub="에디터에서 사용할 기본 글자 크기"
          htmlFor="font-size"
        >
          <select
            id="font-size"
            value={prefs.fontSize}
            onChange={(e) => set('fontSize', parseInt(e.target.value, 10) as 14 | 16 | 18)}
            className={inputCls}
          >
            <option value={14}>14px — 작게</option>
            <option value={16}>16px — 기본</option>
            <option value={18}>18px — 크게</option>
          </select>
        </SettingRow>

        <SettingRow
          label="집중 모드 기본값"
          sub="에디터 진입 시 사이드바 자동 숨김"
          htmlFor="focus-mode"
        >
          <Toggle
            id="focus-mode"
            checked={prefs.focusModeDefault}
            onChange={(v) => set('focusModeDefault', v)}
          />
        </SettingRow>

        <SettingRow
          label="자동저장 간격"
          sub="마지막 입력 이후 자동으로 저장하는 주기"
          htmlFor="autosave"
        >
          <select
            id="autosave"
            value={prefs.autosaveInterval}
            onChange={(e) =>
              set('autosaveInterval', parseInt(e.target.value, 10) as 30 | 60 | 180)
            }
            className={inputCls}
          >
            <option value={30}>30초</option>
            <option value={60}>1분</option>
            <option value={180}>3분</option>
          </select>
        </SettingRow>
      </section>

      {/* ── 섹션 3: 기본 설정 ────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-1 divide-y divide-gray-100">
        <h3 className="font-semibold text-gray-800 pb-3">기본 설정</h3>

        <SettingRow
          label="새 프로젝트 기본 플랫폼"
          sub="새 원고를 만들 때 기본으로 선택되는 플랫폼"
          htmlFor="default-platform"
        >
          <select
            id="default-platform"
            value={prefs.defaultPlatform}
            onChange={(e) =>
              set('defaultPlatform', e.target.value as 'bookk' | 'kyobo' | 'kdp')
            }
            className={inputCls}
          >
            <option value="bookk">📚 부크크</option>
            <option value="kyobo">📖 교보문고</option>
            <option value="kdp">🌐 KDP</option>
          </select>
        </SettingRow>

        <SettingRow
          label="기본 장르"
          sub="새 원고의 기본 장르 (선택 사항)"
          htmlFor="default-genre"
        >
          <input
            id="default-genre"
            type="text"
            value={prefs.defaultGenre}
            onChange={(e) => set('defaultGenre', e.target.value)}
            placeholder="예: 자기계발, 에세이 …"
            maxLength={30}
            className={cn(inputCls, 'w-44')}
          />
        </SettingRow>
      </section>

      {/* ── 저장 버튼 + 토스트 ─────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-1 pb-4">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-700 animate-fade-in">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            저장됐습니다
          </span>
        )}
        <button
          onClick={handleSave}
          className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          저장
        </button>
      </div>

    </main>
  )
}
