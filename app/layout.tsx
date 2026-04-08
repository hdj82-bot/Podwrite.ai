import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { validateEnv } from '@/lib/env'

// 서버 컴포넌트 → 빌드 시 / Cold Start 시 즉시 환경변수 검증
// 누락된 변수가 있으면 배포 전 단계에서 에러로 노출
validateEnv()

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Podwrite.ai — AI 출판 지원 툴',
    template: '%s | Podwrite.ai',
  },
  description:
    'AI와 함께 기획부터 출판 제출 파일까지. 부크크·교보·Amazon KDP 규격 자동 보장.',
  keywords: ['POD', '출판', '자가출판', 'AI', '글쓰기', '부크크', '교보', 'KDP'],
  openGraph: {
    title: 'Podwrite.ai',
    description: 'AI 기반 POD 출판 원스톱 플랫폼',
    url: 'https://podwrite.ai',
    siteName: 'Podwrite.ai',
    locale: 'ko_KR',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
