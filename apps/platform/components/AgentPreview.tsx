"use client";
import { useEffect, useRef, useState } from "react";
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
  const ref = useRef<AgentEl>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { loadAgentScript().then(() => setReady(true)); }, []);
  useEffect(() => { if (ready && ref.current) ref.current.config = config; }, [ready, config]);

  return (
    <concierge-agent
      key={open ? "open" : "closed"}
      ref={ref}
      mode="inline"
      autoplay={String(autoplay)}
      {...(open ? { open: "" } : {})}
      {...(highlight ? { highlight } : {})}
      className={className}
    />
  );
}
