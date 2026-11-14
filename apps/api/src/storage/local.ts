import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { ImageStorage } from '@civicmerge/contracts';
import { validateImageInput } from './image.js';

export function createLocalStorage(directory: string, publicBaseUrl: string): ImageStorage {
  const base = `${publicBaseUrl}/uploads/`;
  return {
    async save({ bytes, mimeType }) {
      validateImageInput({ bytes, mimeType });
      await mkdir(directory, { recursive: true });
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mimeType];
      if (!extension) throw new Error('Unsupported image type');
      const name = `${randomUUID()}.${extension}`;
      await writeFile(path.join(directory, name), bytes, { flag: 'wx' });
      return `${base}${name}`;
    },
    async remove(url) {
      if (!url.startsWith(base)) throw new Error('Image does not belong to local storage');
      const name = url.slice(base.length);
      if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(name)) throw new Error('Invalid local image name');
      await unlink(path.join(directory, name));
    },
  };
}
