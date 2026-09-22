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

export class ConciergeAgent extends HTMLElement {
  static observedAttributes = ["mode", "open", "autoplay", "highlight"];
  private root: ShadowRoot;
  private _config?: AgentConfig;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  set config(c: AgentConfig) { this._config = c; this.update(); }
  get config(): AgentConfig | undefined { return this._config; }

  connectedCallback() { this.update(); }
  attributeChangedCallback() { this.update(); }
  disconnectedCallback() { render(null, this.root); }

  private update() {
    const config = this._config;
    if (!config || !this.isConnected) return;
    loadFont(config.font.url);
    const autoplay = Number(this.getAttribute("autoplay") ?? 0);
    render(
      <App
        key={`${config.store}|${config.voice}|${autoplay}|${this.hasAttribute("open")}`}
        config={config}
        vars={deriveTokens(config).vars}
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
