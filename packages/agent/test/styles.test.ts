import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("widget styles", () => {
  it("uses tokens for every colour — no literal colours", () => {
    const css = readFileSync(new URL("../src/widget/styles.css", import.meta.url), "utf8");
    const literals = css.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/g);
    expect(literals).toBeNull();
  });
});
