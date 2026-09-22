import { ConciergeAgent, defineConciergeAgent } from "./widget/element";
import type { AgentConfig } from "./types";

defineConciergeAgent();

const script =
  (document.currentScript as HTMLScriptElement | null) ??
  document.querySelector<HTMLScriptElement>('script[src*="agent.js"][data-config]');
const id = script?.dataset.config;

if (script && id) {
  const origin = new URL(script.src, location.href).origin;
  fetch(`${origin}/configs/${encodeURIComponent(id)}.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`[concierge] config "${id}" not found (${r.status})`);
      return r.json() as Promise<AgentConfig>;
    })
    .then((config) => {
      // Relative avatar paths are relative to the Concierge host, not the merchant's site
      if (config.agent.avatar?.startsWith("/")) config.agent.avatar = origin + config.agent.avatar;
      const el = document.createElement("concierge-agent") as ConciergeAgent;
      el.config = config;
      document.body.appendChild(el);
    })
    .catch((err) => console.warn(err));
}
