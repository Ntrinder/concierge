import { describe, expect, it } from "vitest";
import { differenceEuclidean } from "culori";
import { contrast, deriveTokens, isPastelBrand } from "../src/tokens";
import { DEMO_CONFIGS, LAB_CONFIGS, PRESETS } from "../src/presets";
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

  // The near-miss flag must read as a callout, not just a slightly different card.
  const oklabDistance = differenceEuclidean("oklab");
  for (const surface of ["light", "dark"] as const) {
    it(`separates the near-miss flag from the card surface (${surface})`, () => {
      for (const brand of AWKWARD) {
        const { vars } = deriveTokens({ ...base, brand, surface });
        expect(oklabDistance(vars["--c-flag-bg"], vars["--c-surface"]), brand).toBeGreaterThanOrEqual(0.05);
      }
    });
  }
  it("gives the Riffle near-miss flag a clearly tinted background on dark", () => {
    const { vars } = deriveTokens(DEMO_CONFIGS.riffle);
    expect(oklabDistance(vars["--c-flag-bg"], vars["--c-surface"])).toBeGreaterThanOrEqual(0.1);
    expect(contrast(vars["--c-flag-text"], vars["--c-flag-bg"])).toBeGreaterThanOrEqual(4.5);
  });

  it("respects a custom background", () => {
    const { vars } = deriveTokens({ ...base, background: "#F6F1E7" });
    expect(vars["--c-bg"]).toBe("#f6f1e7");
  });

  it("gives --c-success at least 3:1 against both --c-surface and --c-bg, for every Lab brand and preset", () => {
    const configs = [...LAB_CONFIGS, ...Object.values(PRESETS).map((p) => ({ ...base, ...p.config }))];
    for (const config of configs) {
      const { vars } = deriveTokens(config);
      expect(contrast(vars["--c-success"], vars["--c-surface"]), `${config.id || "preset"} vs surface`).toBeGreaterThanOrEqual(3);
      expect(contrast(vars["--c-success"], vars["--c-bg"]), `${config.id || "preset"} vs bg`).toBeGreaterThanOrEqual(3);
    }
  });

  it("flags only pastel brands as pastel", () => {
    const configs = [...LAB_CONFIGS, ...Object.values(PRESETS).map((p) => ({ ...base, ...p.config }))];
    for (const config of configs) {
      expect(isPastelBrand(config), config.id || "preset").toBe(config.id === "lab-sherbet");
    }
  });

  it("gives Sherbet a deep-shade action colour and keeps the brand as a surface tint", () => {
    const sherbet = LAB_CONFIGS.find((c) => c.id === "lab-sherbet")!;
    const { vars, adjustments } = deriveTokens(sherbet);
    expect(vars["--c-action"]).not.toBe(vars["--c-brand"]);
    expect(contrast(vars["--c-on-action"], vars["--c-action"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(vars["--c-action"], vars["--c-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(vars["--c-brand-soft"]).toBe(vars["--c-brand"]);
    expect(contrast(vars["--c-on-brand-soft"], vars["--c-brand-soft"])).toBeGreaterThanOrEqual(4.5);
    expect(adjustments.map((a) => a.token)).toContain("--c-action");
  });

  it("leaves --c-action equal to --c-brand for every non-pastel Lab config and preset", () => {
    const configs = [...LAB_CONFIGS, ...Object.values(PRESETS).map((p) => ({ ...base, ...p.config }))];
    for (const config of configs) {
      if (isPastelBrand(config)) continue;
      const { vars } = deriveTokens(config);
      expect(vars["--c-action"], config.id || "preset").toBe(vars["--c-brand"]);
      expect(vars["--c-on-action"], config.id || "preset").toBe(vars["--c-on-brand"]);
    }
  });

  it("keeps --c-action readable and --c-action-edge visible against --c-bg for every Lab config and preset", () => {
    const configs = [...LAB_CONFIGS, ...Object.values(PRESETS).map((p) => ({ ...base, ...p.config }))];
    for (const config of configs) {
      const { vars } = deriveTokens(config);
      expect(contrast(vars["--c-on-action"], vars["--c-action"]), config.id || "preset").toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars["--c-action-edge"], vars["--c-bg"]), config.id || "preset").toBeGreaterThanOrEqual(3);
    }
  });

  it("omits --font-body when inheriting the host font", () => {
    expect(deriveTokens(base).vars["--font-body"]).toBeUndefined();
    const { vars } = deriveTokens({ ...base, font: { family: "Barlow", display: "Barlow Condensed" } });
    expect(vars["--font-body"]).toContain('"Barlow"');
    expect(vars["--font-display"]).toContain('"Barlow Condensed"');
  });
});
