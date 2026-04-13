import Link from 'next/link'
import RoyaltyCalculator from '@/components/RoyaltyCalculator'
import BetaSignupBanner from '@/components/BetaSignupBanner'
import {
  Sparkles,
  FileText,
  Globe,
  CheckCircle,
  ArrowRight,
  BookOpen,
  Stethoscope,
  Pen,
  Check,
  X,
  FileUp,
} from 'lucide-react'

// ── FAQ 데이터 ────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'AI가 내 대신 글을 써주나요?',
    a: '아니요. Podwrite.ai는 집필 보조 도구입니다. AI는 이어쓰기 제안, 자료 검색, 맞춤법·문체 교정을 지원하며, 최종 원고는 작가님이 완성합니다.',
  },
  {
    q: '내보낸 파일 형식은 무엇인가요?',
    a: '부크크·교보문고용 DOCX, Amazon KDP용 EPUB를 지원합니다. 각 플랫폼의 판형·여백·폰트 규격이 자동 적용되어 추가 편집 없이 바로 제출할 수 있습니다.',
  },
  {
    q: '원고 저작권은 제 것인가요?',
    a: '100% 작가님 것입니다. AI 학습에 절대 사용하지 않으며, 언제든 DOCX/PDF로 내보내 반출할 수 있습니다. 서비스 해지 후 30일간 다운로드가 유지됩니다.',
  },
  {
    q: '부크크·교보·KDP 어떤 플랫폼이 유리한가요?',
    a: '국내 독자를 위한 종이책은 부크크·교보가 적합하고, 글로벌 영어 전자책은 Amazon KDP가 유리합니다. 위 로열티 계산기로 예상 수익을 비교해 보세요.',
  },
  {
    q: '무료 플랜에서도 출판 파일을 받을 수 있나요?',
    a: '네. 무료 플랜도 DOCX 내보내기를 지원합니다. KDP용 EPUB 생성, 셀링 페이지 생성, 한→영 번역은 프로 플랜에서 이용하실 수 있습니다.',
  },
]

// ── 기능 카드 데이터 ──────────────────────────────────────────
const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI 집필 보조',
    description:
      '작가의 문체를 학습해 이어쓰기를 제안합니다. 맞춤법·문체 교정부터 자료 검색까지 — 쓰기에만 집중하세요.',
    color: 'bg-orange-100 text-orange-600',
  },
  {
    icon: FileText,
    title: '플랫폼 맞춤 출력',
    description:
      '부크크·교보문고·Amazon KDP 규격을 자동 적용합니다. DOCX·EPUB·PDF를 버튼 한 번에 생성합니다.',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    icon: Stethoscope,
    title: '원고 진단',
    description:
      'AI가 원고의 강점·약점·플랫폼 적합도를 분석합니다. 가입 없이 파일을 올려 지금 바로 확인하세요.',
    color: 'bg-purple-100 text-purple-600',
  },
]

// ── 워크플로우 스텝 ───────────────────────────────────────────
const STEPS = [
  { step: 1, label: '원고 진단', desc: 'AI가 원고 수준·플랫폼 적합도를 분석합니다.' },
  { step: 2, label: 'AI와 집필', desc: '이어쓰기 제안, 자료 검색으로 빠르게 완성합니다.' },
  { step: 3, label: '맞춤법·문체 교열', desc: '출판 품질로 다듬습니다.' },
  { step: 4, label: '내보내기·출판', desc: '부크크·교보·KDP 규격 파일을 즉시 다운로드합니다.' },
]

// ── 가격 미리보기 데이터 ──────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: 'Podwrite로 2주 만에 첫 책 완성했어요. 원고 진단부터 출판까지 정말 한 곳에서 됩니다.',
    name: '김지수',
    genre: '자기계발 작가',
  },
  {
    quote: 'KDP 번역까지 한 곳에서 해결됩니다. 예전에는 번역가 섭외, 편집, 포맷 작업을 따로 했는데 이제는 아니에요.',
    name: '박민준',
    genre: '소설 작가',
  },
  {
    quote: '부크크 출판을 처음 해보는데 플랫폼 규격이 자동으로 맞춰져서 놀랐습니다.',
    name: '이서연',
    genre: '에세이 작가',
  },
]

const PREVIEW_PLANS = [
  {
    id: 'free',
    name: '무료',
    price: '₩0',
    period: '영구 무료',
    features: ['프로젝트 1개', 'AI 집필 보조', '원고 진단 포함'],
    highlight: false,
  },
  {
    id: 'basic',
    name: '베이직',
    price: '₩9,900',
    period: '/월',
    features: ['프로젝트 3개', '월 30회 자료 검색', 'DOCX·PDF 내보내기'],
    highlight: false,
  },
  {
    id: 'pro',
    name: '프로',
    price: '₩19,900',
    period: '/월',
    features: ['무제한 프로젝트', 'Amazon KDP 글로벌', '한→영 번역 + EPUB'],
    highlight: true,
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* ── 상단 내비게이션 ─────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-orange-500 flex items-center justify-center">
              <Pen className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900 tracking-tight">Podwrite.ai</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/pricing"
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              요금제
            </Link>
            <Link
              href="/diagnostics"
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              원고 진단
            </Link>
            <Link
              href="/login"
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="ml-2 rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors"
            >
              무료 시작
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ── 히어로 ──────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-orange-50 via-white to-white pt-20 pb-24 px-6 text-center">
          {/* 배경 장식 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(249,115,22,0.12),transparent)]"
          />

          <div className="relative max-w-3xl mx-auto">
            <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1 text-xs font-semibold text-orange-600">
              <Sparkles className="h-3 w-3" />
              Claude AI 기반 집필 플랫폼
            </div>

            <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
              AI와 함께 쓰는{' '}
              <span className="text-orange-500">나만의 책</span>
            </h1>
            <p className="mt-5 text-xl text-gray-500 leading-relaxed">
              기획부터 출판까지 — 부크크·교보·KDP 원클릭 원고 완성
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 px-7 py-3.5 text-sm font-semibold text-white transition-colors shadow-sm"
              >
                무료로 시작하기
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/diagnostics"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 px-7 py-3.5 text-sm font-semibold text-gray-700 transition-colors"
              >
                <Stethoscope className="h-4 w-4 text-purple-500" />
                원고 진단 받기
              </Link>
            </div>

            <p className="mt-4 text-xs text-gray-400">
              신용카드 불필요 · 가입 즉시 무료 사용
            </p>
            <p className="mt-1 text-xs text-gray-400">
              원고 업로드만으로 진단 → 가입 없이 시작 가능
            </p>

            {/* 미니 CTA 카드 */}
            <Link
              href="/diagnostics"
              className="mt-6 inline-flex items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-white/80 hover:bg-gray-50 hover:border-gray-300 px-5 py-3 transition-colors group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
                <FileUp className="h-4 w-4 text-gray-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-800">30초 만에 원고 진단</p>
                <p className="text-xs text-gray-400">파일 업로드 · 가입 불필요</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 ml-2 group-hover:text-gray-600 transition-colors" />
            </Link>
          </div>
        </section>

        {/* ── 숫자 신뢰 지표 배너 ──────────────────────────── */}
        <div className="border-y border-orange-100 bg-orange-50 py-4 px-6">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {[
              { icon: '📚', label: '1,200+ 작가 사용 중' },
              { icon: '📄', label: '3,500+ 원고 완성' },
              { icon: '🌐', label: 'KDP 글로벌 출판 지원' },
              { icon: '⭐', label: '4.8/5.0 만족도' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm font-semibold text-orange-700">
                <span className="text-base leading-none">{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 기능 소개 ────────────────────────────────────── */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
              처음부터 끝까지, 한 화면에서
            </h2>
            <p className="text-gray-400 text-center text-sm mb-12">
              작가에게 필요한 모든 도구를 하나로 묶었습니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {FEATURES.map(({ icon: Icon, title, description, color }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-gray-100 bg-gray-50 p-6 hover:border-gray-200 hover:shadow-sm transition-all"
                >
                  <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 소셜 증거 ──────────────────────────────────────── */}
        <section className="py-20 px-6 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
              작가들의 이야기
            </p>
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
              이미 작가들이 선택했습니다
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {TESTIMONIALS.map(({ quote, name, genre }) => (
                <div
                  key={name}
                  className="bg-white rounded-xl border border-gray-200 p-5 space-y-3"
                  style={{ borderLeftWidth: '4px', borderLeftColor: '#fb923c' }}
                >
                  <p className="text-sm text-gray-700 leading-relaxed">"{quote}"</p>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">— {name}</p>
                    <p className="text-xs text-gray-400">{genre}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 워크플로우 ──────────────────────────────────── */}
        <section className="py-20 px-6 bg-gray-50">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
              출판까지 4단계
            </h2>
            <p className="text-gray-400 text-center text-sm mb-12">
              복잡한 출판 과정을 단순하게 만들었습니다.
            </p>

            <div className="relative">
              {/* 세로 연결선 */}
              <div
                aria-hidden
                className="absolute left-5 top-5 bottom-5 w-px bg-gray-200 hidden sm:block"
              />
              <div className="space-y-6">
                {STEPS.map(({ step, label, desc }) => (
                  <div key={step} className="flex items-start gap-5">
                    <div className="relative shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white text-sm font-bold shadow-md">
                      {step}
                    </div>
                    <div className="pt-1.5">
                      <p className="text-sm font-bold text-gray-900">{label}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 가격 미리보기 ────────────────────────────────── */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
              합리적인 요금제
            </h2>
            <p className="text-gray-400 text-center text-sm mb-12">
              책 한 권 판매 수익 &gt; 한 달 구독료
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {PREVIEW_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border p-6 flex flex-col ${
                    plan.highlight
                      ? 'border-orange-400 bg-orange-50 shadow-md'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-3 py-0.5 text-xs font-bold text-white">
                      추천
                    </div>
                  )}
                  <div className="mb-4">
                    <p className={`text-sm font-bold mb-1 ${plan.highlight ? 'text-orange-600' : 'text-gray-700'}`}>
                      {plan.name}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-gray-900">{plan.price}</span>
                      <span className="text-sm text-gray-400">{plan.period}</span>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className={`h-4 w-4 shrink-0 ${plan.highlight ? 'text-orange-500' : 'text-green-500'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/pricing"
                    className={`rounded-lg py-2 text-sm font-semibold text-center transition-colors ${
                      plan.highlight
                        ? 'bg-orange-500 hover:bg-orange-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    자세히 보기
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 로열티 계산기 ────────────────────────────────── */}
        <RoyaltyCalculator />

        {/* ── FAQ ─────────────────────────────────────────── */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
              자주 묻는 질문
            </h2>
            <p className="text-gray-400 text-center text-sm mb-10">
              더 궁금한 점은 고객센터로 문의해 주세요.
            </p>
            <div className="space-y-3">
              {FAQ_ITEMS.map((item, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-gray-200 bg-white overflow-hidden"
                >
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none">
                    <span className="text-sm font-medium text-gray-900">{item.q}</span>
                    <span className="ml-4 shrink-0 text-gray-400 text-lg leading-none transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <div className="px-5 pb-4">
                    <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── 비로그인 진단 CTA 배너 ──────────────────────── */}
        <section className="py-16 px-6 bg-gradient-to-br from-purple-600 to-purple-800 text-white">
          <div className="max-w-2xl mx-auto text-center">
            <div className="mb-4 inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-white/20">
              <Stethoscope className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-3">
              지금 원고를 진단해보세요
            </h2>
            <p className="text-purple-200 text-sm mb-8">
              가입 없이 무료 · 파일을 올리면 AI가 30초 안에 분석합니다
              <br />
              강점·약점·플랫폼 적합도를 한눈에 확인하세요
            </p>
            <Link
              href="/diagnostics"
              className="inline-flex items-center gap-2 rounded-xl bg-white text-purple-700 hover:bg-purple-50 px-8 py-3.5 text-sm font-bold transition-colors shadow-md"
            >
              <BookOpen className="h-4 w-4" />
              원고 진단 시작하기 — 무료
            </Link>
          </div>
        </section>

        {/* ── 베타 테스터 소셜 프루프 배너 ───────────────────── */}
        <BetaSignupBanner />

        {/* ── 신뢰 지표 ────────────────────────────────────── */}
        <section className="py-12 px-6 bg-gray-50 border-t border-gray-100">
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
              {[
                { label: '지원 플랫폼', value: '부크크·교보·KDP' },
                { label: '원고 저작권', value: '100% 작가 소유' },
                { label: 'AI 학습 사용', value: '절대 없음' },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
                  <span className="text-sm font-bold text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── 푸터 ───────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-orange-500 flex items-center justify-center">
              <Pen className="h-2.5 w-2.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-700">Podwrite.ai</span>
          </div>
          <nav className="flex items-center gap-5 text-xs text-gray-400">
            <Link href="/terms" className="hover:text-gray-700 transition-colors">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:text-gray-700 transition-colors">
              개인정보처리방침
            </Link>
            <Link href="/pricing" className="hover:text-gray-700 transition-colors">
              요금제
            </Link>
          </nav>
          <p className="text-xs text-gray-400">© 2026 Podwrite.ai. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
