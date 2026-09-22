import { DEMO_CONFIGS, LAB_CONFIGS } from "./presets";
import { defineConciergeAgent, type ConciergeAgent } from "./widget/element";

defineConciergeAgent();
const grid = document.getElementById("grid")!;
const autoplay = new URLSearchParams(location.search).get("autoplay") ?? "2";
const configs = new URLSearchParams(location.search).has("lab") ? LAB_CONFIGS : Object.values(DEMO_CONFIGS);

for (const config of configs) {
  for (const narrow of [false, true]) {
    const cell = document.createElement("div");
    cell.className = narrow ? "cell narrow" : "cell";
    cell.style.background = config.background ?? "#fff";
    const el = document.createElement("concierge-agent") as ConciergeAgent;
    el.setAttribute("mode", "inline");
    el.setAttribute("open", "");
    el.setAttribute("autoplay", autoplay);
    el.config = { ...config, agent: { ...config.agent, avatar: undefined } };
    cell.appendChild(el);
    grid.appendChild(cell);
  }
}
