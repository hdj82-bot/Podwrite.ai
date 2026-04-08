import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'black' | 'white' | 'gray'
  className?: string
}

const SIZE = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
}

const COLOR = {
  black: 'text-black',
  white: 'text-white',
  gray: 'text-gray-400',
}

export default function Spinner({ size = 'md', color = 'gray', className }: SpinnerProps) {
  return (
    <svg
      className={cn('animate-spin', SIZE[size], COLOR[color], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="로딩 중"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
