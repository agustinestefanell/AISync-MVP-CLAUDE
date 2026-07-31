// Client-side file size limits for uploads.
//
// Vercel Serverless Functions reject any request body over 4.5 MB with an
// HTTP 413 before the function runs — not configurable from code or
// vercel.json. These limits keep payloads under that hard cap with margin.

// ContextFilePanel sends the file as raw binary (FormData): 4 MB file ≈ 4 MB
// payload, leaving ~0.5 MB of margin for the rest of the form fields.
export const MAX_CONTEXT_FILE_BYTES = 4 * 1024 * 1024

// Chat attachments travel base64-encoded inside the JSON body (~33% larger
// than the file), so the file limit must be lower: 3 MB file → ~4 MB base64
// + rest of the chat payload stays under the 4.5 MB cap.
export const MAX_ATTACHMENT_FILE_BYTES = 3 * 1024 * 1024

export function formatMB(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${mb % 1 === 0 ? mb.toFixed(0) : mb.toFixed(1)} MB`
}

export function fileTooLargeMessage(fileName: string, fileSizeBytes: number, limitBytes: number): string {
  return `"${fileName}" is too large (${formatMB(fileSizeBytes)}). The current limit is ${formatMB(limitBytes)}. Please try a smaller or compressed file.`
}

// Safety net for HTTP 413 responses that slip past the client-side check
// (e.g. the total payload exceeds the limit even though each file passed).
export function payloadTooLargeMessage(limitBytes: number): string {
  return `The upload is too large for the server. The current limit is ${formatMB(limitBytes)} per request. Please try a smaller or compressed file.`
}
