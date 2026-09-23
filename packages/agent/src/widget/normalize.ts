import type { AgentConfig } from "../types";

const STORES = ["books", "fishing"];

/**
 * Configs arrive over the network (or from a merchant's own script), so never
 * trust their shape: fill in harmless defaults for missing style fields and
 * refuse — with a console warning, never a thrown error on the host page —
 * when the essentials are missing.
 */
export function normalize(raw: unknown): AgentConfig | null {
  const c = raw as Partial<AgentConfig> | null;
  if (!c || typeof c !== "object") return null;
  if (typeof c.brand !== "string" || !/^#[0-9a-f]{6}$/i.test(c.brand)) return null;
  if (!STORES.includes(c.store as string)) return null;
  if (!c.agent || typeof c.agent !== "object" || typeof c.agent.name !== "string") return null;
  const f = c.font && typeof c.font === "object" ? c.font : null;
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const font = {
    family: str(f?.family) ?? "inherit",
    ...(str(f?.display) ? { display: str(f?.display) } : {}),
    ...(str(f?.url) ? { url: str(f?.url) } : {}),
  };
  const validUrl = (v: unknown): v is string => typeof v === "string" && ((v.startsWith("/") && !v.startsWith("//")) || v.startsWith("https://"));
  const b = c.basket && typeof c.basket === "object" ? c.basket : null;
  const basket = {
    ...(validUrl(b?.checkoutUrl) ? { checkoutUrl: b!.checkoutUrl } : {}),
    ...(validUrl(b?.basketUrl) ? { basketUrl: b!.basketUrl } : {}),
  };
  const subtitle = str(c.agent.subtitle);
  const h = c.heading && typeof c.heading === "object" ? c.heading : null;
  const heading = {
    ...(h?.case === "uppercase" || h?.case === "none" ? { case: h?.case } : {}),
    ...(typeof h?.tracking === "number" ? { tracking: Math.min(0.2, Math.max(0, h!.tracking as number)) } : {}),
  };
  const topOffset = typeof c.topOffset === "number" ? Math.min(200, Math.max(0, c.topOffset)) : undefined;

  return {
    ...c,
    surface: c.surface === "dark" ? "dark" : "light",
    font,
    shape: c.shape ?? "rounded",
    density: c.density ?? "regular",
    voice: c.voice ?? "neutral",
    cardStyle: c.cardStyle ?? "visual",
    agent: { ...c.agent, greeting: c.agent.greeting ?? "", subtitle },
    launcher: c.launcher && typeof c.launcher === "object" ? c.launcher : { position: "bottom-right" },
    ...(Object.keys(basket).length ? { basket } : {}),
    ...(c.heading !== undefined ? { heading } : {}),
    ...(c.topOffset !== undefined ? { topOffset } : {}),
  } as AgentConfig;
}
