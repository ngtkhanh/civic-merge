import type { ImageInput } from '@civicmerge/contracts';

export function fakeStorage() {
  const objects = new Map<string, ImageInput>();
  const calls: { path: string; method: string }[] = [];
  const state = { public: false, fail: '', status: 503 };
  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname.replace('/storage/v1', '');
    const method = init?.method ?? 'GET';
    calls.push({ path, method });
    if (state.fail && path.includes(state.fail)) return Response.json({ statusCode: String(state.status), message: 'PRIVATE UPSTREAM DETAIL' }, { status: state.status });
    if (path.startsWith('/bucket/')) return Response.json({ id: path.slice(8), public: state.public });
    if (method === 'POST') {
      const key = path.slice('/object/'.length);
      if (objects.has(key)) return Response.json({}, { status: 409 });
      objects.set(key, { bytes: new Uint8Array(init!.body as Uint8Array), mimeType: new Headers(init!.headers).get('content-type')! });
      return Response.json({ Key: key });
    }
    if (method === 'DELETE') {
      const bucket = path.slice('/object/'.length);
      for (const key of JSON.parse(String(init?.body)).prefixes) objects.delete(`${bucket}/${key}`);
      return Response.json([]);
    }
    const object = objects.get(path.slice('/object/authenticated/'.length));
    return object ? new Response(new Uint8Array(object.bytes), { headers: { 'content-type': object.mimeType } })
      : Response.json({ statusCode: '404' }, { status: 400 });
  };
  return { objects, calls, state, fetcher };
}
