import { closestPerConstraint, match } from "../matcher";
import { receiptsFor } from "../receipts";
import type { AgentDraft, Constraint, ConvState, Product, Reply, StoreKey, VoiceCopy } from "../types";

export interface Ctx { state: ConvState; products: Product[]; text: string; v: (c: VoiceCopy) => string }
export interface TurnOutput { messages: AgentDraft[]; replies: Reply[]; constraints?: Constraint[]; step?: string; lastShown?: string[] }
export interface Script {
  store: StoreKey;
  opening: string;
  demoInputs: string[];
  greetingReplies: Reply[];
  route(text: string, state: ConvState): string;
  steps: Record<string, (ctx: Ctx) => TurnOutput>;
}

const EMPTY: VoiceCopy = {
  warm: "I've looked everywhere and nothing comes close with all of those together. Try removing one of the chips above and I'll look again.",
  neutral: "Nothing comes close with all of those. Remove a chip above to widen the search.",
  terse: "No results. Remove a filter above.",
};

export function present(ctx: Ctx, constraints: Constraint[], copy: { match: VoiceCopy; none: VoiceCopy }, limit = 3) {
  const { matches, nearMisses } = match(ctx.products, constraints);
  if (matches.length) {
    const shown = matches.slice(0, limit);
    return {
      mode: "match" as const,
      lastShown: shown.map((p) => p.id),
      messages: [
        { kind: "text", text: ctx.v(copy.match) },
        { kind: "products", mode: "match", items: shown.map((p) => ({ productId: p.id, receipts: receiptsFor(p, constraints) })) },
      ] as AgentDraft[],
    };
  }
  const closest = closestPerConstraint(nearMisses).slice(0, limit);
  if (!closest.length) {
    return { mode: "empty" as const, lastShown: [], messages: [{ kind: "text", text: ctx.v(EMPTY) }] as AgentDraft[] };
  }
  return {
    mode: "near-miss" as const,
    lastShown: closest.map((n) => n.product.id),
    messages: [
      { kind: "text", text: ctx.v(copy.none) },
      { kind: "products", mode: "near-miss", items: closest.map((n) => ({ productId: n.product.id, flag: n.violation.text, receipts: receiptsFor(n.product, constraints) })) },
    ] as AgentDraft[],
  };
}

export const c = (x: Omit<Constraint, "status">): Constraint => ({ status: "active", ...x });
export const activeOnly = (cs: Constraint[]) => cs.filter((x) => x.status === "active");
export const drop = (cs: Constraint[], pred: (x: Constraint) => boolean) =>
  cs.map((x) => (x.status === "active" && pred(x) ? { ...x, status: "dropped" as const } : x));
/** Replace a constraint by key (removing any previous one with that key) */
export const upsert = (cs: Constraint[], next: Constraint) => [...cs.filter((x) => x.key !== next.key), next];
