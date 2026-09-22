"use client";
import { useCallback, useEffect, useState } from "react";
import type { AgentConfig } from "@concierge/agent/core";

let loading: Promise<void> | null = null;
function loadAgentScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  loading ??= new Promise<void>((resolve) => {
    if (!customElements.get("concierge-agent")) {
      const s = document.createElement("script");
      s.src = "/agent.js";
      s.async = true;
      document.head.appendChild(s);
    }
    customElements.whenDefined("concierge-agent").then(() => resolve());
  });
  return loading;
}

type AgentEl = HTMLElement & { config?: AgentConfig };

export function AgentPreview({ config, autoplay = 2, open = true, highlight, className }: {
  config: AgentConfig; autoplay?: number; open?: boolean; highlight?: string | null; className?: string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => { loadAgentScript().then(() => setReady(true)); }, []);

  // Callback ref (not useRef + effect): applies `.config` whenever the node
  // changes, or whenever `ready`/`config` change (which recreates this
  // callback's identity, so React re-invokes it on the current node). That
  // keeps the widget populated no matter how the host element remounts —
  // ConciergeAgent itself observes the `open` attribute and remounts its
  // internal App, so no React `key` is needed here to react to `open`.
  const setNode = useCallback((node: HTMLElement | null) => {
    if (ready && node) (node as AgentEl).config = config;
  }, [ready, config]);

  return (
    <concierge-agent
      ref={setNode}
      mode="inline"
      autoplay={String(autoplay)}
      {...(open ? { open: "" } : {})}
      {...(highlight ? { highlight } : {})}
      className={className}
    />
  );
}
