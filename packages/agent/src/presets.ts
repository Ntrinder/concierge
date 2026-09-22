import type { AgentConfig } from "./types";

export function googleFontUrl(families: string[]): string {
  const unique = [...new Set(families.filter(Boolean))];
  const q = unique.map((f) => `family=${f.trim().replace(/ /g, "+")}:wght@400;500;600;700`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

export const DEMO_CONFIGS = {
  marginalia: {
    id: "marginalia", store: "books", brand: "#7A2E2E", background: "#F6F1E7", surface: "light",
    font: { family: "inherit", display: "Fraunces", url: googleFontUrl(["Fraunces"]) },
    shape: "soft", density: "airy", voice: "warm", cardStyle: "visual",
    agent: { name: "Ask a bookseller", avatar: "/demo/marginalia-logo.svg", greeting: "Hello! Looking for something to read — or something to give? Tell me a little about who it's for." },
    launcher: { position: "bottom-right", label: "Ask a bookseller" },
  },
  riffle: {
    id: "riffle", store: "fishing", brand: "#FF5A1F", background: "#101214", surface: "dark",
    font: { family: "Barlow", display: "Barlow Condensed", url: googleFontUrl(["Barlow", "Barlow Condensed"]) },
    shape: "square", density: "compact", voice: "terse", cardStyle: "spec",
    agent: { name: "Riffle Guide", avatar: "/demo/riffle-logo.svg", greeting: "Where are you fishing, and what do you need? I'll match the gear." },
    launcher: { position: "bottom-right", label: "Ask a guide" },
  },
} satisfies Record<string, AgentConfig>;

export type PresetKey = "editorial" | "technical" | "playful" | "minimal";
type PresetConfig = Omit<AgentConfig, "id" | "store" | "agent" | "launcher">;

export const PRESETS: Record<PresetKey, { label: string; description: string; config: PresetConfig }> = {
  editorial: { label: "Editorial", description: "Warm paper, serif headings, generous space", config: {
    brand: "#8A3B2E", background: "#F7F2EA", surface: "light", font: { family: "inherit", display: "Fraunces", url: googleFontUrl(["Fraunces"]) },
    shape: "soft", density: "airy", voice: "warm", cardStyle: "visual" } },
  technical: { label: "Technical", description: "High contrast, square, spec-first", config: {
    brand: "#FF5A1F", background: "#111315", surface: "dark", font: { family: "inherit", display: "Barlow Condensed", url: googleFontUrl(["Barlow Condensed"]) },
    shape: "square", density: "compact", voice: "terse", cardStyle: "spec" } },
  playful: { label: "Playful", description: "Bright, rounded, friendly", config: {
    brand: "#6C4CF5", background: "#FFFFFF", surface: "light", font: { family: "inherit", display: "Fredoka", url: googleFontUrl(["Fredoka"]) },
    shape: "soft", density: "regular", voice: "warm", cardStyle: "visual" } },
  minimal: { label: "Minimal", description: "Black and white, quiet, precise", config: {
    brand: "#111111", background: "#FFFFFF", surface: "light", font: { family: "inherit" },
    shape: "rounded", density: "regular", voice: "neutral", cardStyle: "visual" } },
};

export const DEFAULT_CONFIG: AgentConfig = {
  id: "", store: "books", ...PRESETS.minimal.config,
  agent: { name: "Shopping assistant", greeting: "Hi! Tell me what you're looking for and I'll help you find the right thing." },
  launcher: { position: "bottom-right", label: "Need a hand?" },
};

export const LAB_CONFIGS: AgentConfig[] = [
  DEMO_CONFIGS.marginalia,
  DEMO_CONFIGS.riffle,
  { ...DEFAULT_CONFIG, id: "lab-neon", store: "fishing", brand: "#00FF88", background: "#0A0A0A", surface: "dark", font: { family: "inherit", display: "Space Grotesk", url: googleFontUrl(["Space Grotesk"]) }, shape: "rounded", density: "regular", voice: "neutral", cardStyle: "spec", agent: { name: "Neon", greeting: "What are you after?" } },
  { ...DEFAULT_CONFIG, id: "lab-sherbet", store: "books", brand: "#F4C2C2", background: "#FFFFFF", surface: "light", shape: "soft", density: "airy", voice: "warm", cardStyle: "visual", agent: { name: "Sherbet", greeting: "Hello, lovely! What are we reading?" } },
  { ...DEFAULT_CONFIG, id: "lab-mono", store: "fishing", brand: "#111111", background: "#FFFFFF", surface: "light", shape: "square", density: "compact", voice: "terse", cardStyle: "spec", agent: { name: "Mono", greeting: "Specs first. What do you need?" } },
  { ...DEFAULT_CONFIG, id: "lab-hotpink", store: "books", brand: "#FF1493", background: "#FFF5FA", surface: "light", font: { family: "inherit", display: "Playfair Display", url: googleFontUrl(["Playfair Display"]) }, shape: "square", density: "airy", voice: "warm", cardStyle: "visual", agent: { name: "Pink Pages", greeting: "Darling. What shall we read?" } },
];
