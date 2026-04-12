'use client'

/**
 * KdpMetadataForm — KDP 영문 메타데이터 입력 폼 (확장판)
 *
 * 필드:
 *   기본: 영문 제목, 부제목, 저자명
 *   분류: BISAC 카테고리, 연령 등급, 시리즈 정보
 *   검색: 키워드 7개, 책 설명 (HTML)
 *   출판: ISBN-13, 출판사명, 출판 예정일, 예상 페이지 수, 기여자 목록
 *   가격: 언어, USD 가격
 *
 * KDP 규격 검증: 실시간 + 완성도 체크리스트
 * Amazon 미리보기 패널: 토글 버튼
 */

import { useState, useEffect, KeyboardEvent } from 'react'
import {
  Sparkles, X, Plus, Eye, EyeOff, CheckCircle, ChevronDown, ChevronUp,
  Trash2, BookOpen, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import BisacSelector, { type BisacCategory } from './BisacSelector'
import AmazonPreviewPanel from './AmazonPreviewPanel'
import type { KdpMaturityRating } from '@/types'

// ── 상수 ──────────────────────────────────────────────────────

const MATURITY_OPTIONS: Array<{ value: KdpMaturityRating; label: string; desc: string }> = [
  { value: 'general', label: '전체 이용가', desc: 'General — 모든 연령' },
  { value: 'teen', label: '청소년 (Teen 13+)', desc: '청소년 및 성인용' },
  { value: 'mature', label: '성인 (Mature 18+)', desc: '성인 전용 콘텐츠' },
]

const CONTRIBUTOR_ROLE_OPTIONS = [
  { value: 'editor', label: '편집자 (Editor)' },
  { value: 'translator', label: '번역자 (Translator)' },
  { value: 'illustrator', label: '일러스트레이터 (Illustrator)' },
  { value: 'narrator', label: '나레이터 (Narrator)' },
] as const

/** KDP A5 기준 페이지 추정 상수 (단어/페이지) */
const KDP_WORDS_PER_PAGE = 230

// ── 타입 ──────────────────────────────────────────────────────

export interface KdpMetadata {
  // 기존 필드 (하위 호환 유지)
  title: string
  subtitle: string
  description: string
  keywords: string[]
  bisacCategories: BisacCategory[]
  language: string
  price_usd: string
  author: string
  // 확장 필드
  isbn: string
  publisher: string
  publication_date: string
  maturity_rating: KdpMaturityRating
  contributors: Array<{ role: string; name: string }>
  series_name: string
  series_number: string
}

interface KdpMetadataFormProps {
  projectId: string
  initialTitle?: string
  genre?: string | null
  /** 프로젝트 현재 단어 수 — 페이지 수 추정용 */
  wordCount?: number
  /** DB에서 불러온 기존 저장 메타데이터 */
  initialMetadata?: Partial<KdpMetadata>
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
  isbn: '',
  publisher: '',
  publication_date: '',
  maturity_rating: 'general',
  contributors: [],
  series_name: '',
  series_number: '',
}

// ── 유틸 ──────────────────────────────────────────────────────

/** ISBN-13 체크디짓 유효성 검증 */
function isValidISBN13(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 13) return false
  const sum = digits.split('').reduce((acc, d, i) => acc + parseInt(d) * (i % 2 === 0 ? 1 : 3), 0)
  return sum % 10 === 0
}

/** 숫자만 추출, 최대 13자리 */
function sanitizeISBN(value: string): string {
  return value.replace(/\D/g, '').slice(0, 13)
}

// ── 컴포넌트 ─────────────────────────────────────────────────

export default function KdpMetadataForm({
  projectId,
  initialTitle,
  genre,
  wordCount = 0,
  initialMetadata,
  onSave,
  saving,
}: KdpMetadataFormProps) {
  const [meta, setMeta] = useState<KdpMetadata>(() => ({
    ...DEFAULT_METADATA,
    title: initialTitle ?? '',
    ...initialMetadata,
  }))

  const [generating, setGenerating] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Partial<Record<keyof KdpMetadata | 'bisacCategories', string>>>({})
  const [kwInput, setKwInput] = useState('')
  const [showDescPreview, setShowDescPreview] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveToast, setSaveToast] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // initialMetadata가 나중에 도착할 때 반영
  useEffect(() => {
    if (initialMetadata && Object.keys(initialMetadata).length > 0) {
      setMeta((prev) => ({ ...prev, ...initialMetadata }))
    }
  }, [initialMetadata])

  // 토스트 자동 숨김
  useEffect(() => {
    if (!saveToast) return
    const t = setTimeout(() => setSaveToast(false), 2500)
    return () => clearTimeout(t)
  }, [saveToast])

  // 예상 페이지 수
  const estimatedPages = wordCount > 0 ? Math.round(wordCount / KDP_WORDS_PER_PAGE) : 0

  function update<K extends keyof KdpMetadata>(key: K, value: KdpMetadata[K]) {
    setMeta((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  // ── AI 생성 ────────────────────────────────────────────────
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

  // ── 키워드 태그 ────────────────────────────────────────────
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

  // ── 기여자 목록 ────────────────────────────────────────────
  function addContributor() {
    update('contributors', [...meta.contributors, { role: 'editor', name: '' }])
  }

  function updateContributor(idx: number, field: 'role' | 'name', value: string) {
    const updated = meta.contributors.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    update('contributors', updated)
  }

  function removeContributor(idx: number) {
    update('contributors', meta.contributors.filter((_, i) => i !== idx))
  }

  // ── KDP 완성도 체크 ────────────────────────────────────────
  const compliance = {
    title: meta.title.trim().length > 0 && meta.title.length <= 200,
    author: meta.author.trim().length > 0,
    bisac: meta.bisacCategories.length > 0,
    keywords: meta.keywords.length >= 1 && meta.keywords.length <= 7,
    description: meta.description.trim().length > 0 && meta.description.length <= 4000,
    price: parseFloat(meta.price_usd) >= 0.99,
    isbn: meta.isbn.length === 0 || isValidISBN13(meta.isbn),
  }

  const requiredDone = compliance.title && compliance.author && compliance.bisac &&
    compliance.keywords && compliance.description && compliance.price
  const allDone = requiredDone && compliance.isbn

  // ── 유효성 검사 ────────────────────────────────────────────
  function validate(): boolean {
    const newErrors: typeof errors = {}
    if (!meta.title.trim()) newErrors.title = '영문 제목은 필수입니다.'
    else if (meta.title.length > 200) newErrors.title = '제목은 200자 이하여야 합니다.'
    if (!meta.author.trim()) newErrors.author = '저자명은 필수입니다.'
    if (!meta.description.trim()) newErrors.description = '책 설명은 필수입니다.'
    else if (meta.description.length > 4000) newErrors.description = '설명은 4,000자 이하여야 합니다.'
    if (meta.keywords.length < 1) newErrors.keywords = '키워드를 1개 이상 입력하세요.'
    if (meta.bisacCategories.length === 0) newErrors.bisacCategories = 'BISAC 카테고리를 선택하세요.'
    if (meta.isbn && !isValidISBN13(meta.isbn)) newErrors.isbn = '유효하지 않은 ISBN-13입니다. (13자리, 체크디짓 확인)'
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
            isbn: meta.isbn || undefined,
            publisher: meta.publisher || undefined,
            publication_date: meta.publication_date || undefined,
            maturity_rating: meta.maturity_rating,
            contributors: meta.contributors.filter((c) => c.name.trim()),
            series_name: meta.series_name || undefined,
            series_number: meta.series_number || undefined,
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

  // ── 공통 버튼 ──────────────────────────────────────────────
  const AiButton = ({ field, label }: { field: 'title' | 'description' | 'keywords'; label: string }) => (
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

  // ── KDP 완성도 체크리스트 ──────────────────────────────────
  const ComplianceRow = ({ ok, label, required = true }: { ok: boolean; label: string; required?: boolean }) => (
    <div className="flex items-center gap-1.5 text-xs">
      {ok ? (
        <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
      ) : (
        <div className={cn('h-3.5 w-3.5 rounded-full border-2 shrink-0', required ? 'border-red-300' : 'border-gray-300')} />
      )}
      <span className={cn(ok ? 'text-green-700' : required ? 'text-red-600' : 'text-gray-500')}>
        {label}
        {required && !ok && ' (필수)'}
      </span>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* ─────────────── 섹션 1: 기본 정보 ─────────────── */}

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
        <div className="flex items-center justify-between mt-1">
          {errors.title
            ? <p className="text-xs text-red-500">{errors.title}</p>
            : <span />}
          <p className={cn('text-xs', meta.title.length > 180 ? 'text-orange-500' : 'text-gray-400')}>
            {meta.title.length}/200자
          </p>
        </div>
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
          className={cn(
            'w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500',
            errors.author ? 'border-red-300' : 'border-gray-300',
          )}
        />
        {errors.author && <p className="mt-1 text-xs text-red-500">{errors.author}</p>}
      </div>

      {/* ─────────────── 섹션 2: 분류 및 등급 ─────────────── */}

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

      {/* 연령 등급 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">연령 등급</label>
        <div className="flex gap-3 flex-wrap">
          {MATURITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm transition-colors',
                meta.maturity_rating === opt.value
                  ? 'border-orange-400 bg-orange-50 text-orange-800'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700',
              )}
            >
              <input
                type="radio"
                name="maturity_rating"
                value={opt.value}
                checked={meta.maturity_rating === opt.value}
                onChange={() => update('maturity_rating', opt.value)}
                className="accent-orange-500"
              />
              <span>
                <span className="font-medium">{opt.label}</span>
                <span className="text-xs text-gray-500 ml-1">({opt.desc})</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 시리즈 정보 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">시리즈 정보 (선택)</label>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={meta.series_name}
            onChange={(e) => update('series_name', e.target.value)}
            placeholder="시리즈명 (e.g. The Simple Life Series)"
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <input
            type="number"
            min="1"
            value={meta.series_number}
            onChange={(e) => update('series_number', e.target.value)}
            placeholder="권호 (e.g. 1)"
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* ─────────────── 섹션 3: 검색 최적화 ─────────────── */}

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
        <p className="mt-1 text-xs text-gray-400">독자가 Amazon에서 검색할 키워드/구문 (최대 7개)</p>
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
            dangerouslySetInnerHTML={{
              __html: meta.description || '<p class="text-gray-400">미리보기가 없습니다.</p>',
            }}
          />
        ) : (
          <textarea
            value={meta.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Amazon KDP에 표시될 영문 설명. <br>, <b>, <i> 태그 사용 가능."
            rows={7}
            maxLength={4000}
            className={cn(
              'w-full rounded-lg border px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y',
              errors.description ? 'border-red-300' : 'border-gray-300',
            )}
          />
        )}
        {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
        <p className={cn('mt-1 text-xs', meta.description.length > 3800 ? 'text-orange-500' : 'text-gray-400')}>
          {meta.description.length}/4,000자
        </p>
      </div>

      {/* ─────────────── 섹션 4: 출판 정보 (고급 설정) ─────────────── */}

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-gray-500" />
            출판 정보 고급 설정
            <span className="text-xs font-normal text-gray-400">(ISBN, 출판사, 기여자 등)</span>
          </span>
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showAdvanced && (
          <div className="px-4 py-4 space-y-4 border-t border-gray-200">

            {/* ISBN-13 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                ISBN-13 (선택)
              </label>
              <input
                type="text"
                value={meta.isbn}
                onChange={(e) => update('isbn', sanitizeISBN(e.target.value))}
                placeholder="9780000000000 (13자리 숫자)"
                maxLength={13}
                className={cn(
                  'w-full rounded-lg border px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500',
                  errors.isbn ? 'border-red-300' : 'border-gray-300',
                )}
              />
              <div className="flex items-center justify-between mt-1">
                {errors.isbn
                  ? <p className="text-xs text-red-500">{errors.isbn}</p>
                  : meta.isbn.length === 13
                    ? <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        유효한 ISBN-13
                      </p>
                    : <p className="text-xs text-gray-400">없으면 비워두세요 (KDP가 자동 ASIN 발급)</p>
                }
                <span className="text-xs text-gray-400">{meta.isbn.length}/13</span>
              </div>
            </div>

            {/* 출판사명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">출판사명 (선택)</label>
              <input
                type="text"
                value={meta.publisher}
                onChange={(e) => update('publisher', e.target.value)}
                placeholder="e.g. Independent / 독립출판"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* 출판 예정일 + 예상 페이지 수 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">출판 예정일 (선택)</label>
                <input
                  type="date"
                  value={meta.publication_date}
                  onChange={(e) => update('publication_date', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">예상 페이지 수</label>
                <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
                  {estimatedPages > 0 ? (
                    <span>
                      <span className="font-semibold text-gray-800">{estimatedPages}</span>
                      <span className="text-xs text-gray-400 ml-1">
                        p ({wordCount.toLocaleString()}단어 ÷ {KDP_WORDS_PER_PAGE})
                      </span>
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">원고 작성 후 자동 계산</span>
                  )}
                </div>
              </div>
            </div>

            {/* 기여자 목록 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">기여자 (선택)</label>
                <button
                  type="button"
                  onClick={addContributor}
                  className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  기여자 추가
                </button>
              </div>

              {meta.contributors.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">편집자, 번역자 등 기여자가 있으면 추가하세요.</p>
              ) : (
                <div className="space-y-2">
                  {meta.contributors.map((contributor, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={contributor.role}
                        onChange={(e) => updateContributor(idx, 'role', e.target.value)}
                        className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-48"
                      >
                        {CONTRIBUTOR_ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={contributor.name}
                        onChange={(e) => updateContributor(idx, 'name', e.target.value)}
                        placeholder="영문 이름 (e.g. Jane Doe)"
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeContributor(idx)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─────────────── 섹션 5: 가격 및 언어 ─────────────── */}

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
          <label className="block text-sm font-medium text-gray-700 mb-1.5">정가 (USD)</label>
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
          <p className="mt-1 text-xs text-gray-400">
            eBook $0.99–$9.99 → 70% 로열티 /
            {meta.price_usd && !isNaN(parseFloat(meta.price_usd)) && (
              <span className="text-green-600 ml-1">
                예상 ${(parseFloat(meta.price_usd) * 0.7).toFixed(2)}/권
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ─────────────── KDP 완성도 체크리스트 ─────────────── */}

      <div className={cn(
        'rounded-xl border p-4',
        requiredDone ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50',
      )}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">KDP 제출 준비 현황</h3>
          <span className={cn(
            'text-xs font-bold px-2 py-0.5 rounded-full',
            requiredDone ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600',
          )}>
            {[compliance.title, compliance.author, compliance.bisac, compliance.keywords, compliance.description, compliance.price].filter(Boolean).length}/6 완료
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <ComplianceRow ok={compliance.title} label="영문 제목 (200자 이하)" />
          <ComplianceRow ok={compliance.author} label="저자명" />
          <ComplianceRow ok={compliance.bisac} label="BISAC 카테고리" />
          <ComplianceRow ok={compliance.keywords} label="검색 키워드 1~7개" />
          <ComplianceRow ok={compliance.description} label="책 설명 (4,000자 이하)" />
          <ComplianceRow ok={compliance.price} label="가격 ($0.99 이상)" />
          <ComplianceRow ok={compliance.isbn} label="ISBN-13 (선택)" required={false} />
        </div>
        {requiredDone && (
          <p className="mt-2.5 text-xs text-green-700 flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" />
            모든 필수 항목이 완성되었습니다. 저장 후 패키지 다운로드가 가능합니다.
          </p>
        )}
      </div>

      {/* ─────────────── 저장 오류 ─────────────── */}

      {saveError && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {saveError}
        </div>
      )}

      {/* ─────────────── 버튼 영역 ─────────────── */}

      <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 hover:border-gray-400 px-4 py-2 text-sm text-gray-700 transition-colors"
        >
          {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showPreview ? 'Amazon 미리보기 닫기' : 'Amazon 미리보기'}
        </button>

        <div className="flex items-center gap-3">
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

      {/* ─────────────── Amazon 미리보기 패널 ─────────────── */}

      {showPreview && (
        <div className="pt-2">
          <AmazonPreviewPanel
            meta={{
              title: meta.title,
              subtitle: meta.subtitle,
              author: meta.author,
              description: meta.description,
              keywords: meta.keywords,
              bisacCategories: meta.bisacCategories,
              price_usd: meta.price_usd,
              publisher: meta.publisher,
              publication_date: meta.publication_date,
              language: meta.language,
              estimated_pages: estimatedPages,
              maturity_rating: meta.maturity_rating,
              series_name: meta.series_name,
              series_number: meta.series_number,
            }}
          />
        </div>
      )}
    </div>
  )
}
