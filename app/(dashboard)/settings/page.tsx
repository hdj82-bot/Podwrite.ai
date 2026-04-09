import { redirect } from 'next/navigation'

/**
 * /dashboard/settings → /dashboard/settings/profile 리다이렉트
 * 탭 구조의 첫 번째 탭(프로필)으로 바로 이동
 */
export default function SettingsIndexPage() {
  redirect('/dashboard/settings/profile')
}
