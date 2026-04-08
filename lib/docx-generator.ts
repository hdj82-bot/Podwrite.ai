/**
 * TipTap JSON → DOCX 변환기
 *
 * 플랫폼별 판형·여백·폰트를 적용해 POD 제출용 DOCX를 생성합니다.
 * 나눔고딕 OTF 폰트: public/fonts/NanumGothic.otf (임베딩)
 *
 * 의존 라이브러리: docx ^9.0.2
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageOrientation,
  SectionType,
  LineRuleType,
  convertMillimetersToTwip,
} from 'docx'
import * as fs from 'fs'
import * as path from 'path'
import type { TipTapDocument, TipTapNode, TipTapMark, Platform } from '@/types'
import { getPlatformSpec } from '@/lib/platform-specs'

// ── 폰트 임베딩 ───────────────────────────────────────────────────────

function loadFontBuffer(): Buffer | null {
  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NanumGothic.otf')
    return fs.readFileSync(fontPath)
  } catch {
    console.warn('[docx-generator] NanumGothic.otf 폰트 파일을 찾을 수 없습니다.')
    return null
  }
}

// ── TipTap 노드 → TextRun 변환 ────────────────────────────────────────

function getMarkValue(marks: TipTapMark[] | undefined, type: string): boolean {
  return marks?.some((m) => m.type === type) ?? false
}

function tipTapNodeToTextRuns(node: TipTapNode, fontFamily: string, fontSizePt: number): TextRun[] {
  if (node.type === 'text') {
    const text = node.text ?? ''
    const bold = getMarkValue(node.marks, 'bold')
    const italic = getMarkValue(node.marks, 'italic')
    const underline = getMarkValue(node.marks, 'underline')

    return [
      new TextRun({
        text,
        bold,
        italics: italic,
        underline: underline ? {} : undefined,
        font: fontFamily,
        size: Math.round(fontSizePt * 2), // half-points
      }),
    ]
  }

  // 인라인 노드 재귀 처리
  if (node.content) {
    return node.content.flatMap((child) => tipTapNodeToTextRuns(child, fontFamily, fontSizePt))
  }

  return []
}

// ── TipTap 블록 노드 → Paragraph 변환 ────────────────────────────────

function tipTapBlockToParagraphs(
  node: TipTapNode,
  fontFamily: string,
  fontSizePt: number,
  lineHeightPt: number,
): Paragraph[] {
  const spacing = {
    line: Math.round(lineHeightPt * 20), // twip: 1pt = 20 twip
    lineRule: LineRuleType.EXACT,
    after: Math.round(fontSizePt * 10), // 단락 아래 여백 (0.5줄)
  }

  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      const headingMap: Record<number, HeadingLevel> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      }
      const headingFontSize = fontSizePt + (4 - Math.min(level, 3)) * 2 // h1=+6, h2=+4, h3=+2
      const runs = (node.content ?? []).flatMap((child) =>
        tipTapNodeToTextRuns(child, fontFamily, headingFontSize),
      )
      return [
        new Paragraph({
          heading: headingMap[level] ?? HeadingLevel.HEADING_1,
          children: runs.length > 0 ? runs : [new TextRun({ text: '', font: fontFamily })],
          spacing: { ...spacing, before: Math.round(headingFontSize * 20) },
        }),
      ]
    }

    case 'paragraph': {
      const runs = (node.content ?? []).flatMap((child) =>
        tipTapNodeToTextRuns(child, fontFamily, fontSizePt),
      )
      return [
        new Paragraph({
          children: runs.length > 0 ? runs : [new TextRun({ text: '', font: fontFamily, size: Math.round(fontSizePt * 2) })],
          spacing,
          indent: { firstLine: Math.round(fontSizePt * 2 * 20) }, // 첫 줄 들여쓰기 (2글자)
        }),
      ]
    }

    case 'bulletList':
    case 'orderedList': {
      return (node.content ?? []).flatMap((item, idx) => {
        const runs = (item.content ?? []).flatMap((p) =>
          (p.content ?? []).flatMap((child) => tipTapNodeToTextRuns(child, fontFamily, fontSizePt)),
        )
        const bullet = node.type === 'orderedList' ? `${idx + 1}. ` : '• '
        return [
          new Paragraph({
            children: [
              new TextRun({ text: bullet, font: fontFamily, size: Math.round(fontSizePt * 2) }),
              ...runs,
            ],
            spacing,
            indent: { left: convertMillimetersToTwip(8) },
          }),
        ]
      })
    }

    case 'blockquote': {
      const runs = (node.content ?? []).flatMap((child) =>
        tipTapBlockToParagraphs(child, fontFamily, fontSizePt, lineHeightPt),
      )
      return runs
    }

    case 'horizontalRule': {
      return [
        new Paragraph({
          children: [new TextRun({ text: '─'.repeat(30), font: fontFamily, size: Math.round(fontSizePt * 2) })],
          alignment: AlignmentType.CENTER,
          spacing,
        }),
      ]
    }

    case 'hardBreak': {
      return [new Paragraph({ children: [], spacing })]
    }

    default:
      if (node.content) {
        return node.content.flatMap((child) =>
          tipTapBlockToParagraphs(child, fontFamily, fontSizePt, lineHeightPt),
        )
      }
      return []
  }
}

// ── 챕터 구조 타입 ────────────────────────────────────────────────────

export interface ChapterInput {
  title: string
  content: TipTapDocument | null
  order_idx: number
}

// ── 메인 생성 함수 ────────────────────────────────────────────────────

export interface DocxGenerationInput {
  projectTitle: string
  authorName: string
  platform: Platform
  chapters: ChapterInput[]
}

/**
 * TipTap JSON → DOCX Buffer 생성
 * 나눔고딕 폰트 임베딩, 플랫폼별 판형 적용
 */
export async function generateDocx(input: DocxGenerationInput): Promise<Buffer> {
  const spec = getPlatformSpec(input.platform)
  const fontBuffer = loadFontBuffer()

  const pageWidth = convertMillimetersToTwip(spec.pageWidthMM)
  const pageHeight = convertMillimetersToTwip(spec.pageHeightMM)
  const marginTop = convertMillimetersToTwip(spec.marginTopMM)
  const marginBottom = convertMillimetersToTwip(spec.marginBottomMM)
  const marginLeft = convertMillimetersToTwip(spec.marginLeftMM)
  const marginRight = convertMillimetersToTwip(spec.marginRightMM)

  const { fontFamily, fontSizePt, lineHeightPt } = spec

  // ── 타이틀 페이지 ────────────────────────────────────────────────────
  const titleParagraphs: Paragraph[] = [
    new Paragraph({ children: [], spacing: { before: convertMillimetersToTwip(50) } }),
    new Paragraph({
      children: [
        new TextRun({
          text: input.projectTitle,
          bold: true,
          font: fontFamily,
          size: Math.round((fontSizePt + 8) * 2),
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: convertMillimetersToTwip(10) },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: input.authorName,
          font: fontFamily,
          size: Math.round((fontSizePt + 2) * 2),
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `[${spec.name} 제출용]`,
          font: fontFamily,
          size: Math.round(fontSizePt * 2),
          color: '888888',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: convertMillimetersToTwip(5) },
    }),
  ]

  // ── 챕터 → Paragraphs ────────────────────────────────────────────────
  const contentParagraphs: Paragraph[] = []

  const sortedChapters = [...input.chapters].sort((a, b) => a.order_idx - b.order_idx)

  for (const chapter of sortedChapters) {
    // 챕터 제목
    contentParagraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: chapter.title,
            bold: true,
            font: fontFamily,
            size: Math.round((fontSizePt + 4) * 2),
          }),
        ],
        pageBreakBefore: contentParagraphs.length > 0, // 두 번째 챕터부터 페이지 나누기
        spacing: {
          before: contentParagraphs.length === 0 ? 0 : convertMillimetersToTwip(10),
          after: convertMillimetersToTwip(8),
        },
      }),
    )

    // 챕터 본문
    if (chapter.content?.content) {
      for (const node of chapter.content.content) {
        const paragraphs = tipTapBlockToParagraphs(node, fontFamily, fontSizePt, lineHeightPt)
        contentParagraphs.push(...paragraphs)
      }
    } else {
      contentParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: '(내용 없음)', font: fontFamily, color: 'AAAAAA', size: Math.round(fontSizePt * 2) })],
        }),
      )
    }
  }

  // ── 문서 조립 ──────────────────────────────────────────────────────
  const docOptions: ConstructorParameters<typeof Document>[0] = {
    title: input.projectTitle,
    creator: input.authorName,
    description: `${spec.name} 제출용 원고 — Podwrite.ai`,
    sections: [
      // 타이틀 페이지 섹션
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { width: pageWidth, height: pageHeight, orientation: PageOrientation.PORTRAIT },
            margin: { top: marginTop, bottom: marginBottom, left: marginLeft, right: marginRight },
          },
        },
        children: titleParagraphs,
      },
      // 본문 섹션
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { width: pageWidth, height: pageHeight, orientation: PageOrientation.PORTRAIT },
            margin: { top: marginTop, bottom: marginBottom, left: marginLeft, right: marginRight },
          },
        },
        children: contentParagraphs,
      },
    ],
  }

  // 폰트 임베딩 (파일이 있을 때만)
  if (fontBuffer) {
    docOptions.fonts = [
      {
        name: 'NanumGothic',
        data: fontBuffer,
        characterSet: 'default',
      },
    ]
  }

  const doc = new Document(docOptions)
  return await Packer.toBuffer(doc)
}
