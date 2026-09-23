import { render } from "preact";
import { deriveTokens } from "../tokens";
import type { AgentConfig } from "../types";
import { App } from "./App";
import { normalize } from "./normalize";

function loadFont(url?: string) {
  if (!url || document.querySelector(`link[data-concierge-font="${CSS.escape(url)}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  link.dataset.conciergeFont = url;
  document.head.appendChild(link);
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
