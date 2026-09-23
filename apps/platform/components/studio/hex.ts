/** Accepts a 3- or 6-digit hex, with or without a leading "#"; returns a normalised "#rrggbb" or null. */
export function normalizeHex(raw: string): string | null {
  const body = raw.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(body)) return `#${body.toLowerCase()}`;
  if (/^[0-9a-f]{3}$/i.test(body)) return `#${body.toLowerCase().split("").map((c) => c + c).join("")}`;
  return null;
}
