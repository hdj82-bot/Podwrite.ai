import { redirect } from 'next/navigation'

/**
 * /dashboard/new → /dashboard/dashboard 로 리디렉션
 * 새 프로젝트 생성은 모달로 처리하므로 이 페이지는 사용하지 않음.
 * 딥링크로 접근한 경우를 위해 대시보드로 보냄.
 */
export default function NewProjectPage() {
  redirect('/dashboard/dashboard')
}
