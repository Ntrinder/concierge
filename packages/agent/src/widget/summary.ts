import type { Constraint } from "../types";

/** Compact "Looking for" text: active constraints with a non-empty `short`
 * (or `label` lowercased when `short` is unset), ranked by `shortRank`, {value} filled. */
export function summarize(constraints: Constraint[], sep: string): string {
  return constraints
    .filter((c) => c.status === "active" && c.short !== "")
    .sort((a, b) => (a.shortRank ?? 9) - (b.shortRank ?? 9))
    .map(shortText)
    .join(sep);
}

export function shortText(c: Constraint): string {
  return (c.short ?? c.label.toLowerCase()).replace("{value}", String(c.value));
}
