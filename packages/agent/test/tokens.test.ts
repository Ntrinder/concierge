import { describe, expect, it } from "vitest";
import { contrast, deriveTokens } from "../src/tokens";
import type { AgentConfig } from "../src/types";

const base: AgentConfig = {
  id: "t", store: "books", brand: "#7A2E2E", surface: "light",
  font: { family: "inherit" }, shape: "soft", density: "airy", voice: "warm", cardStyle: "visual",
  agent: { name: "Test", greeting: "Hi" }, launcher: { position: "bottom-right" },
};

const AWKWARD = ["#FFE600", "#F4C2C2", "#0B0B0B", "#FF5A1F", "#7A2E2E", "#00FF88", "#777777", "#1E40FF"];
const TEXT_PAIRS: [string, string][] = [
  ["--c-text", "--c-bg"], ["--c-text", "--c-surface"], ["--c-muted", "--c-bg"], ["--c-muted", "--c-surface"],
  ["--c-on-brand", "--c-brand"], ["--c-link", "--c-bg"], ["--c-on-brand-soft", "--c-brand-soft"],
  ["--c-on-accent", "--c-accent"], ["--c-flag-text", "--c-flag-bg"],
];

describe("deriveTokens", () => {
  for (const surface of ["light", "dark"] as const) {
    for (const brand of AWKWARD) {
      it(`keeps AA contrast for ${brand} on ${surface}`, () => {
        const { vars } = deriveTokens({ ...base, brand, surface });
        for (const [fg, bg] of TEXT_PAIRS) {
          expect(contrast(vars[fg], vars[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(vars["--c-brand-edge"], vars["--c-bg"])).toBeGreaterThanOrEqual(3);
      });
    }
  }

  it("reports adjustments when the brand is too light to read on white", () => {
    const { adjustments } = deriveTokens({ ...base, brand: "#FFE600" });
    const tokens = adjustments.map((a) => a.token);
    expect(tokens).toContain("--c-link");
    expect(tokens).toContain("--c-brand-edge");
  });

  const CUSTOM_BACKGROUNDS = ["#767676", "#F6F1E7", "#101214", "#FFFFFF"];
  const CUSTOM_BG_BRANDS = ["#7A2E2E", "#1E40FF", "#FFE600"];
  for (const background of CUSTOM_BACKGROUNDS) {
    for (const brand of CUSTOM_BG_BRANDS) {
      for (const surface of ["light", "dark"] as const) {
        it(`keeps AA contrast for brand ${brand} on custom background ${background} (${surface})`, () => {
          const { vars } = deriveTokens({ ...base, brand, background, surface });
          for (const [fg, bg] of TEXT_PAIRS) {
            expect(contrast(vars[fg], vars[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
          }
          expect(contrast(vars["--c-brand-edge"], vars["--c-bg"])).toBeGreaterThanOrEqual(3);
        });
      }
    }
  }

  // Mid-grey backgrounds are the awkward case: --c-surface sits between --c-bg and the
  // text pole, and for some greys no single text lightness clears AA against both at
  // once unless the surface offset shrinks to make room. Sweep the whole mid-grey band.
  const GREY_SWEEP: string[] = [];
  for (let v = 0x5a; v <= 0x95; v += 0x04) {
    const h = v.toString(16).padStart(2, "0");
    GREY_SWEEP.push(`#${h}${h}${h}`);
  }
  for (const explicit of ["#777777", "#6f6f6f"]) {
    if (!GREY_SWEEP.includes(explicit)) GREY_SWEEP.push(explicit);
  }
  const GREY_SWEEP_BRANDS = ["#7A2E2E", "#1E40FF"];
  for (const background of GREY_SWEEP) {
    for (const brand of GREY_SWEEP_BRANDS) {
      for (const surface of ["light", "dark"] as const) {
        it(`keeps AA contrast for brand ${brand} on grey background ${background} (${surface})`, () => {
          const { vars } = deriveTokens({ ...base, brand, background, surface });
          for (const [fg, bg] of TEXT_PAIRS) {
            expect(contrast(vars[fg], vars[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
          }
          expect(contrast(vars["--c-brand-edge"], vars["--c-bg"])).toBeGreaterThanOrEqual(3);
        });
      }
    }
  }

  it("respects a custom background", () => {
    const { vars } = deriveTokens({ ...base, background: "#F6F1E7" });
    expect(vars["--c-bg"]).toBe("#f6f1e7");
  });

  it("omits --font-body when inheriting the host font", () => {
    expect(deriveTokens(base).vars["--font-body"]).toBeUndefined();
    const { vars } = deriveTokens({ ...base, font: { family: "Barlow", display: "Barlow Condensed" } });
    expect(vars["--font-body"]).toContain('"Barlow"');
    expect(vars["--font-display"]).toContain('"Barlow Condensed"');
  });
});
