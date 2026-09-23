import { useEffect, useRef } from "preact/hooks";
import type { Constraint } from "../types";
import { Chip } from "./ConstraintStrip";
import { CloseIcon } from "./icons";

export function StripSheet({ constraints, onRemove, onClose }: { constraints: Constraint[]; onRemove: (key: string) => void; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);

  const remove = (key: string) => { onRemove(key); onClose(); };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    onClose();
  };

  return (
    <>
      <div class="strip-sheet-scrim" aria-hidden="true" onClick={onClose} />
      <div class="strip-sheet" role="dialog" aria-label="What you're looking for" onKeyDown={onKeyDown}>
        <div class="strip-sheet-top">
          <h3 class="strip-sheet-heading">What you're looking for</h3>
          <button ref={closeRef} type="button" class="icon-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <div class="strip-sheet-chips" role="list">
          {constraints.map((c) => (
            <Chip key={c.key} c={c} dropped={c.status === "dropped"} isNew={false} onRemove={remove} />
          ))}
        </div>
        <p class="strip-sheet-hint">Tap × to drop one and I'll search again.</p>
      </div>
    </>
  );
}
