import { DEFAULT_CONFIG, PRESETS, googleFontUrl, type AgentConfig, type PresetKey } from "@concierge/agent/core";
import type { Extraction } from "@/lib/extract";
import { shapeFromRadius } from "@/lib/fonts";

export type Source = "url" | "logo" | "style";
export interface StudioState {
  step: 1 | 2 | 3;
  config: AgentConfig;
  source?: Source;
  extraction?: Extraction;
  candidates: { hex: string; reason: string }[];
  site: { name: string; font?: string; fontUrl?: string; logo?: string };
  savedId?: string;
  preview: { device: "desktop" | "mobile"; open: boolean; host: "light" | "dark" };
  highlight: string | null;
}
export type Action =
  | { type: "start"; config: AgentConfig; source: Source; extraction?: Extraction; candidates: StudioState["candidates"]; site: StudioState["site"] }
  | { type: "patch"; patch: Partial<AgentConfig> }
  | { type: "step"; step: 1 | 2 | 3 }
  | { type: "preview"; patch: Partial<StudioState["preview"]> }
  | { type: "highlight"; token: string | null }
  | { type: "saved"; id: string };

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
      return { ...s, step: 2, config: a.config, source: a.source, extraction: a.extraction, candidates: a.candidates, site: a.site,
        preview: { ...s.preview, host: a.config.surface === "dark" ? "dark" : "light" } };
    case "patch": return { ...s, config: { ...s.config, ...a.patch } };
    case "step": return { ...s, step: a.step };
    case "preview": return { ...s, preview: { ...s.preview, ...a.patch } };
    case "highlight": return { ...s, highlight: a.token };
    case "saved": return { ...s, savedId: a.id, config: { ...s.config, id: a.id } };
  }
}

function greetingFor(name: string) {
  return `Hi! Welcome to ${name}. Tell me what you're looking for and I'll help you find the right thing.`;
}

export function configFromExtraction(ex: Extraction): AgentConfig {
  const name = ex.name || new URL(ex.url).hostname.replace(/^www\./, "");
  const bg = ex.background;
  const brand = ex.brand[0]?.hex ?? DEFAULT_CONFIG.brand;
  const display = ex.fonts[0];
  return {
    ...DEFAULT_CONFIG,
    brand,
    background: bg,
    surface: bg && isDarkHex(bg) ? "dark" : "light",
    font: { family: "inherit", ...(display ? { display, url: ex.fontUrl ?? googleFontUrl([display]) } : {}) },
    shape: shapeFromRadius(ex.radius),
    agent: { name: `${name} assistant`, avatar: ex.logo, greeting: greetingFor(name) },
    launcher: { position: "bottom-right", label: "Need a hand?" },
  };
}

export function configFromPalette(colours: string[], dataUrl: string, name: string): AgentConfig {
  return {
    ...DEFAULT_CONFIG,
    brand: colours[0] ?? "#111111",
    agent: { name: `${name} assistant`, avatar: dataUrl, greeting: greetingFor(name) },
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
