import { DEFAULT_CONFIG, PRESETS, googleFontUrl, type AgentConfig, type PresetKey, type StoreKey, type Voice } from "@concierge/agent/core";
import type { Extraction } from "@/lib/extract";
import { shapeFromRadius } from "@/lib/fonts";

export type Source = "url" | "logo" | "style";
export interface StudioState {
  step: 1 | 2 | 3;
  config: AgentConfig;
  source?: Source;
  extraction?: Extraction;
  candidates: { hex: string; reason: string }[];
  site: SiteInfo;
  savedId?: string;
  /** returned once by POST /api/configs; required to overwrite savedId */
  editToken?: string;
  preview: { device: "desktop" | "mobile"; open: boolean; host: "light" | "dark" };
  highlight: string | null;
}
/** What the "your homepage" preview is composed from; everything past `name` is read from their site. */
export interface SiteInfo {
  name: string;
  font?: string;
  fontUrl?: string;
  logo?: string;
  nav?: string[];
  headline?: string;
  eyebrow?: string;
  button?: Extraction["button"];
  background?: string;
  text?: string;
  headingFont?: string;
  bodyFont?: string;
}
export type Action =
  | { type: "start"; config: AgentConfig; source: Source; extraction?: Extraction; candidates: StudioState["candidates"]; site: StudioState["site"] }
  | { type: "patch"; patch: Partial<AgentConfig> }
  | { type: "step"; step: 1 | 2 | 3 }
  | { type: "preview"; patch: Partial<StudioState["preview"]> }
  | { type: "highlight"; token: string | null }
  | { type: "saved"; id: string; editToken?: string }
  | { type: "save-as-new" }
  | { type: "restore"; saved: PersistedStudio };

export const initialStudio: StudioState = {
  step: 1,
  config: DEFAULT_CONFIG,
  candidates: [],
  site: { name: "Your store" },
  preview: { device: "desktop", open: true, host: "light" },
  highlight: null,
};

export function studioReducer(s: StudioState, a: Action): StudioState {
  switch (a.type) {
    case "start":
      // A fresh start is a new design: never reuse the previous one's saved id/token
      return { ...s, step: 2, config: a.config, source: a.source, extraction: a.extraction, candidates: a.candidates, site: a.site, savedId: undefined, editToken: undefined,
        preview: { ...s.preview, host: pageTone(a.site, a.config) } };
    case "patch": return { ...s, config: { ...s.config, ...a.patch } };
    case "step": return { ...s, step: a.step };
    case "preview": return { ...s, preview: { ...s.preview, ...a.patch } };
    case "highlight": return { ...s, highlight: a.token };
    case "saved": return { ...s, savedId: a.id, editToken: a.editToken ?? s.editToken, config: { ...s.config, id: a.id } };
    case "save-as-new": return { ...s, savedId: undefined, editToken: undefined, config: { ...s.config, id: "" } };
    case "restore": return { ...s, ...a.saved, step: 2, preview: { ...s.preview, host: pageTone(a.saved.site, a.saved.config) } };
  }
}

/** The preview page's tone: their site's own background when we read one, else the assistant's surface. */
function pageTone(site: SiteInfo | undefined, config: AgentConfig): "light" | "dark" {
  if (site?.background) return isDarkHex(site.background) ? "dark" : "light";
  return config.surface === "dark" ? "dark" : "light";
}

/** The default greeting for each tone; Controls swaps between these until the merchant writes their own. */
export function greetingFor(name: string, voice: Voice): string {
  const n = name.replace(/\.+$/, "");
  switch (voice) {
    case "warm": return `Hi! Welcome to ${n}. Tell me what you're looking for and I'll help you find the right thing.`;
    case "neutral": return `Welcome to ${n}. What are you looking for today?`;
    case "terse": return "What do you need?";
  }
}

const OUTDOOR_RE = /fish|fly\b|rod|reel|angl|outdoor|hik|camp|trail|gear/i;

/** Which sample catalogue the preview converses about: outdoor gear if their site reads that way, else books. */
export function sampleStoreFor(site: SiteInfo): StoreKey {
  return OUTDOOR_RE.test([site.name, ...(site.nav ?? []), site.headline, site.eyebrow].filter(Boolean).join(" ")) ? "fishing" : "books";
}

/**
 * Saved configs only accept https:// logos (or our own /demo/ assets), so a logo
 * found on this Concierge host becomes root-relative and an http:// one is dropped
 * in favour of initials rather than failing the save later.
 */
export function avatarFromUrl(logo?: string): string | undefined {
  if (!logo) return undefined;
  try {
    const u = new URL(logo);
    if (typeof window !== "undefined" && u.origin === window.location.origin && u.pathname.startsWith("/demo/")) return u.pathname;
    return u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}

export const titleCase = (s: string) => s.replace(/(^|\s)(\p{L})/gu, (_, gap: string, ch: string) => gap + ch.toUpperCase());

export function configFromExtraction(ex: Extraction): AgentConfig {
  const name = ex.name || new URL(ex.url).hostname.replace(/^www\./, "");
  const bg = ex.background;
  const brand = ex.brand[0]?.hex ?? DEFAULT_CONFIG.brand;
  const display = ex.headingFont ?? ex.fonts[0];
  return {
    ...DEFAULT_CONFIG,
    store: sampleStoreFor({ name, nav: ex.nav, headline: ex.headline, eyebrow: ex.eyebrow }),
    brand,
    background: bg,
    surface: bg && isDarkHex(bg) ? "dark" : "light",
    font: { family: "inherit", ...(display ? { display, url: ex.fontUrl ?? googleFontUrl([display]) } : {}) },
    shape: shapeFromRadius(ex.radius),
    heading: { case: ex.headingCase ?? "none", tracking: ex.headingTracking ?? 0 },
    agent: { name: `${name} assistant`, avatar: avatarFromUrl(ex.logo), greeting: greetingFor(name, DEFAULT_CONFIG.voice) },
    launcher: { position: "bottom-right", label: "Need a hand?" },
  };
}

export function configFromPalette(colours: string[], dataUrl: string, name: string): AgentConfig {
  return {
    ...DEFAULT_CONFIG,
    brand: colours[0] ?? "#111111",
    store: "books",
    agent: { name: `${name} assistant`, avatar: dataUrl, greeting: greetingFor(name, DEFAULT_CONFIG.voice) },
  };
}

export function configFromPreset(key: PresetKey): AgentConfig {
  return { ...DEFAULT_CONFIG, ...PRESETS[key].config, store: key === "technical" ? "fishing" : "books" };
}

export function isDarkHex(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

/** What survives a refresh: enough to keep editing the same saved design. */
export type PersistedStudio = Pick<StudioState, "config" | "site" | "source" | "candidates" | "savedId" | "editToken">;
const STORAGE_KEY = "concierge.studio.v1";

export function loadPersisted(): PersistedStudio | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedStudio;
    if (!p || typeof p !== "object" || !p.config || typeof p.config.brand !== "string" || !p.source) return null;
    return { ...p, candidates: Array.isArray(p.candidates) ? p.candidates : [], site: p.site ?? { name: "Your store" } };
  } catch {
    return null;
  }
}

export function persist(s: StudioState): void {
  try {
    if (!s.source) return;
    const p: PersistedStudio = { config: s.config, site: s.site, source: s.source, candidates: s.candidates, savedId: s.savedId, editToken: s.editToken };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // storage full or blocked (private mode) — the studio still works, it just won't survive a refresh
  }
}

export function clearPersisted(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
