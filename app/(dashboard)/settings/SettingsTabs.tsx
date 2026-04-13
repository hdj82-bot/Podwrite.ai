'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PenLine } from 'lucide-react'

const TABS: Array<{ href: string; label: string; icon?: React.ReactNode }> = [
  { href: '/dashboard/settings/profile', label: '프로필' },
  { href: '/dashboard/settings/billing', label: '구독·결제' },
  {
    href: '/dashboard/settings/writing',
    label: '글쓰기 환경',
    icon: <PenLine className="w-3.5 h-3.5" />,
  },
]

export default function SettingsTabs() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 mb-6 border-b border-gray-200">
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              isActive
                ? 'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-black border-b-2 border-black -mb-px'
                : 'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px transition-colors'
            }
          >
            {tab.icon}
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
