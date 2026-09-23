import { describe, expect, it } from "vitest";
import { CATALOGS, getProduct } from "../src/catalogs";
import { replay } from "../src/engine/engine";
import { receiptsFor, whyText } from "../src/receipts";
import type { Message } from "../src/types";

const lastProducts = (s: ReturnType<typeof replay>) =>
  [...s.messages].reverse().find((m): m is Extract<Message, { kind: "products" }> => m.role === "agent" && m.kind === "products")!;

describe("receiptsFor", () => {
  it("books after change of mind: Fire & Salt and The Cartographer's War", () => {
    const s = replay("books", "warm", 3);
    const items = lastProducts(s).items;
    expect(items.find((i) => i.productId === "b-fire-and-salt")?.receipts).toEqual(["392 pages", "Not gory", "History"]);
    expect(items.find((i) => i.productId === "b-cartographer")?.receipts).toEqual(["336 pages", "Not gory", "History"]);
    const p = getProduct("books", "b-fire-and-salt")!;
    expect(receiptsFor(p, s.constraints)).toEqual(["392 pages", "Not gory", "History"]);
  });

  it("books after refine 'Police procedural': The Harbour Lights", () => {
    const s = replay("books", "warm", 2);
    const items = lastProducts(s).items;
    expect(items.find((i) => i.productId === "b-harbour-lights")?.receipts).toEqual(["352 pages", "Not gory", "Police procedural"]);
  });

  it("fishing after budget stretch: Stillwater Trail", () => {
    const s = replay("fishing", "terse", 3);
    const items = lastProducts(s).items;
    expect(items.find((i) => i.productId === "f-stillwater-trail")?.receipts).toEqual(["58 cm packed", "4 wt", "Beginner-friendly"]);
  });

  it("caps at 3 pills", () => {
    const s = replay("books", "warm", 2);
    for (const item of lastProducts(s).items) expect(item.receipts!.length).toBeLessThanOrEqual(3);
  });

  it("gives no pill for a constraint the product doesn't satisfy", () => {
    const cutDeep = CATALOGS.books.find((p) => p.id === "b-cut-deep")!;
    const s = replay("books", "warm", 1);
    const receipts = receiptsFor(cutDeep, s.constraints);
    expect(receipts).not.toContain("Not gory");
  });
});

describe("whyText", () => {
  it("uses the constraint-matched sentence when that constraint is active", () => {
    const cartographer = getProduct("books", "b-cartographer")!;
    const s = replay("books", "warm", 3);
    expect(whyText(cartographer, s.constraints)).toBe(cartographer.whyFor!.history);
  });

  it("falls back to product.why when no key matches", () => {
    const cartographer = getProduct("books", "b-cartographer")!;
    expect(whyText(cartographer, [])).toBe(cartographer.why);
  });
});
