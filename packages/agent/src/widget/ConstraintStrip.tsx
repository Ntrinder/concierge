import type { Constraint } from "../types";
import { cls } from "./cls";
import { CloseIcon } from "./icons";

export function ConstraintStrip({ constraints, turn, onRemove }: { constraints: Constraint[]; turn: number; onRemove: (key: string) => void }) {
  const shown = constraints.filter((c) => c.status === "active" || c.changedAt === turn);
  if (!shown.length) return null;
  return (
    <div class="strip" role="list" aria-label="What you're looking for">
      <span class="strip-label">Looking for</span>
      {shown.map((c) => {
        const dropped = c.status === "dropped";
        return (
          <span role="listitem" key={c.key} class={cls("chip", dropped && "is-dropped", !dropped && c.changedAt === turn && "is-new")}>
            {c.label}
            {!dropped && !c.hard && (
              <button type="button" aria-label={`Remove “${c.label}”`} onClick={() => onRemove(c.key)}><CloseIcon /></button>
            )}
          </span>
        );
      })}
    </div>
  );
}
