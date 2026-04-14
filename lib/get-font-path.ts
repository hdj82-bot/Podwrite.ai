import * as path from 'path'

/**
 * public/fonts/ 디렉터리 기준 폰트 파일 절대 경로 반환
 * Vercel 빌드 시: 'bash font-install.sh && next build' 명령으로 폰트를 먼저 설치해야 함
 */
export function getFontPath(fontFileName: string): string {
  return path.join(process.cwd(), 'public', 'fonts', fontFileName)
}

export function getNanumGothicPath(): string {
  return getFontPath('NanumGothic.otf')
}
