export async function serializeRequest(req: Request): Promise<Uint8Array<ArrayBuffer>> {
  const meta = {
    url: req.url,
    method: req.method,
    mode: req.mode,
    cache: req.cache,
    credentials: req.credentials,
    headers: [...req.headers],
    integrity: req.integrity,
    keepalive: req.keepalive,
    redirect: req.redirect,
    referrer: req.referrer,
    referrerPolicy: req.referrerPolicy,
  };

  const body = await req.bytes();

  const metabuf = new TextEncoder().encode(JSON.stringify(meta));

  const lenbuf = new Uint8Array(4);
  new DataView(lenbuf.buffer).setUint32(0, metabuf.length, true);

  const result = new Uint8Array(4 + metabuf.length + body.length);

  result.set(lenbuf, 0);
  result.set(metabuf, 4);
  result.set(body, 4 + metabuf.length);

  return result;
}

export async function deserializeRequest(
  buf: Uint8Array,
): Promise<Request> {
  if (buf.length < 4) {
    throw new Error("Request too short");
  }

  const metalen = new DataView(
    buf.buffer,
    buf.byteOffset,
    4,
  ).getUint32(0, true);

  if (buf.length < 4 + metalen) {
    throw new Error("Truncated request");
  }

  const metabuf = buf.slice(4, 4 + metalen);
  const body = buf.slice(4 + metalen);

  const meta = JSON.parse(new TextDecoder().decode(metabuf));

  const init: RequestInit = {
    method: meta.method,
    mode: meta.mode,
    cache: meta.cache,
    credentials: meta.credentials,
    headers: new Headers(meta.headers),
    integrity: meta.integrity,
    keepalive: meta.keepalive,
    redirect: meta.redirect,
    referrer: meta.referrer,
    referrerPolicy: meta.referrerPolicy,
  };

  if (
    meta.method !== "GET"
    && meta.method !== "HEAD"
    && body.length > 0
  ) {
    init.body = body;
  }

  return new Request(meta.url, init);
}
