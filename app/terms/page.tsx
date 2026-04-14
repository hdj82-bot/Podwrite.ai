import type { Metadata } from 'next'
import Link from 'next/link'
import { Pen } from 'lucide-react'

export const metadata: Metadata = {
  title: '이용약관',
  description: 'Podwrite.ai 서비스 이용약관',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* 헤더 */}
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

      {/* 본문 */}
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">이용약관</h1>
          <div className="flex items-center gap-3 mb-10">
            <span className="inline-flex items-center rounded-full bg-orange-50 border border-orange-200 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
              버전 2026-04-14
            </span>
            <p className="text-sm text-gray-400">시행일: 2026년 4월 14일</p>
          </div>

          <div className="prose prose-gray max-w-none space-y-10 text-sm leading-relaxed text-gray-700">

            {/* 1. 서비스 소개 */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                제1조 서비스 소개
              </h2>
              <p>
                Podwrite.ai(이하 &ldquo;서비스&rdquo;)는 인공지능 기술을 활용하여 작가·저자가 기획, 집필, 교열,
                출판 파일 생성까지의 과정을 하나의 화면에서 완료할 수 있도록 지원하는 클라우드 기반
                저작 보조 플랫폼입니다. 서비스는 부크크(Bookk), 교보문고 퍼플, Amazon KDP 등
                주요 자가출판(POD) 플랫폼의 파일 규격을 자동으로 적용한 출판 파일을 생성합니다.
              </p>
              <p className="mt-3">
                본 약관은 이용자와 Podwrite.ai 운영 주체(이하 &ldquo;회사&rdquo;) 간의 서비스 이용 조건 및
                권리·의무를 규정합니다. 서비스에 가입하거나 이용하는 경우 본 약관에 동의한 것으로 간주합니다.
              </p>
            </section>

            {/* 2. 계정 및 이용 */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                제2조 계정 및 이용
              </h2>
              <ol className="list-decimal list-inside space-y-2 pl-1">
                <li>
                  만 14세 이상인 자만 계정을 생성할 수 있습니다. 미성년자는 법정대리인의 동의가
                  필요합니다.
                </li>
                <li>
                  이용자는 하나의 계정만 보유할 수 있으며, 계정 및 비밀번호를 타인과 공유하거나
                  양도할 수 없습니다.
                </li>
                <li>
                  이용자는 계정 정보(이메일, 비밀번호 등)를 정확하게 유지할 의무가 있으며, 무단
                  접근이 의심되는 경우 즉시 회사에 신고해야 합니다.
                </li>
                <li>
                  이용자가 서비스에 업로드·저장한 원고의 저작권은 100% 이용자에게 귀속됩니다.
                  회사는 해당 콘텐츠를 AI 학습, 제3자 제공 또는 마케팅 목적으로 사용하지 않습니다.
                </li>
                <li>
                  무료 플랜 이용자는 프로젝트 1개, 월 자료 검색 10회 등 플랜별 제한이 적용됩니다.
                  세부 한도는 서비스 내 요금제 페이지에서 확인할 수 있습니다.
                </li>
              </ol>
            </section>

            {/* 3. 구독·결제 */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                제3조 구독 및 결제
              </h2>
              <ol className="list-decimal list-inside space-y-2 pl-1">
                <li>
                  유료 플랜(베이직 ₩9,900/월, 프로 ₩19,900/월)은 Toss Payments를 통해
                  자동 결제됩니다. 연간 구독 시 2개월분 할인이 적용됩니다.
                </li>
                <li>
                  결제는 매월 구독 갱신일에 자동으로 청구됩니다. 결제 실패 시 3일 이내 재시도하며,
                  이후에도 실패할 경우 플랜이 무료로 전환됩니다.
                </li>
                <li>
                  환불은 결제일 기준 7일 이내 미사용 시 전액 환불됩니다. 이후에는 남은 구독 기간에
                  대해 일할 계산 환불을 제공합니다. 환불 신청은 support@podwrite.ai로 문의하세요.
                </li>
                <li>
                  구독 해지 후에도 결제된 만료일까지 유료 기능을 계속 이용할 수 있습니다.
                  만료일 이후에는 기존에 저장된 원고의 읽기 및 DOCX·PDF 내보내기만 가능하며,
                  신규 AI 기능 및 파일 생성은 사용할 수 없습니다. 재구독 시 즉시 전체 기능이 복원됩니다.
                </li>
                <li>
                  해지 시 이용자의 원고 및 데이터는 30일간 보존되며, 재구독 시 즉시 복원됩니다.
                  30일 경과 후에는 데이터가 영구 삭제될 수 있습니다.
                </li>
              </ol>
            </section>

            {/* 4. 금지 행위 */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                제4조 금지 행위
              </h2>
              <p className="mb-3">이용자는 다음 행위를 해서는 안 됩니다.</p>
              <ul className="list-disc list-inside space-y-2 pl-1">
                <li>타인의 저작권, 명예, 개인정보 등 권리를 침해하는 콘텐츠 업로드</li>
                <li>허위·과장 정보, 스팸, 음란물 등 불법 콘텐츠 생성 또는 배포</li>
                <li>서비스의 보안 취약점을 탐색하거나 비정상적인 방법으로 접근 시도</li>
                <li>API 또는 크롤러를 이용한 무단 대량 데이터 수집</li>
                <li>
                  계정을 상업적으로 재판매하거나, 한 계정을 여러 사람이 공유하여 이용하는 행위
                </li>
                <li>관련 법령 또는 공공질서에 위반되는 행위</li>
              </ul>
              <p className="mt-3">
                금지 행위 적발 시 사전 통보 없이 계정이 정지 또는 영구 삭제될 수 있습니다.
              </p>
            </section>

            {/* 5. 면책 조항 */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                제5조 면책 조항
              </h2>
              <ol className="list-decimal list-inside space-y-2 pl-1">
                <li>
                  서비스는 &ldquo;있는 그대로(AS-IS)&rdquo; 제공됩니다. 회사는 서비스의 완전성, 정확성,
                  특정 목적 적합성을 보증하지 않습니다.
                </li>
                <li>
                  AI가 생성한 텍스트, 번역, 교정 결과의 품질 및 정확성에 대해 회사는 법적 책임을
                  지지 않습니다. 최종 원고는 이용자가 직접 검토·확인할 책임이 있습니다.
                </li>
                <li>
                  회사의 귀책 사유 없는 천재지변, 통신 장애, 제3자 서비스(Supabase, AWS 등)
                  장애로 인한 데이터 손실에 대해 회사는 책임을 지지 않습니다.
                </li>
                <li>
                  이용자가 생성·업로드한 콘텐츠의 표절, 저작권 침해, 명예훼손 등으로 인해
                  발생하는 모든 법적 분쟁 및 손해배상 책임은 이용자 본인에게 있습니다.
                  AI가 생성한 문장이라도 출판·배포 전 저작권 침해 여부는 이용자가 직접 확인하여야 합니다.
                </li>
              </ol>
            </section>

            {/* 6. AI 콘텐츠 출판 유의사항 */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                제6조 AI 생성 콘텐츠 출판 시 유의사항
              </h2>
              <p className="mb-3">
                Amazon KDP, 교보문고 퍼플 등 주요 자가출판 플랫폼은 AI 생성 콘텐츠에 대한
                별도 신고 또는 표기 의무를 두고 있습니다. Podwrite.ai를 통해 생성된 원고를
                출판할 경우, 아래 체크리스트를 반드시 확인하시기 바랍니다.
              </p>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 space-y-2 text-sm">
                <p className="font-semibold text-amber-800 mb-2">KDP 제출 전 AI 콘텐츠 체크리스트</p>
                <ul className="space-y-2 text-amber-900">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 select-none">☐</span>
                    <span>AI가 생성한 텍스트·번역이 포함된 경우 KDP 대시보드에서 &ldquo;AI-generated content&rdquo; 항목을 신고했습니까?</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 select-none">☐</span>
                    <span>AI 생성 문장의 표절 여부를 별도 도구(Copyscape, iThenticate 등)로 검증했습니까?</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 select-none">☐</span>
                    <span>원고 전체를 직접 읽고 사실 오류, 허위 정보, 부적절한 표현을 수정했습니까?</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 select-none">☐</span>
                    <span>제출 예정 플랫폼의 최신 AI 정책 변경 사항을 직접 확인했습니까?</span>
                  </li>
                </ul>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                위 체크리스트는 참고용입니다. 정책 위반으로 인한 계정 정지·원고 삭제 등의
                불이익에 대해 회사는 책임을 지지 않습니다.
              </p>
            </section>

            {/* 7. 서비스 중단 */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                제7조 서비스 중단 및 종료
              </h2>
              <p>
                회사는 시스템 점검, 업그레이드, 불가피한 사유로 서비스를 일시 중단할 수 있습니다.
                예정된 중단은 최소 24시간 전 서비스 내 공지를 통해 안내합니다.
                서비스를 영구 종료하는 경우에는 최소 30일 전 이용자에게 이메일로 통보하며,
                이용자가 데이터를 내보낼 수 있는 충분한 기간을 제공합니다.
              </p>
            </section>

            {/* 8. 약관 변경 */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                제8조 약관 변경
              </h2>
              <p>
                회사는 관련 법령이나 서비스 정책 변경에 따라 본 약관을 개정할 수 있습니다.
                중요 변경 사항은 시행 7일 전(이용자에게 불리한 내용은 30일 전)에 서비스 내 공지
                및 이메일로 안내합니다. 변경된 약관에 동의하지 않는 경우 서비스 탈퇴를 통해
                이용 계약을 해지할 수 있습니다.
              </p>
            </section>

            {/* 9. 연락처 */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                제9조 연락처
              </h2>
              <p>
                본 약관 또는 서비스 이용에 관한 문의는 아래로 연락하세요.
              </p>
              <div className="mt-3 rounded-xl bg-gray-50 border border-gray-200 px-5 py-4 text-sm">
                <p className="font-semibold text-gray-800 mb-1">Podwrite.ai 고객지원</p>
                <p>
                  이메일:{' '}
                  <a
                    href="mailto:support@podwrite.ai"
                    className="text-orange-600 hover:underline"
                  >
                    support@podwrite.ai
                  </a>
                </p>
                <p className="mt-1 text-gray-400 text-xs">평일 10:00–18:00 (KST) · 1–2 영업일 이내 답변</p>
              </div>
            </section>

          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="border-t border-gray-100 bg-white py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-orange-500 flex items-center justify-center">
              <Pen className="h-2.5 w-2.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-700">Podwrite.ai</span>
          </div>
          <nav className="flex items-center gap-5 text-xs text-gray-400">
            <Link href="/terms" className="hover:text-gray-700 transition-colors font-medium text-gray-600">
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
