'use client'

/**
 * SubmissionPackage — KDP 제출 패키지 체크리스트 + ZIP 다운로드
 *
 * 체크리스트:
 *   [x] 내지 DOCX
 *   [x] 표지 이미지 (업로드 or Canva 딥링크)
 *   [x] 영문 EPUB
 *   [ ] 메타데이터 XLSX
 * "제출 패키지 ZIP 다운로드" → POST /api/kdp/package
 */

import { useState, useRef } from 'react'
import {
  CheckCircle2,
  Circle,
  Download,
  Upload,
  ExternalLink,
  Loader2,
  FileText,
  Image,
  BookOpen,
  Table2,
  AlertTriangle,
  Package,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import type { KdpMetadata } from './KdpMetadataForm'

interface SubmissionPackageProps {
  projectId: string
  userId: string
  projectTitle: string
  hasDocx: boolean
  hasEpub: boolean
  metadata: KdpMetadata | null
}

export default function SubmissionPackage({
  projectId,
  userId,
  projectTitle,
  hasDocx,
  hasEpub,
  metadata,
}: SubmissionPackageProps) {
  const [hasCover, setHasCover] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [missingFiles, setMissingFiles] = useState<string[]>([])
  const [genError, setGenError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasMetadata = metadata !== null && metadata.title.trim().length > 0

  const checklist = [
    {
      id: 'docx',
      label: '내지 원고 (DOCX)',
      description: '메타데이터 탭 → KDP 형식 DOCX 생성 필요',
      done: hasDocx,
      icon: FileText,
    },
    {
      id: 'cover',
      label: '표지 이미지',
      description: 'JPG/PNG, KDP 커버 계산기 기준 크기',
      done: hasCover,
      icon: Image,
      action: true,
    },
    {
      id: 'epub',
      label: '영문 EPUB',
      description: '번역 탭 → 번역 완료 후 EPUB 생성 필요',
      done: hasEpub,
      icon: BookOpen,
    },
    {
      id: 'metadata',
      label: '메타데이터',
      description: '메타데이터 탭에서 정보 입력 및 저장',
      done: hasMetadata,
      icon: Table2,
    },
  ]

  const completedCount = checklist.filter((c) => c.done).length
  const allDone = completedCount === checklist.length

  // ── 표지 이미지 업로드 ────────────────────────────────────────────
  async function handleCoverUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      setCoverError('이미지 파일만 업로드 가능합니다.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setCoverError('파일 크기는 50MB 이하만 가능합니다.')
      return
    }

    setUploadingCover(true)
    setCoverError(null)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${userId}/${projectId}/cover.${ext}`

      const { error } = await supabase.storage
        .from('project-files')
        .upload(path, file, { upsert: true })

      if (error) throw new Error(error.message)
      setHasCover(true)
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : '업로드 실패')
    } finally {
      setUploadingCover(false)
    }
  }

  // ── ZIP 패키지 생성 ────────────────────────────────────────────────
  async function generatePackage() {
    setGenerating(true)
    setGenError(null)
    setDownloadUrl(null)
    setMissingFiles([])

    try {
      const res = await fetch('/api/kdp/package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          metadata: metadata
            ? {
                title: metadata.title,
                subtitle: metadata.subtitle,
                description: metadata.description,
                keywords: metadata.keywords,
                bisacCode: metadata.bisacCategories[0]?.code,
                bisacLabel: metadata.bisacCategories[0]?.label,
                language: metadata.language,
                author: metadata.author,
                price_usd: parseFloat(metadata.price_usd) || 2.99,
              }
            : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      setDownloadUrl(json.data.download_url)
      if (json.data.files_missing?.length > 0) {
        setMissingFiles(json.data.files_missing)
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'ZIP 생성 실패')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 진행 상태 바 */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">준비 현황</h3>
          <span
            className={cn(
              'text-xs font-semibold px-2.5 py-1 rounded-full',
              allDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
            )}
          >
            {completedCount}/{checklist.length}
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              allDone ? 'bg-green-500' : 'bg-orange-500',
            )}
            style={{ width: `${(completedCount / checklist.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 체크리스트 */}
      <div className="space-y-3">
        {checklist.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.id}
              className={cn(
                'rounded-xl border p-4 flex items-start gap-4',
                item.done ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white',
              )}
            >
              <div className="mt-0.5 shrink-0">
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4 shrink-0', item.done ? 'text-green-600' : 'text-gray-400')} />
                  <span
                    className={cn(
                      'text-sm font-medium',
                      item.done ? 'text-green-900' : 'text-gray-700',
                    )}
                  >
                    {item.label}
                  </span>
                </div>
                {!item.done && (
                  <p className="mt-1 text-xs text-gray-400">{item.description}</p>
                )}

                {/* 표지 업로드 액션 */}
                {item.id === 'cover' && !item.done && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingCover}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {uploadingCover ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        {uploadingCover ? '업로드 중...' : '표지 이미지 업로드'}
                      </button>
                      <a
                        href="https://kdp.amazon.com/cover-calculator"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
                      >
                        <ExternalLink className="h-3 w-3" />
                        KDP 커버 계산기
                      </a>
                    </div>
                    <a
                      href="https://www.canva.com/search/templates?q=book+cover"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Canva에서 표지 디자인하기
                    </a>
                    {coverError && (
                      <p className="text-xs text-red-500">{coverError}</p>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleCoverUpload(file)
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 누락 파일 경고 */}
      {missingFiles.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">일부 파일이 누락되었습니다</p>
              <ul className="mt-1 space-y-0.5">
                {missingFiles.map((f) => (
                  <li key={f} className="text-xs text-amber-700">• {f}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-amber-600">
                ZIP 파일에는 가능한 파일만 포함되었습니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 에러 */}
      {genError && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {genError}
        </div>
      )}

      {/* 다운로드 성공 */}
      {downloadUrl && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p className="text-sm font-semibold text-green-900">패키지 생성 완료!</p>
          </div>
          <p className="text-xs text-green-700 mb-3">
            다운로드 링크는 1시간 동안 유효합니다.
          </p>
          <a
            href={downloadUrl}
            download={`${projectTitle}-kdp-package.zip`}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            <Download className="h-4 w-4" />
            ZIP 다운로드
          </a>
        </div>
      )}

      {/* ZIP 생성 버튼 */}
      {!downloadUrl && (
        <button
          onClick={generatePackage}
          disabled={generating}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-colors',
            allDone
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700',
          )}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              패키지 생성 중...
            </>
          ) : (
            <>
              <Package className="h-4 w-4" />
              {allDone ? 'KDP 제출 패키지 ZIP 다운로드' : '현재 파일로 패키지 생성'}
            </>
          )}
        </button>
      )}

      {/* KDP 제출 안내 */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-2 text-xs text-gray-500">
        <p className="font-semibold text-gray-700 text-sm">KDP 제출 순서</p>
        <ol className="space-y-1 list-decimal list-inside">
          <li><a href="https://kdp.amazon.com" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">kdp.amazon.com</a> 접속 → 새 타이틀 생성</li>
          <li>metadata.xlsx 참고하여 정보 입력</li>
          <li>Paperback: interior.docx 업로드 → 표지 업로드</li>
          <li>Kindle eBook: ebook.epub 업로드</li>
          <li>Kindle Previewer로 최종 확인 후 게시</li>
        </ol>
      </div>
    </div>
  )
}
