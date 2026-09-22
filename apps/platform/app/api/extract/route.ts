import { assertPublicUrl, extractBrand } from "@/lib/extract";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: string };
  let target: URL;
  try {
    const raw = (body.url ?? "").trim();
    target = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
  } catch {
    return Response.json({ error: "That doesn't look like a web address." }, { status: 400 });
  }
  try {
    assertPublicUrl(target);
  } catch {
    return Response.json({ error: "We can only read public websites." }, { status: 400 });
  }
  try {
    return Response.json(await extractBrand(target.href));
  } catch {
    return Response.json({ error: "We couldn't reach that site. Check the address, or upload your logo instead." }, { status: 422 });
  }
}
