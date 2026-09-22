import { useState } from "preact/hooks";
import type { Reply } from "../types";
import { SendIcon } from "./icons";

export function Composer({ replies, busy, placeholder, onSend }: { replies: Reply[]; busy: boolean; placeholder: string; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const submit = (e: Event) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    onSend(t);
    setText("");
  };
  return (
    <div class="composer-wrap">
      {!busy && replies.length > 0 && (
        <div class="replies" role="group" aria-label="Suggested replies">
          {replies.map((r) => (
            <button type="button" key={r.text} class="reply t-link" title={r.text} onClick={() => onSend(r.text)}>{r.label}</button>
          ))}
        </div>
      )}
      <form class="composer" onSubmit={submit}>
        <input value={text} onInput={(e) => setText(e.currentTarget.value)} placeholder={placeholder} aria-label="Message" enterKeyHint="send" autoComplete="off" />
        <button class="send t-btn" type="submit" aria-label="Send" disabled={busy || !text.trim()}><SendIcon /></button>
      </form>
    </div>
  );
}
