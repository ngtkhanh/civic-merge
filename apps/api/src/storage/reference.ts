// Internal wire format, not a network origin. Independent of the HTTP adapter.
export const REFERENCE_ORIGIN = 'https://civicmerge-storage.invalid';
export const storageSegment = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;
export const storageFilename = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function parseImageReference(reference: string) {
  try {
    const url = new URL(reference);
    const [bucket, prefix, name, extra] = url.pathname.slice(1).split('/');
    if (url.origin !== REFERENCE_ORIGIN || url.search || url.hash || url.username || url.password || extra !== undefined
      || !storageSegment.test(bucket ?? '') || !storageSegment.test(prefix ?? '') || !storageFilename.test(name ?? '')) return null;
    return { bucket, prefix, name };
  } catch { return null; }
}
export function publicImageUrl(reference: string, baseUrl: string): string {
  const object = parseImageReference(reference);
  return object ? `${baseUrl}/api/images/${object.bucket}/${object.prefix}/${object.name}` : reference;
}
