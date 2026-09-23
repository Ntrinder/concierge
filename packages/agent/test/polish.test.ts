import { describe, expect, it } from "vitest";
import { deriveTokens } from "../src/tokens";
import { DEMO_CONFIGS } from "../src/presets";
import { initialState, send } from "../src/engine/engine";
import { SCRIPTS } from "../src/engine";
import { CATALOGS, getProduct } from "../src/catalogs";
import { formatPrice } from "../src/widget/ProductCard";
import { normalize } from "../src/widget/normalize";
import type { Message } from "../src/types";

const products = (s: ReturnType<typeof send>) =>
  [...s.messages].reverse().find((m) => m.role === "agent" && m.kind === "products") as Extract<Message, { kind: "products" }> | undefined;

describe("heading + top-offset tokens", () => {
  it("default to none/normal/0px", () => {
    const { vars } = deriveTokens(DEMO_CONFIGS.marginalia);
    expect(vars["--heading-case"]).toBe("none");
    expect(vars["--heading-tracking"]).toBe("normal");
    expect(vars["--top-offset"]).toBe("0px");
  });

  it("Riffle gets uppercase, 0.06em tracking and a 72px top offset", () => {
    const { vars } = deriveTokens(DEMO_CONFIGS.riffle);
    expect(vars["--heading-case"]).toBe("uppercase");
    expect(vars["--heading-tracking"]).toBe("0.06em");
    expect(vars["--top-offset"]).toBe("72px");
  });

  it("clamps tracking to [0, 0.2]", () => {
    const over = deriveTokens({ ...DEMO_CONFIGS.riffle, heading: { tracking: 5 } }).vars;
    expect(over["--heading-tracking"]).toBe("0.2em");
    const under = deriveTokens({ ...DEMO_CONFIGS.riffle, heading: { tracking: -5 } }).vars;
    expect(under["--heading-tracking"]).toBe("0em");
  });
});

describe("starter prompts", () => {
  const addonIds = new Set(
    [...CATALOGS.books, ...CATALOGS.fishing].filter((p) => p.attrs.addon === true).map((p) => p.id),
  );

  it("books: opening routes to understand", () => {
    const s = send(initialState("books", "warm"), SCRIPTS.books.greetingReplies[0]!.text);
    expect(s.step).toBe("understand");
  });

  it("books: history buff routes to historyGift with a match, never an add-on", () => {
    const s = send(initialState("books", "warm"), SCRIPTS.books.greetingReplies[1]!.text);
    expect(s.step).toBe("historyGift");
    const p = products(s)!;
    expect(p.items.length).toBeGreaterThanOrEqual(1);
    for (const i of p.items) expect(addonIds.has(i.productId)).toBe(false);
  });

  it("books: short for a train routes to shortRead with a match, never an add-on", () => {
    const s = send(initialState("books", "warm"), SCRIPTS.books.greetingReplies[2]!.text);
    expect(s.step).toBe("shortRead");
    const p = products(s)!;
    expect(p.items.length).toBeGreaterThanOrEqual(1);
    for (const i of p.items) expect(addonIds.has(i.productId)).toBe(false);
  });

  it("books: understand sets stripLabel 'For dad:'", () => {
    const s = send(initialState("books", "warm"), SCRIPTS.books.opening);
    expect(s.stripLabel).toBe("For dad:");
  });

  it("fishing: opening routes to understand", () => {
    const s = send(initialState("fishing", "terse"), SCRIPTS.fishing.greetingReplies[0]!.text);
    expect(s.step).toBe("understand");
  });

  it("fishing: packable rod routes to packStart with a match, never an add-on", () => {
    const s = send(initialState("fishing", "terse"), SCRIPTS.fishing.greetingReplies[1]!.text);
    expect(s.step).toBe("packStart");
    const p = products(s)!;
    expect(p.items.length).toBeGreaterThanOrEqual(1);
    for (const i of p.items) expect(addonIds.has(i.productId)).toBe(false);
  });

  it("fishing: complete kit routes to kitStart with a match, never an add-on", () => {
    const s = send(initialState("fishing", "terse"), SCRIPTS.fishing.greetingReplies[2]!.text);
    expect(s.step).toBe("kitStart");
    const p = products(s)!;
    expect(p.items.length).toBeGreaterThanOrEqual(1);
    for (const i of p.items) expect(addonIds.has(i.productId)).toBe(false);
  });
});

describe("formatPrice", () => {
  it("always shows two decimals", () => {
    expect(formatPrice(20)).toBe("€20.00");
    expect(formatPrice(16.99)).toBe("€16.99");
  });
});

describe("config normalize — subtitle, heading, topOffset", () => {
  const base = {
    brand: "#7a2e2e", store: "books", agent: { name: "Test", greeting: "Hi" },
  };

  it("keeps a valid subtitle, heading and topOffset", () => {
    const c = normalize({ ...base, agent: { ...base.agent, subtitle: "Ask away" }, heading: { case: "uppercase", tracking: 0.1 }, topOffset: 50 })!;
    expect(c.agent.subtitle).toBe("Ask away");
    expect(c.heading).toEqual({ case: "uppercase", tracking: 0.1 });
    expect(c.topOffset).toBe(50);
  });

  it("clamps an out-of-range tracking and topOffset instead of rejecting", () => {
    const c = normalize({ ...base, heading: { tracking: 10 }, topOffset: 9000 })!;
    expect(c.heading?.tracking).toBe(0.2);
    expect(c.topOffset).toBe(200);
  });

  it("drops a non-string subtitle and malformed heading case", () => {
    const c = normalize({ ...base, agent: { ...base.agent, subtitle: 42 }, heading: { case: "diagonal" } })!;
    expect(c.agent.subtitle).toBeUndefined();
    expect(c.heading?.case).toBeUndefined();
  });

  it("keeps a known launcher style and drops an unknown one", () => {
    expect(normalize({ ...base, launcher: { position: "bottom-left", style: "icon" } })!.launcher).toEqual({ position: "bottom-left", style: "icon" });
    expect(normalize({ ...base, launcher: { position: "bottom-right", style: "blob" } })!.launcher).toEqual({ position: "bottom-right" });
    expect(normalize(base)!.launcher).toEqual({ position: "bottom-right" });
  });

  it("still rejects a config missing the essentials", () => {
    expect(normalize({ agent: { name: "Test" } })).toBeNull();
  });
});
