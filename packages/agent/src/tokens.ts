import { clampChroma, converter, formatHex, parse, wcagContrast } from "culori";
import type { AgentConfig, TokenAdjustment, TokenResult } from "./types";

type Lch = { l: number; c: number; h: number };
const toOklch = converter("oklch");
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function lch(color: string): Lch {
  const o = toOklch(parse(color));
  if (!o) throw new Error(`Invalid colour: ${color}`);
  return { l: o.l, c: o.c ?? 0, h: o.h ?? 0 };
}

export function hex({ l, c, h }: Lch): string {
  return formatHex(clampChroma({ mode: "oklch", l: clamp01(l), c: Math.max(0, c), h }, "oklch"));
}

export const contrast = (a: string, b: string): number => wcagContrast(a, b);

/** Move fg's lightness (keeping hue) away from bg until it reaches `min` contrast. */
export function ensureContrast(fg: string, bg: string, min: number): string {
  if (contrast(fg, bg) >= min) return formatHex(parse(fg)!);
  const base = lch(fg);
  const darker = contrast("#000000", bg) >= contrast("#ffffff", bg);
  for (let step = 1; step <= 100; step++) {
    const candidate = hex({ ...base, l: base.l + (darker ? -step : step) * 0.01 });
    if (contrast(candidate, bg) >= min) return candidate;
  }
  return darker ? "#000000" : "#ffffff";
}

/**
 * Move fg's lightness until it reaches `min` contrast against EVERY background in
 * `backgrounds` at once. A chain of single-target `ensureContrast` calls can undo
 * itself (fixing contrast against one background can wreck it against another,
 * e.g. two close-but-not-identical backgrounds like --c-surface and a custom
 * --c-bg) — this steps all candidates and checks all targets together, so the
 * result is one colour that reads on all of them.
 *
 * Searches BOTH directions (darker and lighter), because on a mid-tone background
 * there may be no single-direction step that helps: darkening can clear one
 * background while lightening is what's needed for another. Among candidates that
 * satisfy every background, returns the one with the smallest lightness change; if
 * none do (some background combination is jointly unsatisfiable even at the
 * black/white extremes), returns whichever candidate maximises the minimum
 * contrast across all backgrounds, checking the pure black/white extremes too.
 */
export function ensureContrastAll(fg: string, backgrounds: string[], min: number): string {
  const meetsAll = (c: string) => backgrounds.every((bg) => contrast(c, bg) >= min);
  const minContrast = (c: string) => Math.min(...backgrounds.map((bg) => contrast(c, bg)));
  const start = formatHex(parse(fg)!);
  if (meetsAll(start)) return start;
  const base = lch(fg);

  let bestPassing: { delta: number; candidate: string } | null = null;
  let bestOverall = { candidate: start, score: minContrast(start) };

  for (const dir of [-1, 1] as const) {
    for (let step = 1; step <= 100; step++) {
      const candidate = hex({ ...base, l: base.l + dir * step * 0.01 });
      const score = minContrast(candidate);
      if (score > bestOverall.score) bestOverall = { candidate, score };
      if (meetsAll(candidate)) {
        const delta = step * 0.01;
        if (!bestPassing || delta < bestPassing.delta) bestPassing = { delta, candidate };
        break; // further steps in this direction only move further away; this is the closest hit here
      }
    }
  }
  if (bestPassing) return bestPassing.candidate;

  for (const extreme of ["#000000", "#ffffff"]) {
    const score = minContrast(extreme);
    if (score > bestOverall.score) bestOverall = { candidate: extreme, score };
  }
  return bestOverall.candidate;
}

/** Best readable text colour on a fill: white, else near-black, else pure black. */
export function bestOn(bg: string): string {
  if (contrast("#ffffff", bg) >= 4.5) return "#ffffff";
  if (contrast("#141414", bg) >= 4.5) return "#141414";
  return "#000000";
}

const RADII = {
  square: { sm: "0px", md: "2px", lg: "2px", btn: "2px" },
  rounded: { sm: "6px", md: "10px", lg: "14px", btn: "10px" },
  soft: { sm: "10px", md: "16px", lg: "22px", btn: "999px" },
} as const;
const SPACE = { compact: [4, 6, 10, 14, 20, 28], regular: [4, 8, 12, 16, 24, 32], airy: [6, 10, 16, 22, 32, 44] } as const;
const FONT_SIZE = { compact: [11, 13, 14, 16, 20], regular: [12, 14, 15, 17, 22], airy: [12, 14, 16, 19, 26] } as const;
const LINE_HEIGHT = { compact: "1.4", regular: "1.5", airy: "1.6" } as const;

function fontStack(family: string): string {
  return family.includes(",") ? family : `"${family}", system-ui, sans-serif`;
}

export function deriveTokens(config: AgentConfig): TokenResult {
  const adjustments: TokenAdjustment[] = [];
  const b = lch(config.brand);
  const brand = formatHex(parse(config.brand)!);

  const bgHex = config.background
    ? formatHex(parse(config.background)!)
    : config.surface === "dark"
      ? hex({ l: 0.18, c: Math.min(b.c, 0.015), h: b.h })
      : hex({ l: 0.985, c: Math.min(b.c, 0.008), h: b.h });
  const isDark = contrast(bgHex, "#ffffff") > contrast(bgHex, "#000000");
  const bg = lch(bgHex);
  /** step away from the background toward the text colour */
  const toward = (d: number) => hex({ ...bg, l: bg.l + (isDark ? d : -d) });

  // `toward()` shifts --c-surface away from --c-bg toward the text pole. On an
  // ordinary derived background this offset is harmless. But on an awkward custom
  // mid-tone --c-bg, --c-surface can end up in a spot where NO text lightness
  // clears AA against both bg and surface at once (moving darker helps against one,
  // lighter helps against the other). Guarantee solvability by shrinking the offset
  // until a single colour (checked at the black/white extremes) can read on both;
  // ordinary light/dark cases hit min-contrast on the first try and never shrink.
  let surfaceOffset = 0.035;
  let surface = toward(surfaceOffset);
  const jointlySatisfiable = (bgA: string, bgB: string, min: number) =>
    (contrast("#000000", bgA) >= min && contrast("#000000", bgB) >= min) ||
    (contrast("#ffffff", bgA) >= min && contrast("#ffffff", bgB) >= min);
  let shrinkGuard = 0;
  while (!jointlySatisfiable(bgHex, surface, 4.5) && surfaceOffset > 0.001 && shrinkGuard < 30) {
    surfaceOffset *= 0.6;
    surface = toward(surfaceOffset);
    shrinkGuard++;
  }

  const border = toward(0.12);
  // Target 7:1 (AAA) against both --c-surface and --c-bg for extra headroom; this is
  // best-effort — on an awkward mid-tone custom background 7:1 may be unreachable, in
  // which case ensureContrastAll degrades toward black/white, which still clears AA
  // (>=4.5) against both surfaces for any background that isn't itself near-midpoint
  // grey on both poles.
  const text = ensureContrastAll(hex({ l: isDark ? 0.95 : 0.22, c: Math.min(b.c, 0.02), h: b.h }), [surface, bgHex], 7);
  const mutedSeed = hex({ l: isDark ? 0.76 : 0.45, c: Math.min(b.c, 0.03), h: b.h });
  // Must hold AA against BOTH --c-surface and --c-bg at once — a chain of two
  // single-target ensureContrast calls can fix one and break the other.
  const muted = ensureContrastAll(mutedSeed, [surface, bgHex], 4.5);

  const onBrand = bestOn(brand);
  if (onBrand !== "#ffffff") {
    adjustments.push({ token: "--c-on-brand", from: "#ffffff", to: onBrand, reason: "White text wasn't readable on your brand colour, so button text is dark instead." });
  }
  const hoverDelta = b.l < 0.3 ? 0.08 : -0.06;
  const brandHover = hex({ ...b, l: b.l + hoverDelta });
  const brandPressed = hex({ ...b, l: b.l + hoverDelta * 2 });

  const brandEdge = ensureContrast(brand, bgHex, 3);
  if (brandEdge !== brand) {
    adjustments.push({ token: "--c-brand-edge", from: brand, to: brandEdge, reason: "Your brand colour is close to your background, so buttons get a slightly deeper outline to stand out." });
  }
  const link = ensureContrast(brand, bgHex, 4.5);
  if (link !== brand) {
    adjustments.push({ token: "--c-link", from: brand, to: link, reason: `Your brand colour is too ${isDark ? "dark" : "light"} to read as text here, so links and highlights use a ${isDark ? "brighter" : "deeper"} shade of it.` });
  }

  const brandSoft = hex({ l: isDark ? bg.l + 0.09 : Math.max(0.9, Math.min(0.95, bg.l - 0.04)), c: Math.min(b.c, 0.05), h: b.h });
  const onBrandSoft = ensureContrast(hex({ l: isDark ? 0.88 : 0.34, c: b.c, h: b.h }), brandSoft, 4.5);

  const accent = config.accent ? formatHex(parse(config.accent)!) : hex({ ...b, h: (b.h + 40) % 360 });
  const onAccent = bestOn(accent);

  // Near-miss flag: tinted with the brand hue (like brandSoft) and pushed further
  // from --c-surface than a neutral step, so it reads as a callout on dark cards too.
  const flagBg = hex({ l: bg.l + (isDark ? 0.14 : -0.09), c: Math.min(b.c, isDark ? 0.07 : 0.05), h: b.h });
  const flagText = ensureContrast(text, flagBg, 4.5);
  const focus = ensureContrast(brand, bgHex, 3);

  const r = RADII[config.shape];
  const s = SPACE[config.density];
  const f = FONT_SIZE[config.density];

  const vars: Record<string, string> = {
    "--c-bg": bgHex,
    "--c-surface": surface,
    "--c-border": border,
    "--c-text": text,
    "--c-muted": muted,
    "--c-brand": brand,
    "--c-brand-hover": brandHover,
    "--c-brand-pressed": brandPressed,
    "--c-on-brand": onBrand,
    "--c-brand-edge": brandEdge,
    "--c-link": link,
    "--c-brand-soft": brandSoft,
    "--c-on-brand-soft": onBrandSoft,
    "--c-accent": accent,
    "--c-on-accent": onAccent,
    "--c-flag-bg": flagBg,
    "--c-flag-text": flagText,
    "--c-focus": focus,
    "--shadow": isDark ? "0 16px 48px rgb(0 0 0 / 0.55)" : "0 16px 48px rgb(20 20 30 / 0.16)",
    "--r-sm": r.sm, "--r-md": r.md, "--r-lg": r.lg, "--r-btn": r.btn,
    "--fs-xs": `${f[0]}px`, "--fs-sm": `${f[1]}px`, "--fs-md": `${f[2]}px`, "--fs-lg": `${f[3]}px`, "--fs-xl": `${f[4]}px`,
    "--lh": LINE_HEIGHT[config.density],
    "--display-weight": config.font.display ? "600" : "650",
    "--font-mono": 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  };
  s.forEach((px, i) => { vars[`--s-${i + 1}`] = `${px}px`; });
  if (config.font.family !== "inherit") vars["--font-body"] = fontStack(config.font.family);
  if (config.font.display) vars["--font-display"] = fontStack(config.font.display);

  return { vars, adjustments };
}

export function varsToCss(vars: Record<string, string>): string {
  return `:host{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}}`;
}
