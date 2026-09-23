import { useEffect, useRef, useState } from "preact/hooks";
import { getProduct } from "../catalogs";
import { markAdded, removeConstraint, replay, send, submitNotify } from "../engine/engine";
import { varsToCss } from "../tokens";
import type { AgentConfig } from "../types";
import styles from "./styles.css?inline";
import { cls } from "./cls";
import { Composer } from "./Composer";
import { ConstraintStrip } from "./ConstraintStrip";
import { DetailSheet } from "./DetailSheet";
import { Avatar, Header } from "./Header";
import { CloseIcon } from "./icons";
import { MessageList } from "./MessageList";
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

const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function App({ config, vars, inline, defaultOpen, autoplay, host, highlight }: AppProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [conv, setConv] = useState(() => replay(config.store, config.voice, autoplay));
  const [initialCount] = useState(conv.messages.length);
  const [visible, setVisible] = useState(conv.messages.length);
  const [detail, setDetail] = useState<string | null>(null);
  const [strip, setStrip] = useState(() => ({ constraints: conv.constraints, turn: conv.turn }));
  const compact = useCompact(host, inline);
  const typing = visible < conv.messages.length && conv.messages[visible]?.role === "agent";

  // Reveal queued messages one by one
  useEffect(() => {
    if (visible >= conv.messages.length) return;
    const next = conv.messages[visible]!;
    if (next.role === "user" || reducedMotion()) { setVisible(visible + 1); return; }
    const delay = next.kind === "text" ? 450 + Math.min(850, next.text.length * 8) : 500;
    const t = setTimeout(() => setVisible((v) => v + 1), delay);
    return () => clearTimeout(t);
  }, [visible, conv.messages.length]);

  // Only update the constraint strip once the reveal queue has caught up, so
  // dropped/new chips appear after the agent's lines, not before them.
  useEffect(() => {
    if (visible < conv.messages.length) return;
    setStrip((s) => (s.constraints === conv.constraints && s.turn === conv.turn ? s : { constraints: conv.constraints, turn: conv.turn }));
  }, [visible, conv]);

  // Lock host page scroll while the full-screen sheet is open on a phone
  useEffect(() => {
    if (inline || !(open && compact)) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prev; };
  }, [open, compact, inline]);

  // Closing returns focus to the launcher (keyboard users land where they started)
  const launcherRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  const close = () => { refocus.current = true; setOpen(false); };
  useEffect(() => {
    if (open || !refocus.current) return;
    refocus.current = false;
    launcherRef.current?.focus();
  }, [open]);

  // Escape closes the detail sheet first, then the panel (page mode only — an
  // inline preview shouldn't react to keys pressed elsewhere on the host page)
  useEffect(() => {
    if (inline || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (detail) { setDetail(null); return; }
      close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inline, open, detail]);

  const say = (text: string) => setConv((s) => send(s, text));
  const busy = visible < conv.messages.length;
  const placeholder = conv.messages.length === 0 ? "Tell me what you're looking for…" : "Reply or ask something else…";

  const addToBasket = (product: ReturnType<typeof getProduct>, { giftWrap }: { giftWrap: boolean }) => {
    if (!product) return;
    window.dispatchEvent(new CustomEvent("concierge:add-to-cart", {
      detail: { productId: product.id, name: product.name, price: product.price, qty: 1, options: { giftWrap } },
    }));
    setDetail(null);
    setConv((s) => markAdded(s, product.id, { giftWrap }));
  };

  return (
    <>
      <style>{styles}</style>
      <style>{varsToCss(vars)}</style>
      <div class={cls("root", inline ? "inline" : "page", compact && "compact", config.launcher.position === "bottom-left" && "left", highlight && `hl-${highlight}`)}>
        {!(open && compact) && (
          <button ref={launcherRef} type="button" class={cls("launcher t-btn", open && "is-open")} aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}
            aria-label={open ? "Close assistant" : config.launcher.label ?? config.agent.name}>
            {open ? <span class="avatar"><CloseIcon /></span> : <><Avatar config={config} /><span>{config.launcher.label ?? config.agent.name}</span></>}
          </button>
        )}
        {open && (
          <div class="panel" role="dialog" aria-label={config.agent.name}>
            <Header config={config} onClose={close} />
            <div class="body">
              <ConstraintStrip constraints={strip.constraints} turn={strip.turn} onRemove={(key) => setConv((s) => removeConstraint(s, key))} />
              <MessageList
                config={config}
                messages={conv.messages}
                visible={visible}
                typing={typing}
                compact={compact}
                animateFrom={initialCount}
                onOpen={setDetail}
                onChoose={setDetail}
                onAdd={(id) => addToBasket(getProduct(config.store, id), { giftWrap: false })}
                onNotify={(id, email) => setConv((s) => submitNotify(s, id, email))}
              />
              <Composer replies={conv.replies} busy={busy} placeholder={placeholder} onSend={say} />
              {detail && (() => {
                const product = getProduct(config.store, detail);
                if (!product) return null;
                return (
                  <DetailSheet
                    config={config}
                    product={product}
                    constraints={conv.constraints}
                    onBack={() => setDetail(null)}
                    onAdd={(opts) => addToBasket(product, opts)}
                  />
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
