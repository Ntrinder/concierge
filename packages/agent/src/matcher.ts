import type { AttrValue, Constraint, MatchResult, NearMiss, Product, Violation } from "./types";

export function attrOf(p: Product, attr: string): AttrValue | undefined {
  return attr === "price" ? p.price : p.attrs[attr];
}

function satisfies(actual: AttrValue | undefined, c: Constraint): boolean {
  switch (c.op) {
    case "includes": return Array.isArray(actual) ? actual.includes(String(c.value)) : actual === c.value;
    case "excludes": return Array.isArray(actual) ? !actual.includes(String(c.value)) : actual !== c.value;
    case "eq": return actual === c.value;
    case "max": return typeof actual === "number" && actual <= Number(c.value);
    case "min": return typeof actual === "number" && actual >= Number(c.value);
  }
}

/** Fills a copy template with a constraint's limit and a product's actual value.
 * {actual} the product's value, {limit}/{value} the constraint's value,
 * {over} = actual − limit, {under} = limit − actual (both rounded). */
export function fill(template: string, c: Constraint, actual: AttrValue | undefined): string {
  const num = typeof actual === "number" ? actual : undefined;
  const limit = Number(c.value);
  const over = num === undefined ? 0 : Math.round(num - limit);
  const under = num === undefined ? 0 : Math.round(limit - num);
  return template
    .replace("{actual}", actual === undefined ? "–" : String(actual))
    .replace("{limit}", String(c.value))
    .replace("{value}", String(c.value))
    .replace("{over}", String(over))
    .replace("{under}", String(under));
}

export function violationOf(p: Product, c: Constraint): Violation | null {
  const actual = attrOf(p, c.attr);
  if (satisfies(actual, c)) return null;
  let severity = 1;
  if (typeof actual === "number" && (c.op === "max" || c.op === "min")) {
    severity = Math.abs(actual - Number(c.value)) / Math.max(1, Number(c.value));
  }
  const text = fill(c.miss ?? `Not ${c.label.toLowerCase()}`, c, actual);
  return { constraint: c, actual, severity, text };
}

export function match(products: Product[], constraints: Constraint[]): MatchResult {
  const active = constraints.filter((c) => c.status === "active");
  const matches: Product[] = [];
  const nearMisses: NearMiss[] = [];
  for (const product of products) {
    const violations = active.map((c) => violationOf(product, c)).filter((v): v is Violation => v !== null);
    if (violations.length === 0) matches.push(product);
    else if (violations.length === 1 && !violations[0].constraint.hard) nearMisses.push({ product, violation: violations[0] });
  }
  nearMisses.sort((a, b) => a.violation.severity - b.violation.severity);
  return { matches, nearMisses };
}

export function closestPerConstraint(nearMisses: NearMiss[]): NearMiss[] {
  const seen = new Set<string>();
  return nearMisses.filter((n) => {
    const key = n.violation.constraint.key;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
