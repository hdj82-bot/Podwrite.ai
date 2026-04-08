import SettingsTabs from './SettingsTabs'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 px-6 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">설정</h2>
      <div className="max-w-2xl">
        <SettingsTabs />
        {children}
      </div>
    </div>
  )
}
