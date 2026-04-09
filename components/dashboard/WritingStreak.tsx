interface WritingStreakProps {
  streak: number
}

export default function WritingStreak({ streak }: WritingStreakProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-6 bg-white rounded-xl border border-gray-200 min-w-[128px]">
      <span className="text-3xl" aria-hidden>
        {streak > 0 ? '🔥' : '✍️'}
      </span>
      <span className="text-3xl font-bold text-gray-900 tabular-nums leading-tight">
        {streak}
      </span>
      <span className="text-xs text-gray-500">일 연속 집필</span>
      {streak === 0 && (
        <p className="text-[11px] text-gray-400 text-center mt-1 leading-snug">
          오늘 100자 이상 쓰면
          <br />
          기록이 시작돼요
        </p>
      )}
    </div>
  )
}
