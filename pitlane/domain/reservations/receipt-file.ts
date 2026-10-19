import sharp from 'sharp';
import { createHash } from 'node:crypto';

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const hasSignature = (bytes: Uint8Array, signature: number[]) => signature.every((b, i) => bytes[i] === b);

/** Proposed test policy: decode real JPEG/PNG pixels, strip metadata, emit PNG. */
export async function normalizeReceipt(bytes: Uint8Array) {
  if (!bytes.byteLength || bytes.byteLength > MAX_RECEIPT_BYTES) throw new Error('receipt_invalid_file');
  // Magic-byte check so untrusted bytes of any other type never reach the native decoder.
  if (!hasSignature(bytes, JPEG_SIGNATURE) && !hasSignature(bytes, PNG_SIGNATURE)) throw new Error('receipt_invalid_file');
  try {
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 16_000_000 });
    const metadata = await image.metadata();
    if (!['jpeg', 'png'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1) throw new Error('format');
    const output = await image.rotate().png().toBuffer();
    if (output.byteLength > MAX_RECEIPT_BYTES) throw new Error('size');
    return { bytes: output, hash: createHash('sha256').update(output).digest('hex') };
  } catch { throw new Error('receipt_invalid_file'); }
}

/** Bound the streamed multipart body even when Content-Length is absent/false. */
export async function boundedReceiptForm(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('receipt_invalid_file');
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RECEIPT_BYTES + 65536) { await reader.cancel(); throw new Error('receipt_invalid_file'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData();
}
