#!/usr/bin/env bash
# =============================================================================
# 나눔고딕 OTF 폰트 설치 스크립트
#
# 라이선스: OFL (SIL Open Font License) — 상업적 임베딩 자유
# 출처: 네이버 한글한글아름답게 프로젝트
#
# 사용법:
#   bash font-install.sh           # 프로젝트 루트에서 실행
#   npm run fonts:install          # npm 스크립트로 실행
#
# Vercel 빌드에서 자동 실행하려면 vercel.json에 추가:
#   "buildCommand": "bash font-install.sh && next build"
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FONTS_DIR="$SCRIPT_DIR/public/fonts"

echo "📦 나눔고딕 폰트 다운로드 중..."

mkdir -p "$FONTS_DIR"

# GitHub 미러 (Naver 공식 배포가 직접 curl 차단 시 사용)
GITHUB_BASE="https://github.com/naver/nanumfont/raw/master/fonts/otf"

download_font() {
  local filename="$1"
  local dest="$FONTS_DIR/$filename"

  if [ -f "$dest" ]; then
    echo "  ✓ $filename (이미 존재, 건너뜀)"
    return
  fi

  echo "  ↓ $filename 다운로드 중..."

  # 1차 시도: Google Fonts CDN
  if curl -fsSL --retry 3 --retry-delay 2 \
    "https://fonts.gstatic.com/s/nanumgothic/v21/${filename}" \
    -o "$dest" 2>/dev/null; then
    echo "  ✓ $filename (Google Fonts)"
    return
  fi

  # 2차 시도: GitHub 미러
  if curl -fsSL --retry 3 --retry-delay 2 \
    "$GITHUB_BASE/$filename" \
    -o "$dest" 2>/dev/null; then
    echo "  ✓ $filename (GitHub)"
    return
  fi

  echo "  ✗ $filename 다운로드 실패 — 수동 설치 필요"
  echo "    수동 다운로드: https://hangeul.naver.com/font"
}

# NanumGothic Regular
download_font "NanumGothic.otf"

# NanumGothic Bold
download_font "NanumGothicBold.otf"

echo ""
echo "완료: $FONTS_DIR"
echo ""

# 파일 존재 여부 최종 확인
if [ -f "$FONTS_DIR/NanumGothic.otf" ]; then
  SIZE=$(du -h "$FONTS_DIR/NanumGothic.otf" | cut -f1)
  echo "  NanumGothic.otf — $SIZE ✓"
else
  echo "  경고: NanumGothic.otf 없음 — DOCX/EPUB 폰트 임베딩이 비활성화됩니다."
  echo "  폰트 없이도 앱은 정상 동작하나, 한글 DOCX 품질에 영향이 있습니다."
fi

if [ -f "$FONTS_DIR/NanumGothicBold.otf" ]; then
  SIZE=$(du -h "$FONTS_DIR/NanumGothicBold.otf" | cut -f1)
  echo "  NanumGothicBold.otf — $SIZE ✓"
fi
