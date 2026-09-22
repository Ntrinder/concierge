import { extractBrand } from "@/lib/extract";

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: string };
  let target: URL;
  try {
    const raw = (body.url ?? "").trim();
    target = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
  } catch {
    return Response.json({ error: "That doesn't look like a web address." }, { status: 400 });
  }
  const ownHost = req.headers.get("host");
  if (!/^https?:$/.test(target.protocol) || (PRIVATE.test(target.hostname) && target.host !== ownHost)) {
    return Response.json({ error: "We can only read public websites." }, { status: 400 });
  }
  try {
    return Response.json(await extractBrand(target.href));
  } catch {
    return Response.json({ error: "We couldn't reach that site. Check the address, or upload your logo instead." }, { status: 422 });
  }
}
