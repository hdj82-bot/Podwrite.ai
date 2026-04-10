/**
 * Inngest 백그라운드 잡: KDP 제출 패키지 생성
 *
 * 이벤트: 'kdp/package.requested'
 * 처리:
 *   1. 프로젝트 + 저장된 KDP 메타데이터 조회
 *   2. 챕터 + 최신 한→영 번역 조회 (chapter_versions.trigger='ai_edit')
 *   3. 영문 EPUB 생성 (epub-generator.ts, language:'en')
 *   4. Storage에서 DOCX + 표지 수집, metadata.json + metadata.xlsx 생성
 *   5. ZIP 조립 → Storage 업로드 → 서명 URL 발급
 *   6. projects.kdp_package JSONB 업데이트 → Supabase Realtime 트리거
 *
 * NOTE: EPUB 생성 + ZIP 조립은 Buffer 직렬화 문제로 단일 step에서 처리
 */

import { inngest } from './client'
import { createServiceClient } from '@/lib/supabase-server'
import { generateEpub } from '@/lib/epub-generator'
import type { EpubChapterInput } from '@/lib/epub-generator'
import type { TipTapDocument } from '@/types'
import JSZip from 'jszip'

// ── XLSX 생성 (JSZip 기반 OOXML) ─────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function buildXlsx(rows: Array<[string, string]>, sheetTitle: string): Promise<Buffer> {
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

  const strings: string[] = []
  function getStrIdx(s: string): number {
    const idx = strings.indexOf(s)
    if (idx >= 0) return idx
    strings.push(s)
    return strings.length - 1
  }

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

// ── README 생성 ───────────────────────────────────────────────────────────

function buildReadme(projectTitle: string, packageDate: string): string {
  return `Amazon KDP Submission Package
Generated by Podwrite.ai on ${packageDate}
=====================================

Project: ${projectTitle}

FILES INCLUDED:
--------------
1. interior.docx    — Interior manuscript (formatted for KDP)
   → Use for Paperback submission or convert to PDF via KDP's tools

2. ebook.epub       — EPUB 3.0 ebook file (English)
   → Upload directly to KDP for Kindle eBook

3. cover/           — Cover image(s)
   → See KDP Cover Calculator for exact dimensions:
     https://kdp.amazon.com/cover-calculator

4. metadata.xlsx    — Book metadata spreadsheet
   → Reference when filling KDP dashboard fields

5. metadata.json    — Machine-readable metadata
   → For reference or programmatic integration

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

// ── Inngest 잡 ────────────────────────────────────────────────────────────

export const generateKdpPackageJob = inngest.createFunction(
  {
    id: 'generate-kdp-package',
    name: 'KDP 제출 패키지 생성',
    concurrency: { limit: 2 },
    retries: 1,
    timeouts: { finish: '10m' },
  },
  { event: 'kdp/package.requested' },
  async ({ event, step }) => {
    const { project_id, user_id, metadata: inputMetadata } = event.data
    const supabase = createServiceClient()

    try {
      // ── 1. 프로젝트 조회 ──────────────────────────────────────────────
      const project = await step.run('fetch-project', async () => {
        const { data, error } = await supabase
          .from('projects')
          .select('id, title, kdp_metadata')
          .eq('id', project_id)
          .eq('user_id', user_id)
          .single()
        if (error || !data) throw new Error('프로젝트를 찾을 수 없습니다.')
        return data as { id: string; title: string; kdp_metadata: Record<string, unknown> | null }
      })

      // ── 2. 챕터 + 최신 번역 조회 ─────────────────────────────────────
      const chapters = await step.run('fetch-chapters', async () => {
        const { data: chapterList, error } = await supabase
          .from('chapters')
          .select('id, title, content, order_idx')
          .eq('project_id', project_id)
          .order('order_idx', { ascending: true })
        if (error) throw new Error(`챕터 조회 실패: ${error.message}`)

        const results = await Promise.all(
          (chapterList ?? []).map(async (chapter) => {
            const { data: versions } = await supabase
              .from('chapter_versions')
              .select('content')
              .eq('chapter_id', chapter.id)
              .eq('trigger', 'ai_edit')
              .order('created_at', { ascending: false })
              .limit(1)

            const versionContent = versions?.[0]?.content as
              | { translation_en?: { title?: string; content?: unknown } }
              | null
              | undefined
            const translation = versionContent?.translation_en ?? null

            return {
              id: chapter.id as string,
              title: (translation?.title ?? chapter.title) as string,
              content: (translation?.content ?? chapter.content) as TipTapDocument | null,
              order_idx: chapter.order_idx as number,
            }
          }),
        )
        return results as EpubChapterInput[]
      })

      // ── 3. 영문 EPUB 생성 + 파일 수집 + ZIP 조립 + 업로드 ─────────────
      // NOTE: Buffer는 JSON 직렬화 불가 → 단일 step에서 처리
      const packageResult = await step.run('build-and-upload-package', async () => {
        const meta = { ...(project.kdp_metadata ?? {}), ...(inputMetadata ?? {}) }
        const packageDate = new Date().toISOString().slice(0, 10)
        const baseStoragePath = `${user_id}/${project_id}`
        const found: string[] = []
        const missing: string[] = []

        // EPUB 생성 (language: 'en')
        const epubBuffer = await generateEpub({
          bookId: project_id,
          projectTitle: (meta.title as string | undefined) ?? project.title,
          authorName: (meta.author as string | undefined) ?? 'Unknown Author',
          language: 'en',
          chapters,
          includeToc: true,
        })
        found.push('ebook.epub')

        const packageZip = new JSZip()
        const coverFolder = packageZip.folder('cover')!
        packageZip.file('ebook.epub', epubBuffer)

        // DOCX (Storage에서 — kdp > bookk > kyobo 순으로 시도)
        const docxPaths = ['kdp', 'bookk', 'kyobo'].map(
          (p) => `${baseStoragePath}/export-${p}.docx`,
        )
        let docxAdded = false
        for (const docxPath of docxPaths) {
          const { data } = await supabase.storage.from('project-files').download(docxPath)
          if (data) {
            packageZip.file('interior.docx', Buffer.from(await data.arrayBuffer()))
            found.push('interior.docx')
            docxAdded = true
            break
          }
        }
        if (!docxAdded) missing.push('interior.docx (내지 DOCX 먼저 생성하세요)')

        // 표지 (Storage에서)
        const { data: coverData } = await supabase.storage
          .from('project-files')
          .download(`${baseStoragePath}/cover.jpg`)
        if (coverData) {
          coverFolder.file('cover.jpg', Buffer.from(await coverData.arrayBuffer()))
          found.push('cover/cover.jpg')
        } else {
          missing.push('cover/ (표지 이미지 업로드 필요)')
        }

        // metadata.json
        const metadataJson = {
          title: (meta.title as string | undefined) ?? project.title,
          subtitle: (meta.subtitle as string | undefined) ?? '',
          author: (meta.author as string | undefined) ?? '',
          language: (meta.language as string | undefined) ?? 'en',
          description: (meta.description as string | undefined) ?? '',
          keywords: (meta.keywords as string[] | undefined) ?? [],
          bisac_codes:
            (meta.bisac_codes as string[] | undefined) ??
            ((meta.bisac_code as string | undefined) ? [meta.bisac_code as string] : []),
          price_usd: (meta.price_usd as number | undefined) ?? null,
          ai_disclosure: (meta.ai_disclosure as string | undefined) ?? 'none',
          generated_at: new Date().toISOString(),
          generated_by: 'Podwrite.ai',
        }
        packageZip.file('metadata.json', JSON.stringify(metadataJson, null, 2))
        found.push('metadata.json')

        // metadata.xlsx
        const metaRows: Array<[string, string]> = [
          ['Field', 'Value'],
          ['Title', metadataJson.title],
          ['Subtitle', metadataJson.subtitle],
          ['Author', metadataJson.author],
          ['Language', metadataJson.language],
          ['Description (first 500 chars)', metadataJson.description.slice(0, 500)],
          ['Keywords', metadataJson.keywords.join(', ')],
          ['BISAC Category Code', metadataJson.bisac_codes[0] ?? ''],
          ['List Price (USD)', metadataJson.price_usd != null ? String(metadataJson.price_usd) : ''],
          ['AI Disclosure', metadataJson.ai_disclosure],
          ['Publication Date', packageDate],
          ['Generated By', 'Podwrite.ai'],
        ]
        const xlsxBuf = await buildXlsx(metaRows, 'KDP Metadata')
        packageZip.file('metadata.xlsx', xlsxBuf)
        found.push('metadata.xlsx')

        // README
        packageZip.file('README.txt', buildReadme(project.title, packageDate))

        // ZIP 조립 + 업로드
        const zipBuffer = Buffer.from(
          await packageZip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' }),
        )

        const zipPath = `${baseStoragePath}/kdp-package-${packageDate}.zip`
        const { error: uploadErr } = await supabase.storage
          .from('project-files')
          .upload(zipPath, zipBuffer, { contentType: 'application/zip', upsert: true })
        if (uploadErr) throw new Error(`ZIP 업로드 실패: ${uploadErr.message}`)

        const { data: urlData, error: urlErr } = await supabase.storage
          .from('project-files')
          .createSignedUrl(zipPath, 3600)
        if (urlErr || !urlData) throw new Error('다운로드 URL 생성 실패')

        return {
          downloadUrl: urlData.signedUrl,
          filesFound: found,
          filesMissing: missing,
        }
      })

      // ── 4. 프로젝트 kdp_package 상태 업데이트 (Realtime 트리거) ─────────
      await step.run('update-status', async () => {
        await supabase
          .from('projects')
          .update({
            kdp_package: {
              status: 'done',
              download_url: packageResult.downloadUrl,
              expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              files_included: packageResult.filesFound,
              files_missing: packageResult.filesMissing,
              generated_at: new Date().toISOString(),
            },
          })
          .eq('id', project_id)
      })

      return {
        success: true,
        project_id,
        download_url: packageResult.downloadUrl,
        files_included: packageResult.filesFound,
        files_missing: packageResult.filesMissing,
      }
    } catch (error) {
      // 최종 실패 시 status='error'로 업데이트 (재시도 소진 후)
      await supabase
        .from('projects')
        .update({
          kdp_package: {
            status: 'error',
            error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
            failed_at: new Date().toISOString(),
          },
        })
        .eq('id', project_id)
        .catch(() => {})

      throw error
    }
  },
)
