import { describe, expect, it } from "vitest";
import { initialState, markAdded, removeConstraint, replay, send } from "../src/engine/engine";
import { SCRIPTS } from "../src/engine";
import { CATALOGS } from "../src/catalogs";
import type { ConvState, Message } from "../src/types";

const lastOf = <K extends Message["kind"]>(s: ConvState, kind: K) =>
  [...s.messages].reverse().find((m) => m.kind === kind && m.role === "agent") as Extract<Message, { kind: K }> | undefined;
const active = (s: ConvState) => s.constraints.filter((c) => c.status === "active").map((c) => c.label);

describe("books journey — change of mind", () => {
  let s = initialState("books", "warm");

  it("understands the opening message", () => {
    s = send(s, SCRIPTS.books.opening);
    expect(active(s)).toEqual(["Mystery", "Gripping", "Not too gory", "Under 400 pages", "Not Rankin"]);
    expect(s.replies.map((r) => r.label)).toContain("Police procedural, like Rankin");
  });

  it("shows three procedurals", () => {
    s = send(s, "Police procedural, like Rankin");
    const products = lastOf(s, "products")!;
    expect(products.mode).toBe("match");
    expect(products.items.map((i) => i.productId)).toEqual(["b-harbour-lights", "b-quiet-ledger", "b-north-wind"]);
  });

  it("swaps crime for history and keeps everything else", () => {
    s = send(s, "Actually, he's gone off crime lately — he's been reading a lot of history");
    const change = lastOf(s, "constraint-change")!;
    expect(change.dropped).toEqual(["Mystery", "Not Rankin", "Police procedural"]);
    expect(change.added).toEqual(["History"]);
    expect(change.kept).toEqual(["Gripping", "Not too gory", "Under 400 pages"]);
    const ids = lastOf(s, "products")!.items.map((i) => i.productId);
    expect(ids).toEqual(["b-fire-and-salt", "b-cartographer", "b-last-signal"]);
    for (const id of ids) expect(CATALOGS.books.find((p) => p.id === id)!.attrs.genres).toContain("history");
    const dropped = s.constraints.filter((c) => c.status === "dropped");
    expect(dropped.every((c) => c.changedAt === s.turn)).toBe(true);
  });

  it("compares the first two shown", () => {
    s = send(s, "Compare the first two");
    expect(lastOf(s, "compare")!.productIds).toEqual(["b-fire-and-salt", "b-cartographer"]);
  });

  it("confirms an add to basket", () => {
    s = markAdded(s, "b-fire-and-salt");
    expect(lastOf(s, "added")!.productId).toBe("b-fire-and-salt");
  });
});

describe("fishing journey — nothing matches", () => {
  it("offers honest near misses, then matches when the budget stretches", () => {
    let s = initialState("fishing", "terse");
    s = send(s, SCRIPTS.fishing.opening);
    s = send(s, "Yes, 3–4 weight");
    const nm = lastOf(s, "products")!;
    expect(nm.mode).toBe("near-miss");
    expect(nm.items).toEqual([
      { productId: "f-stillwater-trail", flag: "€29 over budget", receipts: ["58 cm packed", "4 wt", "Beginner-friendly"] },
      { productId: "f-trailhead-kit", flag: "5 wt — heavier than ideal for small streams", receipts: ["55 cm packed", "Beginner-friendly"] },
      { productId: "f-brookline", flag: "Packs to 85 cm", receipts: ["4 wt", "Beginner-friendly"] },
    ]);
    s = send(s, "Stretch the budget to €200");
    expect(active(s)).toContain("Under €200");
    const m = lastOf(s, "products")!;
    expect(m.mode).toBe("match");
    expect(m.items.map((i) => i.productId)).toEqual(["f-stillwater-trail", "f-headwater"]);
  });

  it("removing a chip re-runs the matcher", () => {
    let s = replay("fishing", "neutral", 2);
    s = removeConstraint(s, "packable");
    expect(lastOf(s, "products")!.items.map((i) => i.productId)).toEqual(["f-brookline", "f-pocketwater"]);
  });

  it("hard constraints cannot be removed", () => {
    const s = replay("fishing", "neutral", 2);
    expect(removeConstraint(s, "flyRod")).toBe(s);
  });
});

describe("add to basket — books", () => {
  it("replay ends on the in-basket card with a chosen compare and card follow-up", () => {
    const s = replay("books", "warm", 5);
    const added = lastOf(s, "added")!;
    expect(added.productId).toBe("b-cartographer");
    expect(added.options).toEqual(["Paperback", "Gift wrapped"]);
    expect(added.count).toBe(1);
    const compare = lastOf(s, "compare")!;
    expect(compare.chosen).toBe("b-cartographer");
    expect(s.replies.map((r) => r.label)).toEqual(["Add a card", "No thanks", "Something for me too"]);

    const withCard = send(s, "Add a card");
    const products = lastOf(withCard, "products")!;
    expect(products.items.map((i) => i.productId)).toContain("b-card");
  });

  it("markAdded twice increments the count and only sets chosen on the latest matching compare", () => {
    let s = replay("books", "warm", 4); // stops right after "Compare the first two"
    s = markAdded(s, "b-fire-and-salt");
    s = markAdded(s, "b-cartographer");
    const added = lastOf(s, "added")!;
    expect(added.count).toBe(2);
    const compares = s.messages.filter((m) => m.role === "agent" && m.kind === "compare") as Extract<Message, { kind: "compare" }>[];
    expect(compares).toHaveLength(1);
    expect(compares[0]!.chosen).toBe("b-fire-and-salt");
  });
});

describe("add to basket — fishing", () => {
  it("replay ends on the in-basket card with a leader & tippet follow-up", () => {
    const s = replay("fishing", "terse", 5);
    const added = lastOf(s, "added")!;
    expect(added.productId).toBe("f-stillwater-trail");
    expect(added.options).toEqual([]);
    expect(s.replies.map((r) => r.label)).toContain("Add a leader & tippet pack");
  });
});

describe("voice and fallback", () => {
  it("uses different copy per voice", () => {
    const warm = send(initialState("fishing", "warm"), SCRIPTS.fishing.opening);
    const terse = send(initialState("fishing", "terse"), SCRIPTS.fishing.opening);
    expect(lastOf(warm, "text")!.text).not.toEqual(lastOf(terse, "text")!.text);
  });

  it("falls back gracefully and keeps the previous suggestions", () => {
    let s = send(initialState("books", "neutral"), SCRIPTS.books.opening);
    const before = s.replies;
    s = send(s, "what's the weather like");
    expect(s.step).toBe("understand");
    expect(s.replies).toEqual(before);
  });
});
