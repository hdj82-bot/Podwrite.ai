/**
 * POD 생성에 사용되는 폰트 파일 절대 경로 유틸리티
 *
 * Vercel 서버리스 환경에서 process.cwd() 기준으로 경로를 반환합니다.
 * DOCX(lib/docx-generator.ts)와 EPUB(lib/epub-generator.ts) 생성기,
 * Inngest 잡(inngest/generate-epub.ts)에서 공통으로 재사용합니다.
 */
import * as path from 'path'
import * as fs from 'fs'

/**
 * public/fonts/ 디렉터리 내 폰트 파일의 절대 경로를 반환합니다.
 */
export function getFontPath(fontFileName: string): string {
  return path.join(process.cwd(), 'public', 'fonts', fontFileName)
}

/**
 * NanumGothic.otf 절대 경로 반환 (편의 래퍼)
 */
export function getNanumGothicPath(): string {
  return getFontPath('NanumGothic.otf')
}

/**
 * 폰트 파일 존재 여부 확인 — Inngest 잡 pre-flight 체크용
 */
export function fontExists(fontFileName: string): boolean {
  try {
    fs.accessSync(getFontPath(fontFileName), fs.constants.R_OK)
    return true
  } catch {
    return false
  }
}
