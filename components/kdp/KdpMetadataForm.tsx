'use client'

/**
 * KdpMetadataForm — KDP 영문 메타데이터 입력 폼
 *
 * 필드:
 *   - 영문 제목 (AI 생성 버튼)
 *   - 부제목
 *   - BISAC 카테고리 (BisacSelector)
 *   - 키워드 7개 (태그 입력)
 *   - 책 설명 (영문, AI 생성, HTML 미리보기)
 *   - 언어, 가격(USD)
 *
 * onSave 콜백으로 상위에 메타데이터 전달
 */

import { useState, useEffect, KeyboardEvent } from 'react'
import { Sparkles, X, Plus, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import BisacSelector, { type BisacCategory } from './BisacSelector'

export interface KdpMetadata {
  title: string
  subtitle: string
  description: string
  keywords: string[]
  bisacCategories: BisacCategory[]
  language: string
  price_usd: string
  author: string
}

interface KdpMetadataFormProps {
  projectId: string
  initialTitle?: string
  /** 프로젝트 장르 — BisacSelector 추천용 */
  genre?: string | null
  onSave: (metadata: KdpMetadata) => void
  saving?: boolean
}

const DEFAULT_METADATA: KdpMetadata = {
  title: '',
  subtitle: '',
  description: '',
  keywords: [],
  bisacCategories: [],
  language: 'en',
  price_usd: '2.99',
  author: '',
}

export default function KdpMetadataForm({
  projectId,
  initialTitle,
  genre,
  onSave,
  saving,
}: KdpMetadataFormProps) {
  const [meta, setMeta] = useState<KdpMetadata>({
    ...DEFAULT_METADATA,
    title: initialTitle ?? '',
  })
  const [generating, setGenerating] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Partial<Record<keyof KdpMetadata, string>>>({})
  const [kwInput, setKwInput] = useState('')
  const [showDescPreview, setShowDescPreview] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveToast, setSaveToast] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // 토스트 자동 숨김 (2.5초)
  useEffect(() => {
    if (!saveToast) return
    const t = setTimeout(() => setSaveToast(false), 2500)
    return () => clearTimeout(t)
  }, [saveToast])

  function update<K extends keyof KdpMetadata>(key: K, value: KdpMetadata[K]) {
    setMeta((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  // ── AI 생성 ────────────────────────────────────────────────────────
  async function generateField(field: 'title' | 'description' | 'keywords') {
    setGenerating((prev) => ({ ...prev, [field]: true }))
    try {
      const res = await fetch('/api/kdp/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, field }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      const val = json.data.value
      if (field === 'keywords') {
        update('keywords', Array.isArray(val) ? val.slice(0, 7) : [])
      } else {
        update(field, String(val))
      }
    } catch (err) {
      console.error(`[KdpMetadataForm] AI 생성 실패 (${field}):`, err)
    } finally {
      setGenerating((prev) => ({ ...prev, [field]: false }))
    }
  }

  // ── 키워드 태그 입력 ──────────────────────────────────────────────
  function addKeyword() {
    const kw = kwInput.trim()
    if (!kw || meta.keywords.length >= 7 || meta.keywords.includes(kw)) return
    update('keywords', [...meta.keywords, kw])
    setKwInput('')
  }

  function onKwKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addKeyword()
    }
  }

  function removeKeyword(kw: string) {
    update('keywords', meta.keywords.filter((k) => k !== kw))
  }

  // ── 유효성 검사 ──────────────────────────────────────────────────
  function validate(): boolean {
    const newErrors: typeof errors = {}
    if (!meta.title.trim()) newErrors.title = '영문 제목은 필수입니다.'
    if (!meta.description.trim()) newErrors.description = '책 설명은 필수입니다.'
    if (meta.keywords.length < 1) newErrors.keywords = '키워드를 1개 이상 입력하세요.'
    if (meta.bisacCategories.length === 0) newErrors.bisacCategories = 'BISAC 카테고리를 선택하세요.' as never
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/kdp/metadata/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          metadata: {
            title: meta.title,
            subtitle: meta.subtitle || undefined,
            author: meta.author || undefined,
            bisac_codes: meta.bisacCategories.map((c) => c.code),
            keywords: meta.keywords,
            description: meta.description,
            language: meta.language,
            price_usd: meta.price_usd ? Number(meta.price_usd) : undefined,
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '저장에 실패했습니다.')
      setSaveToast(true)
      onSave(meta)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const AiButton = ({
    field,
    label,
  }: {
    field: 'title' | 'description' | 'keywords'
    label: string
  }) => (
    <button
      type="button"
      onClick={() => generateField(field)}
      disabled={generating[field]}
      className="inline-flex items-center gap-1 rounded-md bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 text-xs font-medium text-purple-700 transition-colors disabled:opacity-60"
    >
      <Sparkles className="h-3 w-3" />
      {generating[field] ? '생성 중...' : label}
    </button>
  )

  return (
    <div className="space-y-6">
      {/* 영문 제목 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-gray-700">
            영문 제목 <span className="text-red-500">*</span>
          </label>
          <AiButton field="title" label="AI 생성" />
        </div>
        <input
          type="text"
          value={meta.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="e.g. The Art of Simple Living: A Korean Approach"
          maxLength={200}
          className={cn(
            'w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500',
            errors.title ? 'border-red-300' : 'border-gray-300',
          )}
        />
        {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
        <p className="mt-1 text-xs text-gray-400">{meta.title.length}/200자</p>
      </div>

      {/* 부제목 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">부제목 (선택)</label>
        <input
          type="text"
          value={meta.subtitle}
          onChange={(e) => update('subtitle', e.target.value)}
          placeholder="e.g. Practical Wisdom for Modern Life"
          maxLength={200}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* 저자명 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          저자명 (영문) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={meta.author}
          onChange={(e) => update('author', e.target.value)}
          placeholder="e.g. Minjun Kim"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* BISAC 카테고리 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          BISAC 카테고리 <span className="text-red-500">*</span>
        </label>
        <BisacSelector
          value={meta.bisacCategories}
          onChange={(cats) => update('bisacCategories', cats)}
          max={2}
          genre={genre}
        />
        {errors.bisacCategories && (
          <p className="mt-1 text-xs text-red-500">{String(errors.bisacCategories)}</p>
        )}
      </div>

      {/* 키워드 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-gray-700">
            검색 키워드 <span className="text-red-500">*</span>
            <span className="ml-1 text-gray-400 font-normal">({meta.keywords.length}/7)</span>
          </label>
          <AiButton field="keywords" label="AI 7개 생성" />
        </div>

        {meta.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {meta.keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 rounded-md bg-gray-100 text-gray-700 text-xs px-2 py-1"
              >
                {kw}
                <button type="button" onClick={() => removeKeyword(kw)}>
                  <X className="h-3 w-3 hover:text-gray-900" />
                </button>
              </span>
            ))}
          </div>
        )}

        {meta.keywords.length < 7 && (
          <div className="flex gap-2">
            <input
              type="text"
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={onKwKeyDown}
              placeholder="키워드 입력 후 Enter 또는 추가 버튼"
              className={cn(
                'flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500',
                errors.keywords && 'border-red-300',
              )}
            />
            <button
              type="button"
              onClick={addKeyword}
              disabled={!kwInput.trim()}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
        {errors.keywords && <p className="mt-1 text-xs text-red-500">{errors.keywords}</p>}
        <p className="mt-1 text-xs text-gray-400">독자가 Amazon에서 검색할 키워드/구문</p>
      </div>

      {/* 책 설명 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-gray-700">
            책 설명 (영문) <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDescPreview((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              {showDescPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showDescPreview ? '편집' : 'HTML 미리보기'}
            </button>
            <AiButton field="description" label="AI 생성" />
          </div>
        </div>

        {showDescPreview ? (
          <div
            className="min-h-[180px] rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 prose max-w-none"
            dangerouslySetInnerHTML={{ __html: meta.description || '<p class="text-gray-400">미리보기가 없습니다.</p>' }}
          />
        ) : (
          <textarea
            value={meta.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Amazon KDP에 표시될 영문 설명. &lt;br&gt;, &lt;b&gt;, &lt;i&gt; 태그 사용 가능."
            rows={7}
            maxLength={4000}
            className={cn(
              'w-full rounded-lg border px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y',
              errors.description ? 'border-red-300' : 'border-gray-300',
            )}
          />
        )}
        {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
        <p className="mt-1 text-xs text-gray-400">{meta.description.length}/4000자</p>
      </div>

      {/* 언어 + 가격 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">언어</label>
          <select
            value={meta.language}
            onChange={(e) => update('language', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="en">English</option>
            <option value="ko">Korean</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            정가 (USD)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
            <input
              type="number"
              min="0.99"
              max="9999.99"
              step="0.01"
              value={meta.price_usd}
              onChange={(e) => update('price_usd', e.target.value)}
              className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">eBook 최소 $0.99, 최대 $9.99 (70% 로열티)</p>
        </div>
      </div>

      {/* 저장 오류 */}
      {saveError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {saveError}
        </p>
      )}

      {/* 저장 버튼 */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {/* 저장 성공 토스트 */}
        {saveToast && (
          <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            KDP 메타데이터가 저장됐습니다
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || saving}
          className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {isSaving ? '저장 중...' : '메타데이터 저장'}
        </button>
      </div>
    </div>
  )
}
