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
  Footer,
  Header,
  HeadingLevel,
  LineRuleType,
  AlignmentType,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  SectionType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertMillimetersToTwip,
} from 'docx'
import * as fs from 'fs'
import type { TipTapDocument, TipTapNode, TipTapMark, Platform } from '@/types'
import { getPlatformSpec } from '@/lib/platform-specs'
import { getNanumGothicPath } from '@/lib/get-font-path'

// ── 폰트 임베딩 ───────────────────────────────────────────────────────

function loadFontBuffer(): Buffer | null {
  try {
    return fs.readFileSync(getNanumGothicPath())
  } catch {
    console.warn('[docx-generator] NanumGothic.otf 폰트 파일을 찾을 수 없습니다.')
    return null
  }
}

// ── 입력값 검증 ───────────────────────────────────────────────────────

function isValidTipTapDocument(doc: unknown): doc is TipTapDocument {
  if (!doc || typeof doc !== 'object') return false
  const d = doc as Record<string, unknown>
  return d.type === 'doc' && Array.isArray(d.content)
}

// ── TipTap mark 헬퍼 ─────────────────────────────────────────────────

function getMarkValue(marks: TipTapMark[] | undefined, type: string): boolean {
  return marks?.some((m) => m.type === type) ?? false
}

function getMarkAttr(marks: TipTapMark[] | undefined, type: string, attr: string): string | undefined {
  const mark = marks?.find((m) => m.type === type)
  return mark?.attrs?.[attr] as string | undefined
}

// ── AlignmentType 매핑 ────────────────────────────────────────────────

function resolveAlignment(textAlign: string | undefined): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  switch (textAlign) {
    case 'left':    return AlignmentType.LEFT
    case 'center':  return AlignmentType.CENTER
    case 'right':   return AlignmentType.RIGHT
    case 'justify': return AlignmentType.JUSTIFIED
    default:        return undefined
  }
}

// ── TipTap 노드 → TextRun 변환 ────────────────────────────────────────

function tipTapNodeToTextRuns(node: TipTapNode, fontFamily: string, fontSizePt: number): TextRun[] {
  if (node.type === 'text') {
    const text = node.text ?? ''
    const bold        = getMarkValue(node.marks, 'bold')
    const italic      = getMarkValue(node.marks, 'italic')
    const underline   = getMarkValue(node.marks, 'underline')
    const strike      = getMarkValue(node.marks, 'strike')
    const subScript   = getMarkValue(node.marks, 'subscript')
    const superScript = getMarkValue(node.marks, 'superscript')

    // TipTap Color extension: textStyle mark with attrs.color ('#rrggbb')
    const rawColor = getMarkAttr(node.marks, 'textStyle', 'color')
    const color = rawColor ? rawColor.replace(/^#/, '') : undefined

    return [
      new TextRun({
        text,
        bold,
        italics: italic,
        underline: underline ? {} : undefined,
        strike,
        subScript,
        superScript,
        color,
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

// ── TipTap 표(table) 노드 → docx Table 변환 ──────────────────────────

function tipTapTableToDocxTable(
  node: TipTapNode,
  fontFamily: string,
  fontSizePt: number,
  lineHeightPt: number,
): Table {
  const rows = (node.content ?? []).map((rowNode) => {
    const cells = (rowNode.content ?? []).map((cellNode) => {
      const cellParagraphs = (cellNode.content ?? []).flatMap((child) =>
        tipTapBlockToParagraphs(child, fontFamily, fontSizePt, lineHeightPt),
      )
      const colspan = (cellNode.attrs?.colspan as number | undefined) ?? 1
      const rowspan = (cellNode.attrs?.rowspan as number | undefined) ?? 1
      const isHeader = cellNode.type === 'tableHeader'
      return new TableCell({
        children: cellParagraphs.length > 0
          ? cellParagraphs
          : [new Paragraph({ children: [new TextRun({ text: '', font: fontFamily })] })],
        columnSpan: colspan > 1 ? colspan : undefined,
        rowSpan: rowspan > 1 ? rowspan : undefined,
        shading: isHeader ? { fill: 'F2F2F2' } : undefined,
        margins: {
          top: convertMillimetersToTwip(1.5),
          bottom: convertMillimetersToTwip(1.5),
          left: convertMillimetersToTwip(2),
          right: convertMillimetersToTwip(2),
        },
      })
    })
    return new TableRow({ children: cells })
  })

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  })
}

// ── TipTap 블록 노드 → Paragraph[] 변환 ──────────────────────────────

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
      const textAlign = node.attrs?.textAlign as string | undefined
      return [
        new Paragraph({
          heading: headingMap[level] ?? HeadingLevel.HEADING_1,
          children: runs.length > 0 ? runs : [new TextRun({ text: '', font: fontFamily })],
          spacing: { ...spacing, before: Math.round(headingFontSize * 20) },
          alignment: resolveAlignment(textAlign),
        }),
      ]
    }

    case 'paragraph': {
      const runs = (node.content ?? []).flatMap((child) =>
        tipTapNodeToTextRuns(child, fontFamily, fontSizePt),
      )
      const textAlign = node.attrs?.textAlign as string | undefined
      const alignment = resolveAlignment(textAlign)
      return [
        new Paragraph({
          children: runs.length > 0 ? runs : [new TextRun({ text: '', font: fontFamily, size: Math.round(fontSizePt * 2) })],
          spacing,
          alignment,
          // 중앙/우측 정렬 시 들여쓰기 제거
          indent: alignment ? undefined : { firstLine: Math.round(fontSizePt * 2 * 20) },
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
      return (node.content ?? []).flatMap((child) =>
        tipTapBlockToParagraphs(child, fontFamily, fontSizePt, lineHeightPt),
      )
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

    // table은 호출부에서 tipTapTableToDocxTable로 처리
    case 'table':
      return []

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
  includePageNumber?: boolean
  includeHeaderTitle?: boolean
}

/**
 * TipTap JSON → DOCX Buffer 생성
 * - 표(table), 텍스트 정렬, 취소선/첨자, 색상 지원
 * - 페이지 번호 푸터, 책 제목 헤더 (옵션)
 * - 빈 문서·잘못된 JSON 입력 검증
 * - 청크 단위 처리로 대용량 문서 메모리 최적화
 */
export async function generateDocx(input: DocxGenerationInput): Promise<Buffer> {
  const spec = getPlatformSpec(input.platform)
  const fontBuffer = loadFontBuffer()

  const pageWidth    = convertMillimetersToTwip(spec.pageWidthMM)
  const pageHeight   = convertMillimetersToTwip(spec.pageHeightMM)
  const marginTop    = convertMillimetersToTwip(spec.marginTopMM)
  const marginBottom = convertMillimetersToTwip(spec.marginBottomMM)
  const marginLeft   = convertMillimetersToTwip(spec.marginLeftMM)
  const marginRight  = convertMillimetersToTwip(spec.marginRightMM)

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

  // ── 챕터 → 본문 노드 목록 (Paragraph | Table) ────────────────────────
  const contentNodes: (Paragraph | Table)[] = []

  const sortedChapters = [...input.chapters].sort((a, b) => a.order_idx - b.order_idx)

  for (const chapter of sortedChapters) {
    contentNodes.push(
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
        pageBreakBefore: contentNodes.length > 0,
        spacing: {
          before: contentNodes.length === 0 ? 0 : convertMillimetersToTwip(10),
          after: convertMillimetersToTwip(8),
        },
      }),
    )

    if (chapter.content && isValidTipTapDocument(chapter.content) && chapter.content.content.length > 0) {
      // 청크 단위 처리 (대용량 문서 메모리 최적화): 50 노드씩
      const CHUNK_SIZE = 50
      const nodes = chapter.content.content
      for (let i = 0; i < nodes.length; i += CHUNK_SIZE) {
        const chunk = nodes.slice(i, i + CHUNK_SIZE)
        for (const node of chunk) {
          if (node.type === 'table') {
            contentNodes.push(tipTapTableToDocxTable(node, fontFamily, fontSizePt, lineHeightPt))
          } else {
            contentNodes.push(...tipTapBlockToParagraphs(node, fontFamily, fontSizePt, lineHeightPt))
          }
        }
      }
    } else {
      contentNodes.push(
        new Paragraph({
          children: [new TextRun({ text: '(내용 없음)', font: fontFamily, color: 'AAAAAA', size: Math.round(fontSizePt * 2) })],
        }),
      )
    }
  }

  // ── 헤더/푸터 구성 ────────────────────────────────────────────────────

  const contentSectionHeader = input.includeHeaderTitle
    ? {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: input.projectTitle,
                  font: fontFamily,
                  size: Math.round((fontSizePt - 1) * 2),
                  color: '888888',
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
          ],
        }),
      }
    : undefined

  const contentSectionFooter = input.includePageNumber
    ? {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: fontFamily,
                  size: Math.round((fontSizePt - 1) * 2),
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      }
    : undefined

  // ── 문서 조립 ──────────────────────────────────────────────────────
  const docOptions: ConstructorParameters<typeof Document>[0] = {
    title: input.projectTitle,
    creator: input.authorName,
    description: `${spec.name} 제출용 원고 — Podwrite.ai`,
    sections: [
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
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { width: pageWidth, height: pageHeight, orientation: PageOrientation.PORTRAIT },
            margin: { top: marginTop, bottom: marginBottom, left: marginLeft, right: marginRight },
          },
        },
        headers: contentSectionHeader,
        footers: contentSectionFooter,
        children: contentNodes,
      },
    ],
  }

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
