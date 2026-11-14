import { DomainError, type ImageInput } from '@civicmerge/contracts';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export function validateImageInput(image: ImageInput): ImageInput {
  const b = Buffer.from(image.bytes);
  if (b.length > MAX_IMAGE_BYTES) throw new DomainError('VALIDATION_ERROR', 'Ảnh vượt giới hạn 8 MiB.', 413);
  const detected = b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
    : b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255 ? 'image/jpeg'
    : b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null;
  if (!detected || detected !== image.mimeType) throw new DomainError('INVALID_IMAGE', 'Chỉ nhận ảnh JPEG, PNG hoặc WebP có MIME và chữ ký phù hợp.', 415);
  return { bytes: b, mimeType: detected };
}
