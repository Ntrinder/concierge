import { attrOf, violationOf } from "./matcher";
import type { Constraint, Product } from "./types";

export function receiptsFor(product: Product, constraints: Constraint[], max = 3): string[] {
  return constraints
    .filter((c) => c.status === "active" && c.receipt && violationOf(product, c) === null)
    .sort((a, b) => (a.receiptRank ?? 9) - (b.receiptRank ?? 9))
    .slice(0, max)
    .map((c) => c.receipt!.replace("{actual}", String(attrOf(product, c.attr))));
}

export function whyText(product: Product, constraints: Constraint[]): string {
  if (!product.whyFor) return product.why;
  const active = new Set(constraints.filter((c) => c.status === "active").map((c) => c.key));
  const key = Object.keys(product.whyFor).find((k) => active.has(k));
  return key ? product.whyFor[key]! : product.why;
}
