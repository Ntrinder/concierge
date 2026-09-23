import { describe, expect, it } from "vitest";
import { bendConstraint, replay } from "../src/engine/engine";
import { summarize } from "../src/widget/summary";

describe("summarize", () => {
  it("books after change of mind", () => {
    const s = replay("books", "warm", 3);
    expect(summarize(s.constraints, ", ")).toBe("history, gripping, not gory, under 400 pp");
  });

  it("fishing after weight", () => {
    const s = replay("fishing", "terse", 2);
    expect(summarize(s.constraints, " · ")).toBe("3–4 wt · ≤60 cm · ≤€150 · beginner");
  });

  it("excludes dropped constraints", () => {
    const s = replay("books", "warm", 3);
    const dropped = s.constraints.filter((c) => c.status === "dropped");
    expect(dropped.length).toBeGreaterThan(0);
    const summary = summarize(s.constraints, ", ");
    for (const d of dropped) if (d.short) expect(summary).not.toContain(d.short);
  });

  it("omits flyRod (empty short)", () => {
    const s = replay("fishing", "terse", 1);
    expect(s.constraints.find((c) => c.key === "flyRod")?.short).toBe("");
    expect(summarize(s.constraints, " · ")).not.toMatch(/fly ?rod/i);
  });

  it("bending budget shows ≤€179", () => {
    let s = replay("fishing", "terse", 2);
    s = bendConstraint(s, "budget", "f-stillwater-trail");
    expect(summarize(s.constraints, " · ")).toContain("≤€179");
  });

  it("bending weight shows ≤5 wt", () => {
    let s = replay("fishing", "terse", 2);
    s = bendConstraint(s, "weight", "f-trailhead-kit");
    expect(summarize(s.constraints, " · ")).toContain("≤5 wt");
  });
});
