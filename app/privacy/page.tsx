import type { Metadata } from 'next'
import Link from 'next/link'
import { Pen } from 'lucide-react'

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: 'Podwrite.ai 개인정보처리방침',
}

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">개인정보처리방침</h1>
          <p className="text-sm text-gray-400 mb-10">시행일: 2026년 1월 1일</p>

          <div className="space-y-10 text-sm leading-relaxed text-gray-700">

            {/* 수집 항목 */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                제1조 수집하는 개인정보 항목
              </h2>
              <p className="mb-3">
                Podwrite.ai는 서비스 제공에 필요한 최소한의 개인정보만 수집합니다.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">구분</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">항목</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">필수 여부</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-800">회원가입</td>
                      <td className="px-4 py-3 text-gray-600">이메일 주소, 비밀번호(암호화 저장)</td>
                      <td className="px-4 py-3 text-gray-600">필수</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-800">유료 결제</td>
                      <td className="px-4 py-3 text-gray-600">카드 빌링키(Toss Payments 위탁 보관), 결제 이력</td>
                      <td className="px-4 py-3 text-gray-600">유료 플랜 시 필수</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-800">서비스 이용</td>
                      <td className="px-4 py-3 text-gray-600">원고 콘텐츠, 챕터 데이터, 업로드 파일</td>
                      <td className="px-4 py-3 text-gray-600">서비스 이용 시 수집</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-800">자동 수집</td>
                      <td className="px-4 py-3 text-gray-600">IP 주소, 브라우저 종류, 접속 시간, 서비스 이용 기록</td>
                      <td className="px-4 py-3 text-gray-600">자동 수집</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-gray-400">
                * 카드 번호 등 민감한 결제 정보는 Toss Payments가 직접 수집·보관하며, 회사는 빌링키만 보유합니다.
              </p>
            </section>

            {/* 수집 목적 */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                제2조 개인정보 수집 및 이용 목적
              </h2>
              <ul className="list-disc list-inside space-y-2 pl-1">
                <li>회원 식별 및 인증, 계정 관리</li>
                <li>유료 구독 결제 처리 및 구독 상태 관리</li>
                <li>AI 집필 보조, 원고 저장·버전 관리 등 핵심 서비스 제공</li>
                <li>서비스 장애 대응, 보안 사고 예방 및 처리</li>
                <li>약관 변경, 서비스 중단 등 중요 사항 이메일 안내</li>
                <li>서비스 품질 개선을 위한 이용 패턴 통계 분석 (비식별화)</li>
              </ul>
              <p className="mt-3 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-xs text-orange-800">
                이용자의 원고 콘텐츠는 AI 모델 학습, 제3자 광고, 마케팅 목적으로 절대 사용하지 않습니다.
              </p>
            </section>

            {/* 보존 기간 */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                제3조 개인정보 보존 기간
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">항목</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">보존 기간</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">근거</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-800">회원 정보</td>
                      <td className="px-4 py-3 text-gray-600">탈퇴 후 30일 (이후 영구 삭제)</td>
                      <td className="px-4 py-3 text-gray-600">서비스 운영 정책</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-800">원고 및 파일</td>
                      <td className="px-4 py-3 text-gray-600">구독 해지 후 30일 (이후 영구 삭제)</td>
                      <td className="px-4 py-3 text-gray-600">서비스 운영 정책</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-800">결제 이력</td>
                      <td className="px-4 py-3 text-gray-600">5년</td>
                      <td className="px-4 py-3 text-gray-600">전자상거래법 제6조</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-800">접속 로그</td>
                      <td className="px-4 py-3 text-gray-600">3개월</td>
                      <td className="px-4 py-3 text-gray-600">통신비밀보호법 제15조의2</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 제3자 제공 */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                제4조 개인정보 제3자 제공 및 처리 위탁
              </h2>
              <p className="mb-3">
                회사는 서비스 운영을 위해 아래 업체에 개인정보 처리를 위탁합니다.
                수탁 업체는 위탁 목적 이외의 용도로 개인정보를 이용하지 않습니다.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">수탁 업체</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">위탁 업무</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">보존 기간</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-800">Supabase Inc.</td>
                      <td className="px-4 py-3 text-gray-600">
                        데이터베이스 및 인증 인프라 운영 (미국 서버 — EU-US DPF 준수)
                      </td>
                      <td className="px-4 py-3 text-gray-600">위탁 계약 종료 시</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-800">Toss Payments</td>
                      <td className="px-4 py-3 text-gray-600">결제 처리 및 빌링키 보관</td>
                      <td className="px-4 py-3 text-gray-600">결제 관계 종료 후 5년</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-800">Resend</td>
                      <td className="px-4 py-3 text-gray-600">
                        이메일 발송 (인증, 공지, 서비스 알림)
                      </td>
                      <td className="px-4 py-3 text-gray-600">위탁 계약 종료 시</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-800">Anthropic, PBC</td>
                      <td className="px-4 py-3 text-gray-600">
                        Claude AI API 처리 (집필 보조, 번역 요청 내용)
                      </td>
                      <td className="px-4 py-3 text-gray-600">Anthropic 정책에 따름</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-gray-400">
                위 업체 외 제3자에게 개인정보를 제공하지 않습니다. 단, 법령에 따른 수사기관 요청 시 예외입니다.
              </p>
            </section>

            {/* 이용자 권리 */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                제5조 이용자의 권리
              </h2>
              <p className="mb-3">이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
              <ul className="list-disc list-inside space-y-2 pl-1">
                <li>
                  <span className="font-medium">열람:</span> 보유 중인 개인정보 조회를 요청할 수 있습니다.
                </li>
                <li>
                  <span className="font-medium">정정:</span> 부정확한 개인정보의 수정을 요청할 수 있습니다.
                </li>
                <li>
                  <span className="font-medium">삭제(잊힐 권리):</span> 계정 탈퇴 시 개인정보 삭제를 요청할 수 있습니다.
                  단, 법령상 보존 의무가 있는 정보는 즉시 삭제가 어려울 수 있습니다.
                </li>
                <li>
                  <span className="font-medium">처리 정지:</span> 특정 목적의 개인정보 처리 정지를 요청할 수 있습니다.
                </li>
                <li>
                  <span className="font-medium">이동:</span> 이용자가 제공한 데이터를 기계 판독 가능한 형식으로 받을 수 있습니다.
                </li>
              </ul>
              <p className="mt-3">
                권리 행사는 서비스 내 설정 페이지 또는{' '}
                <a href="mailto:support@podwrite.ai" className="text-orange-600 hover:underline">
                  support@podwrite.ai
                </a>
                로 문의하세요. 요청 후 10영업일 이내 처리합니다.
              </p>
            </section>

            {/* 쿠키·분석 */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                제6조 쿠키 및 분석 도구
              </h2>
              <ol className="list-decimal list-inside space-y-2 pl-1">
                <li>
                  서비스는 로그인 세션 유지, 사용자 설정 저장을 위해 필수 쿠키를 사용합니다.
                  이 쿠키는 브라우저 설정으로 거부할 수 있으나, 거부 시 일부 기능이 정상 작동하지
                  않을 수 있습니다.
                </li>
                <li>
                  서비스 품질 개선을 위해 비식별화된 이용 패턴 통계를 내부적으로 수집합니다.
                  개인을 특정하는 방식으로는 사용하지 않습니다.
                </li>
                <li>
                  현재 Google Analytics 등 외부 광고·추적 스크립트는 사용하지 않습니다.
                  향후 도입 시 별도 동의를 받겠습니다.
                </li>
              </ol>
            </section>

            {/* 문의 */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                제7조 개인정보 보호 문의
              </h2>
              <p>
                개인정보 처리에 관한 문의, 불만 접수, 권리 행사 요청은 아래로 연락하세요.
              </p>
              <div className="mt-3 rounded-xl bg-gray-50 border border-gray-200 px-5 py-4 text-sm">
                <p className="font-semibold text-gray-800 mb-1">개인정보 보호 담당</p>
                <p>
                  이메일:{' '}
                  <a
                    href="mailto:support@podwrite.ai"
                    className="text-orange-600 hover:underline"
                  >
                    support@podwrite.ai
                  </a>
                </p>
                <p className="mt-1 text-gray-400 text-xs">
                  평일 10:00–18:00 (KST) · 10영업일 이내 답변
                </p>
              </div>
              <p className="mt-4 text-xs text-gray-500">
                개인정보 침해에 관한 신고·상담은 개인정보보호위원회(
                <a
                  href="https://www.pipc.go.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:underline"
                >
                  www.pipc.go.kr
                </a>
                , 국번 없이 182)를 이용하실 수 있습니다.
              </p>
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
            <Link href="/terms" className="hover:text-gray-700 transition-colors">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:text-gray-700 transition-colors font-medium text-gray-600">
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
