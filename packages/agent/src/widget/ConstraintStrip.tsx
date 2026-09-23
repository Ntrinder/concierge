import { useRef, useState } from "preact/hooks";
import type { CardStyle, Constraint } from "../types";
import { cls } from "./cls";
import { CloseIcon } from "./icons";
import { StripSheet } from "./StripSheet";
import { shortText, summarize } from "./summary";

export function Chip({ c, dropped, isNew, onRemove }: { c: Constraint; dropped: boolean; isNew: boolean; onRemove: (key: string) => void }) {
  return (
    <span role="listitem" class={cls("chip", dropped && "is-dropped", isNew && "is-new")}>
      {c.label}
      {!dropped && !c.hard && (
        <button type="button" aria-label={`Remove “${c.label}”`} onClick={() => onRemove(c.key)}><CloseIcon /></button>
      )}
    </span>
  );
}

export function ConstraintStrip({ constraints, turn, compact, stripLabel, cardStyle, onRemove }: {
  constraints: Constraint[]; turn: number; compact: boolean; stripLabel: string; cardStyle: CardStyle; onRemove: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const lineRef = useRef<HTMLButtonElement>(null);
  const shown = constraints.filter((c) => c.status === "active" || c.changedAt === turn);
  if (!shown.length) return null;

  if (compact) {
    const spec = cardStyle === "spec";
    const sep = spec ? " · " : ", ";
    const active = shown.filter((c) => c.status === "active");
    const dropped = shown.filter((c) => c.status === "dropped");
    const summary = summarize(active, sep);
    const close = () => { setOpen(false); lineRef.current?.focus(); };
    return (
      <>
        <button ref={lineRef} type="button" class={cls("strip-line", spec && "is-spec")} aria-haspopup="dialog" aria-expanded={open}
          aria-label={`Looking for: ${summary}. Edit`} onClick={() => setOpen(true)}>
          <span class="strip-line-label">{stripLabel}</span>
          <span class="strip-line-summary">
            {summary}
            {dropped.length > 0 && <s class="strip-line-dropped">{(summary ? sep : "") + dropped.map(shortText).join(sep)}</s>}
          </span>
          <span class="strip-line-edit">Edit</span>
        </button>
        {open && <StripSheet constraints={shown} onRemove={onRemove} onClose={close} />}
      </>
    );
  }

  return (
    <div class="strip" role="list" aria-label="What you're looking for">
      <span class="strip-label">Looking for</span>
      {shown.map((c) => (
        <Chip key={c.key} c={c} dropped={c.status === "dropped"} isNew={c.status === "active" && c.changedAt === turn} onRemove={onRemove} />
      ))}
    </div>
  );
}
