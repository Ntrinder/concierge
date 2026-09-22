import type { Shape } from "@concierge/agent/core";

export const FONT_CHOICES = [
  "Fraunces", "EB Garamond", "Playfair Display", "Inter", "DM Sans", "Instrument Sans",
  "Barlow", "Barlow Condensed", "Space Grotesk", "IBM Plex Sans", "Nunito", "Fredoka",
];

export function shapeFromRadius(px?: number): Shape {
  if (px === undefined) return "rounded";
  if (px <= 3) return "square";
  if (px <= 12) return "rounded";
  return "soft";
}
