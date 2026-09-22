import { useEffect, useRef } from "preact/hooks";
import type { AgentConfig, Message } from "../types";
import { Avatar } from "./Header";
import { Compare } from "./Compare";
import { AddedNote, NotifyForm } from "./NotifyForm";
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
  onNotify: (messageId: string, email: string) => void;
}

function Words({ text, animate }: { text: string; animate: boolean }) {
  if (!animate) return <>{text}</>;
  return <>{text.split(/(\s+)/).map((w, i) => (/\s+/.test(w) ? w : <span key={i} class="word" style={{ animationDelay: `${i * 14}ms` }}>{w}</span>))}</>;
}

export function MessageList({ config, messages, visible, typing, compact, animateFrom, onOpen, onChoose, onNotify }: Props) {
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
            return <div key={m.id} class="msg msg-rich"><ProductList config={config} items={m.items} mode={m.mode} onOpen={onOpen} /></div>;
          case "constraint-change":
            return (
              <div key={m.id} class="msg msg-rich change" role="group" aria-label="What changed">
                {m.dropped.length > 0 && <div class="change-row"><span class="change-label">Dropped</span>{m.dropped.map((l) => <span class="tag tag-dropped">{l}</span>)}</div>}
                {m.added.length > 0 && <div class="change-row"><span class="change-label">Added</span>{m.added.map((l) => <span class="tag tag-added">{l}</span>)}</div>}
                {m.kept.length > 0 && <div class="change-row"><span class="change-label">Kept</span>{m.kept.map((l) => <span class="tag">{l}</span>)}</div>}
              </div>
            );
          case "compare":
            return <div key={m.id} class="msg msg-rich"><Compare config={config} productIds={m.productIds} compact={compact} onChoose={onChoose} /></div>;
          case "notify-form":
            return <div key={m.id} class="msg msg-rich"><NotifyForm done={m.done} onSubmit={(email) => onNotify(m.id, email)} /></div>;
          case "added":
            return <div key={m.id} class="msg msg-rich"><AddedNote config={config} productId={m.productId} /></div>;
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
