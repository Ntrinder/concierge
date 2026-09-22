import { converter, formatHex, parse as parseColor } from "culori";
import { parse as parseHtml, type HTMLElement } from "node-html-parser";

export interface Extraction {
  url: string;
  name?: string;
  logo?: string;
  brand: { hex: string; reason: string }[];
  background?: string;
  text?: string;
  fonts: string[];
  fontUrl?: string;
  radius?: number;
}

const toOklch = converter("oklch");
const COLOR_RE = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/gi;
const RULE_RE = /([^{}]+)\{([^{}]*)\}/g;
const DECL_RE = /([\w-]+)\s*:\s*([^;]+)/g;
const ROOTISH = /(^|[\s,])(body|html|:root)\b/;
const GENERIC_FONTS = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "-apple-system", "blinkmacsystemfont", "segoe ui", "roboto", "helvetica", "helvetica neue", "arial", "inherit", "initial", "georgia", "times new roman"]);
const UA = "Mozilla/5.0 (compatible; ConciergeBrandReader/1.0; +https://concierge.example)";

async function fetchText(url: string, cap: number): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,text/css,*/*" }, signal: AbortSignal.timeout(6000), redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.text()).slice(0, cap);
}

function toHex(value: string): string | null {
  const c = parseColor(value);
  if (!c || (c.alpha !== undefined && c.alpha < 0.5)) return null;
  return formatHex(c);
}

function firstFamily(value: string): string | null {
  const fam = value.split(",")[0]!.trim().replace(/^['"]|['"]$/g, "").replace(/!important/, "").trim();
  if (!fam || fam.startsWith("var(") || GENERIC_FONTS.has(fam.toLowerCase()) || /icon|awesome|material|symbols/i.test(fam)) return null;
  return fam;
}

function findLogo(root: HTMLElement, base: URL): string | undefined {
  const img = root.querySelectorAll("img").find((el) => {
    const hay = `${el.getAttribute("alt") ?? ""} ${el.getAttribute("src") ?? ""} ${el.getAttribute("class") ?? ""} ${el.parentNode?.getAttribute?.("class") ?? ""}`;
    return /logo/i.test(hay);
  });
  const href =
    img?.getAttribute("src") ??
    root.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href") ??
    root.querySelector('meta[property="og:image"]')?.getAttribute("content");
  return href ? new URL(href, base).href : undefined;
}

export async function extractBrand(rawUrl: string): Promise<Extraction> {
  const url = new URL(rawUrl);
  const root = parseHtml(await fetchText(url.href, 1_500_000));

  const name =
    root.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ??
    root.querySelector("title")?.text.split(/[|–—-]/)[0]?.trim();

  const hrefs = root.querySelectorAll('link[rel~="stylesheet"]').map((l) => l.getAttribute("href")).filter((h): h is string => !!h);
  const googleHrefs = hrefs.filter((h) => h.includes("fonts.googleapis.com"));
  const sheetHrefs = hrefs.filter((h) => !h.includes("fonts.googleapis.com")).slice(0, 6);
  const css: string[] = root.querySelectorAll("style").map((el) => el.text);
  root.querySelectorAll("[style]").forEach((el) => css.push(`inline{${el.getAttribute("style")}}`));
  css.push(...(await Promise.all(sheetHrefs.map((h) => fetchText(new URL(h, url).href, 800_000).catch(() => "")))));

  const tally = new Map<string, { score: number; reasons: Map<string, number> }>();
  const add = (hex: string, score: number, reason: string) => {
    const t = tally.get(hex) ?? { score: 0, reasons: new Map() };
    t.score += score;
    t.reasons.set(reason, (t.reasons.get(reason) ?? 0) + score);
    tally.set(hex, t);
  };
  const theme = root.querySelector('meta[name="theme-color"]')?.getAttribute("content");
  const themeHex = theme ? toHex(theme) : null;
  if (themeHex) add(themeHex, 6, "your site's theme colour");

  let background: string | undefined;
  let text: string | undefined;
  const fontTally = new Map<string, number>();
  const radii: number[] = [];

  for (const chunk of css) {
    for (const [, selRaw, body] of chunk.matchAll(RULE_RE)) {
      const sel = selRaw!.trim().toLowerCase();
      for (const [, propRaw, valRaw] of body!.matchAll(DECL_RE)) {
        const prop = propRaw!.toLowerCase();
        const val = valRaw!.trim();
        if (prop === "font-family") {
          const fam = firstFamily(val);
          if (fam) fontTally.set(fam, (fontTally.get(fam) ?? 0) + (ROOTISH.test(sel) ? 5 : 1));
          continue;
        }
        if (prop === "border-radius" && /button|btn/.test(sel) && val.endsWith("px")) {
          const px = parseFloat(val);
          if (!Number.isNaN(px)) radii.push(px);
          continue;
        }
        for (const raw of val.match(COLOR_RE) ?? []) {
          const hex = toHex(raw);
          if (!hex) continue;
          const chroma = toOklch(hex)?.c ?? 0;
          if (prop.startsWith("--") && /bg|background|paper|canvas/.test(prop) && chroma < 0.06) { background ??= hex; continue; }
          if (ROOTISH.test(sel) && prop.startsWith("background")) { background ??= hex; continue; }
          if (ROOTISH.test(sel) && prop === "color") { text ??= hex; continue; }
          if (chroma < 0.04) continue;
          if (prop.startsWith("--") && /primary|brand|accent|main/.test(prop)) add(hex, 6, "named as a brand colour in your CSS");
          else if (/button|btn|cta/.test(sel) && prop.startsWith("background")) add(hex, 4, "on your buttons");
          else if (/(^|[\s,>])a(\b|:)|link/.test(sel) && prop === "color") add(hex, 3, "on your links");
          else add(hex, 1, "used across your site");
        }
      }
    }
  }

  const ranked = [...tally.entries()].sort((a, b) => b[1].score - a[1].score);
  const brand: Extraction["brand"] = [];
  for (const [hex, t] of ranked) {
    const o = toOklch(hex)!;
    const close = brand.some((b) => {
      const p = toOklch(b.hex)!;
      return Math.abs(p.l - o.l) < 0.06 && Math.abs((p.c ?? 0) - (o.c ?? 0)) < 0.05 && Math.abs((p.h ?? 0) - (o.h ?? 0)) < 12;
    });
    if (close) continue;
    const reason = [...t.reasons.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    brand.push({ hex, reason });
    if (brand.length === 5) break;
  }

  const googleFamilies = googleHrefs.flatMap((h) => new URL(h, url).searchParams.getAll("family").map((f) => f.split(":")[0]!.trim()));
  const fonts = [...new Set([...googleFamilies, ...[...fontTally.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f)])].slice(0, 3);
  const sortedRadii = radii.sort((a, b) => a - b);

  return {
    url: url.href,
    name,
    logo: findLogo(root, url),
    brand,
    background,
    text,
    fonts,
    fontUrl: googleHrefs[0] ? new URL(googleHrefs[0], url).href : undefined,
    radius: sortedRadii.length ? sortedRadii[Math.floor(sortedRadii.length / 2)] : undefined,
  };
}
