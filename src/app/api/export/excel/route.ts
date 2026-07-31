import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import {
  splitMarkdownBlocks,
  stripBlockMarkdownKeepLines,
  exportMessageLabel,
  sanitizeFilename,
  type ExportMessage,
} from '@/lib/export/markdown'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const body = await request.json()
  const { name, messages } = body as { name?: string; messages?: ExportMessage[] }

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'No messages to export.' }, { status: 400 })
  }

  // Hoja principal: una fila por mensaje. Las tablas Markdown se extraen a
  // hojas propias ("Table N") con filas/columnas reales.
  const mainRows: (string | number)[][] = [['#', 'Agent', 'Content']]
  const tableSheets: string[][][] = []

  messages.forEach((msg, idx) => {
    const blocks = splitMarkdownBlocks(msg.content ?? '')
    const parts: string[] = []

    for (const block of blocks) {
      if (block.type === 'table') {
        tableSheets.push(block.rows)
        parts.push(`[Table ${tableSheets.length} — see sheet "Table ${tableSheets.length}"]`)
      } else {
        parts.push(stripBlockMarkdownKeepLines(block.text))
      }
    }

    mainRows.push([idx + 1, exportMessageLabel(msg), parts.join('\n\n')])
  })

  const workbook = XLSX.utils.book_new()

  const mainSheet = XLSX.utils.aoa_to_sheet(mainRows)
  // Anchos de columna legibles: #, Agent, Content
  mainSheet['!cols'] = [{ wch: 4 }, { wch: 12 }, { wch: 100 }]
  XLSX.utils.book_append_sheet(workbook, mainSheet, 'Messages')

  tableSheets.forEach((rows, i) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    const colCount = Math.max(...rows.map(r => r.length))
    sheet['!cols'] = Array.from({ length: colCount }, () => ({ wch: 22 }))
    XLSX.utils.book_append_sheet(workbook, sheet, `Table ${i + 1}`)
  })

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const filename = `${sanitizeFilename(name)}.xlsx`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
