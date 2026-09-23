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
  /** first 3–4 nav link labels */
  nav?: string[];
  /** first h1, and the short line right before it */
  headline?: string;
  eyebrow?: string;
  /** the hero's primary call to action */
  button?: { text?: string; bg?: string; color?: string; radius?: number };
  headingFont?: string;
  bodyFont?: string;
  headingCase?: "none" | "uppercase";
  /** em, 0–0.2 */
  headingTracking?: number;
}

interface Rule { sel: string; decls: [string, string][] }

const toOklch = converter("oklch");
const COLOR_RE = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/gi;
const RULE_RE = /([^{}]+)\{([^{}]*)\}/g;
const DECL_RE = /([\w-]+)\s*:\s*([^;]+)/g;
const ROOTISH = /(^|[\s,])(body|html|:root)\b/;
const GENERIC_FONTS = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "-apple-system", "blinkmacsystemfont", "segoe ui", "roboto", "helvetica", "helvetica neue", "arial", "inherit", "initial", "georgia", "times new roman"]);
const UA = "Mozilla/5.0 (compatible; ConciergeBrandReader/1.0; +https://concierge.example)";

// Hostname patterns for loopback/private/link-local ranges. String-based, not IP-literal-aware
// (see DECISIONS.md "Weakest part" for what this does not cover).
const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/;
const MAX_REDIRECTS = 3;

/** Hosts the operator explicitly allowed via EXTRACT_ALLOW_HOSTS (host:port, comma-separated). */
function operatorAllowedHosts(): Set<string> {
  const raw = process.env.EXTRACT_ALLOW_HOSTS ?? "";
  return new Set(raw.split(",").map((h) => h.trim()).filter(Boolean));
}

const LOCAL_DEV_HOST = /^(localhost|127\.0\.0\.1)$/;

/**
 * Single source of truth for the SSRF guard: blocks non-http(s) protocols and
 * private/loopback/link-local hosts, with two narrow exceptions so the demo stores
 * work locally: in non-production, localhost / 127.0.0.1 on any port; and in any
 * environment, hosts the operator listed in EXTRACT_ALLOW_HOSTS (e.g. for a local
 * `pnpm start`). Neither is ever derived from a client-supplied header.
 */
export function assertPublicUrl(url: URL): void {
  if (!/^https?:$/.test(url.protocol)) throw new Error("Blocked protocol");
  if (!PRIVATE.test(url.hostname)) return;
  if (process.env.NODE_ENV !== "production" && LOCAL_DEV_HOST.test(url.hostname)) return;
  if (operatorAllowedHosts().has(url.host)) return;
  throw new Error("Blocked private/loopback host");
}

async function fetchOnce(url: URL, cap: number): Promise<{ text: string; redirectedTo?: URL }> {
  const res = await fetch(url.href, {
    headers: { "user-agent": UA, accept: "text/html,text/css,*/*" },
    signal: AbortSignal.timeout(6000),
    redirect: "manual",
  });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (!loc) throw new Error("Redirect with no Location header");
    return { text: "", redirectedTo: new URL(loc, url) };
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) return { text: (await res.text()).slice(0, cap) };

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
      if (total >= cap) {
        reader.cancel().catch(() => {});
        break;
      }
    }
  }
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return { text: buf.subarray(0, cap).toString("utf-8") };
}

/** Guarded fetch: SSRF-checked, manual redirects re-checked at every hop, byte-capped. */
export async function fetchText(rawUrl: string, cap: number): Promise<string> {
  let url = new URL(rawUrl);
  assertPublicUrl(url);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { text, redirectedTo } = await fetchOnce(url, cap);
    if (!redirectedTo) return text;
    if (hop === MAX_REDIRECTS) throw new Error("Too many redirects");
    assertPublicUrl(redirectedTo);
    url = redirectedTo;
  }
  throw new Error("Too many redirects");
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

/**
 * Replaces `var(--x)` / `var(--x, fallback)` with the first declared value of --x.
 * Innermost calls resolve first, so nested fallbacks and vars that point at vars
 * (a couple of levels deep) come out as plain values; unknown vars without a fallback become "".
 */
export function resolveVars(value: string, vars: Map<string, string>): string {
  let out = value;
  for (let i = 0; i < 3 && out.includes("var("); i++) {
    out = out.replace(/var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/g, (_, name: string, fb?: string) => vars.get(name) ?? fb?.trim() ?? "");
  }
  return out;
}

/** Family from a `font` shorthand (`700 clamp(…) / .88 Barlow Condensed, sans-serif`) or a plain `font-family`. */
export function familyFrom(prop: string, value: string): string | null {
  if (prop === "font-family") return firstFamily(value);
  if (prop !== "font") return null;
  let v = value;
  for (let prev = ""; prev !== v; ) { prev = v; v = v.replace(/[\w-]+\([^()]*\)/g, " "); }
  v = v.replace(/^(\s*(normal|italic|oblique|bold|bolder|lighter|small-caps|condensed|semi-condensed|expanded|(x+-)?(small|large)|medium|smaller|larger|\d+|[\d.]+[a-z%]+|\/\s*[\d.]+[a-z%]*|\/))+\s*/i, "");
  return v ? firstFamily(v) : null;
}

/**
 * Heading case and tracking for the agent's `heading` tokens: uppercase when the CSS
 * says so or the headline itself is set in caps; tracking from a positive letter-spacing
 * (px read against a 16px root), else a light 0.06em for caps. Clamped to 0–0.2em.
 */
export function headingStyle(input: { transform?: string; letterSpacing?: string; headline?: string }): { headingCase: "none" | "uppercase"; headingTracking: number } {
  const letters = input.headline?.match(/\p{L}/gu) ?? [];
  const capsText = letters.length >= 4 && letters.every((ch) => ch === ch.toUpperCase() && ch !== ch.toLowerCase());
  const upper = /uppercase/i.test(input.transform ?? "") || capsText;
  const ls = input.letterSpacing?.trim().match(/^(-?[\d.]+)(em|rem|px)$/i);
  let tracking = 0;
  if (ls) tracking = parseFloat(ls[1]!) / (ls[2]!.toLowerCase() === "px" ? 16 : 1);
  if (!(tracking > 0)) tracking = upper ? 0.06 : 0;
  return { headingCase: upper ? "uppercase" : "none", headingTracking: Math.round(Math.min(0.2, Math.max(0, tracking)) * 1000) / 1000 };
}

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`);
/** Visible text with <br> as a space and whitespace collapsed. */
const textOf = (el: HTMLElement) => parseHtml(el.innerHTML.replace(/<br\s*\/?>/gi, " ")).text.replace(/\s+/g, " ").trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const STATEFUL = /:(hover|focus|active|visited|focus-visible|focus-within|disabled)|::/;
const SKIP_NAV = /cart|basket|bag|account|log ?in|search/i;

/**
 * Declarations that apply to the element matched by `test`, where `test` sees the last
 * compound of each selector (`.hero h1` → `h1`). Later rules win; hover/focus states and
 * pseudo-elements are skipped. Specificity is ignored — good enough for a preview.
 */
function declsWhere(rules: Rule[], test: (compound: string) => boolean): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rules) {
    const hit = r.sel.split(",").some((part) => {
      const p = part.trim();
      return !STATEFUL.test(p) && test(p.split(/[\s>+~]+/).filter(Boolean).pop() ?? "");
    });
    if (hit) for (const [k, v] of r.decls) out.set(k, v);
  }
  return out;
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

  const rules: Rule[] = [];
  for (const chunk of css) {
    for (const [, selRaw, body] of chunk.matchAll(RULE_RE)) {
      rules.push({ sel: selRaw!.trim().toLowerCase(), decls: [...body!.matchAll(DECL_RE)].map(([, p, v]) => [p!.toLowerCase(), v!.trim()]) });
    }
  }
  // Custom properties first (first declaration wins) so `background: var(--brand)` resolves
  const vars = new Map<string, string>();
  for (const r of rules) for (const [p, v] of r.decls) if (p.startsWith("--") && !vars.has(p)) vars.set(p, v);
  const resolve = (v: string) => resolveVars(v, vars).trim();

  for (const { sel, decls } of rules) {
    for (const [prop, rawVal] of decls) {
      const val = resolve(rawVal);
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

  // ── The homepage itself, for the studio's "your homepage" preview ──
  const classesOf = (el: HTMLElement) => (el.getAttribute("class") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  /** CSS-module class names are hashed, but the element's own class attr matches its selectors. */
  const rulesFor = (classNames: string[]) => {
    const res = classNames.map((c) => new RegExp(`\\.${escapeRe(c)}(?![\\w-])`));
    return declsWhere(rules, (compound) => res.some((re) => re.test(compound)));
  };
  const rulesForTag = (tag: string) => declsWhere(rules, (compound) => new RegExp(`^${tag}(?![\\w-])`).test(compound));
  const stylesOf = (el: HTMLElement) => {
    const out = rulesFor(classesOf(el));
    for (const [, p, v] of (el.getAttribute("style") ?? "").matchAll(DECL_RE)) out.set(p!.toLowerCase(), v!.trim());
    return out;
  };
  const fontOf = (decls: Map<string, string>) => {
    const fam = decls.get("font-family") ?? decls.get("font");
    return fam ? familyFrom(decls.has("font-family") ? "font-family" : "font", resolve(fam)) ?? undefined : undefined;
  };
  const colourOf = (v?: string) => {
    const raw = v ? resolve(v).match(COLOR_RE)?.[0] : undefined;
    return raw ? toHex(raw) ?? undefined : undefined;
  };

  const navLinks = root.querySelectorAll("header nav a").length ? root.querySelectorAll("header nav a") : root.querySelectorAll("nav a");
  const nav = [...new Set(navLinks.map(textOf).filter((t) => t && t.length <= 30 && !SKIP_NAV.test(t)))].slice(0, 4);

  const h1 = root.querySelector("h1");
  const headline = h1 ? clip(textOf(h1), 90) || undefined : undefined;
  const before = h1?.previousElementSibling;
  const eyebrowText = before && /^(p|span|div)$/i.test(before.tagName) ? textOf(before) : "";
  const eyebrow = eyebrowText && eyebrowText.length <= 60 ? eyebrowText : undefined;

  let button: Extraction["button"];
  const scope = h1?.closest("section") ?? root.querySelector("main") ?? h1?.parentNode ?? null;
  if (scope) {
    const els = scope.querySelectorAll("h1, a, button");
    const after = h1 ? els.slice(els.indexOf(h1) + 1).filter((el) => el.tagName !== "H1") : els;
    const cta = after.find((el) => /btn|button|cta/i.test(el.getAttribute("class") ?? "")) ?? after.find((el) => { const t = textOf(el); return t && t.length <= 30; });
    if (cta) {
      const st = stylesOf(cta);
      const bg = colourOf(st.get("background-color") ?? st.get("background"));
      const r = st.get("border-radius") ? resolve(st.get("border-radius")!) : undefined;
      const px = r ? parseFloat(r) : NaN;
      // An unrounded button is a choice too: a styled one with no border-radius is square
      const radius = r?.endsWith("%") && px >= 50 ? 999 : !Number.isNaN(px) ? Math.min(px, 999) : bg ? 0 : undefined;
      button = { text: clip(textOf(cta), 30) || undefined, bg, color: colourOf(st.get("color")), radius };
    }
  }

  const headDecls = h1 ? new Map([...rulesForTag("h1"), ...rulesFor(classesOf(h1))]) : rulesForTag("h1");
  const h2Decls = rulesForTag("h2");
  const pick = (prop: string) => headDecls.get(prop) ?? h2Decls.get(prop);
  const headingFont = fontOf(headDecls) ?? fontOf(h2Decls);
  const rootDecls = declsWhere(rules, (compound) => /^(body|html|:root)(?![\w-])/.test(compound));
  const wrapper = root.querySelector("body")?.querySelector("[class]");
  const bodyFont = fontOf(rootDecls) ?? (wrapper ? fontOf(stylesOf(wrapper)) : undefined);
  const { headingCase, headingTracking } = headingStyle({ transform: pick("text-transform"), letterSpacing: pick("letter-spacing") && resolve(pick("letter-spacing")!), headline });

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
    nav: nav.length ? nav : undefined,
    headline,
    eyebrow,
    button,
    headingFont,
    bodyFont,
    headingCase,
    headingTracking,
  };
}
