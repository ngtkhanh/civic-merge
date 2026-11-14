import type { ImageInput } from '@civicmerge/contracts';

// Backend-only read interface. Routes do not select or construct an adapter.
export interface ImageDelivery {
  readObject(bucket: string, prefix: string, name: string): Promise<ImageInput>;
}
