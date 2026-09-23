import { useEffect, useRef } from "preact/hooks";
import type { AgentConfig, Message } from "../types";
import { Avatar } from "./Header";
import { Compare } from "./Compare";
import { InBasket } from "./InBasket";
import { NearMissPick } from "./NearMissPick";
import { NotifyForm } from "./NotifyForm";
import { ProductList } from "./ProductCard";

interface Props {
  config: AgentConfig;
  messages: Message[];
  visible: number;
  typing: boolean;
  compact: boolean;
  animateFrom: number;
  onOpen: (id: string) => void;
  onChoose: (id: string) => void;
  onAdd: (id: string) => void;
  onBend: (key: string, productId: string) => void;
  onNotify: (messageId: string, email: string) => void;
}

function Words({ text, animate }: { text: string; animate: boolean }) {
  if (!animate) return <>{text}</>;
  return <>{text.split(/(\s+)/).map((w, i) => (/\s+/.test(w) ? w : <span key={i} class="word" style={{ animationDelay: `${i * 14}ms` }}>{w}</span>))}</>;
}

export function MessageList({ config, messages, visible, typing, compact, animateFrom, onOpen, onChoose, onAdd, onBend, onNotify }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [visible, typing]);

  const shown = messages.slice(0, visible);
  return (
    <div class="messages" ref={ref} aria-live="polite">
      <div class="msg msg-agent">
        <Avatar config={config} small />
        <p>{config.agent.greeting}</p>
      </div>
      {shown.map((m, i) => {
        const animate = i >= animateFrom;
        if (m.role === "user") return <div key={m.id} class="msg msg-user">{m.text}</div>;
        switch (m.kind) {
          case "text":
            return (
              <div key={m.id} class="msg msg-agent">
                <Avatar config={config} small />
                <p><Words text={m.text} animate={animate} /></p>
              </div>
            );
          case "products":
            return <div key={m.id} class="msg msg-rich"><ProductList config={config} items={m.items} mode={m.mode} onOpen={onOpen} onAdd={onAdd} /></div>;
          case "constraint-change":
            return (
              <div key={m.id} class="msg msg-rich change" role="group" aria-label="What changed">
                {m.dropped.length > 0 && <div class="change-row"><span class="change-label">Dropped</span>{m.dropped.map((l) => <span class="tag tag-dropped">{l}</span>)}</div>}
                {m.added.length > 0 && <div class="change-row"><span class="change-label">Added</span>{m.added.map((l) => <span class="tag tag-added">{l}</span>)}</div>}
                {m.kept.length > 0 && <div class="change-row"><span class="change-label">Kept</span>{m.kept.map((l) => <span class="tag">{l}</span>)}</div>}
              </div>
            );
          case "compare":
            return <div key={m.id} class="msg msg-rich"><Compare config={config} productIds={m.productIds} chosen={m.chosen} compact={compact} onChoose={onChoose} /></div>;
          case "notify-form":
            return <div key={m.id} class="msg msg-rich"><NotifyForm done={m.done} onSubmit={(email) => onNotify(m.id, email)} /></div>;
          case "added":
            return <div key={m.id} class="msg msg-rich"><InBasket config={config} productId={m.productId} options={m.options} count={m.count} /></div>;
          case "near-miss":
            return <div key={m.id} class="msg msg-rich"><NearMissPick config={config} pick={m.pick} bends={m.bends} used={m.used} onAdd={onAdd} onBend={onBend} /></div>;
        }
      })}
      {typing && (
        <div class="msg msg-agent" aria-label="Typing">
          <Avatar config={config} small />
          <span class="typing"><span /><span /><span /></span>
        </div>
      )}
    </div>
  );
}
