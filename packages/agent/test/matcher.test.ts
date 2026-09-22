import { describe, expect, it } from "vitest";
import { CATALOGS } from "../src/catalogs";
import { closestPerConstraint, match } from "../src/matcher";
import type { Constraint } from "../src/types";

const c = (x: Omit<Constraint, "status">): Constraint => ({ status: "active", ...x });

describe("match — fishing: nothing matches", () => {
  const constraints = [
    c({ key: "flyRod", label: "Fly rod", attr: "flyRod", op: "eq", value: true, hard: true }),
    c({ key: "beginner", label: "Beginner-friendly", attr: "beginner", op: "eq", value: true, miss: "Built for experienced casters" }),
    c({ key: "packable", label: "Packs ≤ 60 cm", attr: "packedCm", op: "max", value: 60, miss: "Packs to {actual} cm" }),
    c({ key: "budget", label: "Under €150", attr: "price", op: "max", value: 150, miss: "€{over} over budget" }),
    c({ key: "weight", label: "3–4 wt", attr: "lineWeight", op: "max", value: 4, miss: "{actual} wt — heavier than ideal for small streams" }),
  ];

  it("finds no exact match", () => {
    expect(match(CATALOGS.fishing, constraints).matches).toEqual([]);
  });

  it("returns the closest near miss per broken constraint with readable deltas", () => {
    const closest = closestPerConstraint(match(CATALOGS.fishing, constraints).nearMisses);
    expect(closest.map((n) => [n.product.id, n.violation.text])).toEqual([
      ["f-stillwater-trail", "€29 over budget"],
      ["f-trailhead-kit", "5 wt — heavier than ideal for small streams"],
      ["f-brookline", "Packs to 85 cm"],
    ]);
  });

  it("never offers a near miss that breaks a hard constraint", () => {
    const { nearMisses } = match(CATALOGS.fishing, constraints);
    expect(nearMisses.some((n) => n.product.id === "f-clearwater-reel")).toBe(false);
  });

  it("ignores dropped constraints", () => {
    const relaxed = constraints.map((x) => (x.key === "packable" ? { ...x, status: "dropped" as const } : x));
    expect(match(CATALOGS.fishing, relaxed).matches.map((p) => p.id)).toEqual(["f-brookline", "f-pocketwater"]);
  });
});

describe("match — books", () => {
  it("finds three police procedurals that fit", () => {
    const constraints = [
      c({ key: "mystery", label: "Mystery", attr: "genres", op: "includes", value: "mystery", hard: true }),
      c({ key: "procedural", label: "Police procedural", attr: "genres", op: "includes", value: "police-procedural", hard: true }),
      c({ key: "gripping", label: "Gripping", attr: "tags", op: "includes", value: "gripping" }),
      c({ key: "gore", label: "Not too gory", attr: "gore", op: "max", value: 1 }),
      c({ key: "pages", label: "Under 400 pages", attr: "pages", op: "max", value: 400 }),
    ];
    expect(match(CATALOGS.books, constraints).matches.map((p) => p.id)).toEqual([
      "b-harbour-lights", "b-quiet-ledger", "b-north-wind",
    ]);
  });
});
