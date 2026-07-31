import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType,
} from 'docx'
import {
  splitMarkdownBlocks,
  stripInlineMarkdown,
  exportMessageLabel,
  sanitizeFilename,
  type ExportMessage,
} from '@/lib/export/markdown'

// Runs con negrita básica: **texto** → TextRun bold, resto normal.
function inlineRuns(line: string): TextRun[] {
  const parts = line.split(/\*\*(.+?)\*\*/g)
  return parts
    .map((part, i) => {
      const text = stripInlineMarkdown(part)
      if (!text) return null
      return new TextRun({ text, bold: i % 2 === 1 })
    })
    .filter((r): r is TextRun => r !== null)
}

function textBlockToParagraphs(text: string): Paragraph[] {
  const paragraphs: Paragraph[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      paragraphs.push(new Paragraph({
        heading: headingMatch[1].length <= 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
        children: inlineRuns(headingMatch[2]),
        spacing: { before: 160, after: 80 },
      }))
      continue
    }

    const bulletMatch = line.match(/^[-*+]\s+(.*)$/) ?? line.match(/^\d+\.\s+(.*)$/)
    if (bulletMatch) {
      paragraphs.push(new Paragraph({
        children: inlineRuns(bulletMatch[1]),
        bullet: { level: 0 },
      }))
      continue
    }

    if (/^[-*_]{3,}$/.test(line) || /^```/.test(line)) continue

    paragraphs.push(new Paragraph({
      children: inlineRuns(line),
      spacing: { after: 80 },
    }))
  }

  return paragraphs
}

function markdownTableToDocxTable(rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row, rowIdx) =>
      new TableRow({
        children: row.map(cell =>
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: cell, bold: rowIdx === 0 })],
            })],
          })
        ),
      })
    ),
  })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const body = await request.json()
  const { name, messages } = body as { name?: string; messages?: ExportMessage[] }

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'No messages to export.' }, { status: 400 })
  }

  const children: (Paragraph | Table)[] = []

  messages.forEach((msg, idx) => {
    // Encabezado del mensaje: quién habló
    children.push(new Paragraph({
      children: [new TextRun({ text: exportMessageLabel(msg), bold: true, allCaps: true, size: 20 })],
      spacing: { before: idx === 0 ? 0 : 280, after: 120 },
    }))

    for (const block of splitMarkdownBlocks(msg.content ?? '')) {
      if (block.type === 'table') {
        children.push(markdownTableToDocxTable(block.rows))
        children.push(new Paragraph({ spacing: { after: 80 } }))
      } else {
        children.push(...textBlockToParagraphs(block.text))
      }
    }
  })

  const doc = new Document({ sections: [{ children }] })
  const buffer = await Packer.toBuffer(doc)
  const filename = `${sanitizeFilename(name)}.docx`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
