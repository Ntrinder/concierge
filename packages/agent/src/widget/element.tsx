import { render } from "preact";
import { deriveTokens } from "../tokens";
import type { AgentConfig } from "../types";
import { App } from "./App";

function loadFont(url?: string) {
  if (!url || document.querySelector(`link[data-concierge-font="${CSS.escape(url)}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  link.dataset.conciergeFont = url;
  document.head.appendChild(link);
}

const STORES = ["books", "fishing"];

/**
 * Configs arrive over the network (or from a merchant's own script), so never
 * trust their shape: fill in harmless defaults for missing style fields and
 * refuse — with a console warning, never a thrown error on the host page —
 * when the essentials are missing.
 */
function normalize(raw: unknown): AgentConfig | null {
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
  return {
    ...c,
    surface: c.surface === "dark" ? "dark" : "light",
    font,
    shape: c.shape ?? "rounded",
    density: c.density ?? "regular",
    voice: c.voice ?? "neutral",
    cardStyle: c.cardStyle ?? "visual",
    agent: { ...c.agent, greeting: c.agent.greeting ?? "" },
    launcher: c.launcher && typeof c.launcher === "object" ? c.launcher : { position: "bottom-right" },
  } as AgentConfig;
}

export class ConciergeAgent extends HTMLElement {
  static observedAttributes = ["mode", "open", "autoplay", "highlight"];
  private root: ShadowRoot;
  private _config?: AgentConfig;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  set config(c: AgentConfig) {
    const safe = normalize(c);
    if (!safe) console.warn("[concierge] ignoring malformed config", c);
    this._config = safe ?? undefined;
    this.update();
  }
  get config(): AgentConfig | undefined { return this._config; }

  connectedCallback() { this.update(); }
  attributeChangedCallback() { this.update(); }
  disconnectedCallback() { render(null, this.root); }

  private update() {
    const config = this._config;
    if (!config || !this.isConnected) return;
    let vars: Record<string, string>;
    try {
      vars = deriveTokens(config).vars;
    } catch (err) {
      console.warn("[concierge] couldn't derive a theme from this config", err);
      return;
    }
    loadFont(config.font.url);
    const autoplay = Number(this.getAttribute("autoplay") ?? 0) || 0;
    render(
      <App
        key={`${config.store}|${config.voice}|${autoplay}|${this.hasAttribute("open")}`}
        config={config}
        vars={vars}
        inline={this.getAttribute("mode") === "inline"}
        defaultOpen={this.hasAttribute("open")}
        autoplay={autoplay}
        host={this}
        highlight={this.getAttribute("highlight")}
      />,
      this.root,
    );
  }
}

export function defineConciergeAgent() {
  if (!customElements.get("concierge-agent")) customElements.define("concierge-agent", ConciergeAgent);
}
