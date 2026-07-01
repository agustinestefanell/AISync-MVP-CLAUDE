// Endpoint temporal de diagnóstico para @napi-rs/canvas
// NO tocar en producción — solo para debugging de Stage B Context Files
import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

export const dynamic = 'force-dynamic'

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const diagnostics: Record<string, any> = {}

  // 1. Información del proceso
  diagnostics.process = {
    version: process.version,
    platform: process.platform,
    arch: process.arch,
  }

  // 2. Intentar resolver @napi-rs/canvas
  try {
    diagnostics.canvas_resolve = require.resolve('@napi-rs/canvas')
  } catch (error) {
    diagnostics.canvas_resolve = {
      error: error instanceof Error ? error.message : String(error),
    }
  }

  // 3. Intentar resolver @napi-rs/canvas-linux-x64-gnu
  try {
    diagnostics.canvas_linux_resolve = require.resolve('@napi-rs/canvas-linux-x64-gnu')
  } catch (error) {
    diagnostics.canvas_linux_resolve = {
      error: error instanceof Error ? error.message : String(error),
    }
  }

  // 4. Listar contenido de node_modules/@napi-rs/
  try {
    const napiRsPath = path.join(process.cwd(), 'node_modules', '@napi-rs')
    if (fs.existsSync(napiRsPath)) {
      diagnostics.napi_rs_dir = fs.readdirSync(napiRsPath)
    } else {
      diagnostics.napi_rs_dir = { error: 'Directory does not exist' }
    }
  } catch (error) {
    diagnostics.napi_rs_dir = {
      error: error instanceof Error ? error.message : String(error),
    }
  }

  // 5. Listar contenido específico de canvas-linux-x64-gnu si existe
  try {
    const linuxBinaryPath = path.join(
      process.cwd(),
      'node_modules',
      '@napi-rs',
      'canvas-linux-x64-gnu'
    )
    if (fs.existsSync(linuxBinaryPath)) {
      diagnostics.canvas_linux_dir = fs.readdirSync(linuxBinaryPath)
    } else {
      diagnostics.canvas_linux_dir = { error: 'Directory does not exist' }
    }
  } catch (error) {
    diagnostics.canvas_linux_dir = {
      error: error instanceof Error ? error.message : String(error),
    }
  }

  // 6. Intentar cargar @napi-rs/canvas y acceder a DOMMatrix
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const canvas = require('@napi-rs/canvas')
    diagnostics.canvas_require = {
      success: true,
      exports: Object.keys(canvas || {}),
    }

    // Intentar acceder a DOMMatrix específicamente
    try {
      const { DOMMatrix } = canvas
      diagnostics.DOMMatrix_access = {
        success: true,
        type: typeof DOMMatrix,
        isDefined: DOMMatrix !== undefined,
      }
    } catch (domError) {
      diagnostics.DOMMatrix_access = {
        success: false,
        error: domError instanceof Error ? domError.message : String(domError),
      }
    }
  } catch (error) {
    diagnostics.canvas_require = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }
  }

  // 7. Verificar variables de entorno relevantes
  diagnostics.env = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    LAMBDA_TASK_ROOT: process.env.LAMBDA_TASK_ROOT,
  }

  return NextResponse.json(diagnostics, { status: 200 })
}
