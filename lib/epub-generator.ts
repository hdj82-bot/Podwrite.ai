/**
 * TipTap JSON → HTML → EPUB 3.0 변환기
 *
 * EPUB 3.0 구조:
 *   mimetype
 *   META-INF/container.xml
 *   OEBPS/content.opf       (패키지 문서)
 *   OEBPS/nav.xhtml         (NAV 목차)
 *   OEBPS/toc.ncx           (NCX 목차 — Kindle 호환)
 *   OEBPS/chapters/ch-N.xhtml
 *   OEBPS/fonts/NanumGothic.otf
 *   OEBPS/styles/main.css
 *
 * 의존 라이브러리: jszip ^3.10.1
 */

import JSZip from 'jszip'
import * as fs from 'fs'
import { getNanumGothicPath } from '@/lib/get-font-path'
import type { TipTapDocument, TipTapNode, TipTapMark } from '@/types'

// ── 폰트 로드 (실패 시 null → 시스템 폰트 폴백) ──────────────────────

function loadFontBuffer(): Buffer | null {
  try {
    const fontPath = getNanumGothicPath()
    return fs.readFileSync(fontPath)
  } catch {
    console.warn('[epub-generator] NanumGothic.otf 폰트 파일을 찾을 수 없습니다. 시스템 폰트를 사용합니다.')
    return null
  }
}

// ── TipTap → HTML 변환 ────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getMarkValue(marks: TipTapMark[] | undefined, type: string): boolean {
  return marks?.some((m) => m.type === type) ?? false
}

function getMarkAttr(marks: TipTapMark[] | undefined, type: string, attr: string): string | undefined {
  const mark = marks?.find((m) => m.type === type)
  return mark?.attrs?.[attr] as string | undefined
}

function inlineNodeToHtml(node: TipTapNode): string {
  if (node.type === 'text') {
    let text = escapeHtml(node.text ?? '')

    if (getMarkValue(node.marks, 'code'))        text = `<code>${text}</code>`
    if (getMarkValue(node.marks, 'strike'))      text = `<s>${text}</s>`
    if (getMarkValue(node.marks, 'subscript'))   text = `<sub>${text}</sub>`
    if (getMarkValue(node.marks, 'superscript')) text = `<sup>${text}</sup>`
    if (getMarkValue(node.marks, 'underline'))   text = `<u>${text}</u>`
    if (getMarkValue(node.marks, 'italic'))      text = `<em>${text}</em>`
    if (getMarkValue(node.marks, 'bold'))        text = `<strong>${text}</strong>`

    // TipTap Color extension: textStyle mark with attrs.color
    const color = getMarkAttr(node.marks, 'textStyle', 'color')
    if (color) text = `<span style="color:${escapeHtml(color)}">${text}</span>`

    return text
  }
  if (node.type === 'hardBreak') return '<br/>'
  if (node.content) return node.content.map(inlineNodeToHtml).join('')
  return ''
}

// ── 자동 TOC용 헤딩 수집 ──────────────────────────────────────────────

export interface TocEntry {
  level: number   // 1~3
  text: string
  anchor: string
}

let _tocEntryCounter = 0

function collectTocEntries(nodes: TipTapNode[]): TocEntry[] {
  const entries: TocEntry[] = []
  for (const node of nodes) {
    if (node.type === 'heading') {
      const level = Math.min((node.attrs?.level as number) ?? 1, 3)
      const text = (node.content ?? []).map((n) => n.text ?? '').join('')
      if (text.trim()) {
        _tocEntryCounter++
        entries.push({ level, text, anchor: `h-${_tocEntryCounter}` })
      }
    }
  }
  return entries
}

// ── 블록 노드 → HTML ────────────────────────────────────────────────

function blockNodeToHtml(node: TipTapNode, tocEntries?: TocEntry[], tocIndex?: { value: number }): string {
  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      const inner = (node.content ?? []).map(inlineNodeToHtml).join('')
      const textAlign = node.attrs?.textAlign as string | undefined
      const styleAttr = textAlign ? ` style="text-align:${textAlign}"` : ''

      if (tocEntries && tocIndex && level <= 3) {
        const entry = tocEntries[tocIndex.value]
        if (entry) {
          tocIndex.value++
          return `<h${level} id="${entry.anchor}"${styleAttr}>${inner}</h${level}>\n`
        }
      }
      return `<h${level}${styleAttr}>${inner}</h${level}>\n`
    }

    case 'paragraph': {
      const inner = (node.content ?? []).map(inlineNodeToHtml).join('')
      const textAlign = node.attrs?.textAlign as string | undefined
      const classAttr = textAlign ? ` class="align-${textAlign}"` : ''
      if (!inner.trim()) return '<p>&nbsp;</p>\n'
      return `<p${classAttr}>${inner}</p>\n`
    }

    case 'bulletList': {
      const items = (node.content ?? [])
        .map((item) => {
          const inner = (item.content ?? []).map((n) => blockNodeToHtml(n, tocEntries, tocIndex)).join('')
          return `<li>${inner}</li>`
        })
        .join('\n')
      return `<ul>\n${items}\n</ul>\n`
    }

    case 'orderedList': {
      const items = (node.content ?? [])
        .map((item) => {
          const inner = (item.content ?? []).map((n) => blockNodeToHtml(n, tocEntries, tocIndex)).join('')
          return `<li>${inner}</li>`
        })
        .join('\n')
      return `<ol>\n${items}\n</ol>\n`
    }

    case 'blockquote': {
      const inner = (node.content ?? []).map((n) => blockNodeToHtml(n, tocEntries, tocIndex)).join('')
      return `<blockquote>${inner}</blockquote>\n`
    }

    case 'codeBlock': {
      const inner = escapeHtml((node.content ?? []).map((n) => n.text ?? '').join(''))
      return `<pre><code>${inner}</code></pre>\n`
    }

    case 'horizontalRule':
      return '<hr/>\n'

    case 'table':
      return tableNodeToHtml(node)

    default:
      if (node.content) return node.content.map((n) => blockNodeToHtml(n, tocEntries, tocIndex)).join('')
      return ''
  }
}

// ── 표(table) 노드 → HTML ─────────────────────────────────────────────

function tableNodeToHtml(node: TipTapNode): string {
  const rows = (node.content ?? []).map((rowNode) => {
    const cells = (rowNode.content ?? []).map((cellNode) => {
      const tag = cellNode.type === 'tableHeader' ? 'th' : 'td'
      const colspan = (cellNode.attrs?.colspan as number | undefined) ?? 1
      const rowspan = (cellNode.attrs?.rowspan as number | undefined) ?? 1
      const attrs = [
        colspan > 1 ? `colspan="${colspan}"` : '',
        rowspan > 1 ? `rowspan="${rowspan}"` : '',
      ].filter(Boolean).join(' ')
      const inner = (cellNode.content ?? []).map((n) => blockNodeToHtml(n)).join('')
      return `<${tag}${attrs ? ' ' + attrs : ''}>${inner}</${tag}>`
    }).join('')
    return `<tr>${cells}</tr>`
  }).join('\n')
  return `<table>\n${rows}\n</table>\n`
}

function tipTapToHtml(doc: TipTapDocument | null, tocEntries?: TocEntry[]): string {
  if (!doc?.content) return '<p></p>'
  const tocIndex = { value: 0 }
  return doc.content.map((n) => blockNodeToHtml(n, tocEntries, tocIndex)).join('')
}

// ── 챕터 XHTML 생성 ────────────────────────────────────────────────────

function chapterXhtml(chapterTitle: string, bodyHtml: string, language: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${language}" lang="${language}">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeHtml(chapterTitle)}</title>
  <link rel="stylesheet" type="text/css" href="../styles/main.css"/>
</head>
<body>
<h1 class="chapter-title">${escapeHtml(chapterTitle)}</h1>
${bodyHtml}
</body>
</html>`
}

// ── CSS 스타일시트 ──────────────────────────────────────────────────────

function mainCss(hasFontFile: boolean): string {
  const fontFace = hasFontFile
    ? `@font-face {
  font-family: 'NanumGothic';
  src: url('../fonts/NanumGothic.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
}
`
    : ''

  // 폰트 폴백: NanumGothic → Noto Sans KR → 시스템 sans-serif
  return `${fontFace}body {
  font-family: 'NanumGothic', 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  font-size: 1em;
  line-height: 1.8;
  margin: 0 1em;
  word-break: keep-all;
  overflow-wrap: break-word;
}

h1, h2, h3, h4, h5, h6 {
  font-weight: bold;
  margin: 1.2em 0 0.5em;
  line-height: 1.4;
}

h1 { font-size: 1.6em; }
h2 { font-size: 1.4em; }
h3 { font-size: 1.2em; }

.chapter-title {
  font-size: 1.8em;
  border-bottom: 2px solid #333;
  padding-bottom: 0.3em;
  margin-bottom: 1em;
}

p {
  margin: 0.5em 0;
  text-indent: 1em;
}

p.align-center  { text-align: center;  text-indent: 0; }
p.align-right   { text-align: right;   text-indent: 0; }
p.align-left    { text-align: left;    text-indent: 0; }
p.align-justify { text-align: justify; }

blockquote {
  border-left: 3px solid #aaa;
  margin: 1em 0;
  padding: 0.5em 1em;
  color: #555;
}

ul, ol {
  margin: 0.5em 0;
  padding-left: 2em;
}

code {
  font-family: monospace;
  background: #f5f5f5;
  padding: 0 0.2em;
}

pre {
  background: #f5f5f5;
  padding: 1em;
  overflow-x: auto;
}

hr {
  border: none;
  border-top: 1px solid #ccc;
  margin: 2em 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 0.95em;
}

th, td {
  border: 1px solid #ccc;
  padding: 0.4em 0.6em;
  vertical-align: top;
  text-align: left;
}

th {
  background-color: #f2f2f2;
  font-weight: bold;
}

tr:nth-child(even) td {
  background-color: #fafafa;
}

nav#toc ol {
  list-style: none;
  padding-left: 1em;
}

nav#toc li {
  margin: 0.3em 0;
}

nav#toc a {
  text-decoration: none;
  color: #333;
}

nav#toc a:hover {
  text-decoration: underline;
}
`
}

// ── OPF 패키지 문서 ─────────────────────────────────────────────────────

function contentOpf(
  bookId: string,
  title: string,
  author: string,
  language: string,
  chapterIds: string[],
  modifiedAt: string,
  hasFontFile: boolean,
  isbn?: string,
): string {
  const manifestChapters = chapterIds
    .map((id, i) => `    <item id="ch${i + 1}" href="chapters/${id}.xhtml" media-type="application/xhtml+xml"/>`)
    .join('\n')

  const spineChapters = chapterIds
    .map((id, i) => `    <itemref idref="ch${i + 1}"/>`)
    .join('\n')

  const fontManifest = hasFontFile
    ? `    <item id="font-nanum" href="fonts/NanumGothic.otf" media-type="application/vnd.ms-opentype"/>\n`
    : ''

  const isbnMeta = isbn ? `    <dc:identifier id="isbn">urn:isbn:${escapeHtml(isbn)}</dc:identifier>\n` : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId" xml:lang="${language}">

  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${escapeHtml(bookId)}</dc:identifier>
${isbnMeta}    <dc:title>${escapeHtml(title)}</dc:title>
    <dc:creator>${escapeHtml(author)}</dc:creator>
    <dc:language>${language}</dc:language>
    <dc:date>${modifiedAt.slice(0, 10)}</dc:date>
    <meta property="dcterms:modified">${modifiedAt}</meta>
    <meta name="generator" content="Podwrite.ai"/>
  </metadata>

  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="styles/main.css" media-type="text/css"/>
${fontManifest}${manifestChapters}
  </manifest>

  <spine toc="ncx">
${spineChapters}
  </spine>

</package>`
}

// ── NCX 목차 (Kindle 호환) ────────────────────────────────────────────────

function tocNcx(
  bookId: string,
  title: string,
  author: string,
  chapters: Array<{ id: string; title: string }>,
): string {
  const navPoints = chapters
    .map(
      (ch, i) => `    <navPoint id="navPoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${escapeHtml(ch.title)}</text></navLabel>
      <content src="chapters/${ch.id}.xhtml"/>
    </navPoint>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeHtml(bookId)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeHtml(title)}</text></docTitle>
  <docAuthor><text>${escapeHtml(author)}</text></docAuthor>
  <navMap>
${navPoints}
  </navMap>
</ncx>`
}

// ── 단순 NAV 문서 ──────────────────────────────────────────────────────

function buildSimpleNav(
  title: string,
  language: string,
  chapters: Array<{ id: string; title: string }>,
): string {
  const items = chapters
    .map((ch) => `      <li><a href="chapters/${ch.id}.xhtml">${escapeHtml(ch.title)}</a></li>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles/main.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>목차</h1>
    <ol>
${items}
    </ol>
  </nav>
</body>
</html>`
}

// ── 헤딩 계층 기반 중첩 TOC ────────────────────────────────────────────

const MAX_TOC_DEPTH = 3
const TOC_FLATTEN_CHAPTER_THRESHOLD = 30 // 챕터 수 초과 시 depth=1로 제한

function buildHierarchicalToc(
  chaptersWithEntries: Array<{ chapterId: string; chapterTitle: string; entries: TocEntry[] }>,
  maxDepth: number,
  language: string,
): string {
  const items: string[] = []

  for (const ch of chaptersWithEntries) {
    items.push(`      <li><a href="chapters/${ch.chapterId}.xhtml">${escapeHtml(ch.chapterTitle)}</a>`)

    const subEntries = ch.entries.filter((e) => e.level >= 2 && e.level <= maxDepth)
    if (subEntries.length > 0) {
      const subItems = subEntries.map((e) => {
        const indent = '  '.repeat(e.level - 1)
        return `${indent}      <li><a href="chapters/${ch.chapterId}.xhtml#${e.anchor}">${escapeHtml(e.text)}</a></li>`
      }).join('\n')
      items.push(`        <ol>\n${subItems}\n        </ol>`)
    }

    items.push(`      </li>`)
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <meta charset="UTF-8"/>
  <title>목차</title>
  <link rel="stylesheet" type="text/css" href="styles/main.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>목차</h1>
    <ol>
${items.join('\n')}
    </ol>
  </nav>
</body>
</html>`
}

// ── 챕터 구조 타입 ────────────────────────────────────────────────────────

export interface EpubChapterInput {
  id: string
  title: string
  content: TipTapDocument | null
  order_idx: number
}

export interface EpubGenerationInput {
  bookId: string
  projectTitle: string
  authorName: string
  language: 'ko' | 'en'
  chapters: EpubChapterInput[]
  includeToc: boolean
  autoToc?: boolean   // 헤딩 계층 기반 중첩 TOC
  isbn?: string       // EPUB 메타데이터 ISBN (옵션)
}

// ── 메인 생성 함수 ────────────────────────────────────────────────────────

/**
 * TipTap JSON → EPUB 3.0 Buffer 생성
 * - 표(table) HTML 변환, 정렬 CSS class
 * - 취소선(<s>), 첨자(<sub>/<sup>)
 * - 자동 목차(TOC) H1→H2→H3 중첩 생성
 * - 폰트 로딩 실패 시 시스템 폰트 폴백
 * - EPUB 메타데이터 ISBN 지원
 * - 챕터 수 많을 때 TOC depth 자동 제한
 */
export async function generateEpub(input: EpubGenerationInput): Promise<Buffer> {
  // tocEntry 카운터 초기화
  _tocEntryCounter = 0

  const zip = new JSZip()
  const modifiedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const fontBuffer = loadFontBuffer()
  const hasFontFile = fontBuffer !== null

  const sortedChapters = [...input.chapters].sort((a, b) => a.order_idx - b.order_idx)
  const chapterMeta = sortedChapters.map((ch) => ({ id: `ch-${ch.order_idx}`, title: ch.title }))

  // 챕터 수에 따라 TOC depth 제한
  const tocDepth = sortedChapters.length > TOC_FLATTEN_CHAPTER_THRESHOLD ? 1 : MAX_TOC_DEPTH

  // 1. mimetype
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

  // 2. META-INF/container.xml
  zip.folder('META-INF')!.file(
    'container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  )

  const oebps = zip.folder('OEBPS')!
  const chaptersFolder = oebps.folder('chapters')!
  const stylesFolder = oebps.folder('styles')!

  // 3. CSS
  stylesFolder.file('main.css', mainCss(hasFontFile))

  // 4. 폰트 임베딩
  if (hasFontFile && fontBuffer) {
    oebps.folder('fonts')!.file('NanumGothic.otf', fontBuffer)
  }

  // 5. 챕터 XHTML + 자동 TOC 수집
  const chaptersWithEntries: Array<{ chapterId: string; chapterTitle: string; entries: TocEntry[] }> = []

  for (const chapter of sortedChapters) {
    const chId = `ch-${chapter.order_idx}`

    const tocEntries: TocEntry[] = input.autoToc && chapter.content?.content
      ? collectTocEntries(chapter.content.content)
      : []

    chaptersWithEntries.push({ chapterId: chId, chapterTitle: chapter.title, entries: tocEntries })

    const bodyHtml = tipTapToHtml(chapter.content, input.autoToc ? tocEntries : undefined)
    chaptersFolder.file(`${chId}.xhtml`, chapterXhtml(chapter.title, bodyHtml, input.language))
  }

  // 6. NAV 문서
  if (input.includeToc) {
    if (input.autoToc) {
      oebps.file('nav.xhtml', buildHierarchicalToc(chaptersWithEntries, tocDepth, input.language))
    } else {
      oebps.file('nav.xhtml', buildSimpleNav(input.projectTitle, input.language, chapterMeta))
    }
  } else {
    oebps.file(
      'nav.xhtml',
      buildSimpleNav(input.projectTitle, input.language, [{ id: chapterMeta[0]?.id ?? 'ch-1', title: input.projectTitle }]),
    )
  }

  // 7. NCX
  oebps.file('toc.ncx', tocNcx(input.bookId, input.projectTitle, input.authorName, chapterMeta))

  // 8. content.opf
  oebps.file(
    'content.opf',
    contentOpf(
      input.bookId,
      input.projectTitle,
      input.authorName,
      input.language,
      chapterMeta.map((c) => c.id),
      modifiedAt,
      hasFontFile,
      input.isbn,
    ),
  )

  const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
  return Buffer.from(arrayBuffer)
}
