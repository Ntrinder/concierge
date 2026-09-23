"use client";
import { useCallback, useEffect, useState } from "react";
import type { AgentConfig } from "@concierge/agent/core";

let loading: Promise<void> | null = null;
function loadAgentScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (customElements.get("concierge-agent")) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/agent.js";
    s.async = true;
    s.onerror = () => {
      s.remove();
      loading = null; // don't cache a failure — the next preview mount retries
      reject(new Error("agent.js failed to load"));
    };
    document.head.appendChild(s);
    customElements.whenDefined("concierge-agent").then(() => resolve());
  });
  return loading;
}

type AgentEl = HTMLElement & { config?: AgentConfig };

export function AgentPreview({ config, autoplay = 2, open = true, highlight, className }: {
  config: AgentConfig; autoplay?: number; open?: boolean; highlight?: string | null; className?: string;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    loadAgentScript().then(() => live && setReady(true), () => live && setFailed(true));
    return () => { live = false; };
  }, []);

  // Callback ref (not useRef + effect): applies `.config` whenever the node
  // changes, or whenever `ready`/`config` change (which recreates this
  // callback's identity, so React re-invokes it on the current node). That
  // keeps the widget populated no matter how the host element remounts —
  // ConciergeAgent itself observes the `open` attribute and remounts its
  // internal App, so no React `key` is needed here to react to `open`.
  const setNode = useCallback((node: HTMLElement | null) => {
    if (ready && node) (node as AgentEl).config = config;
  }, [ready, config]);

  if (failed) {
    return (
      <div role="alert" className={className} style={{ display: "grid", placeItems: "end end", padding: 20, pointerEvents: "none" }}>
        <p style={{ margin: 0, padding: "10px 14px", borderRadius: 10, background: "#fff4e5", color: "#6b3a00", font: "14px/1.4 system-ui, sans-serif", boxShadow: "0 4px 16px rgb(0 0 0 / .12)" }}>
          Preview couldn&apos;t load — is agent.js built? Run <code>pnpm --filter @concierge/agent build</code>, then refresh.
        </p>
      </div>
    );
  }

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
