import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { validateEnv } from '@/lib/env'

// 서버 컴포넌트 → 빌드 시 / Cold Start 시 즉시 환경변수 검증
// 누락된 변수가 있으면 배포 전 단계에서 에러로 노출
validateEnv()

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://podwrite.ai'),
  title: {
    default: 'Podwrite.ai — AI 출판 지원 툴',
    template: '%s | Podwrite.ai',
  },
  description:
    'AI와 함께 기획부터 출판 제출 파일까지. 부크크·교보·Amazon KDP 규격 자동 보장.',
  keywords: ['독립출판', 'POD', '출판', '자가출판', 'AI 글쓰기', '글쓰기', '전자책', '부크크', '교보', 'KDP'],
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'Podwrite.ai — AI 출판 지원 툴',
    description: 'AI와 함께 기획부터 출판 제출 파일까지. 부크크·교보·Amazon KDP 규격 자동 보장.',
    url: 'https://podwrite.ai',
    siteName: 'Podwrite.ai',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Podwrite.ai — AI 출판 지원 툴',
    description: 'AI와 함께 기획부터 출판 제출 파일까지. 부크크·교보·Amazon KDP 규격 자동 보장.',
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
