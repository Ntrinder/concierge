import { describe, expect, it } from "vitest";
import { replay } from "../src/engine/engine";
import type { StoreKey } from "../src/types";

const STORES: StoreKey[] = ["books", "fishing"];

describe("suggested replies fit a single row", () => {
  for (const store of STORES) {
    for (let n = 0; n <= 5; n++) {
      it(`${store} replay(${n}) has at most 3 replies`, () => {
        expect(replay(store, "warm", n).replies.length).toBeLessThanOrEqual(3);
      });
    }
  }
});
