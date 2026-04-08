import { redirect } from 'next/navigation'

/** /dashboard → /dashboard/dashboard 로 리디렉션 */
export default function DashboardRootPage() {
  redirect('/dashboard/dashboard')
}
