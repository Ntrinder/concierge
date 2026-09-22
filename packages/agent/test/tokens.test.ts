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
