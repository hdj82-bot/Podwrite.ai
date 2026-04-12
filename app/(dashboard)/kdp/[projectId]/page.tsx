/**
 * /kdp/[projectId] — KDP 글로벌 모듈 메인 페이지
 *
 * 탭 구성:
 *   1. 메타데이터 — 영문 제목, BISAC, 키워드, 설명
 *   2. 번역 — 한→영 번역 진행 + EPUB 생성
 *   3. 제출 패키지 — 파일 체크리스트 + ZIP 다운로드
 *
 * Pro 플랜 전용. 다른 플랜 접근 시 업그레이드 안내.
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Globe, FileText, Package, ChevronLeft, Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import KdpMetadataForm, { type KdpMetadata } from '@/components/kdp/KdpMetadataForm'
import TranslationPanel from '@/components/kdp/TranslationPanel'
import SubmissionPackage from '@/components/kdp/SubmissionPackage'
import type { Plan } from '@/types'

type Tab = 'metadata' | 'translation' | 'package'

interface Project {
  id: string
  title: string
  platform: string
  genre: string | null
  description: string | null
  current_words: number
  kdp_metadata: Record<string, unknown> | null
}

interface Chapter {
  id: string
  title: string
  order_idx: number
}

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: 'metadata', label: '메타데이터', icon: FileText },
  { id: 'translation', label: '번역', icon: Globe },
  { id: 'package', label: '제출 패키지', icon: Package },
]

function tabDone(tab: Tab, metadata: KdpMetadata | null, hasEpub: boolean): boolean {
  if (tab === 'metadata') return metadata !== null && metadata.title.trim().length > 0
  if (tab === 'translation') return hasEpub
  return false
}

export default function KdpPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [activeTab, setActiveTab] = useState<Tab>('metadata')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [plan, setPlan] = useState<Plan>('free')
  const [userId, setUserId] = useState<string>('')
  const [project, setProject] = useState<Project | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])

  // 번역/패키지 상태
  const [metadata, setMetadata] = useState<KdpMetadata | null>(null)
  const [savingMeta, setSavingMeta] = useState(false)
  const [hasDocx, setHasDocx] = useState(false)
  const [hasEpub, setHasEpub] = useState(false)

  // ── 데이터 로드 ──────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)

      // 사용자 플랜 조회
      const { data: profile } = await supabase
        .from('users')
        .select('plan')
        .eq('id', user.id)
        .single()
      setPlan((profile?.plan as Plan) ?? 'free')

      // 프로젝트 조회 (current_words, kdp_metadata 포함)
      const { data: proj, error: projErr } = await supabase
        .from('projects')
        .select('id, title, platform, genre, description, current_words, kdp_metadata')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single()

      if (projErr || !proj) {
        setError('프로젝트를 찾을 수 없습니다.')
        setLoading(false)
        return
      }
      setProject(proj as Project)

      // 챕터 조회
      const { data: chs } = await supabase
        .from('chapters')
        .select('id, title, order_idx')
        .eq('project_id', projectId)
        .order('order_idx', { ascending: true })
      setChapters((chs ?? []) as Chapter[])

      // Storage에서 기존 파일 존재 여부 확인
      const checkFile = async (path: string): Promise<boolean> => {
        const { data } = await supabase.storage.from('project-files').list(`${user.id}/${projectId}`, {
          search: path.split('/').pop(),
        })
        return (data?.length ?? 0) > 0
      }

      const [docxExists, epubExists] = await Promise.all([
        checkFile(`export-kdp.docx`).then((r) => r || checkFile(`export-bookk.docx`)),
        checkFile(`export-en.epub`).then((r) => r || checkFile(`export-ko.epub`)),
      ])
      setHasDocx(docxExists)
      setHasEpub(epubExists)

      setLoading(false)
    }
    load()
  }, [projectId, router])

  // ── 메타데이터 저장 콜백 (폼 내부에서 DB 저장 후 호출됨) ────────────
  function handleSaveMeta(meta: KdpMetadata) {
    setMetadata(meta)
    setSavingMeta(false)
  }

  // ── EPUB 생성 완료 콜백 ──────────────────────────────────────────
  function handleEpubReady() {
    setHasEpub(true)
    // 제출 패키지 탭으로 유도
    setTimeout(() => setActiveTab('package'), 1500)
  }

  // ── DOCX 생성 트리거 ─────────────────────────────────────────────
  async function handleGenerateDocx() {
    const res = await fetch('/api/generate-docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, platform: 'kdp', include_cover: false }),
    })
    if (res.ok) {
      setHasDocx(true)
    }
  }

  // ── 로딩 / 에러 / 접근 제한 ────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-sm text-orange-600 hover:underline"
          >
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  // Pro 플랜 전용 접근 제한
  if (plan !== 'pro') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="max-w-md text-center px-6">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
            <Lock className="h-7 w-7 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pro 플랜 전용 기능</h2>
          <p className="text-gray-500 text-sm mb-6">
            Amazon KDP 글로벌 모듈은 Pro 플랜 구독자만 이용할 수 있습니다.
            한→영 번역, EPUB 생성, KDP 제출 패키지를 모두 포함합니다.
          </p>
          <button
            onClick={() => router.push('/settings/billing')}
            className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 text-sm font-semibold transition-colors"
          >
            Pro 플랜으로 업그레이드
          </button>
          <p className="mt-3 text-xs text-gray-400">월 ₩19,900 · 언제든지 취소 가능</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-screen">
      {/* 헤더 */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.push(`/editor/${projectId}`)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            <ChevronLeft className="h-4 w-4" />
            편집기로 돌아가기
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100">
              <Globe className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Amazon KDP 글로벌</h1>
              <p className="text-sm text-gray-500 truncate max-w-xs">{project?.title}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <nav className="flex">
            {TABS.map((tab, i) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              const isDone = tabDone(tab.id, metadata, hasEpub)
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    isActive
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                  )}
                >
                  {isDone && !isActive ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold shrink-0',
                        isActive ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600',
                      )}
                    >
                      {i + 1}
                    </span>
                  )}
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* DOCX 생성 안내 배너 (패키지 탭에서 필요할 때) */}
        {activeTab === 'package' && !hasDocx && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">내지 DOCX가 없습니다</p>
              <p className="text-xs text-amber-700 mt-0.5">
                KDP 형식 내지 파일 생성이 필요합니다.
              </p>
              <button
                onClick={handleGenerateDocx}
                className="mt-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs px-3 py-1.5 font-medium transition-colors"
              >
                KDP 내지 DOCX 생성하기
              </button>
            </div>
          </div>
        )}

        {activeTab === 'metadata' && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">영문 메타데이터</h2>
              <p className="text-sm text-gray-500 mt-1">
                KDP 대시보드 제출용 영문 정보를 입력하세요. AI 자동 생성을 활용하세요.
              </p>
            </div>
            <KdpMetadataForm
              projectId={projectId}
              initialTitle={metadata?.title ?? project?.title}
              genre={project?.genre}
              wordCount={project?.current_words ?? 0}
              initialMetadata={
                project?.kdp_metadata
                  ? (project.kdp_metadata as Partial<KdpMetadata>)
                  : undefined
              }
              onSave={handleSaveMeta}
              saving={savingMeta}
            />
            {metadata && !savingMeta && (
              <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
                <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                저장됨 · 번역 탭으로 계속하세요
                <button
                  onClick={() => setActiveTab('translation')}
                  className="ml-2 text-orange-600 font-medium hover:underline"
                >
                  번역 탭 →
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'translation' && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">한→영 번역</h2>
              <p className="text-sm text-gray-500 mt-1">
                Claude AI가 원고를 영어권 독자 기준으로 문화 현지화합니다.
              </p>
            </div>
            {chapters.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Globe className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">챕터가 없습니다. 편집기에서 챕터를 추가하세요.</p>
              </div>
            ) : (
              <TranslationPanel
                projectId={projectId}
                chapters={chapters}
                onEpubReady={handleEpubReady}
              />
            )}
          </div>
        )}

        {activeTab === 'package' && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">KDP 제출 패키지</h2>
              <p className="text-sm text-gray-500 mt-1">
                필요한 파일을 모두 준비하고 ZIP으로 다운로드하세요.
              </p>
            </div>
            <SubmissionPackage
              projectId={projectId}
              userId={userId}
              projectTitle={project?.title ?? ''}
              hasDocx={hasDocx}
              hasEpub={hasEpub}
              metadata={metadata}
            />
          </div>
        )}
      </div>
    </div>
  )
}
