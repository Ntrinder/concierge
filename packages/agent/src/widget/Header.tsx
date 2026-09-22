import type { AgentConfig } from "../types";
import { CloseIcon } from "./icons";

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

export function Avatar({ config, small }: { config: AgentConfig; small?: boolean }) {
  return (
    <span class={small ? "avatar avatar-sm" : "avatar"} aria-hidden="true">
      {config.agent.avatar ? <img src={config.agent.avatar} alt="" /> : initials(config.agent.name)}
    </span>
  );
}

export function Header({ config, onClose }: { config: AgentConfig; onClose: () => void }) {
  return (
    <div class="header">
      <Avatar config={config} />
      <div class="header-text">
        <p class="title">{config.agent.name}</p>
        <p class="subtitle">Shopping assistant · replies instantly</p>
      </div>
      <button type="button" class="icon-btn" aria-label="Close assistant" onClick={onClose}><CloseIcon /></button>
    </div>
  );
}
