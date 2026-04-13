/**
 * lib/writing-prefs.ts — 글쓰기 환경설정 로컬 스토리지 유틸
 *
 * 키: pod_writing_prefs
 * 저장 방식: JSON (Supabase 저장 없음)
 */

export interface WritingPrefs {
  // ── 목표 설정
  dailyWordGoal: number        // 일일 목표 단어 수 (기본 500)
  goalNotification: boolean   // 목표 달성 시 알림 여부

  // ── 에디터 환경
  fontSize: 14 | 16 | 18     // 기본 글꼴 크기 (px)
  focusModeDefault: boolean   // 집중 모드 기본값 (사이드바 자동 숨김)
  autosaveInterval: 30 | 60 | 180  // 자동저장 간격 (초)

  // ── 기본 설정
  defaultPlatform: 'bookk' | 'kyobo' | 'kdp'  // 새 프로젝트 기본 플랫폼
  defaultGenre: string        // 기본 장르 (자유 입력)
}

export const DEFAULT_PREFS: WritingPrefs = {
  dailyWordGoal:     500,
  goalNotification:  true,
  fontSize:          16,
  focusModeDefault:  false,
  autosaveInterval:  60,
  defaultPlatform:   'bookk',
  defaultGenre:      '',
}

const STORAGE_KEY = 'pod_writing_prefs'

export function getWritingPrefs(): WritingPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<WritingPrefs>
    return { ...DEFAULT_PREFS, ...parsed }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function saveWritingPrefs(prefs: WritingPrefs): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage 접근 불가 환경 무시
  }
}
