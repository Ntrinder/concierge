import { useEffect, useState } from "preact/hooks";
import { replay } from "../engine/engine";
import { varsToCss } from "../tokens";
import type { AgentConfig } from "../types";
import styles from "./styles.css?inline";
import { cls } from "./cls";
import { Avatar, Header } from "./Header";
import { CloseIcon } from "./icons";
import { useCompact } from "./useCompact";

export interface AppProps {
  config: AgentConfig;
  vars: Record<string, string>;
  inline: boolean;
  defaultOpen: boolean;
  autoplay: number;
  host: HTMLElement;
  highlight: string | null;
}

export function App({ config, vars, inline, defaultOpen, autoplay, host, highlight }: AppProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [conv] = useState(() => replay(config.store, config.voice, autoplay));
  const compact = useCompact(host, inline);

  // Lock host page scroll while the full-screen sheet is open on a phone
  useEffect(() => {
    if (inline || !(open && compact)) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prev; };
  }, [open, compact, inline]);

  return (
    <>
      <style>{styles}</style>
      <style>{varsToCss(vars)}</style>
      <div class={cls("root", inline ? "inline" : "page", compact && "compact", config.launcher.position === "bottom-left" && "left", highlight && `hl-${highlight}`)}>
        {!(open && compact) && (
          <button type="button" class={cls("launcher t-btn", open && "is-open")} aria-expanded={open} onClick={() => setOpen(!open)}
            aria-label={open ? "Close assistant" : config.launcher.label ?? config.agent.name}>
            {open ? <span class="avatar"><CloseIcon /></span> : <><Avatar config={config} /><span>{config.launcher.label ?? config.agent.name}</span></>}
          </button>
        )}
        {open && (
          <div class="panel" role="dialog" aria-label={config.agent.name}>
            <Header config={config} onClose={() => setOpen(false)} />
            <div class="body">{/* Task 6 */}<p style="padding:16px">{conv.messages.length} messages</p></div>
          </div>
        )}
      </div>
    </>
  );
}
