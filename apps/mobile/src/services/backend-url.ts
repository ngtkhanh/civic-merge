export function normalizeBackendUrl(input: string): string {
  let url: URL;
  try { url = new URL(input.trim()); }
  catch { throw new Error('Nhập địa chỉ máy chủ đầy đủ, ví dụ http://192.168.1.20:3011.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Nhập địa chỉ gốc HTTP/HTTPS, không kèm /health, mật khẩu hoặc tham số.');
  }
  return url.origin;
}
