// ============================================================
// Podwrite.ai — 전체 공유 도메인 타입
// Window 2, 3, 4 에서 import { Xxx } from '@/types' 로 사용
// ============================================================

// ── 플랜 ────────────────────────────────────────────────────

export type Plan = 'free' | 'basic' | 'pro'

export const PLAN_LIMITS = {
  free: {
    projects: 1,
    searchPerMonth: 10,
    versionsPerChapter: 5,
    storageMB: 50,
    sellingPage: false,
    kdp: false,
  },
  basic: {
    projects: 3,
    searchPerMonth: 30,
    versionsPerChapter: 20,
    storageMB: 500,
    sellingPage: false,
    kdp: false,
  },
  pro: {
    projects: Infinity,
    searchPerMonth: Infinity,
    versionsPerChapter: Infinity,
    storageMB: 10240,
    sellingPage: true,
    kdp: true,
  },
} as const satisfies Record<Plan, PlanLimits>

export interface PlanLimits {
  projects: number
  searchPerMonth: number
  versionsPerChapter: number
  storageMB: number
  sellingPage: boolean
  kdp: boolean
}

// ── 사용자 ──────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  plan: Plan
  plan_expires_at: string | null
  terms_agreed_at: string | null
  privacy_agreed_at: string | null
  created_at: string
  updated_at: string
}

// ── 프로젝트 ─────────────────────────────────────────────────

export type Platform = 'bookk' | 'kyobo' | 'kdp'
export type ProjectStatus = 'draft' | 'in_progress' | 'completed' | 'published'

export interface Project {
  id: string
  user_id: string
  title: string
  platform: Platform
  status: ProjectStatus
  target_words: number
  current_words: number
  cover_image_url: string | null
  description: string | null
  genre: string | null
  created_at: string
  updated_at: string
}

export interface ProjectWithChapters extends Project {
  chapters: Chapter[]
}

// ── 챕터 ─────────────────────────────────────────────────────

export interface Chapter {
  id: string
  project_id: string
  order_idx: number
  title: string
  /** TipTap JSON 문서 */
  content: TipTapDocument | null
  word_count: number
  created_at: string
  updated_at: string
}

/** TipTap ProseMirror JSON 최상위 타입 */
export interface TipTapDocument {
  type: 'doc'
  content: TipTapNode[]
}

export interface TipTapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  marks?: TipTapMark[]
  text?: string
}

export interface TipTapMark {
  type: string
  attrs?: Record<string, unknown>
}

// ── 챕터 버전 ────────────────────────────────────────────────

export type VersionTrigger = 'ai_edit' | 'autosave' | 'manual'

export interface ChapterVersion {
  id: string
  chapter_id: string
  content: TipTapDocument
  trigger: VersionTrigger
  created_at: string
}

// ── 검색 ─────────────────────────────────────────────────────

export interface SearchResult {
  id: string
  project_id: string
  query: string
  results: SearchResultItem[]
  created_at: string
}

export interface SearchResultItem {
  title: string
  url: string
  snippet: string
  published_date?: string
}

export interface SearchUsage {
  id: string
  user_id: string
  count: number
  reset_at: string
}

// ── 원고 진단 ────────────────────────────────────────────────

export interface Diagnostic {
  id: string
  user_id: string | null
  session_token: string
  file_storage_path: string | null
  report: DiagnosticReport | null
  status: DiagnosticStatus
  created_at: string
}

export type DiagnosticStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface DiagnosticReport {
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  platform_fit: Record<Platform, PlatformFitScore>
  overall_score: number
  word_count: number
  estimated_pages: number
}

export interface PlatformFitScore {
  score: number
  reason: string
}

// ── 구독 / 결제 ───────────────────────────────────────────────

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'pending'

export interface Subscription {
  id: string
  user_id: string
  toss_billing_key: string
  plan: Plan
  status: SubscriptionStatus
  amount: number
  next_billing_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface BillingHistory {
  id: string
  subscription_id: string
  amount: number
  status: 'success' | 'failed'
  toss_payment_key: string | null
  error_message: string | null
  billed_at: string
}

// ── AI 채팅 ───────────────────────────────────────────────────

export type AIChatMode =
  | 'writing'      // 집필 보조
  | 'outline'      // 목차 기획
  | 'proofread'    // 맞춤법 교정
  | 'style'        // 문체 교열
  | 'search'       // 자료 검색

export interface AIChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  mode: AIChatMode
  sources?: SearchResultItem[]
  created_at: string
}

// ── DOCX / 파일 생성 ──────────────────────────────────────────

export interface DocxGenerationOptions {
  project_id: string
  platform: Platform
  include_cover: boolean
  font_size?: number
  include_page_number?: boolean
  include_header_title?: boolean
}

export interface EpubGenerationOptions {
  project_id: string
  language: 'ko' | 'en'
  include_toc: boolean
  auto_toc?: boolean
  isbn?: string
}

// ── API 응답 공통 래퍼 ────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
}

// ── 플랫폼 규격 ───────────────────────────────────────────────

export interface PlatformSpec {
  name: string
  pageWidthMM: number
  pageHeightMM: number
  marginTopMM: number
  marginBottomMM: number
  marginLeftMM: number
  marginRightMM: number
  fontFamily: string
  fontSizePt: number
  lineHeightPt: number
  minWords: number
  maxWords: number
}

// ── KDP 확장 타입 ─────────────────────────────────────────────

export type KdpContributorRole = 'editor' | 'translator' | 'illustrator' | 'narrator'

export interface KdpContributor {
  role: KdpContributorRole
  name: string
}

export type KdpMaturityRating = 'general' | 'teen' | 'mature'
