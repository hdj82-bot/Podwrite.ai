import { redirect } from 'next/navigation'

/** /dashboard/projects → /dashboard 로 리디렉션 */
export default function ProjectsPage() {
  redirect('/dashboard')
}
