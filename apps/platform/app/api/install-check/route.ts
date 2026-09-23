import { parse as parseHtml } from "node-html-parser";
import { assertPublicUrl, fetchText } from "@/lib/extract";

const ID_RE = /^[a-z0-9-]{1,64}$/;

/** Every `data-config` on a `script[src]` whose path ends `/agent.js`, in document order. */
function agentConfigIds(html: string, pageUrl: URL): string[] {
  const root = parseHtml(html);
  const ids: string[] = [];
  for (const el of root.querySelectorAll("script[src]")) {
    const src = el.getAttribute("src");
    if (!src) continue;
    let pathname: string;
    try {
      pathname = new URL(src, pageUrl).pathname;
    } catch {
      continue;
    }
    if (!pathname.endsWith("/agent.js")) continue;
    const cfg = el.getAttribute("data-config");
    if (cfg) ids.push(cfg);
  }
  return ids;
}

/**
 * POST { url, id }: fetches the merchant's page and checks whether our snippet is
 * installed there with this design. Always 200 (even on failure) so the UI can show
 * the result inline; errors are generic — never the underlying fetch/parse message.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: string; id?: string };
  const id = typeof body.id === "string" ? body.id : "";
  if (!ID_RE.test(id)) return Response.json({ error: "Invalid design id" }, { status: 400 });

  let target: URL;
  try {
    const raw = (body.url ?? "").trim();
    target = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
  } catch {
    return Response.json({ status: "error", error: "That doesn't look like a web address." });
  }
  try {
    assertPublicUrl(target);
  } catch {
    return Response.json({ status: "error", error: "We can only check public websites." });
  }

  let html: string;
  try {
    html = await fetchText(target.href, 1_500_000);
  } catch {
    return Response.json({ status: "error", error: "We couldn't reach that site. Check the address and try again." });
  }

  const found = agentConfigIds(html, target);
  if (found.includes(id)) return Response.json({ status: "live" });
  if (found.length) return Response.json({ status: "other", found: found[0] });
  return Response.json({ status: "missing" });
}
