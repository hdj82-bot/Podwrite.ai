/**
 * POST /api/kdp/package
 *
 * KDP 제출 패키지 ZIP 생성 후 서명 URL 반환
 *
 * 포함 파일:
 *   - interior.docx     (Supabase Storage에서)
 *   - ebook.epub        (Supabase Storage에서)
 *   - cover/            (업로드된 표지)
 *   - metadata.xlsx     (JSZip으로 생성한 OOXML)
 *   - README.txt        (KDP 제출 가이드)
 *
 * body: { projectId }
 * 응답: { data: { download_url: string, expires_in: 3600 } }
 *
 * 인증: Pro 플랜 전용
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserWithProfile, createServiceClient } from '@/lib/supabase-server'
import { PLAN_LIMITS } from '@/types'
import JSZip from 'jszip'

const schema = z.object({
  projectId: z.string().uuid(),
  metadata: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    keywords: z.array(z.string()).max(7).optional(),
    bisacCode: z.string().optional(),
    bisacLabel: z.string().optional(),
    language: z.string().default('en'),
    author: z.string().optional(),
    price_usd: z.number().optional(),
  }).optional(),
})

// ── 최소 XLSX 생성 (JSZip 기반 OOXML) ────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildXlsx(
  rows: Array<[string, string]>, // [label, value]
  sheetTitle: string,
): Promise<Buffer> {
  const zip = new JSZip()

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`

  const relsRoot = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  const relsWorkbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetTitle)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`

  // 공유 문자열 테이블
  const strings: string[] = []
  function getStrIdx(s: string): number {
    const idx = strings.indexOf(s)
    if (idx >= 0) return idx
    strings.push(s)
    return strings.length - 1
  }

  // 시트 데이터 생성
  const sheetRows = rows.map(([label, value], i) => {
    const row = i + 1
    const labelIdx = getStrIdx(label)
    const valueIdx = getStrIdx(value)
    return `    <row r="${row}"><c r="A${row}" t="s"><v>${labelIdx}</v></c><c r="B${row}" t="s"><v>${valueIdx}</v></c></row>`
  })

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
${sheetRows.join('\n')}
  </sheetData>
</worksheet>`

  const sharedStrings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
${strings.map((s) => `  <si><t>${escapeXml(s)}</t></si>`).join('\n')}
</sst>`

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`

  zip.file('[Content_Types].xml', contentTypes)
  zip.folder('_rels')!.file('.rels', relsRoot)
  const xl = zip.folder('xl')!
  xl.file('workbook.xml', workbook)
  xl.file('sharedStrings.xml', sharedStrings)
  xl.file('styles.xml', styles)
  xl.folder('_rels')!.file('workbook.xml.rels', relsWorkbook)
  xl.folder('worksheets')!.file('sheet1.xml', sheet)

  return zip.generateAsync({ type: 'arraybuffer' }).then((ab) => Buffer.from(ab))
}

// ── README 생성 ────────────────────────────────────────────────────────────

function buildReadme(projectTitle: string, packageDate: string): string {
  return `Amazon KDP Submission Package
Generated by Podwrite.ai on ${packageDate}
=====================================

Project: ${projectTitle}

FILES INCLUDED:
--------------
1. interior.docx    — Interior manuscript (formatted for KDP)
   → Use for Paperback submission or convert to PDF via KDP's tools

2. ebook.epub       — EPUB 3.0 ebook file
   → Upload directly to KDP for Kindle eBook

3. cover/           — Cover image(s)
   → See KDP Cover Calculator for exact dimensions:
     https://kdp.amazon.com/cover-calculator

4. metadata.xlsx    — Book metadata spreadsheet
   → Reference when filling KDP dashboard fields

SUBMISSION STEPS:
----------------
Paperback:
  1. Log in to kdp.amazon.com
  2. Create a new title → Paperback
  3. Fill in metadata from metadata.xlsx
  4. Upload interior.docx (or convert to PDF first)
  5. Upload cover image from cover/ folder
  6. Preview in Kindle Previewer → Submit

Kindle eBook:
  1. Create a new title → Kindle eBook
  2. Fill in metadata
  3. Upload ebook.epub
  4. Set pricing
  5. Preview in Kindle Previewer → Publish

RESOURCES:
----------
- KDP Help: https://kdp.amazon.com/help
- Kindle Previewer: https://www.amazon.com/Kindle-Previewer
- KDP Content Guidelines: https://kdp.amazon.com/help/topic/G200933220

Generated by Podwrite.ai — https://podwrite.ai
`
}

// ── 메인 핸들러 ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser || !profile) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  if (!PLAN_LIMITS[profile.plan].kdp) {
    return NextResponse.json(
      { error: 'KDP 패키지 생성은 Pro 플랜 전용 기능입니다.' },
      { status: 403 },
    )
  }

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 프로젝트 정보 조회
  const { data: project } = await supabase
    .from('projects')
    .select('id, title, genre, description')
    .eq('id', body.projectId)
    .eq('user_id', authUser.id)
    .single()

  if (!project) {
    return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
  }

  const packageZip = new JSZip()
  const coverFolder = packageZip.folder('cover')!
  const packageDate = new Date().toISOString().slice(0, 10)
  const baseStoragePath = `${authUser.id}/${body.projectId}`

  const filesFound: string[] = []
  const filesMissing: string[] = []

  // ── 내지 DOCX 수집 ─────────────────────────────────────────────────
  const docxPaths = ['kdp', 'bookk', 'kyobo'].map((p) => `${baseStoragePath}/export-${p}.docx`)
  let docxAdded = false
  for (const docxPath of docxPaths) {
    const { data: docxData } = await supabase.storage.from('project-files').download(docxPath)
    if (docxData) {
      const buf = Buffer.from(await docxData.arrayBuffer())
      packageZip.file('interior.docx', buf)
      filesFound.push('interior.docx')
      docxAdded = true
      break
    }
  }
  if (!docxAdded) filesMissing.push('interior.docx (내지 DOCX 먼저 생성하세요)')

  // ── EPUB 수집 ─────────────────────────────────────────────────────
  const epubPaths = ['en', 'ko'].map((lang) => `${baseStoragePath}/export-${lang}.epub`)
  let epubAdded = false
  for (const epubPath of epubPaths) {
    const { data: epubData } = await supabase.storage.from('project-files').download(epubPath)
    if (epubData) {
      const buf = Buffer.from(await epubData.arrayBuffer())
      packageZip.file('ebook.epub', buf)
      filesFound.push('ebook.epub')
      epubAdded = true
      break
    }
  }
  if (!epubAdded) filesMissing.push('ebook.epub (EPUB 먼저 생성하세요)')

  // ── 표지 이미지 수집 ──────────────────────────────────────────────
  const coverPath = `${baseStoragePath}/cover.jpg`
  const { data: coverData } = await supabase.storage.from('project-files').download(coverPath)
  if (coverData) {
    const buf = Buffer.from(await coverData.arrayBuffer())
    coverFolder.file('cover.jpg', buf)
    filesFound.push('cover/cover.jpg')
  } else {
    filesMissing.push('cover/ (표지 이미지 업로드 필요)')
  }

  // ── 메타데이터 XLSX 생성 ────────────────────────────────────────────
  const meta = body.metadata ?? {}
  const metaRows: Array<[string, string]> = [
    ['Field', 'Value'],
    ['Title', meta.title ?? project.title],
    ['Subtitle', meta.subtitle ?? ''],
    ['Author', meta.author ?? ''],
    ['Language', meta.language ?? 'en'],
    ['Description (first 500 chars)', (meta.description ?? '').slice(0, 500)],
    ['Keywords', (meta.keywords ?? []).join(', ')],
    ['BISAC Category Code', meta.bisacCode ?? ''],
    ['BISAC Category Name', meta.bisacLabel ?? ''],
    ['List Price (USD)', meta.price_usd != null ? String(meta.price_usd) : ''],
    ['Publication Date', packageDate],
    ['Generated By', 'Podwrite.ai'],
  ]

  const xlsxBuf = await buildXlsx(metaRows, 'KDP Metadata')
  packageZip.file('metadata.xlsx', xlsxBuf)
  filesFound.push('metadata.xlsx')

  // ── README ─────────────────────────────────────────────────────────
  packageZip.file('README.txt', buildReadme(project.title, packageDate))

  // ── ZIP 생성 → Storage 업로드 ───────────────────────────────────────
  const zipBuffer = Buffer.from(
    await packageZip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' }),
  )

  const zipPath = `${baseStoragePath}/kdp-package-${packageDate}.zip`
  const { error: uploadErr } = await supabase.storage
    .from('project-files')
    .upload(zipPath, zipBuffer, { contentType: 'application/zip', upsert: true })

  if (uploadErr) {
    return NextResponse.json({ error: 'ZIP 업로드 실패: ' + uploadErr.message }, { status: 500 })
  }

  // 서명된 다운로드 URL (1시간)
  const { data: urlData, error: urlErr } = await supabase.storage
    .from('project-files')
    .createSignedUrl(zipPath, 3600)

  if (urlErr || !urlData) {
    return NextResponse.json({ error: '다운로드 URL 생성 실패' }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      download_url: urlData.signedUrl,
      expires_in: 3600,
      files_included: filesFound,
      files_missing: filesMissing,
    },
  })
}
