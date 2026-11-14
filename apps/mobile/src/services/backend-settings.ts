import { File, Paths } from 'expo-file-system';
import { normalizeBackendUrl } from './backend-url';
export { normalizeBackendUrl } from './backend-url';

const settingsFile = () => new File(Paths.document, 'civicmerge-backend.txt');
export function readBackendUrl(): string {
  try {
    const file = settingsFile();
    if (file.exists) return normalizeBackendUrl(file.textSync());
  } catch {
    // An unreadable setting must not prevent the app from opening the editor.
  }
  const fallback = process.env.EXPO_PUBLIC_API_URL;
  if (!fallback) return '';
  try { return normalizeBackendUrl(fallback); } catch { return ''; }
}

export function saveBackendUrl(input: string): string {
  const url = normalizeBackendUrl(input);
  const file = settingsFile();
  if (!file.exists) file.create();
  file.writeSync(url);
  return url;
}
