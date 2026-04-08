'use client'

interface ScoreGaugeProps {
  score: number   // 0~100
  size?: number   // SVG 크기(px), 기본 120
  label?: string  // 게이지 아래 레이블
}

/**
 * 원형 게이지 — 0~100 점수를 시각화
 * SVG stroke-dashoffset 방식으로 구현 (외부 의존 없음)
 */
export default function ScoreGauge({ score, size = 120, label = '종합 점수' }: ScoreGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)))
  const radius = 44
  const cx = 50
  const cy = 50
  const circumference = 2 * Math.PI * radius          // ≈ 276.46
  const offset = circumference * (1 - clampedScore / 100)

  const color = scoreColor(clampedScore)

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-label={`${label}: ${clampedScore}점`}
      >
        {/* 트랙 (배경 원) */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#e5e7eb"   /* gray-200 */
          strokeWidth={8}
        />
        {/* 진행 원 */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        {/* 점수 텍스트 */}
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="20"
          fontWeight="700"
          fill="#111827"   /* gray-900 */
        >
          {clampedScore}
        </text>
        {/* 단위 텍스트 */}
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="8"
          fill="#6b7280"   /* gray-500 */
        >
          / 100
        </text>
      </svg>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a'   // green-600
  if (score >= 60) return '#2563eb'   // blue-600
  if (score >= 40) return '#d97706'   // amber-600
  return '#dc2626'                     // red-600
}
