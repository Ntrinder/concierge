import { attrOf, closestPerConstraint, fill, match } from "../matcher";
import { receiptsFor, whyText } from "../receipts";
import type { AgentDraft, Constraint, ConvState, NearMiss, Product, Reply, StoreKey, VoiceCopy } from "../types";

export interface Ctx { state: ConvState; products: Product[]; text: string; v: (c: VoiceCopy) => string; script: Script }
export interface TurnOutput { messages: AgentDraft[]; replies: Reply[]; constraints?: Constraint[]; step?: string; lastShown?: string[] }
export interface Script {
  store: StoreKey;
  opening: string;
  demoInputs: (string | { add: string; giftWrap?: boolean })[];
  greetingReplies: Reply[];
  /** label on the collapsed constraint line at ≤480px, e.g. "For dad:" / "Spec" */
  stripLabel: string;
  route(text: string, state: ConvState): string;
  steps: Record<string, (ctx: Ctx) => TurnOutput>;
  afterAdd?(ctx: Ctx, product: Product): { messages: AgentDraft[]; replies: Reply[]; step?: string };
  /** Picks the "My pick" card from the closest near-misses; default is smallest severity (closest[0]) */
  pickNearMiss?(closest: NearMiss[]): NearMiss;
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
  const pick = ctx.script.pickNearMiss?.(closest) ?? closest[0]!;
  const bends = closest
    .filter((n) => n.product.id !== pick.product.id)
    .map((n) => ({
      productId: n.product.id,
      key: n.violation.constraint.key,
      text: n.violation.constraint.bend ? fill(n.violation.constraint.bend, n.violation.constraint, n.violation.actual) : n.violation.text,
    }));
  return {
    mode: "near-miss" as const,
    lastShown: [pick.product.id, ...bends.map((b) => b.productId)],
    messages: [
      { kind: "text", text: ctx.v(copy.none) },
      { kind: "near-miss", pick: { productId: pick.product.id, cells: cellsFor(pick, constraints), why: whyText(pick.product, constraints) }, bends },
    ] as AgentDraft[],
  };
}

/** Spec-grid cells for the "My pick" card: active constraints with a `cell`, ranked, capped
 * at 3 while always keeping the failing one; the pick's violation gets a plain fallback cell
 * when its constraint has none. */
function cellsFor(pick: NearMiss, constraints: Constraint[]) {
  const active = constraints.filter((x) => x.status === "active" && x.cell).sort((a, b) => a.cell!.rank - b.cell!.rank);
  const cells = active.map((x) => {
    const fail = x.key === pick.violation.constraint.key;
    const template = fail ? x.cell!.fail : x.cell!.pass;
    return { label: x.cell!.label, value: fill(template, x, attrOf(pick.product, x.attr)), fail };
  });
  if (!pick.violation.constraint.cell) cells.push({ label: pick.violation.constraint.label, value: pick.violation.text, fail: true });
  if (cells.length <= 3) return cells;
  const failIdx = cells.findIndex((x) => x.fail);
  return failIdx < 3 ? cells.slice(0, 3) : [...cells.slice(0, 2), cells[failIdx]!];
}

export const c = (x: Omit<Constraint, "status">): Constraint => ({ status: "active", ...x });
export const activeOnly = (cs: Constraint[]) => cs.filter((x) => x.status === "active");
export const drop = (cs: Constraint[], pred: (x: Constraint) => boolean) =>
  cs.map((x) => (x.status === "active" && pred(x) ? { ...x, status: "dropped" as const } : x));
/** Replace a constraint by key (removing any previous one with that key) */
export const upsert = (cs: Constraint[], next: Constraint) => [...cs.filter((x) => x.key !== next.key), next];
