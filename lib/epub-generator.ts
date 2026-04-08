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
import * as path from 'path'
import type { TipTapDocument, TipTapNode, TipTapMark } from '@/types'

// ── 폰트 로드 ─────────────────────────────────────────────────────────

function loadFontBuffer(): Buffer | null {
  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NanumGothic.otf')
    return fs.readFileSync(fontPath)
  } catch {
    console.warn('[epub-generator] NanumGothic.otf 폰트 파일을 찾을 수 없습니다.')
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

function inlineNodeToHtml(node: TipTapNode): string {
  if (node.type === 'text') {
    let text = escapeHtml(node.text ?? '')
    if (getMarkValue(node.marks, 'bold')) text = `<strong>${text}</strong>`
    if (getMarkValue(node.marks, 'italic')) text = `<em>${text}</em>`
    if (getMarkValue(node.marks, 'underline')) text = `<u>${text}</u>`
    if (getMarkValue(node.marks, 'code')) text = `<code>${text}</code>`
    return text
  }
  if (node.type === 'hardBreak') return '<br/>'
  if (node.content) return node.content.map(inlineNodeToHtml).join('')
  return ''
}

function blockNodeToHtml(node: TipTapNode): string {
  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      const inner = (node.content ?? []).map(inlineNodeToHtml).join('')
      return `<h${level}>${inner}</h${level}>\n`
    }
    case 'paragraph': {
      const inner = (node.content ?? []).map(inlineNodeToHtml).join('')
      if (!inner.trim()) return '<p>&nbsp;</p>\n'
      return `<p>${inner}</p>\n`
    }
    case 'bulletList': {
      const items = (node.content ?? [])
        .map((item) => {
          const inner = (item.content ?? []).map(blockNodeToHtml).join('')
          return `<li>${inner}</li>`
        })
        .join('\n')
      return `<ul>\n${items}\n</ul>\n`
    }
    case 'orderedList': {
      const items = (node.content ?? [])
        .map((item) => {
          const inner = (item.content ?? []).map(blockNodeToHtml).join('')
          return `<li>${inner}</li>`
        })
        .join('\n')
      return `<ol>\n${items}\n</ol>\n`
    }
    case 'blockquote': {
      const inner = (node.content ?? []).map(blockNodeToHtml).join('')
      return `<blockquote>${inner}</blockquote>\n`
    }
    case 'codeBlock': {
      const inner = escapeHtml((node.content ?? []).map((n) => n.text ?? '').join(''))
      return `<pre><code>${inner}</code></pre>\n`
    }
    case 'horizontalRule':
      return '<hr/>\n'
    default:
      if (node.content) return node.content.map(blockNodeToHtml).join('')
      return ''
  }
}

function tipTapToHtml(doc: TipTapDocument | null): string {
  if (!doc?.content) return '<p></p>'
  return doc.content.map(blockNodeToHtml).join('')
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

  return `${fontFace}body {
  font-family: 'NanumGothic', 'Noto Sans KR', sans-serif;
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
): string {
  const manifestChapters = chapterIds
    .map((id, i) => `    <item id="ch${i + 1}" href="chapters/${id}.xhtml" media-type="application/xhtml+xml"/>`)
    .join('\n')

  const spineChapters = chapterIds
    .map((id, i) => `    <itemref idref="ch${i + 1}"/>`)
    .join('\n')

  const fontManifest = hasFontFile
    ? `    <item id="font-nanum" href="fonts/NanumGothic.otf" media-type="font/otf"/>\n`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId" xml:lang="${language}">

  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${escapeHtml(bookId)}</dc:identifier>
    <dc:title>${escapeHtml(title)}</dc:title>
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

// ── NAV 문서 ─────────────────────────────────────────────────────────────

function navXhtml(
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
</head>
<body>
  <nav epub:type="toc">
    <h1>목차</h1>
    <ol>
${items}
    </ol>
  </nav>
</body>
</html>`
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
}

// ── 메인 생성 함수 ────────────────────────────────────────────────────────

/**
 * TipTap JSON → EPUB 3.0 Buffer 생성
 * jszip으로 패키징, 나눔고딕 폰트 임베딩
 */
export async function generateEpub(input: EpubGenerationInput): Promise<Buffer> {
  const zip = new JSZip()
  const modifiedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const fontBuffer = loadFontBuffer()
  const hasFontFile = fontBuffer !== null

  const sortedChapters = [...input.chapters].sort((a, b) => a.order_idx - b.order_idx)
  const chapterMeta = sortedChapters.map((ch) => ({ id: `ch-${ch.order_idx}`, title: ch.title }))

  // 1. mimetype (압축 안 함, EPUB 규격)
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

  // 5. 챕터 XHTML 파일들
  for (const chapter of sortedChapters) {
    const chId = `ch-${chapter.order_idx}`
    const bodyHtml = tipTapToHtml(chapter.content)
    chaptersFolder.file(`${chId}.xhtml`, chapterXhtml(chapter.title, bodyHtml, input.language))
  }

  // 6. NAV 문서
  if (input.includeToc) {
    oebps.file('nav.xhtml', navXhtml(input.projectTitle, input.language, chapterMeta))
  } else {
    oebps.file(
      'nav.xhtml',
      navXhtml(input.projectTitle, input.language, [{ id: chapterMeta[0]?.id ?? 'ch-1', title: input.projectTitle }]),
    )
  }

  // 7. NCX
  oebps.file(
    'toc.ncx',
    tocNcx(input.bookId, input.projectTitle, input.authorName, chapterMeta),
  )

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
    ),
  )

  const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
  return Buffer.from(arrayBuffer)
}
