import { describe, expect, it } from "vitest";
import { bendConstraint, initialState, markAdded, removeConstraint, replay, send } from "../src/engine/engine";
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
    const nm = lastOf(s, "near-miss")!;
    expect(nm.pick.productId).toBe("f-trailhead-kit");
    expect(nm.pick.cells).toEqual([
      { label: "Packed", value: "55 cm ✓", fail: false },
      { label: "Line", value: "5 wt ≠ 3–4", fail: true },
      { label: "Price", value: "€5 under", fail: false },
    ]);
    expect(nm.pick.why).toBe("Everything's in the box, so you're fishing on day one. A 5 weight is a little heavy for tiny streams but forgiving to learn on.");
    expect(nm.bends).toEqual([
      { productId: "f-stillwater-trail", key: "budget", text: "+€29 budget · otherwise perfect" },
      { productId: "f-brookline", key: "packable", text: "packs to 85 cm · won't fit a daypack" },
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

describe("bending a rule on the near-miss pick", () => {
  it("bending budget relabels the constraint and matches the bent-to product", () => {
    let s = replay("fishing", "terse", 2);
    s = bendConstraint(s, "budget", "f-stillwater-trail");
    const budget = s.constraints.find((c) => c.key === "budget")!;
    expect(budget.value).toBe(179);
    expect(budget.label).toBe("Under €179");
    const products = lastOf(s, "products")!;
    expect(products.mode).toBe("match");
    expect(products.items.map((i) => i.productId)).toContain("f-stillwater-trail");
    expect(lastOf(s, "near-miss")!.used).toBe(true);
  });

  it("bending packable matches the bent-to product", () => {
    let s = replay("fishing", "terse", 2);
    s = bendConstraint(s, "packable", "f-brookline");
    const products = lastOf(s, "products")!;
    expect(products.items.map((i) => i.productId)).toContain("f-brookline");
  });
});

describe("near-miss pick — default without a script hook", () => {
  it("picks the sole/closest near miss when the script defines no pickNearMiss", () => {
    let s = send(initialState("books", "warm"), SCRIPTS.books.opening);
    s = send(s, "Cosy");
    const nm = lastOf(s, "near-miss")!;
    expect(nm.pick.productId).toBe("b-pennyfold");
    expect(nm.pick.cells).toEqual([
      { label: "Pages", value: "288 ✓", fail: false },
      { label: "Gripping", value: "More slow-burn than gripping", fail: true },
    ]);
    expect(nm.bends).toEqual([]);
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
