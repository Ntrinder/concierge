# Concierge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an embeddable, brand-configurable shopping agent (scripted, no LLM), a merchant configuration page, and two demo storefronts (Marginalia books, Riffle & Co. fishing) that load the same agent with different configs.

**Architecture:** pnpm monorepo. `packages/agent` holds pure TS core (types, OKLCH token engine, catalogs, matcher, scripted conversation engine) plus a Preact widget wrapped in a `<concierge-agent>` custom element with Shadow DOM, built by Vite into a single IIFE `agent.js` written straight into `apps/platform/public/`. `apps/platform` is one Next.js app (one Railway service) serving the config studio, `/lab`, the two storefronts under `/demo/*`, config JSON, and a brand-extraction API. The platform imports the agent's pure core as TS source (`@concierge/agent/core`) and loads the widget itself via `/agent.js`.

**Tech Stack:** Node 26, pnpm 9.15.9, TypeScript 5.9, Preact 10.29, Vite 8 + @preact/preset-vite 2.10, Vitest 4, culori 4, Next.js 16.3 (App Router) + React 19.2, node-html-parser 7.

**Spec:** `docs/superpowers/specs/2026-09-22-concierge-design.md`

## Global Constraints

- Scripted agent only. No LLM calls, no API keys.
- Widget component CSS (`packages/agent/src/widget/styles.css`) uses CSS custom properties for every colour. No hex, `rgb(`, `hsl(` or `oklch(` literals. Enforced by a test.
- Every text/background pair the token engine emits passes WCAG AA (4.5:1). Button fill and page background differ by at least 3:1 via `--c-brand-edge`.
- The widget must work at 375px wide. At ≤ 480px it becomes a full-screen sheet (`compact` mode).
- The widget isolates itself from host CSS via Shadow DOM and resets inherited text properties on `.root`. It inherits only `font-family` when the config says `"inherit"`.
- The snippet shape is exactly: `<script src="https://<host>/agent.js" data-config="<id>" async></script>`
- Add to basket dispatches `window` event `concierge:add-to-cart` with `detail: { productId, name, price, qty, options }`.
- Demo config ids `marginalia` and `riffle` are reserved and read-only.
- Testing stays light: Vitest unit tests only in `packages/agent` (token engine, matcher, engine, literal-colour check). No Playwright. UI is verified by hand in the browser.
- `DECISIONS.md` at the repo root is a running log. Any task that overrides an AI suggestion or makes a notable trade-off appends one line to it.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## File Structure

```
package.json, pnpm-workspace.yaml, tsconfig.base.json, .gitignore, railway.json, README.md, DECISIONS.md
packages/agent/
  package.json, tsconfig.json, vite.config.ts, index.html (dev harness)
  src/core.ts                 public pure-TS surface (no JSX) imported by the platform
  src/types.ts                AgentConfig, Product, Constraint, Message, ConvState …
  src/tokens.ts               deriveTokens, contrast helpers
  src/presets.ts              style presets, DEFAULT_CONFIG, DEMO_CONFIGS, LAB_CONFIGS
  src/catalogs/books.ts, fishing.ts, index.ts
  src/matcher.ts              match, violationOf, closestPerConstraint
  src/engine/engine.ts        initialState, send, removeConstraint, markAdded, submitNotify
  src/engine/present.ts       shared "show results" helper
  src/engine/books.ts, fishing.ts, index.ts   scripts
  src/widget/element.tsx      <concierge-agent> custom element
  src/widget/App.tsx, Header.tsx, ConstraintStrip.tsx, MessageList.tsx, Composer.tsx,
             ProductCard.tsx, Compare.tsx, DetailSheet.tsx, NotifyForm.tsx, icons.tsx, useCompact.ts, cls.ts
  src/widget/styles.css
  src/loader.ts               IIFE entry → agent.js
  src/harness.ts              dev harness only
  test/tokens.test.ts, matcher.test.ts, engine.test.ts, styles.test.ts
apps/platform/
  package.json, next.config.ts, tsconfig.json, global.d.ts
  app/(platform)/layout.tsx, globals.css, page.tsx (studio), lab/page.tsx
  app/(demo)/layout.tsx, demo/books/page.tsx + books.module.css, demo/fishing/page.tsx + fishing.module.css
  app/configs/[file]/route.ts, app/api/configs/route.ts, app/api/extract/route.ts
  components/AgentPreview.tsx, CartBadge.tsx
  components/studio/Studio.tsx, state.ts, StepStart.tsx, StepTune.tsx, Preview.tsx, MockStore.tsx,
                    Controls.tsx, FitCheck.tsx, StepInstall.tsx, studio.module.css
  lib/configStore.ts, lib/extract.ts, lib/logoPalette.ts, lib/fonts.ts
  public/demo/marginalia-logo.svg, riffle-logo.svg
```

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `DECISIONS.md`
- Create: `packages/agent/package.json`, `packages/agent/tsconfig.json`, `packages/agent/vite.config.ts`, `packages/agent/src/loader.ts`, `packages/agent/src/core.ts`
- Create: `apps/platform/package.json`, `apps/platform/next.config.ts`, `apps/platform/tsconfig.json`, `apps/platform/app/(platform)/layout.tsx`, `apps/platform/app/(platform)/page.tsx`, `apps/platform/app/(platform)/globals.css`, `apps/platform/app/(demo)/layout.tsx`

**Interfaces:**
- Produces: `pnpm build` builds `apps/platform/public/agent.js` then Next. `pnpm dev` runs the Vite watch build and `next dev` in parallel. `pnpm test` runs agent Vitest. Import path `@concierge/agent/core` resolves to `packages/agent/src/core.ts` from the platform.

- [ ] **Step 1: Root files**

`package.json`:
```json
{
  "name": "concierge",
  "private": true,
  "packageManager": "pnpm@9.15.9",
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm --filter @concierge/agent build && pnpm --filter platform build",
    "start": "pnpm --filter platform start",
    "test": "pnpm --filter @concierge/agent test"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  }
}
```

`.gitignore`:
```
node_modules
.next
dist
.data
apps/platform/public/agent.js
*.tsbuildinfo
.DS_Store
```

`DECISIONS.md`:
```markdown
# Decisions (running log — trimmed to one page at the end)

## Merchant & configuration page

## Keeping the agent right across brands

## AI suggestions I overrode

## Cut for time

## Weakest part

## With another hour
```

- [ ] **Step 2: Agent package**

`packages/agent/package.json`:
```json
{
  "name": "@concierge/agent",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { "./core": "./src/core.ts" },
  "scripts": {
    "dev": "vite build --watch",
    "harness": "vite",
    "build": "vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "culori": "^4.0.2", "preact": "^10.29.0" },
  "devDependencies": {
    "@preact/preset-vite": "^2.10.6",
    "@types/culori": "^4.0.1",
    "@types/node": "^24.0.0",
    "typescript": "^5.9.0",
    "vite": "^8.0.0",
    "vitest": "^4.0.0"
  }
}
```

`packages/agent/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "types": ["vite/client", "node"]
  },
  "include": ["src", "test", "vite.config.ts"]
}
```

`packages/agent/vite.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    lib: { entry: "src/loader.ts", name: "Concierge", formats: ["iife"], fileName: () => "agent.js" },
    outDir: "../../apps/platform/public",
    emptyOutDir: false,
    sourcemap: false,
  },
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
```

`packages/agent/src/loader.ts` (placeholder, replaced in Task 5):
```ts
console.info("[concierge] agent.js loaded");
```

`packages/agent/src/core.ts` (placeholder, filled in later tasks):
```ts
export const CONCIERGE_VERSION = "0.1.0";
```

- [ ] **Step 3: Platform app**

`apps/platform/package.json`:
```json
{
  "name": "platform",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -p ${PORT:-3000}",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@concierge/agent": "workspace:*",
    "culori": "^4.0.2",
    "next": "^16.3.0",
    "node-html-parser": "^7.0.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@types/culori": "^4.0.1",
    "@types/node": "^24.0.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "typescript": "^5.9.0"
  }
}
```

`apps/platform/next.config.ts`:
```ts
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@concierge/agent"],
  turbopack: { root: path.resolve(process.cwd(), "../..") },
};

export default nextConfig;
```

`apps/platform/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "global.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/platform/app/(platform)/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";

const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-platform" });

export const metadata: Metadata = {
  title: "Concierge — shopping assistant studio",
  description: "Set up a shopping assistant that looks like your store.",
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
```

`apps/platform/app/(platform)/globals.css`:
```css
:root {
  --ink: #16161a;
  --ink-2: #55555e;
  --ink-3: #8a8a93;
  --paper: #fafaf7;
  --card: #ffffff;
  --line: #e6e5df;
  --ok: #1f7a4d;
  --ok-soft: #e7f4ec;
  --note: #8a5a00;
  --note-soft: #fdf4e1;
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  font-family: var(--font-platform), system-ui, sans-serif;
  background: var(--paper);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}
button, input, select, textarea { font: inherit; color: inherit; }
```

`apps/platform/app/(platform)/page.tsx` (placeholder, replaced in Task 12):
```tsx
export default function Home() {
  return <main style={{ padding: 40 }}>Concierge studio — coming soon</main>;
}
```

`apps/platform/app/(demo)/layout.tsx`:
```tsx
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Install and verify**

Run: `cd ~/src/concierge && pnpm install && pnpm build`
Expected: Vite prints `../../apps/platform/public/agent.js` and Next build completes with route `/`.

Run: `pnpm --filter platform dev` then `curl -s localhost:3000 | grep -o "coming soon"` and `curl -s localhost:3000/agent.js | head -c 80`
Expected: `coming soon`, and the JS contains `agent.js loaded`. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold pnpm monorepo (agent package + Next platform)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 2: Core types and token engine

**Files:**
- Create: `packages/agent/src/types.ts`, `packages/agent/src/tokens.ts`
- Modify: `packages/agent/src/core.ts`
- Test: `packages/agent/test/tokens.test.ts`

**Interfaces:**
- Produces:
  - `AgentConfig`, `TokenAdjustment`, `TokenResult` and the other shared types listed in `types.ts` below. Later tasks import them from `../types` (agent) or `@concierge/agent/core` (platform).
  - `deriveTokens(config: AgentConfig): TokenResult`. `vars` keys are exactly: `--c-bg --c-surface --c-border --c-text --c-muted --c-brand --c-brand-hover --c-brand-pressed --c-on-brand --c-brand-edge --c-link --c-brand-soft --c-on-brand-soft --c-accent --c-on-accent --c-flag-bg --c-flag-text --c-focus --shadow --r-sm --r-md --r-lg --r-btn --s-1…--s-6 --fs-xs --fs-sm --fs-md --fs-lg --fs-xl --lh --display-weight --font-mono`, plus `--font-body` only when `font.family !== "inherit"` and `--font-display` only when `font.display` is set.
  - `contrast(a: string, b: string): number` and `ensureContrast(fg, bg, min): string`.

Note: this adds an optional `background` field to `AgentConfig`, which the spec does not have. Merchants care whether the panel is cream or white, and extraction finds it. Log this in DECISIONS.md.

- [ ] **Step 1: Write types**

`packages/agent/src/types.ts`:
```ts
export type StoreKey = "books" | "fishing";
export type Voice = "warm" | "neutral" | "terse";
export type Shape = "soft" | "rounded" | "square";
export type Density = "airy" | "regular" | "compact";
export type CardStyle = "visual" | "spec";

export interface AgentConfig {
  id: string;
  store: StoreKey;
  brand: string;
  accent?: string;
  background?: string;
  surface: "light" | "dark";
  /** family "inherit" = use the host site's font */
  font: { family: string; display?: string; url?: string };
  shape: Shape;
  density: Density;
  voice: Voice;
  cardStyle: CardStyle;
  agent: { name: string; avatar?: string; greeting: string };
  launcher: { position: "bottom-right" | "bottom-left"; label?: string };
}

export interface TokenAdjustment { token: string; from: string; to: string; reason: string }
export interface TokenResult { vars: Record<string, string>; adjustments: TokenAdjustment[] }

export type AttrValue = string | number | boolean | string[];

export type ProductImage =
  | { kind: "cover"; bg: string; fg: string; motif: "band" | "circle" | "rule" }
  | { kind: "glyph"; glyph: "rod" | "reel" | "kit" };

export interface Product {
  id: string;
  store: StoreKey;
  name: string;
  byline: string;
  price: number;
  blurb: string;
  why: string;
  attrs: Record<string, AttrValue>;
  specs: { label: string; value: string }[];
  image: ProductImage;
}

export interface Constraint {
  key: string;
  label: string;
  attr: string;
  op: "includes" | "excludes" | "max" | "min" | "eq";
  value: string | number | boolean;
  /** hard constraints define the category; near misses never break them and shoppers can't remove them */
  hard?: boolean;
  group?: string;
  /** near-miss text template: {actual} {limit} {over} */
  miss?: string;
  status: "active" | "dropped";
  /** turn number when this constraint was added or dropped (set by the engine) */
  changedAt?: number;
}

export interface Violation { constraint: Constraint; actual: AttrValue | undefined; severity: number; text: string }
export interface NearMiss { product: Product; violation: Violation }
export interface MatchResult { matches: Product[]; nearMisses: NearMiss[] }

export interface Reply { label: string; text: string }
export type VoiceCopy = Record<Voice, string>;

export type AgentDraft =
  | { kind: "text"; text: string }
  | { kind: "products"; mode: "match" | "near-miss"; items: { productId: string; flag?: string }[] }
  | { kind: "constraint-change"; kept: string[]; dropped: string[]; added: string[] }
  | { kind: "compare"; productIds: string[] }
  | { kind: "notify-form"; done?: string }
  | { kind: "added"; productId: string };

export type Message =
  | { id: string; role: "user"; kind: "text"; text: string }
  | ({ id: string; role: "agent" } & AgentDraft);

export interface ConvState {
  store: StoreKey;
  voice: Voice;
  step: string;
  turn: number;
  seq: number;
  constraints: Constraint[];
  messages: Message[];
  replies: Reply[];
  lastShown: string[];
}
```

- [ ] **Step 2: Write the failing test**

`packages/agent/test/tokens.test.ts`:
```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @concierge/agent test`
Expected: FAIL, cannot resolve `../src/tokens`.

- [ ] **Step 4: Implement the token engine**

`packages/agent/src/tokens.ts`:
```ts
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

  const surface = toward(0.035);
  const border = toward(0.12);
  const text = ensureContrast(hex({ l: isDark ? 0.95 : 0.22, c: Math.min(b.c, 0.02), h: b.h }), surface, 7);
  const mutedSeed = hex({ l: isDark ? 0.76 : 0.45, c: Math.min(b.c, 0.03), h: b.h });
  const muted = ensureContrast(ensureContrast(mutedSeed, surface, 4.5), bgHex, 4.5);

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

  const flagBg = toward(0.09);
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
```

`packages/agent/src/core.ts`:
```ts
export * from "./types";
export { deriveTokens, contrast, ensureContrast, varsToCss } from "./tokens";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @concierge/agent test`
Expected: PASS (all AWKWARD × light/dark cases plus the 3 named tests). If a pair fails, fix the derivation in `tokens.ts` (usually by running `ensureContrast` against the weaker background). Don't loosen the test.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(agent): OKLCH token engine with enforced AA contrast

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 3: Catalogs and matcher

**Files:**
- Create: `packages/agent/src/catalogs/books.ts`, `packages/agent/src/catalogs/fishing.ts`, `packages/agent/src/catalogs/index.ts`, `packages/agent/src/matcher.ts`
- Modify: `packages/agent/src/core.ts`
- Test: `packages/agent/test/matcher.test.ts`

**Interfaces:**
- Consumes: `Product`, `Constraint`, `MatchResult`, `NearMiss`, `Violation` from `types.ts`.
- Produces:
  - `CATALOGS: Record<StoreKey, Product[]>` and `getProduct(store: StoreKey, id: string): Product | undefined`
  - `match(products: Product[], constraints: Constraint[]): MatchResult`. Only `status: "active"` constraints count. Near misses break exactly one non-hard constraint and are sorted by severity, lowest first.
  - `closestPerConstraint(nearMisses: NearMiss[]): NearMiss[]`: the lowest-severity near miss for each broken constraint.
  - `attrOf(p: Product, attr: string)`: `"price"` reads `p.price`, anything else reads `p.attrs[attr]`.

Catalog data is tuned so the scripted journeys come out of the matcher exactly as the spec describes. Don't change prices, pages, gore, packed lengths or line weights without re-running the tests.

- [ ] **Step 1: Books catalog**

`packages/agent/src/catalogs/books.ts`:
```ts
import type { Product, ProductImage } from "../types";

const cover = (bg: string, fg: string, motif: "band" | "circle" | "rule"): ProductImage => ({ kind: "cover", bg, fg, motif });

interface BookInput {
  id: string; name: string; author: string; price: number; pages: number;
  genres: string[]; tags: string[]; gore: number; genreLabel: string;
  blurb: string; why: string; image: ProductImage;
}

const book = (b: BookInput): Product => ({
  id: b.id, store: "books", name: b.name, byline: b.author, price: b.price,
  blurb: b.blurb, why: b.why, image: b.image,
  attrs: { author: b.author, pages: b.pages, genres: b.genres, tags: b.tags, gore: b.gore, giftable: true },
  specs: [
    { label: "Pages", value: String(b.pages) },
    { label: "Genre", value: b.genreLabel },
    { label: "Format", value: "Paperback" },
  ],
});

export const BOOKS: Product[] = [
  book({ id: "b-harbour-lights", name: "The Harbour Lights", author: "Fiona Castellan", price: 16.99, pages: 352,
    genres: ["mystery", "police-procedural"], tags: ["gripping"], gore: 1, genreLabel: "Police procedural",
    blurb: "A body in the Leith docks, a detective three weeks from retirement, and a city that would rather forget.",
    why: "A weary Leith detective with Rebus's stubbornness and better manners.", image: cover("#1F3A4A", "#F2E6D0", "band") }),
  book({ id: "b-quiet-ledger", name: "A Quiet Ledger", author: "Tom Aldous", price: 14.99, pages: 298,
    genres: ["mystery", "police-procedural"], tags: ["gripping"], gore: 0, genreLabel: "Police procedural",
    blurb: "An accountant vanishes the week before an audit. DS Nadia Kerr follows the money into the Borders.",
    why: "Fraud, not blood: a procedural that runs on paperwork and nerve.", image: cover("#E8DCC4", "#2B2B2B", "rule") }),
  book({ id: "b-north-wind", name: "North Wind, Late", author: "Morag Ellis", price: 17.99, pages: 384,
    genres: ["mystery", "police-procedural"], tags: ["gripping"], gore: 1, genreLabel: "Police procedural",
    blurb: "One DI, one Highland village, one winter — and nobody willing to say what happened at the ferry.",
    why: "Tight, tense and atmospheric, with a lead he'll want to follow into a series.", image: cover("#3C4F3A", "#EDE6D6", "circle") }),
  book({ id: "b-cut-deep", name: "Cut Deep", author: "Declan Rourke", price: 12.99, pages: 336,
    genres: ["mystery", "police-procedural"], tags: ["gripping"], gore: 3, genreLabel: "Police procedural",
    blurb: "A Glasgow killer who leaves messages. Relentless and very graphic.",
    why: "Brilliantly paced, but it doesn't look away from the violence.", image: cover("#111111", "#D7263D", "band") }),
  book({ id: "b-long-watch", name: "The Long Watch", author: "Anneliese Moor", price: 19.99, pages: 544,
    genres: ["mystery", "police-procedural"], tags: ["gripping"], gore: 1, genreLabel: "Police procedural",
    blurb: "Twenty years, three detectives, one unsolved case — a sweeping, doorstop procedural.",
    why: "Rich and absorbing, if he has the time for a big one.", image: cover("#5B3A29", "#F4E9D8", "rule") }),
  book({ id: "b-glass-fjord", name: "Glass Fjord", author: "Sigrid Holm", price: 15.99, pages: 412,
    genres: ["mystery", "nordic"], tags: ["gripping"], gore: 3, genreLabel: "Nordic noir",
    blurb: "Bergen in the dark months, a string of ritual killings, and a detective who can't sleep.",
    why: "Classic Nordic noir — bleak, gripping and gruesome.", image: cover("#CFE0E8", "#16323F", "circle") }),
  book({ id: "b-ninth-winter", name: "The Ninth Winter", author: "Per Lindqvist", price: 16.49, pages: 368,
    genres: ["mystery", "nordic"], tags: ["gripping"], gore: 1, genreLabel: "Nordic noir",
    blurb: "A missing ferryman on a frozen archipelago; an inspector who knows every family on every island.",
    why: "Nordic atmosphere without the gore — quiet menace instead.", image: cover("#E9EEF0", "#27414D", "band") }),
  book({ id: "b-pennyfold", name: "Murder at Pennyfold", author: "Hattie Blake", price: 10.99, pages: 288,
    genres: ["mystery", "cosy"], tags: ["charming"], gore: 0, genreLabel: "Cosy mystery",
    blurb: "A retired headmistress, a village fête and a poisoned Victoria sponge.",
    why: "Warm and clever — more charming than edge-of-the-seat.", image: cover("#F3D9C9", "#6B2D2D", "circle") }),
  book({ id: "b-ash-and-ink", name: "Ash & Ink", author: "Laurence Vey", price: 17.49, pages: 376,
    genres: ["mystery", "historical"], tags: ["gripping"], gore: 1, genreLabel: "Historical mystery",
    blurb: "Edinburgh, 1724: a printer's apprentice finds a confession set in type that nobody admits to writing.",
    why: "Rankin's city, three centuries earlier — a real page-turner.", image: cover("#2E2A24", "#E3C77A", "rule") }),
  book({ id: "b-assayers-daughter", name: "The Assayer's Daughter", author: "Cora Winslow", price: 18.99, pages: 402,
    genres: ["mystery", "historical"], tags: ["slow-burn"], gore: 0, genreLabel: "Historical mystery",
    blurb: "A silver mine, a forged hallmark and a daughter who knows metal better than her father did.",
    why: "Beautifully written and patient — a slow burn.", image: cover("#D8D2C4", "#3A3A3A", "band") }),
  book({ id: "b-fire-and-salt", name: "Fire & Salt", author: "Idris Maddox", price: 16.99, pages: 392,
    genres: ["historical", "thriller", "history"], tags: ["gripping"], gore: 1, genreLabel: "Historical thriller",
    blurb: "Leith, 1645: plague, smugglers and a customs officer with one week to find a missing cargo.",
    why: "Bridges both worlds — all the tension of crime, rooted in real history.", image: cover("#7A2E2E", "#F6EBDD", "band") }),
  book({ id: "b-cartographer", name: "The Cartographer's War", author: "Edmund Hale", price: 20.0, pages: 336,
    genres: ["history", "narrative-history"], tags: ["gripping"], gore: 1, genreLabel: "Narrative history",
    blurb: "After 1745, a handful of surveyors raced to map the Highlands — and changed Scotland for ever.",
    why: "True story, told like a thriller — chases, betrayals, deadlines.", image: cover("#E4D6B8", "#23412F", "rule") }),
  book({ id: "b-last-signal", name: "The Last Signal", author: "Ruth Aberdeen", price: 18.99, pages: 304,
    genres: ["history", "narrative-history"], tags: ["gripping"], gore: 0, genreLabel: "Narrative history",
    blurb: "The wireless operators of wartime Orkney, and the message that nearly didn't get through.",
    why: "Codebreaking and suspense — he'll race through it.", image: cover("#1D2B3A", "#F0C987", "circle") }),
  book({ id: "b-iron-road", name: "Iron Road", author: "Callum Firth", price: 19.99, pages: 368,
    genres: ["history", "narrative-history"], tags: ["gripping"], gore: 1, genreLabel: "Narrative history",
    blurb: "How the railways remade Scotland — engineers, swindlers and the bridge that fell.",
    why: "Big characters and real stakes; history with momentum.", image: cover("#3B3B3B", "#E9A23B", "band") }),
  book({ id: "b-empire-of-tides", name: "Empire of Tides", author: "Margaret Olufsen", price: 28.0, pages: 688,
    genres: ["history"], tags: ["gripping"], gore: 1, genreLabel: "History",
    blurb: "Five hundred years of the North Sea, from herring fleets to oil rigs.",
    why: "Magnificent — and very long.", image: cover("#0F3D4C", "#E6F0F2", "rule") }),
  book({ id: "b-quiet-centuries", name: "The Quiet Centuries", author: "Henry Aske", price: 17.99, pages: 320,
    genres: ["history"], tags: ["reflective"], gore: 0, genreLabel: "History",
    blurb: "A gentle history of Scottish parish life, 1600–1900.",
    why: "Thoughtful and lovely, but more reflective than gripping.", image: cover("#EDE3CF", "#4A4034", "circle") }),
  book({ id: "b-bones-of-culloden", name: "The Bones of Culloden", author: "Alasdair Grant", price: 19.49, pages: 352,
    genres: ["history"], tags: ["gripping"], gore: 3, genreLabel: "History",
    blurb: "A forensic, unflinching account of the battle and its aftermath.",
    why: "Gripping, but graphic about the battlefield.", image: cover("#2B1D1D", "#C9B79C", "band") }),
  book({ id: "b-small-hours", name: "The Small Hours", author: "Nina Achterberg", price: 13.99, pages: 240,
    genres: ["literary"], tags: ["reflective"], gore: 0, genreLabel: "Literary fiction",
    blurb: "A night-shift nurse, a city asleep, and the patients who can't.",
    why: "Quietly devastating literary fiction.", image: cover("#F2EEE8", "#333333", "rule") }),
];
```

- [ ] **Step 2: Fishing catalog**

`packages/agent/src/catalogs/fishing.ts`:
```ts
import type { Product } from "../types";

interface GearInput {
  id: string; name: string; byline: string; price: number; glyph: "rod" | "reel" | "kit";
  flyRod: boolean; beginner: boolean; packedCm: number; lineWeight?: number;
  specs: [string, string][]; blurb: string; why: string;
}

const gear = (g: GearInput): Product => ({
  id: g.id, store: "fishing", name: g.name, byline: g.byline, price: g.price,
  blurb: g.blurb, why: g.why, image: { kind: "glyph", glyph: g.glyph },
  attrs: {
    flyRod: g.flyRod, beginner: g.beginner, packedCm: g.packedCm,
    ...(g.lineWeight !== undefined ? { lineWeight: g.lineWeight } : {}),
  },
  specs: g.specs.map(([label, value]) => ({ label, value })),
});

export const FISHING: Product[] = [
  gear({ id: "f-stillwater-trail", name: "Stillwater Trail 7'6\" 4wt", byline: "4-piece fly rod · medium action", price: 179, glyph: "rod",
    flyRod: true, beginner: true, packedCm: 58, lineWeight: 4,
    specs: [["Length", "7'6\""], ["Line", "4 wt"], ["Pieces", "4"], ["Packed", "58 cm"], ["Weight", "78 g"], ["Action", "Medium"]],
    blurb: "A forgiving medium-action 4 wt that breaks into four and rides in a daypack side pocket. Lifetime warranty.",
    why: "Ticks every box on the water — it just costs more." }),
  gear({ id: "f-headwater", name: "Headwater 7'6\" 3wt", byline: "4-piece fly rod · medium-slow action", price: 189, glyph: "rod",
    flyRod: true, beginner: true, packedCm: 56, lineWeight: 3,
    specs: [["Length", "7'6\""], ["Line", "3 wt"], ["Pieces", "4"], ["Packed", "56 cm"], ["Weight", "72 g"], ["Action", "Med-slow"]],
    blurb: "Delicate 3 wt for tiny brooks. Slow enough to feel every cast load.",
    why: "The most delicate option — lovely on very small water." }),
  gear({ id: "f-brookline", name: "Brookline 7' 4wt", byline: "3-piece fly rod · medium action", price: 129, glyph: "rod",
    flyRod: true, beginner: true, packedCm: 85, lineWeight: 4,
    specs: [["Length", "7'0\""], ["Line", "4 wt"], ["Pieces", "3"], ["Packed", "85 cm"], ["Weight", "80 g"], ["Action", "Medium"]],
    blurb: "Short, light and easy to cast under trees. Three pieces, so it packs longer.",
    why: "Right weight, right price — straps to the outside of a pack." }),
  gear({ id: "f-pocketwater", name: "Pocketwater 6'6\" 3wt", byline: "3-piece fly rod · medium action", price: 139, glyph: "rod",
    flyRod: true, beginner: true, packedCm: 88, lineWeight: 3,
    specs: [["Length", "6'6\""], ["Line", "3 wt"], ["Pieces", "3"], ["Packed", "88 cm"], ["Weight", "70 g"], ["Action", "Medium"]],
    blurb: "A short rod built for overgrown streams where a longer rod can't swing.",
    why: "Brilliant under trees; packs long." }),
  gear({ id: "f-trailhead-kit", name: "Trailhead 8'6\" 5wt Kit", byline: "Rod, reel, line & case", price: 145, glyph: "kit",
    flyRod: true, beginner: true, packedCm: 55, lineWeight: 5,
    specs: [["Length", "8'6\""], ["Line", "5 wt"], ["Pieces", "4"], ["Packed", "55 cm"], ["Weight", "96 g"], ["Includes", "Reel + line"]],
    blurb: "Everything you need in one case: rod, reel, backing and floating line.",
    why: "Complete and packable, but a 5 wt is more than tight streams need." }),
  gear({ id: "f-upstream-pro", name: "Upstream Pro 7'9\" 4wt", byline: "4-piece fly rod · fast action", price: 349, glyph: "rod",
    flyRod: true, beginner: false, packedCm: 62, lineWeight: 4,
    specs: [["Length", "7'9\""], ["Line", "4 wt"], ["Pieces", "4"], ["Packed", "62 cm"], ["Weight", "68 g"], ["Action", "Fast"]],
    blurb: "A precise, fast rod for experienced casters.", why: "Superb — for when you've got a few seasons in." }),
  gear({ id: "f-backcountry-six", name: "Backcountry 7' 3wt Six", byline: "6-piece fly rod · fast action", price: 289, glyph: "rod",
    flyRod: true, beginner: false, packedCm: 42, lineWeight: 3,
    specs: [["Length", "7'0\""], ["Line", "3 wt"], ["Pieces", "6"], ["Packed", "42 cm"], ["Weight", "66 g"], ["Action", "Fast"]],
    blurb: "Six pieces, fits inside a 30 L pack.", why: "Ultra-packable, but stiff for a first rod." }),
  gear({ id: "f-rivermouth", name: "Rivermouth 9' 6wt", byline: "4-piece fly rod · all-rounder", price: 119, glyph: "rod",
    flyRod: true, beginner: true, packedCm: 72, lineWeight: 6,
    specs: [["Length", "9'0\""], ["Line", "6 wt"], ["Pieces", "4"], ["Packed", "72 cm"], ["Weight", "104 g"], ["Action", "Medium"]],
    blurb: "A do-everything rod for bigger rivers and wind.", why: "Great value, built for bigger water." }),
  gear({ id: "f-meadow", name: "Meadow 8'6\" 5wt", byline: "4-piece fly rod · medium action", price: 99, glyph: "rod",
    flyRod: true, beginner: true, packedCm: 69, lineWeight: 5,
    specs: [["Length", "8'6\""], ["Line", "5 wt"], ["Pieces", "4"], ["Packed", "69 cm"], ["Weight", "92 g"], ["Action", "Medium"]],
    blurb: "A friendly first rod for lakes and medium rivers.", why: "Cheap and cheerful." }),
  gear({ id: "f-tarn-kit", name: "Tarn 9' 5wt Starter Kit", byline: "Rod, reel, line & tube", price: 165, glyph: "kit",
    flyRod: true, beginner: true, packedCm: 72, lineWeight: 5,
    specs: [["Length", "9'0\""], ["Line", "5 wt"], ["Pieces", "4"], ["Packed", "72 cm"], ["Weight", "101 g"], ["Includes", "Reel + line"]],
    blurb: "A complete lake-and-river kit.", why: "Everything included, for bigger water." }),
  gear({ id: "f-glacier", name: "Glacier 9' 8wt", byline: "2-piece fly rod · saltwater", price: 199, glyph: "rod",
    flyRod: true, beginner: false, packedCm: 138, lineWeight: 8,
    specs: [["Length", "9'0\""], ["Line", "8 wt"], ["Pieces", "2"], ["Packed", "138 cm"], ["Weight", "128 g"], ["Action", "Fast"]],
    blurb: "Saltwater and big fish.", why: "Wrong tool for streams." }),
  gear({ id: "f-scout-spin", name: "Scout Telescopic Spinning Rod", byline: "Spinning rod · telescopic", price: 49, glyph: "rod",
    flyRod: false, beginner: true, packedCm: 46,
    specs: [["Length", "6'0\""], ["Type", "Spinning"], ["Packed", "46 cm"], ["Weight", "140 g"]],
    blurb: "Collapses to 46 cm. Not a fly rod.", why: "Packable spinning rod." }),
  gear({ id: "f-clearwater-reel", name: "Clearwater 3/4 Fly Reel", byline: "Fly reel · large arbor", price: 69, glyph: "reel",
    flyRod: false, beginner: true, packedCm: 9, lineWeight: 4,
    specs: [["Line", "3–4 wt"], ["Arbor", "Large"], ["Weight", "112 g"], ["Drag", "Click & pawl"]],
    blurb: "Simple, light reel to pair with a 3–4 wt rod.", why: "A perfect partner for a small-stream rod." }),
];
```

`packages/agent/src/catalogs/index.ts`:
```ts
import type { Product, StoreKey } from "../types";
import { BOOKS } from "./books";
import { FISHING } from "./fishing";

export const CATALOGS: Record<StoreKey, Product[]> = { books: BOOKS, fishing: FISHING };

export function getProduct(store: StoreKey, id: string): Product | undefined {
  return CATALOGS[store].find((p) => p.id === id);
}
```

- [ ] **Step 3: Write the failing test**

`packages/agent/test/matcher.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { CATALOGS } from "../src/catalogs";
import { closestPerConstraint, match } from "../src/matcher";
import type { Constraint } from "../src/types";

const c = (x: Omit<Constraint, "status">): Constraint => ({ status: "active", ...x });

describe("match — fishing: nothing matches", () => {
  const constraints = [
    c({ key: "flyRod", label: "Fly rod", attr: "flyRod", op: "eq", value: true, hard: true }),
    c({ key: "beginner", label: "Beginner-friendly", attr: "beginner", op: "eq", value: true, miss: "Built for experienced casters" }),
    c({ key: "packable", label: "Packs ≤ 60 cm", attr: "packedCm", op: "max", value: 60, miss: "Packs to {actual} cm" }),
    c({ key: "budget", label: "Under €150", attr: "price", op: "max", value: 150, miss: "€{over} over budget" }),
    c({ key: "weight", label: "3–4 wt", attr: "lineWeight", op: "max", value: 4, miss: "{actual} wt — heavier than ideal for small streams" }),
  ];

  it("finds no exact match", () => {
    expect(match(CATALOGS.fishing, constraints).matches).toEqual([]);
  });

  it("returns the closest near miss per broken constraint with readable deltas", () => {
    const closest = closestPerConstraint(match(CATALOGS.fishing, constraints).nearMisses);
    expect(closest.map((n) => [n.product.id, n.violation.text])).toEqual([
      ["f-stillwater-trail", "€29 over budget"],
      ["f-trailhead-kit", "5 wt — heavier than ideal for small streams"],
      ["f-brookline", "Packs to 85 cm"],
    ]);
  });

  it("never offers a near miss that breaks a hard constraint", () => {
    const { nearMisses } = match(CATALOGS.fishing, constraints);
    expect(nearMisses.some((n) => n.product.id === "f-clearwater-reel")).toBe(false);
  });

  it("ignores dropped constraints", () => {
    const relaxed = constraints.map((x) => (x.key === "packable" ? { ...x, status: "dropped" as const } : x));
    expect(match(CATALOGS.fishing, relaxed).matches.map((p) => p.id)).toEqual(["f-brookline", "f-pocketwater"]);
  });
});

describe("match — books", () => {
  it("finds three police procedurals that fit", () => {
    const constraints = [
      c({ key: "mystery", label: "Mystery", attr: "genres", op: "includes", value: "mystery", hard: true }),
      c({ key: "procedural", label: "Police procedural", attr: "genres", op: "includes", value: "police-procedural", hard: true }),
      c({ key: "gripping", label: "Gripping", attr: "tags", op: "includes", value: "gripping" }),
      c({ key: "gore", label: "Not too gory", attr: "gore", op: "max", value: 1 }),
      c({ key: "pages", label: "Under 400 pages", attr: "pages", op: "max", value: 400 }),
    ];
    expect(match(CATALOGS.books, constraints).matches.map((p) => p.id)).toEqual([
      "b-harbour-lights", "b-quiet-ledger", "b-north-wind",
    ]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @concierge/agent test matcher`
Expected: FAIL, cannot resolve `../src/matcher`.

- [ ] **Step 5: Implement matcher**

`packages/agent/src/matcher.ts`:
```ts
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

export function violationOf(p: Product, c: Constraint): Violation | null {
  const actual = attrOf(p, c.attr);
  if (satisfies(actual, c)) return null;
  let severity = 1;
  let over = 0;
  if (typeof actual === "number" && (c.op === "max" || c.op === "min")) {
    over = Math.abs(actual - Number(c.value));
    severity = over / Math.max(1, Number(c.value));
  }
  const text = (c.miss ?? `Not ${c.label.toLowerCase()}`)
    .replace("{actual}", actual === undefined ? "–" : String(actual))
    .replace("{limit}", String(c.value))
    .replace("{over}", String(Math.round(over)));
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
```

Append to `packages/agent/src/core.ts`:
```ts
export { CATALOGS, getProduct } from "./catalogs";
export { match, closestPerConstraint } from "./matcher";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @concierge/agent test`
Expected: PASS. If the near-miss order differs, check the severity maths (budget 29/150 = 0.19, weight 1/4 = 0.25, packed 25/60 = 0.42). The expected order is Stillwater, Trailhead, Brookline.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(agent): catalogs and constraint matcher with near-miss ranking

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 4: Conversation engine and the two scripts

**Files:**
- Create: `packages/agent/src/engine/present.ts`, `packages/agent/src/engine/books.ts`, `packages/agent/src/engine/fishing.ts`, `packages/agent/src/engine/index.ts`, `packages/agent/src/engine/engine.ts`
- Modify: `packages/agent/src/core.ts`
- Test: `packages/agent/test/engine.test.ts`

**Interfaces:**
- Consumes: `CATALOGS`, `match`, `closestPerConstraint`, all types.
- Produces:
  - `Script` interface (`present.ts`): `{ store, opening, demoInputs, greetingReplies, route(text, state): string, steps: Record<string, (ctx: Ctx) => TurnOutput> }`
  - `Ctx = { state: ConvState; products: Product[]; text: string; v: (c: VoiceCopy) => string }`
  - `TurnOutput = { messages: AgentDraft[]; replies: Reply[]; constraints?: Constraint[]; step?: string; lastShown?: string[] }`
  - `present(ctx, constraints, copy: { match: VoiceCopy; none: VoiceCopy }, limit = 3): { messages: AgentDraft[]; lastShown: string[]; mode: "match" | "near-miss" | "empty" }`
  - `SCRIPTS: Record<StoreKey, Script>`
  - `initialState(store, voice): ConvState`
  - `send(state, text): ConvState`
  - `removeConstraint(state, key): ConvState`
  - `markAdded(state, productId): ConvState`
  - `submitNotify(state, messageId, email): ConvState`
  - `replay(store, voice, count): ConvState` runs the first `count` demo inputs

All engine functions are pure and return new state. Each `send` or `removeConstraint` increments `turn`. Constraints that are new or changed status get `changedAt = turn`. The UI uses this to animate chips.

- [ ] **Step 1: Write the failing test**

`packages/agent/test/engine.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { initialState, markAdded, removeConstraint, replay, send } from "../src/engine/engine";
import { SCRIPTS } from "../src/engine";
import { CATALOGS } from "../src/catalogs";
import type { ConvState, Message } from "../src/types";

const lastOf = <K extends Message["kind"]>(s: ConvState, kind: K) =>
  [...s.messages].reverse().find((m) => m.kind === kind && m.role === "agent") as Extract<Message, { kind: K }> | undefined;
const active = (s: ConvState) => s.constraints.filter((c) => c.status === "active").map((c) => c.label);

describe("books journey — change of mind", () => {
  let s = initialState("books", "warm");

  it("understands the opening message", () => {
    s = send(s, SCRIPTS.books.opening);
    expect(active(s)).toEqual(["Mystery", "Gripping", "Not too gory", "Under 400 pages", "Not Rankin"]);
    expect(s.replies.map((r) => r.label)).toContain("Police procedural, like Rankin");
  });

  it("shows three procedurals", () => {
    s = send(s, "Police procedural, like Rankin");
    const products = lastOf(s, "products")!;
    expect(products.mode).toBe("match");
    expect(products.items.map((i) => i.productId)).toEqual(["b-harbour-lights", "b-quiet-ledger", "b-north-wind"]);
  });

  it("swaps crime for history and keeps everything else", () => {
    s = send(s, "Actually, he's gone off crime lately — he's been reading a lot of history");
    const change = lastOf(s, "constraint-change")!;
    expect(change.dropped).toEqual(["Mystery", "Not Rankin", "Police procedural"]);
    expect(change.added).toEqual(["History"]);
    expect(change.kept).toEqual(["Gripping", "Not too gory", "Under 400 pages"]);
    const ids = lastOf(s, "products")!.items.map((i) => i.productId);
    expect(ids).toEqual(["b-fire-and-salt", "b-cartographer", "b-last-signal"]);
    for (const id of ids) expect(CATALOGS.books.find((p) => p.id === id)!.attrs.genres).toContain("history");
    const dropped = s.constraints.filter((c) => c.status === "dropped");
    expect(dropped.every((c) => c.changedAt === s.turn)).toBe(true);
  });

  it("compares the first two shown", () => {
    s = send(s, "Compare the first two");
    expect(lastOf(s, "compare")!.productIds).toEqual(["b-fire-and-salt", "b-cartographer"]);
  });

  it("confirms an add to basket", () => {
    s = markAdded(s, "b-fire-and-salt");
    expect(lastOf(s, "added")!.productId).toBe("b-fire-and-salt");
  });
});

describe("fishing journey — nothing matches", () => {
  it("offers honest near misses, then matches when the budget stretches", () => {
    let s = initialState("fishing", "terse");
    s = send(s, SCRIPTS.fishing.opening);
    s = send(s, "Yes, 3–4 weight");
    const nm = lastOf(s, "products")!;
    expect(nm.mode).toBe("near-miss");
    expect(nm.items).toEqual([
      { productId: "f-stillwater-trail", flag: "€29 over budget" },
      { productId: "f-trailhead-kit", flag: "5 wt — heavier than ideal for small streams" },
      { productId: "f-brookline", flag: "Packs to 85 cm" },
    ]);
    s = send(s, "Stretch the budget to €200");
    expect(active(s)).toContain("Under €200");
    const m = lastOf(s, "products")!;
    expect(m.mode).toBe("match");
    expect(m.items.map((i) => i.productId)).toEqual(["f-stillwater-trail", "f-headwater"]);
  });

  it("removing a chip re-runs the matcher", () => {
    let s = replay("fishing", "neutral", 2);
    s = removeConstraint(s, "packable");
    expect(lastOf(s, "products")!.items.map((i) => i.productId)).toEqual(["f-brookline", "f-pocketwater"]);
  });

  it("hard constraints cannot be removed", () => {
    const s = replay("fishing", "neutral", 2);
    expect(removeConstraint(s, "flyRod")).toBe(s);
  });
});

describe("voice and fallback", () => {
  it("uses different copy per voice", () => {
    const warm = send(initialState("fishing", "warm"), SCRIPTS.fishing.opening);
    const terse = send(initialState("fishing", "terse"), SCRIPTS.fishing.opening);
    expect(lastOf(warm, "text")!.text).not.toEqual(lastOf(terse, "text")!.text);
  });

  it("falls back gracefully and keeps the previous suggestions", () => {
    let s = send(initialState("books", "neutral"), SCRIPTS.books.opening);
    const before = s.replies;
    s = send(s, "what's the weather like");
    expect(s.step).toBe("understand");
    expect(s.replies).toEqual(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @concierge/agent test engine`
Expected: FAIL, cannot resolve `../src/engine/engine`.

- [ ] **Step 3: Shared present helper and Script types**

`packages/agent/src/engine/present.ts`:
```ts
import { closestPerConstraint, match } from "../matcher";
import type { AgentDraft, Constraint, ConvState, Product, Reply, StoreKey, VoiceCopy } from "../types";

export interface Ctx { state: ConvState; products: Product[]; text: string; v: (c: VoiceCopy) => string }
export interface TurnOutput { messages: AgentDraft[]; replies: Reply[]; constraints?: Constraint[]; step?: string; lastShown?: string[] }
export interface Script {
  store: StoreKey;
  opening: string;
  demoInputs: string[];
  greetingReplies: Reply[];
  route(text: string, state: ConvState): string;
  steps: Record<string, (ctx: Ctx) => TurnOutput>;
}

const EMPTY: VoiceCopy = {
  warm: "I've looked everywhere and nothing comes close with all of those together. Try removing one of the chips above and I'll look again.",
  neutral: "Nothing comes close with all of those. Remove a chip above to widen the search.",
  terse: "No results. Remove a filter above.",
};

export function present(ctx: Ctx, constraints: Constraint[], copy: { match: VoiceCopy; none: VoiceCopy }, limit = 3) {
  const { matches, nearMisses } = match(ctx.products, constraints);
  if (matches.length) {
    const shown = matches.slice(0, limit);
    return {
      mode: "match" as const,
      lastShown: shown.map((p) => p.id),
      messages: [
        { kind: "text", text: ctx.v(copy.match) },
        { kind: "products", mode: "match", items: shown.map((p) => ({ productId: p.id })) },
      ] as AgentDraft[],
    };
  }
  const closest = closestPerConstraint(nearMisses).slice(0, limit);
  if (!closest.length) {
    return { mode: "empty" as const, lastShown: [], messages: [{ kind: "text", text: ctx.v(EMPTY) }] as AgentDraft[] };
  }
  return {
    mode: "near-miss" as const,
    lastShown: closest.map((n) => n.product.id),
    messages: [
      { kind: "text", text: ctx.v(copy.none) },
      { kind: "products", mode: "near-miss", items: closest.map((n) => ({ productId: n.product.id, flag: n.violation.text })) },
    ] as AgentDraft[],
  };
}

export const c = (x: Omit<Constraint, "status">): Constraint => ({ status: "active", ...x });
export const activeOnly = (cs: Constraint[]) => cs.filter((x) => x.status === "active");
export const drop = (cs: Constraint[], pred: (x: Constraint) => boolean) =>
  cs.map((x) => (x.status === "active" && pred(x) ? { ...x, status: "dropped" as const } : x));
/** Replace a constraint by key (removing any previous one with that key) */
export const upsert = (cs: Constraint[], next: Constraint) => [...cs.filter((x) => x.key !== next.key), next];
```

- [ ] **Step 4: Books script**

`packages/agent/src/engine/books.ts`:
```ts
import { activeOnly, c, drop, present, upsert, type Script } from "./present";
import type { Reply } from "../types";

const OPENING = "Looking for a gripping mystery for my dad. He's read all of Rankin. Nothing too gory, and ideally under 400 pages.";
const CHANGE = "Actually, he's gone off crime lately — he's been reading a lot of history";

const C = {
  mystery: c({ key: "mystery", label: "Mystery", attr: "genres", op: "includes", value: "mystery", hard: true, group: "genre" }),
  gripping: c({ key: "gripping", label: "Gripping", attr: "tags", op: "includes", value: "gripping", miss: "More slow-burn than gripping" }),
  gore: c({ key: "gore", label: "Not too gory", attr: "gore", op: "max", value: 1, miss: "Grittier than you'd like" }),
  pages: c({ key: "pages", label: "Under 400 pages", attr: "pages", op: "max", value: 400, miss: "{actual} pages" }),
  notRankin: c({ key: "notRankin", label: "Not Rankin", attr: "author", op: "excludes", value: "Ian Rankin", hard: true, group: "genre" }),
  procedural: c({ key: "procedural", label: "Police procedural", attr: "genres", op: "includes", value: "police-procedural", hard: true, group: "genre" }),
  historical: c({ key: "historical", label: "Historical", attr: "genres", op: "includes", value: "historical", hard: true, group: "genre" }),
  nordic: c({ key: "nordic", label: "Nordic", attr: "genres", op: "includes", value: "nordic", hard: true, group: "genre" }),
  cosy: c({ key: "cosy", label: "Cosy", attr: "genres", op: "includes", value: "cosy", hard: true, group: "genre" }),
  history: c({ key: "history", label: "History", attr: "genres", op: "includes", value: "history", hard: true, group: "genre" }),
};
const SUBSTYLES = [
  { re: /procedural|like rankin|rankin-?like/, c: C.procedural },
  { re: /historical/, c: C.historical },
  { re: /nordic|scandi/, c: C.nordic },
  { re: /cos[yi]|cozy/, c: C.cosy },
];
const SUBSTYLE_KEYS = new Set(SUBSTYLES.map((s) => s.c.key));

const AFTER_RESULTS: Reply[] = [
  { label: "Compare the first two", text: "Compare the first two" },
  { label: "Actually, he's gone off crime…", text: CHANGE },
  { label: "Something shorter", text: "Something shorter" },
];
const AFTER_HISTORY: Reply[] = [
  { label: "Compare the first two", text: "Compare the first two" },
  { label: "Something shorter", text: "Something shorter" },
];

export const books: Script = {
  store: "books",
  opening: OPENING,
  demoInputs: [OPENING, "Police procedural, like Rankin", CHANGE, "Compare the first two"],
  greetingReplies: [{ label: "“A gripping mystery for my dad…”", text: OPENING }],

  route(text, state) {
    const t = text.toLowerCase();
    if (state.step === "start") return /mystery|crime|book|dad|read|novel/.test(t) ? "understand" : "fallback";
    if (/gone off|changed? (my|his) mind|instead|history|non-?fiction/.test(t)) return "changeMind";
    if (/compare/.test(t)) return "compare";
    if (/shorter|fewer pages|\d+\s*pages/.test(t)) return "pages";
    if (/surprise/.test(t) || SUBSTYLES.some((s) => s.re.test(t))) return "refine";
    return "fallback";
  },

  steps: {
    understand: ({ v }) => ({
      constraints: [C.mystery, C.gripping, C.gore, C.pages, C.notRankin],
      messages: [
        { kind: "text", text: v({
          warm: "Lovely — a gripping mystery, not too gory, under 400 pages, and nothing he's already read from Rankin. I've pinned those up top so you can change them any time.",
          neutral: "Got it: a gripping mystery, not too gory, under 400 pages, and not Rankin. Those are pinned above — tap × to remove one.",
          terse: "Noted: mystery, gripping, low gore, under 400 pages, not Rankin.",
        }) },
        { kind: "text", text: v({
          warm: "One question so I choose well: does he like his mysteries Rankin-style, or would something a little different appeal?",
          neutral: "What kind of mystery does he usually enjoy?",
          terse: "Which style?",
        }) },
      ],
      replies: [
        { label: "Police procedural, like Rankin", text: "Police procedural, like Rankin" },
        { label: "Historical", text: "Historical" },
        { label: "Nordic", text: "Nordic" },
        { label: "Surprise me", text: "Surprise me" },
      ],
    }),

    refine: (ctx) => {
      const t = ctx.text.toLowerCase();
      const chosen = SUBSTYLES.find((s) => s.re.test(t))?.c;
      let constraints = drop(ctx.state.constraints, (x) => SUBSTYLE_KEYS.has(x.key));
      if (chosen) constraints = upsert(constraints, { ...chosen });
      const out = present(ctx, constraints, {
        match: { warm: "Here are the ones I'd happily put in his hands:", neutral: "These fit everything you've told me:", terse: "Matches:" },
        none: { warm: "Nothing in that style ticks every box, but these come close — each misses on just one thing:", neutral: "No exact matches in that style. Closest options:", terse: "No exact match. Closest:" },
      });
      return { constraints, messages: out.messages, lastShown: out.lastShown, replies: AFTER_RESULTS };
    },

    changeMind: (ctx) => {
      const before = activeOnly(ctx.state.constraints);
      const dropped = before.filter((x) => x.group === "genre").map((x) => x.label).sort();
      const constraints = upsert(drop(ctx.state.constraints, (x) => x.group === "genre"), { ...C.history });
      const kept = before.filter((x) => x.group !== "genre").map((x) => x.label);
      const out = present(ctx, constraints, {
        match: { warm: "History that reads like a thriller — the first one bridges both worlds:", neutral: "History titles that fit:", terse: "Matches:" },
        none: { warm: "Nothing fits every box, but these are close:", neutral: "Closest history titles:", terse: "Closest:" },
      });
      return {
        constraints,
        lastShown: out.lastShown,
        replies: AFTER_HISTORY,
        messages: [
          { kind: "text", text: ctx.v({
            warm: "Ah, that changes things — happily. I'll let go of the crime and keep the rest: still gripping, still not gory, still under 400 pages.",
            neutral: "No problem. Swapping crime for history and keeping everything else.",
            terse: "Swapped crime → history. Rest kept.",
          }) },
          { kind: "constraint-change", kept, dropped, added: ["History"] },
          ...out.messages,
        ],
      };
    },

    pages: (ctx) => {
      const current = ctx.state.constraints.find((x) => x.key === "pages");
      const asked = Number(ctx.text.match(/(\d+)\s*pages/)?.[1]);
      const limit = asked || Math.max(200, Number(current?.value ?? 400) - 80);
      const constraints = upsert(ctx.state.constraints, { ...C.pages, value: limit, label: `Under ${limit} pages` });
      const out = present(ctx, constraints, {
        match: { warm: `Keeping it under ${limit} pages:`, neutral: `Under ${limit} pages:`, terse: `≤${limit} pages:` },
        none: { warm: `Nothing quite that short fits — these are the nearest:`, neutral: "Closest options:", terse: "Closest:" },
      });
      return { constraints, messages: out.messages, lastShown: out.lastShown, replies: ctx.state.replies };
    },

    compare: (ctx) => {
      const ids = ctx.state.lastShown.slice(0, 2);
      if (ids.length < 2) {
        return { messages: [{ kind: "text", text: ctx.v({ warm: "There's only one to look at — tap it for the details.", neutral: "Only one option to compare — tap it for details.", terse: "Only one. Tap for details." }) }], replies: ctx.state.replies };
      }
      return {
        messages: [
          { kind: "text", text: ctx.v({ warm: "Side by side — tap “Choose” on the one that feels right:", neutral: "Here's how they compare:", terse: "Comparison:" }) },
          { kind: "compare", productIds: ids },
        ],
        replies: [],
      };
    },

    fallback: (ctx) => ({
      step: ctx.state.step,
      messages: [{ kind: "text", text: ctx.v({
        warm: "I didn't quite catch that — I'm best at narrowing books down by style, length and what he's enjoyed before. Want to try one of these?",
        neutral: "Sorry, I didn't follow. I can narrow by style, length or mood — or pick one of these:",
        terse: "Didn't catch that. Try one of these:",
      }) }],
      replies: ctx.state.replies,
    }),
  },
};
```

- [ ] **Step 5: Fishing script**

`packages/agent/src/engine/fishing.ts`:
```ts
import { c, drop, present, upsert, type Script } from "./present";
import type { Reply } from "../types";

const OPENING = "Need a beginner fly rod for small streams, packs down small enough for hiking, under €150.";

const C = {
  flyRod: c({ key: "flyRod", label: "Fly rod", attr: "flyRod", op: "eq", value: true, hard: true }),
  beginner: c({ key: "beginner", label: "Beginner-friendly", attr: "beginner", op: "eq", value: true, miss: "Built for experienced casters" }),
  packable: c({ key: "packable", label: "Packs ≤ 60 cm", attr: "packedCm", op: "max", value: 60, miss: "Packs to {actual} cm" }),
  budget: c({ key: "budget", label: "Under €150", attr: "price", op: "max", value: 150, miss: "€{over} over budget" }),
  weight: c({ key: "weight", label: "3–4 wt", attr: "lineWeight", op: "max", value: 4, miss: "{actual} wt — heavier than ideal for small streams" }),
};

const NEAR_MISS_REPLIES: Reply[] = [
  { label: "Stretch the budget to €200", text: "Stretch the budget to €200" },
  { label: "Pack size can be bigger", text: "Pack size can be bigger" },
  { label: "Tell me when a match lands", text: "Tell me when a match lands" },
];
const CONFIRM: Reply[] = [
  { label: "Yes, 3–4 weight", text: "Yes, 3–4 weight" },
  { label: "What does weight mean?", text: "What does weight mean?" },
];
const WEIGHT_COPY = {
  match: { warm: "Good news — these tick every box:", neutral: "These match everything:", terse: "Matches:" },
  none: {
    warm: "Honest answer: nothing we stock ticks every box. Here's the closest from each direction — each one misses on just one thing:",
    neutral: "Nothing matches all five. Closest options, each missing one requirement:",
    terse: "No exact match. Closest, one miss each:",
  },
};

export const fishing: Script = {
  store: "fishing",
  opening: OPENING,
  demoInputs: [OPENING, "Yes, 3–4 weight", "Stretch the budget to €200", "Compare the first two"],
  greetingReplies: [{ label: "“Beginner fly rod for small streams…”", text: OPENING }],

  route(text, state) {
    const t = text.toLowerCase();
    if (state.step === "start") return /rod|fly|stream|hik|fish|reel/.test(t) ? "understand" : "fallback";
    if ((state.step === "understand" || state.step === "explain") && /^(yes|yep|sure|ok)|3.?4|sounds good|go with/.test(t)) return "weight";
    if (/what does|explain|not sure|mean/.test(t)) return "explain";
    if (/tell me when|notify|let me know/.test(t)) return "notify";
    if (/stretch|budget|spend more|€\s?\d+|\d+\s?(eur|euro)/.test(t)) return "budget";
    if (/pack size|bigger|longer is fine|doesn'?t (need|have) to pack|relax/.test(t)) return "relaxPack";
    if (/compare/.test(t)) return "compare";
    return "fallback";
  },

  steps: {
    understand: ({ v }) => ({
      constraints: [C.flyRod, C.beginner, C.packable, C.budget],
      messages: [
        { kind: "text", text: v({
          warm: "Nice — a first fly rod you can hike in with. I've pinned what you told me above.",
          neutral: "Got it: beginner fly rod, packs down for hiking, under €150.",
          terse: "Beginner fly rod. Packs ≤ 60 cm. Under €150.",
        }) },
        { kind: "text", text: v({
          warm: "One thing worth knowing: on small streams a light 3–4 weight rod makes casting under trees easier and small trout more fun. Shall I stick to those?",
          neutral: "For small streams, a 3–4 weight is ideal. OK to go with that?",
          terse: "Small streams → 3–4 wt. Go with that?",
        }) },
      ],
      replies: CONFIRM,
    }),

    explain: ({ v }) => ({
      messages: [{ kind: "text", text: v({
        warm: "Rod “weight” is about the line it casts, not how heavy it is. Lighter (3–4) lands softly on small, clear water and bends nicely with small trout; 5–6 is the all-rounder for bigger rivers and wind. For small streams, lighter is kinder.",
        neutral: "Weight refers to the line the rod casts. 3–4 wt suits small streams and small fish; 5–6 wt suits bigger rivers and wind.",
        terse: "Weight = line class. 3–4: small water. 5–6: big rivers, wind.",
      }) }],
      replies: [CONFIRM[0]],
    }),

    weight: (ctx) => {
      const constraints = upsert(ctx.state.constraints, { ...C.weight });
      const out = present(ctx, constraints, WEIGHT_COPY);
      return { constraints, messages: out.messages, lastShown: out.lastShown, replies: out.mode === "near-miss" ? NEAR_MISS_REPLIES : [{ label: "Compare the first two", text: "Compare the first two" }] };
    },

    budget: (ctx) => {
      const limit = Number(ctx.text.match(/(\d{2,4})/)?.[1]) || 200;
      const constraints = upsert(ctx.state.constraints, { ...C.budget, value: limit, label: `Under €${limit}` });
      const out = present(ctx, constraints, {
        match: { warm: `Stretching to €${limit} opens things up:`, neutral: `Under €${limit}:`, terse: `≤ €${limit}:` },
        none: { warm: `Even at €${limit}, nothing ticks every box — closest:`, neutral: "Still no exact match. Closest:", terse: "Closest:" },
      });
      return { constraints, messages: out.messages, lastShown: out.lastShown, replies: out.lastShown.length >= 2 ? [{ label: "Compare the first two", text: "Compare the first two" }] : [] };
    },

    relaxPack: (ctx) => {
      const constraints = drop(ctx.state.constraints, (x) => x.key === "packable");
      const out = present(ctx, constraints, {
        match: { warm: "If it can ride on the outside of your pack, these fit everything else:", neutral: "Without the pack-size limit:", terse: "No pack limit:" },
        none: { warm: "Closest without the pack-size limit:", neutral: "Closest:", terse: "Closest:" },
      });
      return { constraints, messages: out.messages, lastShown: out.lastShown, replies: out.lastShown.length >= 2 ? [{ label: "Compare the first two", text: "Compare the first two" }] : [] };
    },

    notify: ({ v }) => ({
      messages: [
        { kind: "text", text: v({
          warm: "Happy to. Leave your email and I'll let you know the moment a packable 3–4 wt under €150 comes in.",
          neutral: "Leave your email and we'll tell you when a match arrives.",
          terse: "Email me when a match arrives:",
        }) },
        { kind: "notify-form" },
      ],
      replies: [NEAR_MISS_REPLIES[0], NEAR_MISS_REPLIES[1]],
    }),

    compare: (ctx) => {
      const ids = ctx.state.lastShown.slice(0, 2);
      if (ids.length < 2) {
        return { messages: [{ kind: "text", text: ctx.v({ warm: "There's just one here — tap it for the full specs.", neutral: "Only one option — tap it for specs.", terse: "One option. Tap for specs." }) }], replies: ctx.state.replies };
      }
      return {
        messages: [
          { kind: "text", text: ctx.v({ warm: "Here they are side by side:", neutral: "Spec comparison:", terse: "Specs:" }) },
          { kind: "compare", productIds: ids },
        ],
        replies: [],
      };
    },

    fallback: (ctx) => ({
      step: ctx.state.step,
      messages: [{ kind: "text", text: ctx.v({
        warm: "Not sure I followed — I can narrow things down by budget, rod weight or how small it packs. Try one of these:",
        neutral: "I didn't catch that. I can filter by budget, weight or packed length:",
        terse: "Unclear. Options:",
      }) }],
      replies: ctx.state.replies,
    }),
  },
};
```

`packages/agent/src/engine/index.ts`:
```ts
import type { StoreKey } from "../types";
import { books } from "./books";
import { fishing } from "./fishing";
import type { Script } from "./present";

export const SCRIPTS: Record<StoreKey, Script> = { books, fishing };
export type { Script } from "./present";
```

- [ ] **Step 6: Engine**

`packages/agent/src/engine/engine.ts`:
```ts
import { CATALOGS } from "../catalogs";
import type { AgentDraft, Constraint, ConvState, Message, StoreKey, Voice, VoiceCopy } from "../types";
import { SCRIPTS } from "./index";
import { present, type Ctx, type TurnOutput } from "./present";

export function initialState(store: StoreKey, voice: Voice): ConvState {
  return { store, voice, step: "start", turn: 0, seq: 0, constraints: [], messages: [], replies: SCRIPTS[store].greetingReplies, lastShown: [] };
}

type NewMessage = { role: "user"; kind: "text"; text: string } | ({ role: "agent" } & AgentDraft);

function push(s: ConvState, m: NewMessage): ConvState {
  const seq = s.seq + 1;
  return { ...s, seq, messages: [...s.messages, { ...m, id: `m${seq}` } as Message] };
}

function stamp(prev: Constraint[], next: Constraint[], turn: number): Constraint[] {
  return next.map((c) => {
    const p = prev.find((x) => x.key === c.key);
    const changed = !p || p.status !== c.status || p.value !== c.value;
    return changed ? { ...c, changedAt: turn } : { ...c, changedAt: p.changedAt };
  });
}

function ctxFor(s: ConvState, text: string): Ctx {
  return { state: s, products: CATALOGS[s.store], text, v: (c: VoiceCopy) => c[s.voice] };
}

function apply(s: ConvState, out: TurnOutput, step: string): ConvState {
  const turn = s.turn + 1;
  let next: ConvState = {
    ...s,
    turn,
    step: out.step ?? step,
    replies: out.replies,
    lastShown: out.lastShown ?? s.lastShown,
    constraints: out.constraints ? stamp(s.constraints, out.constraints, turn) : s.constraints,
  };
  for (const d of out.messages) next = push(next, { role: "agent", ...d });
  return next;
}

export function send(state: ConvState, text: string): ConvState {
  const script = SCRIPTS[state.store];
  const s = push(state, { role: "user", kind: "text", text });
  const key = script.route(text, s);
  const run = script.steps[key] ?? script.steps.fallback;
  return apply(s, run(ctxFor(s, text)), key);
}

export function removeConstraint(state: ConvState, key: string): ConvState {
  const target = state.constraints.find((x) => x.key === key && x.status === "active");
  if (!target || target.hard) return state;
  const constraints = state.constraints.map((x) => (x.key === key ? { ...x, status: "dropped" as const } : x));
  const ctx = ctxFor(state, "");
  const out = present(ctx, constraints, {
    match: { warm: `Without “${target.label}”, here's what opens up:`, neutral: `Without “${target.label}”:`, terse: `Dropped “${target.label}”:` },
    none: { warm: `Without “${target.label}”, these come closest:`, neutral: "Closest options:", terse: "Closest:" },
  });
  return apply(state, { constraints, messages: out.messages, lastShown: out.lastShown, replies: state.replies }, state.step);
}

export function markAdded(state: ConvState, productId: string): ConvState {
  const v = (c: VoiceCopy) => c[state.voice];
  return apply(state, {
    messages: [
      { kind: "added", productId },
      { kind: "text", text: v({ warm: "Wonderful choice — it's in your basket. Anything else I can help you find?", neutral: "Added to your basket. Anything else?", terse: "In basket." }) },
    ],
    replies: [],
  }, state.step);
}

export function submitNotify(state: ConvState, messageId: string, email: string): ConvState {
  const messages = state.messages.map((m) => (m.id === messageId && m.kind === "notify-form" ? { ...m, done: email } : m));
  const v = (c: VoiceCopy) => c[state.voice];
  return apply({ ...state, messages }, {
    messages: [{ kind: "text", text: v({ warm: `Done — I'll email ${email} as soon as a match lands.`, neutral: `We'll email ${email} when a match arrives.`, terse: `Will notify ${email}.` }) }],
    replies: state.replies,
  }, state.step);
}

export function replay(store: StoreKey, voice: Voice, count: number): ConvState {
  let s = initialState(store, voice);
  for (const input of SCRIPTS[store].demoInputs.slice(0, count)) s = send(s, input);
  return s;
}
```

Append to `packages/agent/src/core.ts`:
```ts
export { SCRIPTS } from "./engine";
export { initialState, send, replay } from "./engine/engine";
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @concierge/agent test`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(agent): scripted conversation engine with books and fishing journeys

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 5: Presets, demo configs and the widget shell

**Files:**
- Create: `packages/agent/src/presets.ts`
- Create: `packages/agent/src/widget/element.tsx`, `App.tsx`, `Header.tsx`, `icons.tsx`, `useCompact.ts`, `cls.ts`, `styles.css`
- Create: `packages/agent/index.html`, `packages/agent/src/harness.ts`
- Modify: `packages/agent/src/loader.ts`, `packages/agent/src/core.ts`
- Test: `packages/agent/test/styles.test.ts`

**Interfaces:**
- Consumes: `deriveTokens`, `varsToCss`, `replay`, `SCRIPTS`, types.
- Produces:
  - `DEMO_CONFIGS: Record<"marginalia" | "riffle", AgentConfig>`, `LAB_CONFIGS: AgentConfig[]` (6 entries), `PRESETS: Record<PresetKey, { label; description; config: Omit<AgentConfig, "id" | "store" | "agent" | "launcher"> }>`, `DEFAULT_CONFIG: AgentConfig`, `googleFontUrl(families: string[]): string`
  - Custom element `<concierge-agent>` (class `ConciergeAgent`). Property `config: AgentConfig`. Observed attributes: `mode="inline"` (renders inside its own box, not fixed to the viewport), `open` (starts open), `autoplay="N"` (replays the first N demo inputs instantly), `highlight="link|btn"` (outlines elements for the fit check).
  - `agent.js`: always defines the element. If its `<script>` has `data-config`, it fetches `${scriptOrigin}/configs/${id}.json` and appends the element to `<body>`.
  - `App` props: `{ config, vars, inline, defaultOpen, autoplay, host, highlight }`. Task 6 fills in the panel body.

- [ ] **Step 1: Presets and demo configs**

`packages/agent/src/presets.ts`:
```ts
import type { AgentConfig } from "./types";

export function googleFontUrl(families: string[]): string {
  const unique = [...new Set(families.filter(Boolean))];
  const q = unique.map((f) => `family=${f.trim().replace(/ /g, "+")}:wght@400;500;600;700`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

export const DEMO_CONFIGS = {
  marginalia: {
    id: "marginalia", store: "books", brand: "#7A2E2E", background: "#F6F1E7", surface: "light",
    font: { family: "inherit", display: "Fraunces", url: googleFontUrl(["Fraunces"]) },
    shape: "soft", density: "airy", voice: "warm", cardStyle: "visual",
    agent: { name: "Ask a bookseller", avatar: "/demo/marginalia-logo.svg", greeting: "Hello! Looking for something to read — or something to give? Tell me a little about who it's for." },
    launcher: { position: "bottom-right", label: "Ask a bookseller" },
  },
  riffle: {
    id: "riffle", store: "fishing", brand: "#FF5A1F", background: "#101214", surface: "dark",
    font: { family: "Barlow", display: "Barlow Condensed", url: googleFontUrl(["Barlow", "Barlow Condensed"]) },
    shape: "square", density: "compact", voice: "terse", cardStyle: "spec",
    agent: { name: "Riffle Guide", avatar: "/demo/riffle-logo.svg", greeting: "Where are you fishing, and what do you need? I'll match the gear." },
    launcher: { position: "bottom-right", label: "Ask a guide" },
  },
} satisfies Record<string, AgentConfig>;

export type PresetKey = "editorial" | "technical" | "playful" | "minimal";
type PresetConfig = Omit<AgentConfig, "id" | "store" | "agent" | "launcher">;

export const PRESETS: Record<PresetKey, { label: string; description: string; config: PresetConfig }> = {
  editorial: { label: "Editorial", description: "Warm paper, serif headings, generous space", config: {
    brand: "#8A3B2E", background: "#F7F2EA", surface: "light", font: { family: "inherit", display: "Fraunces", url: googleFontUrl(["Fraunces"]) },
    shape: "soft", density: "airy", voice: "warm", cardStyle: "visual" } },
  technical: { label: "Technical", description: "High contrast, square, spec-first", config: {
    brand: "#FF5A1F", background: "#111315", surface: "dark", font: { family: "inherit", display: "Barlow Condensed", url: googleFontUrl(["Barlow Condensed"]) },
    shape: "square", density: "compact", voice: "terse", cardStyle: "spec" } },
  playful: { label: "Playful", description: "Bright, rounded, friendly", config: {
    brand: "#6C4CF5", background: "#FFFFFF", surface: "light", font: { family: "inherit", display: "Fredoka", url: googleFontUrl(["Fredoka"]) },
    shape: "soft", density: "regular", voice: "warm", cardStyle: "visual" } },
  minimal: { label: "Minimal", description: "Black and white, quiet, precise", config: {
    brand: "#111111", background: "#FFFFFF", surface: "light", font: { family: "inherit" },
    shape: "rounded", density: "regular", voice: "neutral", cardStyle: "visual" } },
};

export const DEFAULT_CONFIG: AgentConfig = {
  id: "", store: "books", ...PRESETS.minimal.config,
  agent: { name: "Shopping assistant", greeting: "Hi! Tell me what you're looking for and I'll help you find the right thing." },
  launcher: { position: "bottom-right", label: "Need a hand?" },
};

export const LAB_CONFIGS: AgentConfig[] = [
  DEMO_CONFIGS.marginalia,
  DEMO_CONFIGS.riffle,
  { ...DEFAULT_CONFIG, id: "lab-neon", store: "fishing", brand: "#00FF88", background: "#0A0A0A", surface: "dark", font: { family: "inherit", display: "Space Grotesk", url: googleFontUrl(["Space Grotesk"]) }, shape: "rounded", density: "regular", voice: "neutral", cardStyle: "spec", agent: { name: "Neon", greeting: "What are you after?" } },
  { ...DEFAULT_CONFIG, id: "lab-sherbet", store: "books", brand: "#F4C2C2", background: "#FFFFFF", surface: "light", shape: "soft", density: "airy", voice: "warm", cardStyle: "visual", agent: { name: "Sherbet", greeting: "Hello, lovely! What are we reading?" } },
  { ...DEFAULT_CONFIG, id: "lab-mono", store: "fishing", brand: "#111111", background: "#FFFFFF", surface: "light", shape: "square", density: "compact", voice: "terse", cardStyle: "spec", agent: { name: "Mono", greeting: "Specs first. What do you need?" } },
  { ...DEFAULT_CONFIG, id: "lab-hotpink", store: "books", brand: "#FF1493", background: "#FFF5FA", surface: "light", font: { family: "inherit", display: "Playfair Display", url: googleFontUrl(["Playfair Display"]) }, shape: "square", density: "airy", voice: "warm", cardStyle: "visual", agent: { name: "Pink Pages", greeting: "Darling. What shall we read?" } },
];
```

Append to `packages/agent/src/core.ts`:
```ts
export { DEMO_CONFIGS, LAB_CONFIGS, PRESETS, DEFAULT_CONFIG, googleFontUrl, type PresetKey } from "./presets";
```

- [ ] **Step 2: Write the failing literal-colour test**

`packages/agent/test/styles.test.ts`:
```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("widget styles", () => {
  it("uses tokens for every colour — no literal colours", () => {
    const css = readFileSync(new URL("../src/widget/styles.css", import.meta.url), "utf8");
    const literals = css.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/g);
    expect(literals).toBeNull();
  });
});
```

Run: `pnpm --filter @concierge/agent test styles`
Expected: FAIL (ENOENT, the file doesn't exist yet).

- [ ] **Step 3: Base styles**

`packages/agent/src/widget/styles.css` (Tasks 6 and 7 append to this file):
```css
:host { font-family: var(--font-body, inherit); }
:host([mode="inline"]) { display: block; position: relative; width: 100%; height: 100%; overflow: hidden; pointer-events: none; }
*, *::before, *::after { box-sizing: border-box; }
button, input, textarea { font: inherit; color: inherit; }
button { -webkit-tap-highlight-color: transparent; }

/* Reset everything a host page can leak in through inheritance */
.root {
  color: var(--c-text); font-size: var(--fs-md); line-height: var(--lh);
  letter-spacing: normal; word-spacing: normal; text-transform: none; text-align: left;
  font-weight: 400; font-style: normal; text-indent: 0; white-space: normal;
  -webkit-font-smoothing: antialiased;
}
.launcher, .panel { pointer-events: auto; }

/* Launcher */
.launcher {
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
  display: inline-flex; align-items: center; gap: var(--s-2);
  min-height: 52px; padding: 6px var(--s-4) 6px 6px;
  border: 1px solid var(--c-brand-edge); border-radius: var(--r-btn);
  background: var(--c-brand); color: var(--c-on-brand);
  box-shadow: var(--shadow); cursor: pointer;
  font-weight: 600; font-size: var(--fs-md);
  transition: transform 160ms ease, background 160ms ease;
}
.launcher:hover { background: var(--c-brand-hover); transform: translateY(-1px); }
.launcher.is-open { padding: 6px; }
.left .launcher, .left .panel { right: auto; left: 20px; }
.inline .launcher, .inline .panel { position: absolute; }

.avatar {
  width: 40px; height: 40px; flex: none; border-radius: 50%; overflow: hidden;
  display: grid; place-items: center;
  background: var(--c-bg); color: var(--c-text);
  font-family: var(--font-display, inherit); font-weight: 700; font-size: var(--fs-sm);
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-sm { width: 26px; height: 26px; font-size: var(--fs-xs); background: var(--c-brand-soft); color: var(--c-on-brand-soft); }

/* Panel */
.panel {
  position: fixed; right: 20px; bottom: 86px; z-index: 2147483000;
  width: min(400px, calc(100vw - 40px)); height: min(680px, calc(100vh - 116px));
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--c-bg); border: 1px solid var(--c-border); border-radius: var(--r-lg);
  box-shadow: var(--shadow);
  animation: panel-in 240ms cubic-bezier(.2,.8,.2,1);
}
.inline .panel { width: min(400px, calc(100% - 40px)); height: min(680px, calc(100% - 116px)); }
.compact .panel { inset: 0; width: 100%; height: 100%; border: 0; border-radius: 0; }
.page.compact .panel { position: fixed; height: 100dvh; }
@keyframes panel-in { from { opacity: 0; transform: translateY(12px) scale(.98); } }

/* Header */
.header { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4); border-bottom: 1px solid var(--c-border); }
.header .avatar { width: 36px; height: 36px; background: var(--c-brand-soft); color: var(--c-on-brand-soft); }
.header-text { flex: 1; min-width: 0; }
.title { margin: 0; font-family: var(--font-display, inherit); font-weight: var(--display-weight); font-size: var(--fs-lg); line-height: 1.2; }
.subtitle { margin: 0; color: var(--c-muted); font-size: var(--fs-xs); }
.icon-btn { width: 40px; height: 40px; flex: none; display: grid; place-items: center; border: 0; border-radius: var(--r-sm); background: transparent; color: var(--c-muted); cursor: pointer; }
.icon-btn:hover { background: var(--c-surface); color: var(--c-text); }

.body { flex: 1; min-height: 0; display: flex; flex-direction: column; position: relative; }

:focus-visible { outline: 2px solid var(--c-focus); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 4: Widget helpers**

`packages/agent/src/widget/cls.ts`:
```ts
export const cls = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
```

`packages/agent/src/widget/icons.tsx`:
```tsx
const svg = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" } as const;

export const CloseIcon = () => <svg {...svg}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const SendIcon = () => <svg {...svg}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const BackIcon = () => <svg {...svg}><path d="M15 6l-6 6 6 6" /></svg>;
export const CheckIcon = () => <svg {...svg}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const FlagIcon = () => <svg {...svg} width={16} height={16}><path d="M12 8v5M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></svg>;
export const ChatIcon = () => <svg {...svg}><path d="M4 5h16v11H9l-5 4z" /></svg>;
```

`packages/agent/src/widget/useCompact.ts`:
```ts
import { useEffect, useState } from "preact/hooks";

export function useCompact(host: HTMLElement, inline: boolean): boolean {
  const measure = () => (inline ? host.getBoundingClientRect().width : window.innerWidth) <= 480;
  const [compact, setCompact] = useState(measure);
  useEffect(() => {
    const update = () => setCompact(measure());
    update();
    if (inline) {
      const ro = new ResizeObserver(update);
      ro.observe(host);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [host, inline]);
  return compact;
}
```

- [ ] **Step 5: Header, App shell, element**

`packages/agent/src/widget/Header.tsx`:
```tsx
import type { AgentConfig } from "../types";
import { CloseIcon } from "./icons";

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

export function Avatar({ config, small }: { config: AgentConfig; small?: boolean }) {
  return (
    <span class={small ? "avatar avatar-sm" : "avatar"} aria-hidden="true">
      {config.agent.avatar ? <img src={config.agent.avatar} alt="" /> : initials(config.agent.name)}
    </span>
  );
}

export function Header({ config, onClose }: { config: AgentConfig; onClose: () => void }) {
  return (
    <div class="header">
      <Avatar config={config} />
      <div class="header-text">
        <p class="title">{config.agent.name}</p>
        <p class="subtitle">Shopping assistant · replies instantly</p>
      </div>
      <button type="button" class="icon-btn" aria-label="Close assistant" onClick={onClose}><CloseIcon /></button>
    </div>
  );
}
```

`packages/agent/src/widget/App.tsx` (shell; Task 6 replaces the `.body` contents):
```tsx
import { useEffect, useState } from "preact/hooks";
import { replay } from "../engine/engine";
import { varsToCss } from "../tokens";
import type { AgentConfig } from "../types";
import styles from "./styles.css?inline";
import { cls } from "./cls";
import { Avatar, Header } from "./Header";
import { CloseIcon } from "./icons";
import { useCompact } from "./useCompact";

export interface AppProps {
  config: AgentConfig;
  vars: Record<string, string>;
  inline: boolean;
  defaultOpen: boolean;
  autoplay: number;
  host: HTMLElement;
  highlight: string | null;
}

export function App({ config, vars, inline, defaultOpen, autoplay, host, highlight }: AppProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [conv] = useState(() => replay(config.store, config.voice, autoplay));
  const compact = useCompact(host, inline);

  // Lock host page scroll while the full-screen sheet is open on a phone
  useEffect(() => {
    if (inline || !(open && compact)) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prev; };
  }, [open, compact, inline]);

  return (
    <>
      <style>{styles}</style>
      <style>{varsToCss(vars)}</style>
      <div class={cls("root", inline ? "inline" : "page", compact && "compact", config.launcher.position === "bottom-left" && "left", highlight && `hl-${highlight}`)}>
        {!(open && compact) && (
          <button type="button" class={cls("launcher t-btn", open && "is-open")} aria-expanded={open} onClick={() => setOpen(!open)}
            aria-label={open ? "Close assistant" : config.launcher.label ?? config.agent.name}>
            {open ? <span class="avatar"><CloseIcon /></span> : <><Avatar config={config} /><span>{config.launcher.label ?? config.agent.name}</span></>}
          </button>
        )}
        {open && (
          <div class="panel" role="dialog" aria-label={config.agent.name}>
            <Header config={config} onClose={() => setOpen(false)} />
            <div class="body">{/* Task 6 */}<p style="padding:16px">{conv.messages.length} messages</p></div>
          </div>
        )}
      </div>
    </>
  );
}
```

`packages/agent/src/widget/element.tsx`:
```tsx
import { render } from "preact";
import { deriveTokens } from "../tokens";
import type { AgentConfig } from "../types";
import { App } from "./App";

function loadFont(url?: string) {
  if (!url || document.querySelector(`link[data-concierge-font="${CSS.escape(url)}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  link.dataset.conciergeFont = url;
  document.head.appendChild(link);
}

export class ConciergeAgent extends HTMLElement {
  static observedAttributes = ["mode", "open", "autoplay", "highlight"];
  private root: ShadowRoot;
  private _config?: AgentConfig;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  set config(c: AgentConfig) { this._config = c; this.update(); }
  get config(): AgentConfig | undefined { return this._config; }

  connectedCallback() { this.update(); }
  attributeChangedCallback() { this.update(); }
  disconnectedCallback() { render(null, this.root); }

  private update() {
    const config = this._config;
    if (!config || !this.isConnected) return;
    loadFont(config.font.url);
    const autoplay = Number(this.getAttribute("autoplay") ?? 0);
    render(
      <App
        key={`${config.store}|${config.voice}|${autoplay}|${this.hasAttribute("open")}`}
        config={config}
        vars={deriveTokens(config).vars}
        inline={this.getAttribute("mode") === "inline"}
        defaultOpen={this.hasAttribute("open")}
        autoplay={autoplay}
        host={this}
        highlight={this.getAttribute("highlight")}
      />,
      this.root,
    );
  }
}

export function defineConciergeAgent() {
  if (!customElements.get("concierge-agent")) customElements.define("concierge-agent", ConciergeAgent);
}
```

`packages/agent/src/loader.ts`:
```ts
import { ConciergeAgent, defineConciergeAgent } from "./widget/element";
import type { AgentConfig } from "./types";

defineConciergeAgent();

const script =
  (document.currentScript as HTMLScriptElement | null) ??
  document.querySelector<HTMLScriptElement>('script[src*="agent.js"][data-config]');
const id = script?.dataset.config;

if (script && id) {
  const origin = new URL(script.src, location.href).origin;
  fetch(`${origin}/configs/${encodeURIComponent(id)}.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`[concierge] config "${id}" not found (${r.status})`);
      return r.json() as Promise<AgentConfig>;
    })
    .then((config) => {
      // Relative avatar paths are relative to the Concierge host, not the merchant's site
      if (config.agent.avatar?.startsWith("/")) config.agent.avatar = origin + config.agent.avatar;
      const el = document.createElement("concierge-agent") as ConciergeAgent;
      el.config = config;
      document.body.appendChild(el);
    })
    .catch((err) => console.warn(err));
}
```

- [ ] **Step 6: Dev harness**

`packages/agent/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Concierge harness</title>
    <style>
      body { margin: 0; font-family: Georgia, serif; background: #ddd; }
      .grid { display: flex; flex-wrap: wrap; gap: 16px; padding: 16px; }
      .cell { width: 440px; height: 720px; background: #fff; border: 1px solid #bbb; }
      .cell.narrow { width: 375px; }
    </style>
  </head>
  <body>
    <div class="grid" id="grid"></div>
    <script type="module" src="/src/harness.ts"></script>
  </body>
</html>
```

`packages/agent/src/harness.ts`:
```ts
import { DEMO_CONFIGS, LAB_CONFIGS } from "./presets";
import { defineConciergeAgent, type ConciergeAgent } from "./widget/element";

defineConciergeAgent();
const grid = document.getElementById("grid")!;
const autoplay = new URLSearchParams(location.search).get("autoplay") ?? "2";
const configs = new URLSearchParams(location.search).has("lab") ? LAB_CONFIGS : Object.values(DEMO_CONFIGS);

for (const config of configs) {
  for (const narrow of [false, true]) {
    const cell = document.createElement("div");
    cell.className = narrow ? "cell narrow" : "cell";
    cell.style.background = config.background ?? "#fff";
    const el = document.createElement("concierge-agent") as ConciergeAgent;
    el.setAttribute("mode", "inline");
    el.setAttribute("open", "");
    el.setAttribute("autoplay", autoplay);
    el.config = { ...config, agent: { ...config.agent, avatar: undefined } };
    cell.appendChild(el);
    grid.appendChild(cell);
  }
}
```

- [ ] **Step 7: Verify**

Run: `pnpm --filter @concierge/agent test && pnpm --filter @concierge/agent typecheck && pnpm --filter @concierge/agent build`
Expected: tests PASS (including the literal-colour check), no type errors, and `apps/platform/public/agent.js` written (under about 60 kB).

Run: `pnpm --filter @concierge/agent harness` and open the printed URL.
Expected: four cells (Marginalia and Riffle, each at 440px and 375px), with panels open and themed. The 375px cells show the full-bleed compact sheet. Marginalia is cream with serif headings and soft corners. Riffle is near-black with an orange header avatar and square corners. The launcher toggles the panel.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(agent): <concierge-agent> web component shell, loader and presets

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 6: Conversation UI (messages, reveal, constraint strip, replies, composer)

**Files:**
- Create: `packages/agent/src/widget/MessageList.tsx`, `ConstraintStrip.tsx`, `Composer.tsx`, `packages/agent/src/widget/ProductCard.tsx` (a stub that Task 7 replaces)
- Modify: `packages/agent/src/widget/App.tsx`, `packages/agent/src/widget/styles.css` (append)

**Interfaces:**
- Consumes: `send`, `removeConstraint`, `replay`, `SCRIPTS`, `getProduct`.
- Produces:
  - `MessageList` props: `{ config, messages: Message[], visible: number, typing: boolean, compact: boolean, onOpen(id), onChoose(id), onNotify(messageId, email) }`
  - `ProductList` props (from `ProductCard.tsx`): `{ config: AgentConfig; items: { productId: string; flag?: string }[]; mode: "match" | "near-miss"; onOpen(id: string): void }`. Task 7 keeps this exact signature.
  - `Compare`, `NotifyForm`, `AddedNote` are referenced from `ProductCard.tsx` in the stub so `MessageList` compiles. Task 7 moves them into their own files and updates the imports.

Reveal behaviour: the engine returns every message at once. The UI shows them one at a time. User messages appear instantly. Each agent message waits behind a typing indicator for 450–1300 ms (by text length; 500 ms for rich messages). Text reveals word by word with CSS `animation-delay` (no timers). With `prefers-reduced-motion`, or for messages that were already there when the widget mounted (autoplay), everything shows immediately.

- [ ] **Step 1: Stub ProductCard.tsx (replaced in Task 7)**

`packages/agent/src/widget/ProductCard.tsx`:
```tsx
import { getProduct } from "../catalogs";
import type { AgentConfig } from "../types";

export function ProductList({ config, items, onOpen }: { config: AgentConfig; items: { productId: string; flag?: string }[]; mode: "match" | "near-miss"; onOpen: (id: string) => void }) {
  return <ul>{items.map((i) => <li key={i.productId}><button type="button" onClick={() => onOpen(i.productId)}>{getProduct(config.store, i.productId)?.name}</button> {i.flag}</li>)}</ul>;
}
export function Compare({ productIds }: { config: AgentConfig; productIds: string[]; compact: boolean; onChoose: (id: string) => void }) {
  return <p>Compare: {productIds.join(" vs ")}</p>;
}
export function NotifyForm({ done }: { done?: string; onSubmit: (email: string) => void }) {
  return <p>{done ?? "notify form"}</p>;
}
export function AddedNote({ productId }: { config: AgentConfig; productId: string }) {
  return <p>Added {productId}</p>;
}
```

- [ ] **Step 2: MessageList**

`packages/agent/src/widget/MessageList.tsx`:
```tsx
import { useEffect, useRef } from "preact/hooks";
import type { AgentConfig, Message } from "../types";
import { Avatar } from "./Header";
import { AddedNote, Compare, NotifyForm, ProductList } from "./ProductCard";

interface Props {
  config: AgentConfig;
  messages: Message[];
  visible: number;
  typing: boolean;
  compact: boolean;
  animateFrom: number;
  onOpen: (id: string) => void;
  onChoose: (id: string) => void;
  onNotify: (messageId: string, email: string) => void;
}

function Words({ text, animate }: { text: string; animate: boolean }) {
  if (!animate) return <>{text}</>;
  return <>{text.split(/(\s+)/).map((w, i) => (/\s+/.test(w) ? w : <span class="word" style={{ animationDelay: `${i * 14}ms` }}>{w}</span>))}</>;
}

export function MessageList({ config, messages, visible, typing, compact, animateFrom, onOpen, onChoose, onNotify }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [visible, typing]);

  const shown = messages.slice(0, visible);
  return (
    <div class="messages" ref={ref} aria-live="polite">
      <div class="msg msg-agent">
        <Avatar config={config} small />
        <p>{config.agent.greeting}</p>
      </div>
      {shown.map((m, i) => {
        const animate = i >= animateFrom;
        if (m.role === "user") return <div key={m.id} class="msg msg-user">{m.text}</div>;
        switch (m.kind) {
          case "text":
            return (
              <div key={m.id} class="msg msg-agent">
                <Avatar config={config} small />
                <p><Words text={m.text} animate={animate} /></p>
              </div>
            );
          case "products":
            return <div key={m.id} class="msg msg-rich"><ProductList config={config} items={m.items} mode={m.mode} onOpen={onOpen} /></div>;
          case "constraint-change":
            return (
              <div key={m.id} class="msg msg-rich change" role="group" aria-label="What changed">
                {m.dropped.length > 0 && <div class="change-row"><span class="change-label">Dropped</span>{m.dropped.map((l) => <span class="tag tag-dropped">{l}</span>)}</div>}
                {m.added.length > 0 && <div class="change-row"><span class="change-label">Added</span>{m.added.map((l) => <span class="tag tag-added">{l}</span>)}</div>}
                {m.kept.length > 0 && <div class="change-row"><span class="change-label">Kept</span>{m.kept.map((l) => <span class="tag">{l}</span>)}</div>}
              </div>
            );
          case "compare":
            return <div key={m.id} class="msg msg-rich"><Compare config={config} productIds={m.productIds} compact={compact} onChoose={onChoose} /></div>;
          case "notify-form":
            return <div key={m.id} class="msg msg-rich"><NotifyForm done={m.done} onSubmit={(email) => onNotify(m.id, email)} /></div>;
          case "added":
            return <div key={m.id} class="msg msg-rich"><AddedNote config={config} productId={m.productId} /></div>;
        }
      })}
      {typing && (
        <div class="msg msg-agent" aria-label="Typing">
          <Avatar config={config} small />
          <span class="typing"><span /><span /><span /></span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: ConstraintStrip**

`packages/agent/src/widget/ConstraintStrip.tsx`:
```tsx
import type { Constraint } from "../types";
import { cls } from "./cls";
import { CloseIcon } from "./icons";

export function ConstraintStrip({ constraints, turn, onRemove }: { constraints: Constraint[]; turn: number; onRemove: (key: string) => void }) {
  const shown = constraints.filter((c) => c.status === "active" || c.changedAt === turn);
  if (!shown.length) return null;
  return (
    <div class="strip" role="list" aria-label="What you're looking for">
      <span class="strip-label">Looking for</span>
      {shown.map((c) => {
        const dropped = c.status === "dropped";
        return (
          <span role="listitem" key={c.key} class={cls("chip", dropped && "is-dropped", !dropped && c.changedAt === turn && "is-new")}>
            {c.label}
            {!dropped && !c.hard && (
              <button type="button" aria-label={`Remove “${c.label}”`} onClick={() => onRemove(c.key)}><CloseIcon /></button>
            )}
          </span>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Composer**

`packages/agent/src/widget/Composer.tsx`:
```tsx
import { useState } from "preact/hooks";
import type { Reply } from "../types";
import { SendIcon } from "./icons";

export function Composer({ replies, busy, placeholder, onSend }: { replies: Reply[]; busy: boolean; placeholder: string; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const submit = (e: Event) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    onSend(t);
    setText("");
  };
  return (
    <div class="composer-wrap">
      {!busy && replies.length > 0 && (
        <div class="replies" role="group" aria-label="Suggested replies">
          {replies.map((r) => (
            <button type="button" key={r.text} class="reply t-link" title={r.text} onClick={() => onSend(r.text)}>{r.label}</button>
          ))}
        </div>
      )}
      <form class="composer" onSubmit={submit}>
        <input value={text} onInput={(e) => setText(e.currentTarget.value)} placeholder={placeholder} aria-label="Message" enterKeyHint="send" autoComplete="off" />
        <button class="send t-btn" type="submit" aria-label="Send" disabled={busy || !text.trim()}><SendIcon /></button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Wire App**

In `packages/agent/src/widget/App.tsx`, replace the `useState(() => replay(...))` line and the `.body` placeholder so the component reads:

```tsx
import { useEffect, useState } from "preact/hooks";
import { getProduct } from "../catalogs";
import { markAdded, removeConstraint, replay, send, submitNotify } from "../engine/engine";
import { varsToCss } from "../tokens";
import type { AgentConfig } from "../types";
import styles from "./styles.css?inline";
import { cls } from "./cls";
import { Composer } from "./Composer";
import { ConstraintStrip } from "./ConstraintStrip";
import { Avatar, Header } from "./Header";
import { CloseIcon } from "./icons";
import { MessageList } from "./MessageList";
import { useCompact } from "./useCompact";

// AppProps unchanged

const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function App({ config, vars, inline, defaultOpen, autoplay, host, highlight }: AppProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [conv, setConv] = useState(() => replay(config.store, config.voice, autoplay));
  const [initialCount] = useState(conv.messages.length);
  const [visible, setVisible] = useState(conv.messages.length);
  const [detail, setDetail] = useState<string | null>(null);
  const compact = useCompact(host, inline);
  const typing = visible < conv.messages.length && conv.messages[visible]?.role === "agent";

  // Reveal queued messages one by one
  useEffect(() => {
    if (visible >= conv.messages.length) return;
    const next = conv.messages[visible]!;
    if (next.role === "user" || reducedMotion()) { setVisible(visible + 1); return; }
    const delay = next.kind === "text" ? 450 + Math.min(850, next.text.length * 8) : 500;
    const t = setTimeout(() => setVisible((v) => v + 1), delay);
    return () => clearTimeout(t);
  }, [visible, conv.messages.length]);

  // (scroll-lock effect unchanged)

  const say = (text: string) => setConv((s) => send(s, text));
  const busy = visible < conv.messages.length;
  const placeholder = conv.messages.length === 0 ? "Tell me what you're looking for…" : "Reply or ask something else…";

  return (
    <>
      <style>{styles}</style>
      <style>{varsToCss(vars)}</style>
      <div class={cls("root", inline ? "inline" : "page", compact && "compact", config.launcher.position === "bottom-left" && "left", highlight && `hl-${highlight}`)}>
        {/* launcher unchanged */}
        {open && (
          <div class="panel" role="dialog" aria-label={config.agent.name}>
            <Header config={config} onClose={() => setOpen(false)} />
            <div class="body">
              <ConstraintStrip constraints={conv.constraints} turn={conv.turn} onRemove={(key) => setConv((s) => removeConstraint(s, key))} />
              <MessageList
                config={config}
                messages={conv.messages}
                visible={visible}
                typing={typing}
                compact={compact}
                animateFrom={initialCount}
                onOpen={setDetail}
                onChoose={setDetail}
                onNotify={(id, email) => setConv((s) => submitNotify(s, id, email))}
              />
              <Composer replies={conv.replies} busy={busy} placeholder={placeholder} onSend={say} />
              {/* Task 7: DetailSheet when `detail` is set; uses getProduct, markAdded */}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
```

Keep the launcher JSX and scroll-lock effect from Task 5 exactly as they were. `getProduct`, `markAdded` and `detail` are unused until Task 7. That's fine, but if the typecheck complains about unused imports, remove them and add them back in Task 7.

- [ ] **Step 6: Append styles**

Append to `packages/agent/src/widget/styles.css`:
```css
/* Constraint strip */
.strip {
  display: flex; align-items: center; gap: var(--s-2);
  padding: var(--s-2) var(--s-4); overflow-x: auto; scrollbar-width: none;
  background: var(--c-surface); border-bottom: 1px solid var(--c-border);
}
.strip::-webkit-scrollbar { display: none; }
.strip-label { flex: none; font-size: var(--fs-xs); color: var(--c-muted); white-space: nowrap; }
.chip {
  flex: none; display: inline-flex; align-items: center; gap: 2px;
  min-height: 28px; padding: 2px 4px 2px var(--s-3);
  border: 1px solid transparent; border-radius: var(--r-btn);
  background: var(--c-brand-soft); color: var(--c-on-brand-soft);
  font-size: var(--fs-sm); white-space: nowrap;
}
.chip:not(:has(button)) { padding-right: var(--s-3); }
.chip button {
  width: 24px; height: 24px; display: grid; place-items: center;
  border: 0; border-radius: 50%; background: transparent; color: inherit; cursor: pointer; opacity: .75;
}
.chip button svg { width: 14px; height: 14px; }
.chip button:hover { opacity: 1; background: var(--c-bg); }
.chip.is-new { animation: chip-in 420ms cubic-bezier(.2,.8,.2,1) both; }
.chip.is-dropped {
  background: transparent; border-color: var(--c-border); color: var(--c-muted);
  text-decoration: line-through; animation: chip-out 700ms ease both;
}
@keyframes chip-in { from { opacity: 0; transform: scale(.8); } }
@keyframes chip-out { from { opacity: 1; } to { opacity: .6; } }

/* Messages */
.messages {
  flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  display: flex; flex-direction: column; gap: var(--s-4); padding: var(--s-4);
}
.msg { animation: msg-in 260ms ease both; }
@keyframes msg-in { from { opacity: 0; transform: translateY(6px); } }
.msg-agent { display: flex; align-items: flex-start; gap: var(--s-2); }
.msg-agent p { margin: 2px 0 0; max-width: 36em; }
.msg-user {
  align-self: flex-end; max-width: 85%;
  padding: var(--s-2) var(--s-3);
  background: var(--c-brand); color: var(--c-on-brand);
  border-radius: var(--r-md) var(--r-md) var(--r-sm) var(--r-md);
}
.msg-rich { margin-left: calc(26px + var(--s-2)); }
.compact .msg-rich { margin-left: 0; }
.word { animation: word-in 280ms ease both; }
@keyframes word-in { from { opacity: 0; } }
.typing { display: inline-flex; gap: 4px; padding: 10px 0; }
.typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--c-muted); animation: blink 1s infinite both; }
.typing span:nth-child(2) { animation-delay: .15s; }
.typing span:nth-child(3) { animation-delay: .3s; }
@keyframes blink { 0%, 80%, 100% { opacity: .25; } 40% { opacity: 1; } }

/* What changed */
.change { display: grid; gap: var(--s-2); padding: var(--s-3); border: 1px solid var(--c-border); border-radius: var(--r-md); font-size: var(--fs-sm); }
.change-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.change-label { width: 4.5em; color: var(--c-muted); font-size: var(--fs-xs); }
.tag { padding: 2px var(--s-2); border-radius: var(--r-btn); background: var(--c-surface); }
.tag-dropped { color: var(--c-muted); text-decoration: line-through; }
.tag-added { background: var(--c-brand-soft); color: var(--c-on-brand-soft); animation: chip-in 420ms cubic-bezier(.2,.8,.2,1) both; }

/* Replies + composer */
.composer-wrap { border-top: 1px solid var(--c-border); background: var(--c-bg); }
.replies { display: flex; flex-wrap: wrap; gap: var(--s-2); padding: var(--s-3) var(--s-4) 0; }
.reply {
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  min-height: 34px; padding: 0 var(--s-3);
  border: 1px solid var(--c-border); border-radius: var(--r-btn);
  background: var(--c-bg); color: var(--c-link); cursor: pointer;
  font-size: var(--fs-sm); font-weight: 600;
}
.reply:hover { background: var(--c-brand-soft); color: var(--c-on-brand-soft); border-color: transparent; }
.composer { display: flex; gap: var(--s-2); padding: var(--s-3) var(--s-4); }
.compact .composer { padding-bottom: calc(var(--s-3) + env(safe-area-inset-bottom)); }
.composer input {
  flex: 1; min-width: 0; min-height: 44px; padding: 0 var(--s-3);
  border: 1px solid var(--c-border); border-radius: var(--r-btn);
  background: var(--c-surface); font-size: max(16px, var(--fs-md));
}
.composer input::placeholder { color: var(--c-muted); }
.send {
  width: 44px; height: 44px; flex: none; display: grid; place-items: center;
  border: 1px solid var(--c-brand-edge); border-radius: var(--r-btn);
  background: var(--c-brand); color: var(--c-on-brand); cursor: pointer;
}
.send:disabled { opacity: .45; cursor: default; }
```

- [ ] **Step 7: Verify**

Run: `pnpm --filter @concierge/agent test && pnpm --filter @concierge/agent typecheck`
Expected: PASS.

Run the harness with `?autoplay=0`. In the Marginalia cell, tap the suggested opening chip. Expected: the user bubble appears, then a typing indicator, then two agent lines that fade in word by word, then chips pinned in the strip. Tap "Police procedural…", then the "Actually, he's gone off crime…" chip. Expected: `Mystery`, `Not Rankin` and `Police procedural` appear struck through and faded, `History` pops in, and the Kept/Dropped/Added card appears. Removing a soft chip with × re-runs the search. Try the Riffle cell: the flow reaches three near misses (still stub list items). Type gibberish: the fallback message keeps the previous chips.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(agent): conversation UI with staged reveal, constraint strip and replies

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 7: Product UI (cards, near-miss flags, compare, detail sheet, add to basket, notify)

**Files:**
- Modify: `packages/agent/src/widget/ProductCard.tsx` (full replacement)
- Create: `packages/agent/src/widget/Compare.tsx`, `DetailSheet.tsx`, `NotifyForm.tsx`
- Modify: `packages/agent/src/widget/MessageList.tsx` (imports), `App.tsx` (detail sheet + add to basket), `styles.css` (append)

**Interfaces:**
- Consumes: `getProduct`, `markAdded`, the `ProductList` signature from Task 6.
- Produces:
  - `ProductList`, `ProductCard`, `ProductImageView` (from `ProductCard.tsx`); `Compare` (from `Compare.tsx`); `DetailSheet` (props `{ config, product, onBack, onAdd(opts: { giftWrap: boolean }) }`); `NotifyForm`, `AddedNote` (from `NotifyForm.tsx`)
  - DOM event: `window.dispatchEvent(new CustomEvent("concierge:add-to-cart", { detail: { productId, name, price, qty: 1, options: { giftWrap } } }))`
  - Highlight hooks for the fit check: elements that draw text in `--c-link` carry class `t-link`. Elements filled with the brand colour carry `t-btn`. CSS `.hl-link .t-link` and `.hl-btn .t-btn` outline them.

Card layout depends on `config.cardStyle`: `visual` is cover-led (cover at left, title, byline, the why line, price). `spec` is spec-led (glyph + name + price on one row, then a 3-column spec grid in mono). Near-miss cards show a full-width flag row at the top with the broken constraint.

- [ ] **Step 1: ProductCard.tsx**

`packages/agent/src/widget/ProductCard.tsx`:
```tsx
import { getProduct } from "../catalogs";
import type { AgentConfig, Product, ProductImage } from "../types";
import { cls } from "./cls";
import { FlagIcon } from "./icons";

export const formatPrice = (n: number) => `€${Number.isInteger(n) ? n : n.toFixed(2)}`;

function Glyph({ glyph }: { glyph: "rod" | "reel" | "kit" }) {
  const common = { fill: "none", stroke: "currentColor", "stroke-width": 1.6, "stroke-linecap": "round" } as const;
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" class="glyph-svg">
      {glyph === "rod" && <g {...common}><path d="M6 42L42 6" /><circle cx="14" cy="34" r="4" /><path d="M42 6l-2 10" /></g>}
      {glyph === "reel" && <g {...common}><circle cx="24" cy="24" r="14" /><circle cx="24" cy="24" r="5" /><path d="M24 10v-4M36 30l6 4" /></g>}
      {glyph === "kit" && <g {...common}><rect x="6" y="14" width="36" height="22" rx="2" /><path d="M18 14v-4h12v4M6 24h36" /></g>}
    </svg>
  );
}

export function ProductImageView({ image, product, size }: { image: ProductImage; product: Product; size: "sm" | "lg" }) {
  if (image.kind === "glyph") return <div class={cls("glyph", `glyph-${size}`)}><Glyph glyph={image.glyph} /></div>;
  // Cover colours are product artwork (data), not theme — inline style is intentional
  return (
    <div class={cls("cover", `cover-${size}`, `motif-${image.motif}`)} style={{ background: image.bg, color: image.fg }} aria-hidden="true">
      <span class="cover-title">{product.name}</span>
      <span class="cover-author">{product.byline}</span>
    </div>
  );
}

export function ProductCard({ config, product, flag, onOpen }: { config: AgentConfig; product: Product; flag?: string; onOpen: (id: string) => void }) {
  const spec = config.cardStyle === "spec";
  return (
    <button type="button" class={cls("card", spec ? "card-spec" : "card-visual", flag && "is-near-miss")} onClick={() => onOpen(product.id)}
      aria-label={`${product.name}, ${formatPrice(product.price)}${flag ? `. Note: ${flag}` : ""}. View details`}>
      {flag && <span class="flag"><FlagIcon />{flag}</span>}
      {spec ? (
        <>
          <span class="card-row">
            <ProductImageView image={product.image} product={product} size="sm" />
            <span class="card-head">
              <span class="card-name">{product.name}</span>
              <span class="card-byline">{product.byline}</span>
            </span>
            <span class="price">{formatPrice(product.price)}</span>
          </span>
          <dl class="specs">
            {product.specs.slice(0, 6).map((s) => <div class="spec" key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}
          </dl>
        </>
      ) : (
        <span class="card-row">
          <ProductImageView image={product.image} product={product} size="sm" />
          <span class="card-head">
            <span class="card-name">{product.name}</span>
            <span class="card-byline">{product.byline}</span>
            <span class="card-why">{product.why}</span>
            <span class="card-foot"><span class="price">{formatPrice(product.price)}</span><span class="card-cta t-link">Details →</span></span>
          </span>
        </span>
      )}
    </button>
  );
}

export function ProductList({ config, items, mode, onOpen }: { config: AgentConfig; items: { productId: string; flag?: string }[]; mode: "match" | "near-miss"; onOpen: (id: string) => void }) {
  return (
    <div class={cls("cards", mode === "near-miss" && "cards-near-miss")}>
      {items.map((i) => {
        const p = getProduct(config.store, i.productId);
        return p ? <ProductCard key={p.id} config={config} product={p} flag={i.flag} onOpen={onOpen} /> : null;
      })}
    </div>
  );
}
```

- [ ] **Step 2: Compare.tsx**

`packages/agent/src/widget/Compare.tsx`:
```tsx
import { getProduct } from "../catalogs";
import type { AgentConfig, Product } from "../types";
import { formatPrice, ProductImageView } from "./ProductCard";

export function Compare({ config, productIds, compact, onChoose }: { config: AgentConfig; productIds: string[]; compact: boolean; onChoose: (id: string) => void }) {
  const products = productIds.map((id) => getProduct(config.store, id)).filter((p): p is Product => !!p);
  const labels = [...new Set(products.flatMap((p) => p.specs.map((s) => s.label)))];
  const specOf = (p: Product, label: string) => p.specs.find((s) => s.label === label)?.value ?? "—";
  const mono = config.cardStyle === "spec";

  if (compact) {
    return (
      <div class="compare-stack">
        {products.map((p) => (
          <div class="compare-card" key={p.id}>
            <div class="compare-card-head">
              <ProductImageView image={p.image} product={p} size="sm" />
              <div><div class="card-name">{p.name}</div><div class="price">{formatPrice(p.price)}</div></div>
            </div>
            <dl class="compare-dl">
              {labels.map((l) => <div key={l}><dt>{l}</dt><dd class={mono ? "mono" : ""}>{specOf(p, l)}</dd></div>)}
              {!mono && <div><dt>Why</dt><dd>{p.why}</dd></div>}
            </dl>
            <button type="button" class="btn btn-primary btn-block t-btn" onClick={() => onChoose(p.id)}>Choose this one</button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div class="compare">
      <table>
        <thead>
          <tr><th scope="col"><span class="sr">Attribute</span></th>{products.map((p) => <th scope="col" key={p.id}>{p.name}</th>)}</tr>
        </thead>
        <tbody>
          <tr><th scope="row">Price</th>{products.map((p) => <td key={p.id} class="price">{formatPrice(p.price)}</td>)}</tr>
          {labels.map((l) => (
            <tr key={l}><th scope="row">{l}</th>{products.map((p) => <td key={p.id} class={mono ? "mono" : ""}>{specOf(p, l)}</td>)}</tr>
          ))}
          {!mono && <tr><th scope="row">Why</th>{products.map((p) => <td key={p.id}>{p.why}</td>)}</tr>}
          <tr class="compare-actions"><th scope="row"><span class="sr">Choose</span></th>{products.map((p) => (
            <td key={p.id}><button type="button" class="btn btn-primary t-btn" onClick={() => onChoose(p.id)}>Choose</button></td>
          ))}</tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: DetailSheet.tsx and NotifyForm.tsx**

`packages/agent/src/widget/DetailSheet.tsx`:
```tsx
import { useEffect, useRef, useState } from "preact/hooks";
import type { AgentConfig, Product } from "../types";
import { BackIcon } from "./icons";
import { formatPrice, ProductImageView } from "./ProductCard";

export function DetailSheet({ config, product, onBack, onAdd }: { config: AgentConfig; product: Product; onBack: () => void; onAdd: (opts: { giftWrap: boolean }) => void }) {
  const [giftWrap, setGiftWrap] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { backRef.current?.focus(); }, []);
  const giftable = product.attrs.giftable === true;

  return (
    <div class="sheet" role="dialog" aria-label={product.name} onKeyDown={(e) => e.key === "Escape" && onBack()}>
      <div class="sheet-top">
        <button type="button" class="icon-btn" ref={backRef} onClick={onBack} aria-label="Back to conversation"><BackIcon /></button>
        <span class="sheet-crumb">Back to {config.agent.name}</span>
      </div>
      <div class="sheet-body">
        <div class="sheet-hero">
          <ProductImageView image={product.image} product={product} size="lg" />
          <div>
            <h3 class="sheet-title">{product.name}</h3>
            <p class="card-byline">{product.byline}</p>
            <p class="price sheet-price">{formatPrice(product.price)}</p>
          </div>
        </div>
        <div class="why-box"><strong>Why this one</strong><p>{product.why}</p></div>
        <p class="sheet-blurb">{product.blurb}</p>
        <dl class={config.cardStyle === "spec" ? "specs" : "detail-list"}>
          {product.specs.map((s) => <div class="spec" key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}
        </dl>
      </div>
      <div class="sheet-foot">
        {giftable && (
          <label class="check"><input type="checkbox" checked={giftWrap} onChange={(e) => setGiftWrap(e.currentTarget.checked)} /> Gift wrap it (free)</label>
        )}
        <button type="button" class="btn btn-primary btn-block t-btn" onClick={() => onAdd({ giftWrap })}>Add to basket · {formatPrice(product.price)}</button>
      </div>
    </div>
  );
}
```

`packages/agent/src/widget/NotifyForm.tsx`:
```tsx
import { useState } from "preact/hooks";
import { getProduct } from "../catalogs";
import type { AgentConfig } from "../types";
import { CheckIcon } from "./icons";

export function NotifyForm({ done, onSubmit }: { done?: string; onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState("");
  if (done) return <div class="added"><CheckIcon /> We'll email {done}</div>;
  return (
    <form class="notify" onSubmit={(e) => { e.preventDefault(); if (/^\S+@\S+\.\S+$/.test(email)) onSubmit(email); }}>
      <input type="email" required placeholder="you@example.com" aria-label="Email address" value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
      <button type="submit" class="btn btn-primary t-btn">Notify me</button>
    </form>
  );
}

export function AddedNote({ config, productId }: { config: AgentConfig; productId: string }) {
  const p = getProduct(config.store, productId);
  return <div class="added" role="status"><CheckIcon /> Added to basket: {p?.name}</div>;
}
```

- [ ] **Step 4: Update imports and App**

In `MessageList.tsx`, replace the stub import with:
```tsx
import { Compare } from "./Compare";
import { AddedNote, NotifyForm } from "./NotifyForm";
import { ProductList } from "./ProductCard";
```

In `App.tsx`, add `import { DetailSheet } from "./DetailSheet";`. Replace the `{/* Task 7 … */}` comment inside `.body` with:
```tsx
{detail && (() => {
  const product = getProduct(config.store, detail);
  if (!product) return null;
  return (
    <DetailSheet
      config={config}
      product={product}
      onBack={() => setDetail(null)}
      onAdd={({ giftWrap }) => {
        window.dispatchEvent(new CustomEvent("concierge:add-to-cart", {
          detail: { productId: product.id, name: product.name, price: product.price, qty: 1, options: { giftWrap } },
        }));
        setDetail(null);
        setConv((s) => markAdded(s, product.id));
      }}
    />
  );
})()}
```

- [ ] **Step 5: Append styles**

Append to `packages/agent/src/widget/styles.css`:
```css
/* Cards */
.cards { display: grid; gap: var(--s-3); }
.card {
  display: grid; gap: var(--s-2); width: 100%; padding: var(--s-3);
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-md);
  text-align: left; cursor: pointer; overflow: hidden;
  transition: border-color 160ms ease, transform 160ms ease;
}
.card:hover { border-color: var(--c-brand-edge); transform: translateY(-1px); }
.card-row { display: flex; gap: var(--s-3); align-items: flex-start; }
.card-head { flex: 1; min-width: 0; display: grid; gap: 2px; }
.card-name { font-family: var(--font-display, inherit); font-weight: var(--display-weight); font-size: var(--fs-md); line-height: 1.25; }
.card-byline { color: var(--c-muted); font-size: var(--fs-sm); margin: 0; }
.card-why { font-size: var(--fs-sm); margin-top: var(--s-1); }
.card-foot { display: flex; justify-content: space-between; align-items: baseline; margin-top: var(--s-2); }
.card-cta { color: var(--c-link); font-size: var(--fs-sm); font-weight: 600; }
.price { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.flag {
  display: flex; align-items: center; gap: 6px;
  margin: calc(-1 * var(--s-3)) calc(-1 * var(--s-3)) 0; padding: 6px var(--s-3);
  background: var(--c-flag-bg); color: var(--c-flag-text);
  font-size: var(--fs-sm); font-weight: 600;
}

/* Covers & glyphs (cover colours come from product data via inline style) */
.cover { position: relative; flex: none; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; border-radius: 3px; box-shadow: 0 1px 0 var(--c-border), 2px 3px 0 var(--c-border); }
.cover-sm { width: 60px; height: 90px; padding: 6px; }
.cover-lg { width: 110px; height: 165px; padding: 10px; }
.cover-title { font-family: var(--font-display, inherit); font-weight: 600; line-height: 1.1; font-size: 8px; }
.cover-author { font-size: 6px; opacity: .8; margin-top: 2px; }
.cover-lg .cover-title { font-size: 14px; }
.cover-lg .cover-author { font-size: 10px; }
.cover::before { content: ""; position: absolute; left: 0; right: 0; background: currentColor; opacity: .18; }
.motif-band::before { top: 18%; height: 22%; }
.motif-rule::before { top: 14%; height: 2px; box-shadow: 0 6px 0 currentColor; opacity: .5; }
.motif-circle::before { top: 12%; left: 22%; right: auto; width: 56%; aspect-ratio: 1; border-radius: 50%; }
.glyph { flex: none; display: grid; place-items: center; background: var(--c-bg); border: 1px solid var(--c-border); border-radius: var(--r-sm); color: var(--c-link); }
.glyph-sm { width: 48px; height: 48px; }
.glyph-lg { width: 110px; height: 110px; }
.glyph-svg { width: 70%; height: 70%; }

/* Spec grid */
.specs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; margin: 0; background: var(--c-border); border: 1px solid var(--c-border); border-radius: var(--r-sm); overflow: hidden; }
.spec { padding: 6px var(--s-2); background: var(--c-bg); }
.spec dt { color: var(--c-muted); font-size: var(--fs-xs); }
.spec dd { margin: 0; font-family: var(--font-mono); font-size: var(--fs-sm); }
.detail-list { display: grid; gap: var(--s-2); margin: 0; }
.detail-list .spec { display: flex; justify-content: space-between; padding: 0 0 var(--s-2); background: transparent; border-bottom: 1px solid var(--c-border); }
.detail-list .spec dd { font-family: inherit; }

/* Buttons */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 36px; padding: 0 var(--s-3);
  border: 1px solid var(--c-border); border-radius: var(--r-btn);
  background: var(--c-bg); color: var(--c-text); cursor: pointer;
  font-size: var(--fs-sm); font-weight: 600;
}
.btn-primary { background: var(--c-brand); border-color: var(--c-brand-edge); color: var(--c-on-brand); }
.btn-primary:hover { background: var(--c-brand-hover); }
.btn-primary:active { background: var(--c-brand-pressed); }
.btn-block { width: 100%; min-height: 48px; font-size: var(--fs-md); }

/* Compare */
.compare { border: 1px solid var(--c-border); border-radius: var(--r-md); overflow: hidden; font-size: var(--fs-sm); }
.compare table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.compare th, .compare td { padding: var(--s-2); border-bottom: 1px solid var(--c-border); vertical-align: top; text-align: left; }
.compare thead th { background: var(--c-surface); font-family: var(--font-display, inherit); font-weight: var(--display-weight); line-height: 1.25; }
.compare tbody th { width: 28%; color: var(--c-muted); font-weight: 400; font-size: var(--fs-xs); }
.compare .mono { font-family: var(--font-mono); }
.compare-actions td, .compare-actions th { border-bottom: 0; }
.compare-stack { display: grid; gap: var(--s-3); }
.compare-card { display: grid; gap: var(--s-3); padding: var(--s-3); border: 1px solid var(--c-border); border-radius: var(--r-md); background: var(--c-surface); }
.compare-card-head { display: flex; gap: var(--s-3); align-items: center; }
.compare-dl { display: grid; gap: 6px; margin: 0; font-size: var(--fs-sm); }
.compare-dl div { display: flex; justify-content: space-between; gap: var(--s-3); }
.compare-dl dt { color: var(--c-muted); }
.compare-dl dd { margin: 0; text-align: right; }
.compare-dl .mono { font-family: var(--font-mono); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

/* Detail sheet */
.sheet { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; background: var(--c-bg); animation: sheet-in 260ms cubic-bezier(.2,.8,.2,1); }
@keyframes sheet-in { from { opacity: 0; transform: translateY(24px); } }
.sheet-top { display: flex; align-items: center; gap: var(--s-2); padding: var(--s-2) var(--s-3); border-bottom: 1px solid var(--c-border); }
.sheet-crumb { color: var(--c-muted); font-size: var(--fs-sm); }
.sheet-body { flex: 1; overflow-y: auto; display: grid; align-content: start; gap: var(--s-4); padding: var(--s-4); }
.sheet-hero { display: flex; gap: var(--s-4); align-items: flex-end; }
.sheet-title { margin: 0; font-family: var(--font-display, inherit); font-weight: var(--display-weight); font-size: var(--fs-xl); line-height: 1.15; }
.sheet-price { margin: var(--s-2) 0 0; font-size: var(--fs-lg); }
.sheet-blurb { margin: 0; }
.why-box { padding: var(--s-3); border-radius: var(--r-md); background: var(--c-brand-soft); color: var(--c-on-brand-soft); font-size: var(--fs-sm); }
.why-box p { margin: 4px 0 0; }
.sheet-foot { display: grid; gap: var(--s-2); padding: var(--s-3) var(--s-4); border-top: 1px solid var(--c-border); }
.compact .sheet-foot { padding-bottom: calc(var(--s-3) + env(safe-area-inset-bottom)); }
.check { display: flex; align-items: center; gap: var(--s-2); font-size: var(--fs-sm); }
.check input { width: 18px; height: 18px; accent-color: var(--c-brand); }

/* Notify & added */
.notify { display: flex; gap: var(--s-2); }
.notify input { flex: 1; min-width: 0; min-height: 40px; padding: 0 var(--s-3); border: 1px solid var(--c-border); border-radius: var(--r-btn); background: var(--c-surface); font-size: max(16px, var(--fs-md)); }
.added { display: flex; align-items: center; gap: var(--s-2); padding: var(--s-2) var(--s-3); border-radius: var(--r-md); background: var(--c-brand-soft); color: var(--c-on-brand-soft); font-size: var(--fs-sm); font-weight: 600; }

/* Fit-check highlight */
.hl-link .t-link, .hl-btn .t-btn { outline: 2px dashed var(--c-focus); outline-offset: 3px; animation: hl 1.2s ease-in-out infinite; }
@keyframes hl { 50% { outline-offset: 6px; } }
```

- [ ] **Step 6: Verify**

Run: `pnpm --filter @concierge/agent test && pnpm --filter @concierge/agent typecheck && pnpm --filter @concierge/agent build`
Expected: PASS. The literal-colour test still passes (cover colours are inline styles from data).

Harness at `?autoplay=4`. Expected:
- Marginalia 440px: the history picks are cover-led cards, then a comparison table with a "Why" row. Choose → detail sheet with the why box, gift-wrap checkbox, "Add to basket · €16.99". Add → "Added to basket" note.
- Riffle 440px: square spec cards with mono spec grids. At autoplay 2, three near-miss cards, each with a flag row ("€29 over budget", …). Autoplay 4 gives a spec comparison.
- 375px cells: the comparison stacks as cards, and the sheet fills the panel.
- `?lab`: all six lab configs are readable, nothing unreadable, the neon and pink ones keep contrast.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(agent): product cards, near-miss flags, compare, detail sheet and add-to-basket event

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 8: Platform config serving and the AgentPreview bridge

**Files:**
- Create: `apps/platform/lib/configStore.ts`, `apps/platform/app/configs/[file]/route.ts`, `apps/platform/app/api/configs/route.ts`
- Create: `apps/platform/components/AgentPreview.tsx`, `apps/platform/global.d.ts`

**Interfaces:**
- Consumes: `DEMO_CONFIGS`, `AgentConfig` from `@concierge/agent/core`.
- Produces:
  - `GET /configs/:id.json` returns 200 with the config, or 404. CORS `*`. `Cache-Control: no-store`.
  - `POST /api/configs` with body `AgentConfig` returns `{ id }`. It overwrites when `config.id` is an existing saved (non-demo) id, otherwise it creates `slug-xxxx`. Validation failures return 400 `{ error }`.
  - `readConfig(id): Promise<AgentConfig | null>`, `saveConfig(config): Promise<string>`
  - `<AgentPreview config autoplay? open? highlight? className? />`: a client component that loads `/agent.js` once and renders `<concierge-agent mode="inline">`, setting `.config`.

- [ ] **Step 1: Config store**

`apps/platform/lib/configStore.ts`:
```ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { DEMO_CONFIGS, type AgentConfig } from "@concierge/agent/core";

const DATA_DIR = process.env.CONFIG_DIR ?? path.join(process.cwd(), ".data", "configs");
const ID_RE = /^[a-z0-9-]{1,64}$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const DEMO_IDS = new Set(Object.keys(DEMO_CONFIGS));

export async function readConfig(id: string): Promise<AgentConfig | null> {
  if (!ID_RE.test(id)) return null;
  if (DEMO_IDS.has(id)) return DEMO_CONFIGS[id as keyof typeof DEMO_CONFIGS];
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf8")) as AgentConfig;
  } catch {
    return null;
  }
}

export function validate(c: Partial<AgentConfig>): string | null {
  if (!c || typeof c !== "object") return "Missing config";
  if (!c.brand || !HEX_RE.test(c.brand)) return "Brand colour must be a 6-digit hex";
  if (c.background && !HEX_RE.test(c.background)) return "Background must be a 6-digit hex";
  if (c.accent && !HEX_RE.test(c.accent)) return "Accent must be a 6-digit hex";
  if (c.store !== "books" && c.store !== "fishing") return "Unknown store";
  if (!c.agent?.name || !c.agent.greeting) return "Assistant name and greeting are required";
  if (JSON.stringify(c).length > 200_000) return "Config too large (is the logo huge?)";
  return null;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "store";

export async function saveConfig(config: AgentConfig): Promise<string> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  let id = config.id;
  const existing = id && ID_RE.test(id) && !DEMO_IDS.has(id) ? await readConfig(id) : null;
  if (!existing) id = `${slug(config.agent.name)}-${Math.random().toString(36).slice(2, 6)}`;
  await fs.writeFile(path.join(DATA_DIR, `${id}.json`), JSON.stringify({ ...config, id }, null, 2));
  return id;
}
```

- [ ] **Step 2: Routes**

`apps/platform/app/configs/[file]/route.ts`:
```ts
import { readConfig } from "@/lib/configStore";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const id = file.replace(/\.json$/, "");
  const config = await readConfig(id);
  if (!config) return Response.json({ error: "Not found" }, { status: 404, headers: CORS });
  return Response.json(config, { headers: { ...CORS, "Cache-Control": "no-store" } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
```

`apps/platform/app/api/configs/route.ts`:
```ts
import type { AgentConfig } from "@concierge/agent/core";
import { saveConfig, validate } from "@/lib/configStore";

export async function POST(req: Request) {
  const config = (await req.json().catch(() => null)) as AgentConfig | null;
  const error = validate(config ?? {});
  if (error || !config) return Response.json({ error: error ?? "Invalid JSON" }, { status: 400 });
  const id = await saveConfig(config);
  return Response.json({ id });
}
```

- [ ] **Step 3: AgentPreview bridge**

`apps/platform/global.d.ts`:
```ts
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "concierge-agent": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        mode?: string;
        open?: string;
        autoplay?: string;
        highlight?: string;
      };
    }
  }
}
```

`apps/platform/components/AgentPreview.tsx`:
```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import type { AgentConfig } from "@concierge/agent/core";

let loading: Promise<void> | null = null;
function loadAgentScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  loading ??= new Promise<void>((resolve) => {
    if (!customElements.get("concierge-agent")) {
      const s = document.createElement("script");
      s.src = "/agent.js";
      s.async = true;
      document.head.appendChild(s);
    }
    customElements.whenDefined("concierge-agent").then(() => resolve());
  });
  return loading;
}

type AgentEl = HTMLElement & { config?: AgentConfig };

export function AgentPreview({ config, autoplay = 2, open = true, highlight, className }: {
  config: AgentConfig; autoplay?: number; open?: boolean; highlight?: string | null; className?: string;
}) {
  const ref = useRef<AgentEl>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { loadAgentScript().then(() => setReady(true)); }, []);
  useEffect(() => { if (ready && ref.current) ref.current.config = config; }, [ready, config]);

  return (
    <concierge-agent
      key={open ? "open" : "closed"}
      ref={ref}
      mode="inline"
      autoplay={String(autoplay)}
      {...(open ? { open: "" } : {})}
      {...(highlight ? { highlight } : {})}
      className={className}
    />
  );
}
```

- [ ] **Step 4: Verify**

Run: `pnpm build && pnpm --filter platform dev`, then:
- `curl -s localhost:3000/configs/marginalia.json | head -c 120` returns JSON with `"id":"marginalia"`
- `curl -si localhost:3000/configs/nope.json | head -1` returns 404
- `curl -s -XPOST localhost:3000/api/configs -H 'content-type: application/json' -d '{"id":"","store":"books","brand":"#123456","surface":"light","font":{"family":"inherit"},"shape":"soft","density":"airy","voice":"warm","cardStyle":"visual","agent":{"name":"Test Shop","greeting":"Hi"},"launcher":{"position":"bottom-right"}}'` returns `{"id":"test-shop-xxxx"}`, and GET `/configs/<that id>.json` returns it
- `curl -s -XPOST localhost:3000/api/configs -H 'content-type: application/json' -d '{"brand":"red"}'` returns a 400 with an error

Run: `pnpm --filter platform typecheck`. Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(platform): config storage, config JSON endpoint with CORS, AgentPreview bridge

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Demo storefronts (Marginalia and Riffle & Co.)

**Files:**
- Create: `apps/platform/public/demo/marginalia-logo.svg`, `apps/platform/public/demo/riffle-logo.svg`
- Create: `apps/platform/components/CartBadge.tsx`
- Create: `apps/platform/app/(demo)/demo/books/page.tsx`, `books.module.css`
- Create: `apps/platform/app/(demo)/demo/fishing/page.tsx`, `fishing.module.css`

**Interfaces:**
- Consumes: `CATALOGS` from `@concierge/agent/core`; `/agent.js`; `/configs/:id.json`.
- Produces: `/demo/books` and `/demo/fishing`. Each has the real snippet tag `<script src="/agent.js" data-config="…" async>`. `?config=<id>` overrides the config id, which Task 14 uses for "see it on a demo page". Each page declares `--brand` and `--bg` custom properties in CSS, a `theme-color` meta, a Google Fonts `<link>` and a logo `<img alt="… logo">`, so the brand extractor (Task 11) finds them.

The storefronts have to look like real, carefully made stores. The widget's fit is judged against them.

- [ ] **Step 1: Logos**

`apps/platform/public/demo/marginalia-logo.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#7A2E2E"/><text x="32" y="44" text-anchor="middle" font-family="Georgia, serif" font-size="36" font-style="italic" fill="#F6F1E7">M</text></svg>
```

`apps/platform/public/demo/riffle-logo.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#101214"/><path d="M8 40 C 20 28, 28 48, 40 34 S 56 26, 58 30" stroke="#FF5A1F" stroke-width="5" fill="none" stroke-linecap="square"/><rect x="8" y="46" width="48" height="4" fill="#F2F2F0"/></svg>
```

- [ ] **Step 2: CartBadge**

`apps/platform/components/CartBadge.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";

export function CartBadge({ className, toastClassName, label = "Basket" }: { className?: string; toastClassName?: string; label?: string }) {
  const [count, setCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    const onAdd = (e: Event) => {
      const { name, qty } = (e as CustomEvent<{ name: string; qty: number }>).detail;
      setCount((c) => c + qty);
      setToast(`Added “${name}” to your basket`);
      setTimeout(() => setToast(null), 3200);
    };
    window.addEventListener("concierge:add-to-cart", onAdd);
    return () => window.removeEventListener("concierge:add-to-cart", onAdd);
  }, []);
  return (
    <>
      <span className={className} aria-live="polite">{label} ({count})</span>
      {toast && <div className={toastClassName} role="status">{toast}</div>}
    </>
  );
}
```

- [ ] **Step 3: Marginalia (books)**

`apps/platform/app/(demo)/demo/books/page.tsx`:
```tsx
import type { Metadata, Viewport } from "next";
import { CATALOGS, type Product } from "@concierge/agent/core";
import { CartBadge } from "@/components/CartBadge";
import s from "./books.module.css";

export const metadata: Metadata = { title: "Marginalia — independent booksellers, Edinburgh" };
export const viewport: Viewport = { themeColor: "#7A2E2E" };

function Cover({ p }: { p: Product }) {
  if (p.image.kind !== "cover") return null;
  return (
    <div className={s.cover} style={{ background: p.image.bg, color: p.image.fg }}>
      <span className={s.coverTitle}>{p.name}</span>
      <span className={s.coverAuthor}>{p.byline}</span>
    </div>
  );
}

export default async function BooksStore({ searchParams }: { searchParams: Promise<{ config?: string }> }) {
  const { config = "marginalia" } = await searchParams;
  const books = CATALOGS.books;
  return (
    <div className={s.store}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Fraunces:opsz,wght@9..144,400..600&display=swap" />
      <header className={s.header}>
        <a href="#" className={s.brand}><img src="/demo/marginalia-logo.svg" alt="Marginalia logo" width={36} height={36} /><span>Marginalia</span></a>
        <nav className={s.nav}><a href="#">New in</a><a href="#">Fiction</a><a href="#">History</a><a href="#">Gifts</a></nav>
        <CartBadge className={s.cart} toastClassName={s.toast} />
      </header>
      <section className={s.hero}>
        <p className={s.eyebrow}>Autumn, chosen by people who read</p>
        <h1>Books for the long evenings</h1>
        <p className={s.lede}>An independent bookshop on the corner of Leith Walk since 1987. Every book on this page has been read by someone who works here.</p>
        <a href="#shelf" className={s.button}>Browse the shelf</a>
      </section>
      <section id="shelf" className={s.shelf}>
        <h2>On the front table</h2>
        <div className={s.grid}>
          {books.slice(0, 12).map((p) => (
            <article key={p.id} className={s.item}>
              <Cover p={p} />
              <h3>{p.name}</h3>
              <p className={s.author}>{p.byline}</p>
              <p className={s.price}>€{p.price.toFixed(2)}</p>
            </article>
          ))}
        </div>
      </section>
      <footer className={s.footer}>Marginalia Books · 212 Leith Walk, Edinburgh · A demo store for Concierge</footer>
      <script src="/agent.js" data-config={config} async />
    </div>
  );
}
```

`apps/platform/app/(demo)/demo/books/books.module.css`:
```css
.store {
  --brand: #7A2E2E;
  --bg: #F6F1E7;
  --ink: #2B2522;
  --muted: #6E625A;
  --line: #E2D8C8;
  min-height: 100vh; background: var(--bg); color: var(--ink);
  font-family: "EB Garamond", Georgia, serif; font-size: 19px; line-height: 1.55;
}
.header { display: flex; align-items: center; gap: 32px; padding: 20px clamp(16px, 5vw, 64px); border-bottom: 1px solid var(--line); }
.brand { display: flex; align-items: center; gap: 12px; color: var(--ink); text-decoration: none; font-family: "Fraunces", serif; font-size: 26px; font-style: italic; }
.nav { display: flex; gap: 24px; flex: 1; }
.nav a { color: var(--ink); text-decoration: none; }
.nav a:hover { color: var(--brand); text-decoration: underline; text-underline-offset: 4px; }
.cart { font-variant: small-caps; letter-spacing: .04em; }
.hero { max-width: 760px; padding: 88px clamp(16px, 5vw, 64px) 72px; }
.eyebrow { color: var(--brand); font-style: italic; margin: 0 0 12px; }
.hero h1 { font-family: "Fraunces", serif; font-weight: 500; font-size: clamp(40px, 7vw, 72px); line-height: 1.02; margin: 0 0 20px; letter-spacing: -0.01em; }
.lede { color: var(--muted); font-size: 21px; max-width: 34em; }
.button { display: inline-block; margin-top: 16px; padding: 12px 26px; border-radius: 999px; background: var(--brand); color: #fff; text-decoration: none; }
.shelf { padding: 24px clamp(16px, 5vw, 64px) 96px; border-top: 1px solid var(--line); }
.shelf h2 { font-family: "Fraunces", serif; font-weight: 500; font-size: 30px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 40px 28px; }
.item h3 { font-family: "Fraunces", serif; font-weight: 500; font-size: 18px; line-height: 1.2; margin: 14px 0 2px; }
.author { color: var(--muted); margin: 0; font-style: italic; }
.price { margin: 6px 0 0; }
.cover { aspect-ratio: 2 / 3; display: flex; flex-direction: column; justify-content: flex-end; padding: 14px; border-radius: 2px; box-shadow: 2px 3px 0 var(--line), 0 12px 24px -12px rgba(60, 40, 20, .35); }
.coverTitle { font-family: "Fraunces", serif; font-size: 17px; line-height: 1.1; }
.coverAuthor { font-size: 12px; opacity: .8; margin-top: 4px; }
.footer { padding: 32px clamp(16px, 5vw, 64px) 120px; color: var(--muted); border-top: 1px solid var(--line); font-size: 15px; }
.toast { position: fixed; left: 50%; top: 20px; transform: translateX(-50%); z-index: 10; padding: 10px 20px; border-radius: 999px; background: var(--ink); color: var(--bg); }
@media (max-width: 640px) { .nav { display: none; } .header { justify-content: space-between; } .hero { padding-top: 48px; } }
```

- [ ] **Step 4: Riffle & Co. (fishing)**

`apps/platform/app/(demo)/demo/fishing/page.tsx`:
```tsx
import type { Metadata, Viewport } from "next";
import { CATALOGS } from "@concierge/agent/core";
import { CartBadge } from "@/components/CartBadge";
import s from "./fishing.module.css";

export const metadata: Metadata = { title: "Riffle & Co. — fly fishing gear for small water" };
export const viewport: Viewport = { themeColor: "#FF5A1F" };

export default async function FishingStore({ searchParams }: { searchParams: Promise<{ config?: string }> }) {
  const { config = "riffle" } = await searchParams;
  const gear = CATALOGS.fishing.filter((p) => p.attrs.flyRod === true);
  return (
    <div className={s.store}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@600;700&display=swap" />
      <div className={s.ticker}>FREE SHIPPING OVER €100 · 60-DAY TRAIL TEST · RODS CAST-TESTED IN-HOUSE</div>
      <header className={s.header}>
        <a href="#" className={s.brand}><img src="/demo/riffle-logo.svg" alt="Riffle & Co. logo" width={40} height={40} /><span>RIFFLE &amp; CO.</span></a>
        <nav className={s.nav}><a href="#">Rods</a><a href="#">Reels</a><a href="#">Lines</a><a href="#">Packs</a></nav>
        <CartBadge className={s.cart} toastClassName={s.toast} label="CART" />
      </header>
      <section className={s.hero}>
        <p className={s.kicker}>FIELD-TESTED / 2026</p>
        <h1>BUILT FOR<br />SMALL WATER.</h1>
        <p className={s.lede}>Packable fly rods and kit for anglers who walk in. Every spec measured, not marketed.</p>
        <a href="#gear" className={s.button}>SHOP RODS →</a>
      </section>
      <section id="gear" className={s.gear}>
        <div className={s.gearHead}><h2>RODS &amp; KITS</h2><span>{gear.length} ITEMS</span></div>
        <div className={s.grid}>
          {gear.map((p) => (
            <article key={p.id} className={s.item}>
              <div className={s.itemTop}><h3>{p.name}</h3><span className={s.price}>€{p.price}</span></div>
              <p className={s.byline}>{p.byline}</p>
              <dl className={s.specs}>{p.specs.slice(0, 3).map((sp) => <div key={sp.label}><dt>{sp.label}</dt><dd>{sp.value}</dd></div>)}</dl>
            </article>
          ))}
        </div>
      </section>
      <footer className={s.footer}>RIFFLE &amp; CO. · KENDAL, CUMBRIA · DEMO STORE FOR CONCIERGE</footer>
      <script src="/agent.js" data-config={config} async />
    </div>
  );
}
```

`apps/platform/app/(demo)/demo/fishing/fishing.module.css`:
```css
.store {
  --brand: #FF5A1F;
  --bg: #101214;
  --ink: #F2F2F0;
  --muted: #9AA0A6;
  --line: #2A2E33;
  min-height: 100vh; background: var(--bg); color: var(--ink);
  font-family: "Barlow", system-ui, sans-serif; font-size: 16px; line-height: 1.45;
}
.ticker { background: var(--brand); color: #101214; font: 700 12px/1 "Barlow Condensed", sans-serif; letter-spacing: .12em; padding: 8px 16px; text-align: center; }
.header { display: flex; align-items: center; gap: 32px; padding: 16px clamp(16px, 4vw, 48px); border-bottom: 1px solid var(--line); }
.brand { display: flex; align-items: center; gap: 12px; color: var(--ink); text-decoration: none; font: 700 24px/1 "Barlow Condensed", sans-serif; letter-spacing: .06em; }
.nav { display: flex; gap: 24px; flex: 1; font: 600 15px/1 "Barlow Condensed", sans-serif; letter-spacing: .1em; text-transform: uppercase; }
.nav a { color: var(--muted); text-decoration: none; }
.nav a:hover { color: var(--ink); }
.cart { font: 700 14px/1 "Barlow Condensed", sans-serif; letter-spacing: .1em; border: 1px solid var(--line); padding: 10px 14px; }
.hero { padding: 72px clamp(16px, 4vw, 48px) 64px; border-bottom: 1px solid var(--line); background: linear-gradient(180deg, #15181b, var(--bg)); }
.kicker { color: var(--brand); font: 700 13px/1 "Barlow Condensed", sans-serif; letter-spacing: .2em; margin: 0 0 16px; }
.hero h1 { font: 700 clamp(48px, 10vw, 112px)/.88 "Barlow Condensed", sans-serif; margin: 0 0 20px; letter-spacing: -.01em; }
.lede { color: var(--muted); max-width: 34em; font-size: 18px; }
.button { display: inline-block; margin-top: 12px; padding: 14px 22px; background: var(--brand); color: #101214; text-decoration: none; font: 700 15px/1 "Barlow Condensed", sans-serif; letter-spacing: .12em; }
.gear { padding: 32px clamp(16px, 4vw, 48px) 96px; }
.gearHead { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid var(--ink); padding-bottom: 8px; margin-bottom: 0; }
.gearHead h2 { font: 700 28px/1 "Barlow Condensed", sans-serif; margin: 0; letter-spacing: .04em; }
.gearHead span { color: var(--muted); font: 600 13px/1 ui-monospace, monospace; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); border-left: 1px solid var(--line); }
.item { padding: 20px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.item:hover { background: #15181b; }
.itemTop { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
.item h3 { font: 700 20px/1.1 "Barlow Condensed", sans-serif; margin: 0; }
.price { color: var(--brand); font: 700 18px/1 ui-monospace, monospace; }
.byline { color: var(--muted); margin: 6px 0 14px; font-size: 14px; }
.specs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0; }
.specs dt { color: var(--muted); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
.specs dd { margin: 0; font: 600 14px/1.3 ui-monospace, monospace; }
.footer { padding: 24px clamp(16px, 4vw, 48px) 120px; color: var(--muted); font: 600 12px/1 "Barlow Condensed", sans-serif; letter-spacing: .14em; border-top: 1px solid var(--line); }
.toast { position: fixed; left: 50%; top: 16px; transform: translateX(-50%); z-index: 10; padding: 12px 18px; background: var(--brand); color: #101214; font-weight: 700; }
@media (max-width: 640px) { .nav { display: none; } .header { justify-content: space-between; } }
```

- [ ] **Step 5: Verify**

Run: `pnpm build && pnpm --filter platform dev`. Open `/demo/books` and `/demo/fishing` at desktop width and in DevTools at 375px.
Expected:
- Both stores look finished and clearly different. Each launcher appears bottom-right in that store's styling (Marginalia: oxblood pill "Ask a bookseller" with the M logo; Riffle: square orange "Ask a guide").
- Marginalia's widget body text is EB Garamond, inherited from the page. Riffle's is Barlow, from the config.
- The full journey works on both. Add to basket increments the store's own badge and shows the store's toast.
- At 375px the widget opens full screen, page scroll is locked, and closing restores it.
- `/demo/books?config=riffle` shows the Riffle widget on the bookshop page (shows config switching works).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(platform): Marginalia and Riffle & Co. demo storefronts embedding agent.js

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: /lab — the stress-test grid

**Files:**
- Create: `apps/platform/app/(platform)/lab/page.tsx`, `apps/platform/app/(platform)/lab/lab.module.css`

**Interfaces:**
- Consumes: `LAB_CONFIGS`, `AgentPreview`.
- Produces: `/lab` shows 6 configs, each in an inline frame with the widget open at autoplay 2. There's a toggle between 440px and 375px frame widths, and each frame is captioned with its config summary.

- [ ] **Step 1: Page**

`apps/platform/app/(platform)/lab/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { LAB_CONFIGS } from "@concierge/agent/core";
import { AgentPreview } from "@/components/AgentPreview";
import s from "./lab.module.css";

export default function Lab() {
  const [narrow, setNarrow] = useState(false);
  const [step, setStep] = useState(2);
  return (
    <main className={s.main}>
      <header className={s.head}>
        <div>
          <h1>Lab</h1>
          <p>One agent, one codebase, six brands. If any of these look broken, the token engine is wrong, not the config.</p>
        </div>
        <div className={s.controls}>
          <label><input type="checkbox" checked={narrow} onChange={(e) => setNarrow(e.target.checked)} /> 375px</label>
          <label>Conversation step <select value={step} onChange={(e) => setStep(Number(e.target.value))}>
            {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select></label>
        </div>
      </header>
      <div className={s.grid}>
        {LAB_CONFIGS.map((c) => (
          <figure key={c.id} className={s.cell}>
            <div className={s.frame} style={{ width: narrow ? 375 : 440, background: c.background ?? "#fff" }}>
              <AgentPreview config={c} autoplay={step} />
            </div>
            <figcaption><strong>{c.agent.name}</strong> · {c.brand} on {c.background ?? c.surface} · {c.shape} · {c.density} · {c.voice} · {c.cardStyle}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
```

`apps/platform/app/(platform)/lab/lab.module.css`:
```css
.main { padding: 32px clamp(16px, 4vw, 48px) 80px; }
.head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; align-items: end; margin-bottom: 24px; }
.head h1 { margin: 0 0 4px; font-size: 28px; letter-spacing: -.01em; }
.head p { margin: 0; color: var(--ink-2); max-width: 44em; }
.controls { display: flex; gap: 20px; font-size: 14px; }
.grid { display: flex; flex-wrap: wrap; gap: 28px; }
.cell { margin: 0; }
.frame { height: 720px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.cell figcaption { margin-top: 8px; font-size: 13px; color: var(--ink-2); max-width: 440px; }
```

- [ ] **Step 2: Verify**

Open `/lab`. Expected: six themed widgets. Each is readable at steps 0–4 and at 375px. The Sherbet (pastel pink) widget shows darker link text and outlined buttons, not unreadable pink. The Neon widget on black stays readable.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(platform): /lab stress-test grid across six brand configs

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 11: Brand extraction (URL → brand) and logo palette

**Files:**
- Create: `apps/platform/lib/extract.ts`, `apps/platform/app/api/extract/route.ts`, `apps/platform/lib/logoPalette.ts`, `apps/platform/lib/fonts.ts`

**Interfaces:**
- Produces:
  - `interface Extraction { url: string; name?: string; logo?: string; brand: { hex: string; reason: string }[]; background?: string; text?: string; fonts: string[]; fontUrl?: string; radius?: number }` (exported from `lib/extract.ts`)
  - `extractBrand(url: string): Promise<Extraction>` (server only)
  - `POST /api/extract` with body `{ url }` returns `Extraction`, or `{ error }` with 400 or 422. It blocks private and loopback hosts unless the host matches the request's own host (so the demo stores work in dev).
  - `paletteFromImage(file: File): Promise<{ colours: string[]; dataUrl: string }>` (client only): up to 4 brand-ish colours, plus a 128px PNG data URL for the avatar
  - `FONT_CHOICES: string[]` and `shapeFromRadius(px?: number): Shape` (from `lib/fonts.ts`)

This is best effort by design. When the result is weak, the UI (Task 12) says so plainly and steers the merchant to logo upload.

- [ ] **Step 1: Extractor**

`apps/platform/lib/extract.ts`:
```ts
import { converter, formatHex, parse as parseColor } from "culori";
import { parse as parseHtml, type HTMLElement } from "node-html-parser";

export interface Extraction {
  url: string;
  name?: string;
  logo?: string;
  brand: { hex: string; reason: string }[];
  background?: string;
  text?: string;
  fonts: string[];
  fontUrl?: string;
  radius?: number;
}

const toOklch = converter("oklch");
const COLOR_RE = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/gi;
const RULE_RE = /([^{}]+)\{([^{}]*)\}/g;
const DECL_RE = /([\w-]+)\s*:\s*([^;]+)/g;
const ROOTISH = /(^|[\s,])(body|html|:root)\b/;
const GENERIC_FONTS = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "-apple-system", "blinkmacsystemfont", "segoe ui", "roboto", "helvetica", "helvetica neue", "arial", "inherit", "initial", "georgia", "times new roman"]);
const UA = "Mozilla/5.0 (compatible; ConciergeBrandReader/1.0; +https://concierge.example)";

async function fetchText(url: string, cap: number): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,text/css,*/*" }, signal: AbortSignal.timeout(6000), redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.text()).slice(0, cap);
}

function toHex(value: string): string | null {
  const c = parseColor(value);
  if (!c || (c.alpha !== undefined && c.alpha < 0.5)) return null;
  return formatHex(c);
}

function firstFamily(value: string): string | null {
  const fam = value.split(",")[0]!.trim().replace(/^['"]|['"]$/g, "").replace(/!important/, "").trim();
  if (!fam || fam.startsWith("var(") || GENERIC_FONTS.has(fam.toLowerCase()) || /icon|awesome|material|symbols/i.test(fam)) return null;
  return fam;
}

function findLogo(root: HTMLElement, base: URL): string | undefined {
  const img = root.querySelectorAll("img").find((el) => {
    const hay = `${el.getAttribute("alt") ?? ""} ${el.getAttribute("src") ?? ""} ${el.getAttribute("class") ?? ""} ${el.parentNode?.getAttribute?.("class") ?? ""}`;
    return /logo/i.test(hay);
  });
  const href =
    img?.getAttribute("src") ??
    root.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href") ??
    root.querySelector('meta[property="og:image"]')?.getAttribute("content");
  return href ? new URL(href, base).href : undefined;
}

export async function extractBrand(rawUrl: string): Promise<Extraction> {
  const url = new URL(rawUrl);
  const root = parseHtml(await fetchText(url.href, 1_500_000));

  const name =
    root.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ??
    root.querySelector("title")?.text.split(/[|–—-]/)[0]?.trim();

  const hrefs = root.querySelectorAll('link[rel~="stylesheet"]').map((l) => l.getAttribute("href")).filter((h): h is string => !!h);
  const googleHrefs = hrefs.filter((h) => h.includes("fonts.googleapis.com"));
  const sheetHrefs = hrefs.filter((h) => !h.includes("fonts.googleapis.com")).slice(0, 6);
  const css: string[] = root.querySelectorAll("style").map((el) => el.text);
  root.querySelectorAll("[style]").forEach((el) => css.push(`inline{${el.getAttribute("style")}}`));
  css.push(...(await Promise.all(sheetHrefs.map((h) => fetchText(new URL(h, url).href, 800_000).catch(() => "")))));

  const tally = new Map<string, { score: number; reasons: Map<string, number> }>();
  const add = (hex: string, score: number, reason: string) => {
    const t = tally.get(hex) ?? { score: 0, reasons: new Map() };
    t.score += score;
    t.reasons.set(reason, (t.reasons.get(reason) ?? 0) + score);
    tally.set(hex, t);
  };
  const theme = root.querySelector('meta[name="theme-color"]')?.getAttribute("content");
  const themeHex = theme ? toHex(theme) : null;
  if (themeHex) add(themeHex, 6, "your site's theme colour");

  let background: string | undefined;
  let text: string | undefined;
  const fontTally = new Map<string, number>();
  const radii: number[] = [];

  for (const chunk of css) {
    for (const [, selRaw, body] of chunk.matchAll(RULE_RE)) {
      const sel = selRaw!.trim().toLowerCase();
      for (const [, propRaw, valRaw] of body!.matchAll(DECL_RE)) {
        const prop = propRaw!.toLowerCase();
        const val = valRaw!.trim();
        if (prop === "font-family") {
          const fam = firstFamily(val);
          if (fam) fontTally.set(fam, (fontTally.get(fam) ?? 0) + (ROOTISH.test(sel) ? 5 : 1));
          continue;
        }
        if (prop === "border-radius" && /button|btn/.test(sel) && val.endsWith("px")) {
          const px = parseFloat(val);
          if (!Number.isNaN(px)) radii.push(px);
          continue;
        }
        for (const raw of val.match(COLOR_RE) ?? []) {
          const hex = toHex(raw);
          if (!hex) continue;
          const chroma = toOklch(hex)?.c ?? 0;
          if (prop.startsWith("--") && /bg|background|paper|canvas/.test(prop) && chroma < 0.06) { background ??= hex; continue; }
          if (ROOTISH.test(sel) && prop.startsWith("background")) { background ??= hex; continue; }
          if (ROOTISH.test(sel) && prop === "color") { text ??= hex; continue; }
          if (chroma < 0.04) continue;
          if (prop.startsWith("--") && /primary|brand|accent|main/.test(prop)) add(hex, 6, "named as a brand colour in your CSS");
          else if (/button|btn|cta/.test(sel) && prop.startsWith("background")) add(hex, 4, "on your buttons");
          else if (/(^|[\s,>])a(\b|:)|link/.test(sel) && prop === "color") add(hex, 3, "on your links");
          else add(hex, 1, "used across your site");
        }
      }
    }
  }

  const ranked = [...tally.entries()].sort((a, b) => b[1].score - a[1].score);
  const brand: Extraction["brand"] = [];
  for (const [hex, t] of ranked) {
    const o = toOklch(hex)!;
    const close = brand.some((b) => {
      const p = toOklch(b.hex)!;
      return Math.abs(p.l - o.l) < 0.06 && Math.abs((p.c ?? 0) - (o.c ?? 0)) < 0.05 && Math.abs((p.h ?? 0) - (o.h ?? 0)) < 12;
    });
    if (close) continue;
    const reason = [...t.reasons.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    brand.push({ hex, reason });
    if (brand.length === 5) break;
  }

  const googleFamilies = googleHrefs.flatMap((h) => new URL(h, url).searchParams.getAll("family").map((f) => f.split(":")[0]!.trim()));
  const fonts = [...new Set([...googleFamilies, ...[...fontTally.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f)])].slice(0, 3);
  const sortedRadii = radii.sort((a, b) => a - b);

  return {
    url: url.href,
    name,
    logo: findLogo(root, url),
    brand,
    background,
    text,
    fonts,
    fontUrl: googleHrefs[0] ? new URL(googleHrefs[0], url).href : undefined,
    radius: sortedRadii.length ? sortedRadii[Math.floor(sortedRadii.length / 2)] : undefined,
  };
}
```

- [ ] **Step 2: API route with SSRF guard**

`apps/platform/app/api/extract/route.ts`:
```ts
import { extractBrand } from "@/lib/extract";

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: string };
  let target: URL;
  try {
    const raw = (body.url ?? "").trim();
    target = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
  } catch {
    return Response.json({ error: "That doesn't look like a web address." }, { status: 400 });
  }
  const ownHost = req.headers.get("host");
  if (!/^https?:$/.test(target.protocol) || (PRIVATE.test(target.hostname) && target.host !== ownHost)) {
    return Response.json({ error: "We can only read public websites." }, { status: 400 });
  }
  try {
    return Response.json(await extractBrand(target.href));
  } catch {
    return Response.json({ error: "We couldn't reach that site. Check the address, or upload your logo instead." }, { status: 422 });
  }
}
```

Note: in dev the demo stores are fetched over `http://localhost:3000`. When the studio pre-fills demo URLs, it uses `window.location.origin` so the host matches.

- [ ] **Step 3: Logo palette (client)**

`apps/platform/lib/logoPalette.ts`:
```ts
import { converter, formatHex } from "culori";

const toOklch = converter("oklch");

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function paletteFromImage(file: File): Promise<{ colours: string[]; dataUrl: string }> {
  const src = URL.createObjectURL(file);
  try {
    const img = await loadImage(src);
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 200) continue;
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += g; e.b += b;
      buckets.set(key, e);
    }
    const scored = [...buckets.values()].map((e) => {
      const hex = formatHex({ mode: "rgb", r: e.r / e.n / 255, g: e.g / e.n / 255, b: e.b / e.n / 255 });
      const o = toOklch(hex)!;
      return { hex, o, score: e.n * (0.5 + (o.c ?? 0) * 4) };
    }).filter(({ o }) => (o.c ?? 0) >= 0.035 && o.l <= 0.97 && o.l >= 0.08)
      .sort((a, b) => b.score - a.score);

    const colours: string[] = [];
    for (const s of scored) {
      if (colours.some((c) => { const p = toOklch(c)!; return Math.abs((p.h ?? 0) - (s.o.h ?? 0)) < 20 && Math.abs(p.l - s.o.l) < 0.1; })) continue;
      colours.push(s.hex);
      if (colours.length === 4) break;
    }

    const avatar = document.createElement("canvas");
    avatar.width = avatar.height = 128;
    const actx = avatar.getContext("2d")!;
    const scale = Math.min(128 / img.width, 128 / img.height);
    const w = img.width * scale, h = img.height * scale;
    actx.drawImage(img, (128 - w) / 2, (128 - h) / 2, w, h);

    return { colours, dataUrl: avatar.toDataURL("image/png") };
  } finally {
    URL.revokeObjectURL(src);
  }
}
```

- [ ] **Step 4: Font helpers**

`apps/platform/lib/fonts.ts`:
```ts
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
```

- [ ] **Step 5: Verify**

Run: `pnpm --filter platform typecheck`, then with the dev server running:
`curl -s -XPOST localhost:3000/api/extract -H 'content-type: application/json' -H 'host: localhost:3000' -d '{"url":"http://localhost:3000/demo/books"}' | head -c 600`
Expected: `brand[0].hex` is `#7a2e2e` with a reason like "named as a brand colour in your CSS" or "your site's theme colour". `background` is `#f6f1e7`. `fonts` starts with `EB Garamond`. `logo` ends in `marginalia-logo.svg`. Name is `Marginalia`.

Repeat for `/demo/fishing`. Expected: `#ff5a1f`, background `#101214`, fonts `Barlow`, `Barlow Condensed`.

Try one real site (e.g. `https://www.aesop.com`) and note the result in DECISIONS.md, whether it works or fails. It may be weak. That's expected, and it's what the logo fallback is for.

`curl -s -XPOST localhost:3000/api/extract -H 'content-type: application/json' -d '{"url":"http://169.254.169.254/"}'` returns a 400.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(platform): brand extraction from URL and palette extraction from logo

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 12: Studio shell, state and Step 1 ("Let's make it look like your store")

**Files:**
- Create: `apps/platform/components/studio/state.ts`, `Studio.tsx`, `StepStart.tsx`, `studio.module.css`
- Modify: `apps/platform/app/(platform)/page.tsx`

**Interfaces:**
- Consumes: `DEFAULT_CONFIG`, `PRESETS`, `googleFontUrl`, `Extraction`, `paletteFromImage`, `shapeFromRadius`.
- Produces:
  - `StudioState`, `studioReducer`, `initialStudio` in `state.ts`:
    ```ts
    type Source = "url" | "logo" | "style";
    interface StudioState {
      step: 1 | 2 | 3;
      config: AgentConfig;
      source?: Source;
      extraction?: Extraction;
      candidates: { hex: string; reason: string }[];
      site: { name: string; font?: string; fontUrl?: string; logo?: string };
      savedId?: string;
      preview: { device: "desktop" | "mobile"; open: boolean; host: "light" | "dark" };
      highlight: string | null;
    }
    type Action =
      | { type: "start"; config: AgentConfig; source: Source; extraction?: Extraction; candidates: StudioState["candidates"]; site: StudioState["site"] }
      | { type: "patch"; patch: Partial<AgentConfig> }
      | { type: "step"; step: 1 | 2 | 3 }
      | { type: "preview"; patch: Partial<StudioState["preview"]> }
      | { type: "highlight"; token: string | null }
      | { type: "saved"; id: string };
    ```
  - `configFromExtraction(ex: Extraction): AgentConfig`, `configFromPalette(colours, dataUrl, name): AgentConfig`, `configFromPreset(key): AgentConfig`
  - `<Studio />`: a 3-step page with a progress indicator. Tasks 13 and 14 add `StepTune` and `StepInstall`.

The Concierge UI is deliberately calm: off-white, ink, one grotesk, hairline borders. The merchant's colours should be the most colourful thing on screen.

- [ ] **Step 1: State**

`apps/platform/components/studio/state.ts`:
```ts
import { DEFAULT_CONFIG, PRESETS, googleFontUrl, type AgentConfig, type PresetKey } from "@concierge/agent/core";
import type { Extraction } from "@/lib/extract";
import { shapeFromRadius } from "@/lib/fonts";

export type Source = "url" | "logo" | "style";
export interface StudioState {
  step: 1 | 2 | 3;
  config: AgentConfig;
  source?: Source;
  extraction?: Extraction;
  candidates: { hex: string; reason: string }[];
  site: { name: string; font?: string; fontUrl?: string; logo?: string };
  savedId?: string;
  preview: { device: "desktop" | "mobile"; open: boolean; host: "light" | "dark" };
  highlight: string | null;
}
export type Action =
  | { type: "start"; config: AgentConfig; source: Source; extraction?: Extraction; candidates: StudioState["candidates"]; site: StudioState["site"] }
  | { type: "patch"; patch: Partial<AgentConfig> }
  | { type: "step"; step: 1 | 2 | 3 }
  | { type: "preview"; patch: Partial<StudioState["preview"]> }
  | { type: "highlight"; token: string | null }
  | { type: "saved"; id: string };

export const initialStudio: StudioState = {
  step: 1,
  config: DEFAULT_CONFIG,
  candidates: [],
  site: { name: "Your store" },
  preview: { device: "desktop", open: true, host: "light" },
  highlight: null,
};

export function studioReducer(s: StudioState, a: Action): StudioState {
  switch (a.type) {
    case "start":
      return { ...s, step: 2, config: a.config, source: a.source, extraction: a.extraction, candidates: a.candidates, site: a.site,
        preview: { ...s.preview, host: a.config.surface === "dark" ? "dark" : "light" } };
    case "patch": return { ...s, config: { ...s.config, ...a.patch } };
    case "step": return { ...s, step: a.step };
    case "preview": return { ...s, preview: { ...s.preview, ...a.patch } };
    case "highlight": return { ...s, highlight: a.token };
    case "saved": return { ...s, savedId: a.id, config: { ...s.config, id: a.id } };
  }
}

function greetingFor(name: string) {
  return `Hi! Welcome to ${name}. Tell me what you're looking for and I'll help you find the right thing.`;
}

export function configFromExtraction(ex: Extraction): AgentConfig {
  const name = ex.name || new URL(ex.url).hostname.replace(/^www\./, "");
  const bg = ex.background;
  const brand = ex.brand[0]?.hex ?? DEFAULT_CONFIG.brand;
  const display = ex.fonts[0];
  return {
    ...DEFAULT_CONFIG,
    brand,
    background: bg,
    surface: bg && isDarkHex(bg) ? "dark" : "light",
    font: { family: "inherit", ...(display ? { display, url: ex.fontUrl ?? googleFontUrl([display]) } : {}) },
    shape: shapeFromRadius(ex.radius),
    agent: { name: `${name} assistant`, avatar: ex.logo, greeting: greetingFor(name) },
    launcher: { position: "bottom-right", label: "Need a hand?" },
  };
}

export function configFromPalette(colours: string[], dataUrl: string, name: string): AgentConfig {
  return {
    ...DEFAULT_CONFIG,
    brand: colours[0] ?? "#111111",
    agent: { name: `${name} assistant`, avatar: dataUrl, greeting: greetingFor(name) },
  };
}

export function configFromPreset(key: PresetKey): AgentConfig {
  return { ...DEFAULT_CONFIG, ...PRESETS[key].config, store: key === "technical" ? "fishing" : "books" };
}

export function isDarkHex(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}
```

- [ ] **Step 2: Studio shell and page**

`apps/platform/components/studio/Studio.tsx`:
```tsx
"use client";
import { useReducer } from "react";
import { initialStudio, studioReducer } from "./state";
import { StepStart } from "./StepStart";
import s from "./studio.module.css";

const STEPS = ["Match your store", "Tune it", "Add it to your site"] as const;

export function Studio() {
  const [state, dispatch] = useReducer(studioReducer, initialStudio);
  return (
    <div className={s.app}>
      <header className={s.topbar}>
        <span className={s.logo}><span className={s.logoMark} aria-hidden="true" />Concierge</span>
        <ol className={s.steps} aria-label="Progress">
          {STEPS.map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3;
            const reachable = n === 1 || (n <= 3 && state.source !== undefined && (n < 3 || state.step >= 2));
            return (
              <li key={label} aria-current={state.step === n ? "step" : undefined} className={state.step === n ? s.stepActive : state.step > n ? s.stepDone : undefined}>
                <button type="button" disabled={!reachable} onClick={() => dispatch({ type: "step", step: n })}>
                  <span className={s.stepNum}>{state.step > n ? "✓" : n}</span>{label}
                </button>
              </li>
            );
          })}
        </ol>
        <a className={s.toplink} href="/lab">Lab</a>
      </header>
      {state.step === 1 && <StepStart dispatch={dispatch} />}
      {/* Task 13: step 2 — StepTune; Task 14: step 3 — StepInstall */}
    </div>
  );
}
```

`apps/platform/app/(platform)/page.tsx`:
```tsx
import { Studio } from "@/components/studio/Studio";

export default function Home() {
  return <Studio />;
}
```

- [ ] **Step 3: StepStart**

`apps/platform/components/studio/StepStart.tsx`:
```tsx
"use client";
import { useEffect, useState, type Dispatch } from "react";
import { PRESETS, type PresetKey } from "@concierge/agent/core";
import type { Extraction } from "@/lib/extract";
import { paletteFromImage } from "@/lib/logoPalette";
import { configFromExtraction, configFromPalette, configFromPreset, type Action } from "./state";
import s from "./studio.module.css";

const PROGRESS = ["Reading your homepage", "Finding your colours", "Finding your fonts", "Looking for your logo"];

export function StepStart({ dispatch }: { dispatch: Dispatch<Action> }) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "reading" | "found" | "weak" | "error">("idle");
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  const [ex, setEx] = useState<Extraction | null>(null);
  const [chosen, setChosen] = useState(0);
  const [logo, setLogo] = useState<{ colours: string[]; dataUrl: string; name: string } | null>(null);
  const [logoChosen, setLogoChosen] = useState(0);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    if (phase !== "reading") return;
    const t = setInterval(() => setTick((n) => Math.min(n + 1, PROGRESS.length - 1)), 650);
    return () => clearInterval(t);
  }, [phase]);

  async function read(target = url) {
    if (!target.trim()) return;
    setUrl(target); setPhase("reading"); setTick(0); setError(""); setEx(null);
    const res = await fetch("/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: target }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setPhase("error"); return; }
    setEx(data); setChosen(0);
    setPhase(data.brand.length ? "found" : "weak");
  }

  function continueWithUrl() {
    if (!ex) return;
    const reordered = { ...ex, brand: [ex.brand[chosen]!, ...ex.brand.filter((_, i) => i !== chosen)] };
    const name = ex.name || new URL(ex.url).hostname;
    dispatch({ type: "start", source: "url", extraction: ex, config: configFromExtraction(reordered), candidates: ex.brand,
      site: { name, font: ex.fonts[0], fontUrl: ex.fontUrl, logo: ex.logo } });
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    const { colours, dataUrl } = await paletteFromImage(file);
    const name = ex?.name || file.name.replace(/\.[a-z]+$/i, "").replace(/[-_]+/g, " ").replace(/\blogo\b/i, "").trim() || "Your store";
    setLogo({ colours, dataUrl, name }); setLogoChosen(0);
  }

  function continueWithLogo() {
    if (!logo) return;
    const ordered = [logo.colours[logoChosen]!, ...logo.colours.filter((_, i) => i !== logoChosen)].filter(Boolean);
    dispatch({ type: "start", source: "logo", config: configFromPalette(ordered, logo.dataUrl, logo.name),
      candidates: logo.colours.map((hex) => ({ hex, reason: "from your logo" })), site: { name: logo.name, logo: logo.dataUrl } });
  }

  function startFromPreset(key: PresetKey) {
    dispatch({ type: "start", source: "style", config: configFromPreset(key), candidates: [], site: { name: "Your store" } });
  }

  return (
    <main className={s.start}>
      <h1 className={s.h1}>Let's make your assistant look like your store.</h1>
      <p className={s.lede}>Start from your website and we'll pick up your colours, fonts and logo. You can fine-tune everything next — nothing goes live until you paste the snippet.</p>

      <form className={s.urlForm} onSubmit={(e) => { e.preventDefault(); read(); }}>
        <label htmlFor="url" className={s.srOnly}>Your store's web address</label>
        <input id="url" className={s.urlInput} placeholder="yourstore.com" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoComplete="url" />
        <button className={s.primary} disabled={phase === "reading"}>{phase === "reading" ? "Reading…" : "Match my store"}</button>
      </form>
      {origin && (
        <p className={s.hint}>No site handy? Try a demo store: {" "}
          <button type="button" className={s.linkBtn} onClick={() => read(`${origin}/demo/books`)}>Marginalia (books)</button> ·{" "}
          <button type="button" className={s.linkBtn} onClick={() => read(`${origin}/demo/fishing`)}>Riffle &amp; Co. (fishing)</button>
        </p>
      )}

      {phase === "reading" && (
        <ul className={s.progress} aria-live="polite">
          {PROGRESS.map((p, i) => <li key={p} className={i < tick ? s.done : i === tick ? s.active : s.pending}>{i < tick ? "✓" : "·"} {p}…</li>)}
        </ul>
      )}

      {phase === "error" && <p className={s.notice} role="alert">{error}</p>}

      {phase === "weak" && ex && (
        <p className={s.notice} role="status">
          We could read {ex.name ?? "your site"}, but couldn't find clear brand colours — some stores load their design with scripts we can't see.
          Upload your logo below and we'll take your colours from that instead.
        </p>
      )}

      {phase === "found" && ex && (
        <section className={s.found} aria-label="What we found">
          <h2 className={s.h2}>Here's what we found on {ex.name ?? "your site"}</h2>
          <div className={s.foundGrid}>
            <div>
              <h3 className={s.h3}>Brand colour <span className={s.muted}>— tap to choose</span></h3>
              <div className={s.swatches} role="radiogroup" aria-label="Brand colour">
                {ex.brand.map((b, i) => (
                  <button key={b.hex} type="button" role="radio" aria-checked={chosen === i} className={s.swatchBtn} onClick={() => setChosen(i)}>
                    <span className={s.swatch} style={{ background: b.hex }} />
                    <span className={s.swatchHex}>{b.hex.toUpperCase()}</span>
                    <span className={s.swatchWhy}>{b.reason}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className={s.h3}>Font</h3>
              <p className={s.foundValue} style={{ fontFamily: ex.fonts[0] ? `"${ex.fonts[0]}"` : undefined }}>{ex.fonts[0] ?? "We'll use your site's own font"}</p>
              {ex.fontUrl && <link rel="stylesheet" href={ex.fontUrl} />}
              <h3 className={s.h3}>Logo</h3>
              {ex.logo ? <img src={ex.logo} alt="Your logo" className={s.foundLogo} /> : <p className={s.muted}>Not found — we'll use your initials.</p>}
              {ex.background && <><h3 className={s.h3}>Background</h3><p className={s.foundValue}><span className={s.miniSwatch} style={{ background: ex.background }} /> {ex.background.toUpperCase()}</p></>}
            </div>
          </div>
          <button type="button" className={s.primary} onClick={continueWithUrl}>Looks right — continue</button>
        </section>
      )}

      <div className={s.alternatives}>
        <section className={s.altCard}>
          <h2 className={s.h3}>Upload your logo</h2>
          <p className={s.muted}>We'll pull your brand colours out of it.</p>
          <label className={s.fileLabel}>
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(e) => onLogo(e.target.files?.[0])} />
            Choose a file
          </label>
          {logo && (
            <div className={s.logoResult}>
              <img src={logo.dataUrl} alt="" className={s.foundLogo} />
              {logo.colours.length ? (
                <div className={s.swatches} role="radiogroup" aria-label="Brand colour from logo">
                  {logo.colours.map((hex, i) => (
                    <button key={hex} type="button" role="radio" aria-checked={logoChosen === i} className={s.swatchBtn} onClick={() => setLogoChosen(i)}>
                      <span className={s.swatch} style={{ background: hex }} /><span className={s.swatchHex}>{hex.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              ) : <p className={s.muted}>Your logo is black and white — we'll start in monochrome and you can pick a colour next.</p>}
              <button type="button" className={s.primary} onClick={continueWithLogo}>Continue with this</button>
            </div>
          )}
        </section>
        <section className={s.altCard}>
          <h2 className={s.h3}>Start from a style</h2>
          <p className={s.muted}>Pick the closest feel; adjust everything next.</p>
          <div className={s.presets}>
            {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
              const p = PRESETS[key];
              return (
                <button key={key} type="button" className={s.preset} onClick={() => startFromPreset(key)}
                  style={{ background: p.config.background, color: p.config.surface === "dark" ? "#f2f2f0" : "#16161a", borderRadius: p.config.shape === "square" ? 2 : p.config.shape === "soft" ? 16 : 8 }}>
                  <span className={s.presetDot} style={{ background: p.config.brand }} />
                  <strong>{p.label}</strong>
                  <span>{p.description}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Styles**

`apps/platform/components/studio/studio.module.css` (Tasks 13 and 14 append to it):
```css
.app { min-height: 100vh; }
.topbar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 24px; padding: 14px clamp(16px, 3vw, 32px); background: color-mix(in srgb, var(--paper) 88%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
.logo { display: flex; align-items: center; gap: 10px; font-weight: 600; letter-spacing: -.01em; }
.logoMark { width: 18px; height: 18px; border-radius: 50% 50% 50% 4px; background: var(--ink); }
.steps { display: flex; gap: 4px; list-style: none; margin: 0 auto; padding: 0; }
.steps button { display: flex; align-items: center; gap: 8px; border: 0; background: transparent; padding: 6px 12px; border-radius: 999px; color: var(--ink-3); cursor: pointer; font-size: 14px; }
.steps button:disabled { cursor: default; }
.stepActive button { background: var(--card); color: var(--ink); box-shadow: 0 0 0 1px var(--line); }
.stepDone button { color: var(--ink-2); }
.stepNum { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; border: 1px solid currentColor; font-size: 11px; }
.toplink { color: var(--ink-2); font-size: 14px; }
.srOnly { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

.start { max-width: 880px; margin: 0 auto; padding: 64px 20px 96px; }
.h1 { font-size: clamp(32px, 5vw, 48px); line-height: 1.05; letter-spacing: -.025em; margin: 0 0 16px; font-weight: 600; }
.h2 { font-size: 22px; letter-spacing: -.01em; margin: 0 0 16px; font-weight: 600; }
.h3 { font-size: 14px; margin: 16px 0 8px; font-weight: 600; }
.lede { font-size: 18px; color: var(--ink-2); max-width: 36em; margin: 0 0 32px; }
.muted { color: var(--ink-3); font-weight: 400; margin: 0; font-size: 14px; }
.urlForm { display: flex; gap: 8px; }
.urlInput { flex: 1; min-width: 0; height: 56px; padding: 0 20px; font-size: 18px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
.urlInput:focus { outline: 2px solid var(--ink); outline-offset: 1px; }
.primary { height: 48px; padding: 0 22px; border: 0; border-radius: 12px; background: var(--ink); color: var(--paper); font-weight: 600; cursor: pointer; }
.urlForm .primary { height: 56px; }
.primary:disabled { opacity: .6; }
.hint { color: var(--ink-3); font-size: 14px; margin: 12px 0 0; }
.linkBtn { border: 0; background: none; padding: 0; color: var(--ink); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.progress { list-style: none; padding: 0; margin: 24px 0; display: grid; gap: 6px; font-size: 15px; }
.progress .done { color: var(--ok); }
.progress .active { color: var(--ink); }
.progress .pending { color: var(--ink-3); }
.notice { margin: 24px 0; padding: 14px 16px; border-radius: 10px; background: var(--note-soft); color: var(--note); }
.found { margin: 32px 0; padding: 24px; background: var(--card); border: 1px solid var(--line); border-radius: 16px; }
.foundGrid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 32px; margin-bottom: 24px; }
.swatches { display: flex; flex-wrap: wrap; gap: 8px; }
.swatchBtn { display: grid; grid-template-columns: 36px auto; grid-template-rows: auto auto; column-gap: 10px; align-items: center; text-align: left; padding: 8px 12px 8px 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); cursor: pointer; }
.swatchBtn[aria-checked="true"] { outline: 2px solid var(--ink); outline-offset: 0; border-color: transparent; }
.swatch { grid-row: span 2; width: 36px; height: 36px; border-radius: 8px; box-shadow: inset 0 0 0 1px rgb(0 0 0 / .08); }
.swatchHex { font: 600 13px/1.2 ui-monospace, monospace; }
.swatchWhy { font-size: 12px; color: var(--ink-3); }
.foundValue { margin: 0; font-size: 18px; display: flex; align-items: center; gap: 8px; }
.miniSwatch { display: inline-block; width: 18px; height: 18px; border-radius: 4px; box-shadow: inset 0 0 0 1px rgb(0 0 0 / .12); }
.foundLogo { width: 56px; height: 56px; object-fit: contain; border-radius: 8px; border: 1px solid var(--line); background: var(--card); }
.alternatives { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 48px; }
.altCard { padding: 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--card); display: grid; gap: 8px; align-content: start; }
.fileLabel { display: inline-flex; width: fit-content; align-items: center; height: 40px; padding: 0 16px; border: 1px dashed var(--ink-3); border-radius: 10px; cursor: pointer; font-size: 14px; }
.fileLabel input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.logoResult { display: grid; gap: 12px; margin-top: 8px; }
.presets { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.preset { display: grid; gap: 4px; text-align: left; padding: 12px; border: 1px solid var(--line); cursor: pointer; font-size: 13px; }
.preset strong { font-size: 15px; }
.presetDot { width: 18px; height: 18px; border-radius: 50%; }
@media (max-width: 720px) {
  .steps button { font-size: 0; gap: 0; padding: 6px; }
  .stepNum { font-size: 11px; }
  .foundGrid, .alternatives { grid-template-columns: 1fr; }
  .urlForm { flex-direction: column; }
}
```

- [ ] **Step 5: Verify**

Open `/`. Expected: a calm page with a large URL field. Clicking the "Marginalia (books)" demo link shows progress ticking, then "Here's what we found on Marginalia" with the oxblood swatch first and its reason, EB Garamond rendered in its own font, the M logo, and the cream background. Typing `not a url!!` shows a friendly error. Uploading a PNG logo shows swatches from it. Clicking a style tile moves to step 2 (a blank area until Task 13). At 375px everything stacks and the URL button goes full width.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(platform): studio shell and step 1 — match from URL, logo or style

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 13: Studio Step 2 ("Tune it"): preview on a mock of their store, controls, fit check

**Files:**
- Create: `apps/platform/components/studio/StepTune.tsx`, `Preview.tsx`, `MockStore.tsx`, `Controls.tsx`, `FitCheck.tsx`
- Modify: `apps/platform/components/studio/Studio.tsx`, `studio.module.css` (append)

**Interfaces:**
- Consumes: `StudioState`, `Action`, `AgentPreview`, `deriveTokens`, `googleFontUrl`, `FONT_CHOICES`.
- Produces: `<StepTune state dispatch />`. Continue dispatches `{ type: "step", step: 3 }`.

Behaviour:
- The preview stage sets `font-family` to the site font (`state.site.font`, or a system stack), so `"inherit"` in the widget shows the merchant's real font. The stage also loads `state.site.fontUrl`.
- Mock-store background: `config.background` when `preview.host` matches the config's surface. Otherwise a neutral white or near-black, so merchants can check the widget on both.
- `FitCheck` maps token adjustments to highlight keys: `--c-link` → `link`; `--c-brand-edge` and `--c-on-brand` → `btn`. "Show me" toggles `state.highlight`, which passes to `AgentPreview`'s `highlight` attribute.
- When the site font is known but has no Google Fonts URL, FitCheck adds: *"Preview uses a stand-in for {font}. On your site, the assistant uses your real font."*

- [ ] **Step 1: MockStore**

`apps/platform/components/studio/MockStore.tsx`:
```tsx
import type { AgentConfig } from "@concierge/agent/core";
import s from "./studio.module.css";

export function MockStore({ config, site, host }: { config: AgentConfig; site: { name: string; logo?: string }; host: "light" | "dark" }) {
  const dark = host === "dark";
  const matchesSurface = (config.surface === "dark") === dark;
  const bg = matchesSurface && config.background ? config.background : dark ? "#121316" : "#ffffff";
  const ink = dark ? "#f1f1ee" : "#1b1b1f";
  const tile = dark ? "rgb(255 255 255 / .06)" : "rgb(0 0 0 / .05)";
  const display = config.font.display ? `"${config.font.display}", inherit` : "inherit";
  return (
    <div className={s.mock} style={{ background: bg, color: ink }} aria-hidden="true">
      <div className={s.mockHeader}>
        {site.logo ? <img src={site.logo} alt="" className={s.mockLogo} /> : <span className={s.mockLogoText} style={{ fontFamily: display }}>{site.name}</span>}
        <span className={s.mockNav}><span>Shop</span><span>New in</span><span>About</span></span>
        <span className={s.mockCart}>Basket (0)</span>
      </div>
      <div className={s.mockHero}>
        <div className={s.mockHeadline} style={{ fontFamily: display }}>New season, chosen with care</div>
        <div className={s.mockLine} style={{ background: tile, width: "70%" }} />
        <div className={s.mockLine} style={{ background: tile, width: "52%" }} />
        <span className={s.mockButton} style={{ background: config.brand, borderRadius: config.shape === "square" ? 0 : config.shape === "soft" ? 999 : 8 }} />
      </div>
      <div className={s.mockGrid}>
        {[0, 1, 2, 3].map((i) => <div key={i} className={s.mockTile} style={{ background: tile }} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Preview**

`apps/platform/components/studio/Preview.tsx`:
```tsx
"use client";
import type { Dispatch } from "react";
import { AgentPreview } from "@/components/AgentPreview";
import { MockStore } from "./MockStore";
import type { Action, StudioState } from "./state";
import s from "./studio.module.css";

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className={s.segmented} role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

export function Preview({ state, dispatch }: { state: StudioState; dispatch: Dispatch<Action> }) {
  const { preview, config, site } = state;
  const siteFont = site.font ? `"${site.font}", system-ui, sans-serif` : "system-ui, sans-serif";
  const setPreview = (patch: Partial<StudioState["preview"]>) => dispatch({ type: "preview", patch });
  return (
    <section className={s.previewCol} aria-label="Preview">
      <div className={s.toolbar}>
        <Segmented label="Device" value={preview.device} options={[["desktop", "Desktop"], ["mobile", "Phone"]]} onChange={(device) => setPreview({ device })} />
        <Segmented label="Assistant" value={preview.open ? "open" : "closed"} options={[["open", "Open"], ["closed", "Closed"]]} onChange={(v) => setPreview({ open: v === "open" })} />
        <Segmented label="Page" value={preview.host} options={[["light", "Light page"], ["dark", "Dark page"]]} onChange={(host) => setPreview({ host })} />
        <Segmented label="Sample products" value={config.store} options={[["books", "Books"], ["fishing", "Outdoor gear"]]} onChange={(store) => dispatch({ type: "patch", patch: { store } })} />
      </div>
      {site.fontUrl && <link rel="stylesheet" href={site.fontUrl} />}
      <div className={s.stageWrap}>
        <div className={preview.device === "mobile" ? s.stagePhone : s.stageDesktop} style={{ fontFamily: siteFont }}>
          <MockStore config={config} site={site} host={preview.host} />
          <div className={s.agentLayer}>
            <AgentPreview config={config} autoplay={2} open={preview.open} highlight={state.highlight} />
          </div>
        </div>
      </div>
      <p className={s.previewNote}>This is a mock of your page with a sample conversation, so you can judge the fit before anything goes live.</p>
    </section>
  );
}
```

- [ ] **Step 3: FitCheck**

`apps/platform/components/studio/FitCheck.tsx`:
```tsx
"use client";
import { useMemo, type Dispatch } from "react";
import { deriveTokens } from "@concierge/agent/core";
import type { Action, StudioState } from "./state";
import s from "./studio.module.css";

const HIGHLIGHT: Record<string, string> = { "--c-link": "link", "--c-brand-edge": "btn", "--c-on-brand": "btn" };

export function FitCheck({ state, dispatch }: { state: StudioState; dispatch: Dispatch<Action> }) {
  const { adjustments } = useMemo(() => deriveTokens(state.config), [state.config]);
  const fontNote = state.site.font && !state.site.fontUrl && state.config.font.family === "inherit";
  const ok = adjustments.length === 0 && !fontNote;
  return (
    <div className={ok ? s.fitOk : s.fitNotes} role="status" aria-live="polite">
      {ok ? (
        <p><strong>✓ Looks right.</strong> Every colour pairing is readable and on-brand.</p>
      ) : (
        <>
          <p><strong>We've adjusted {adjustments.length === 1 ? "one thing" : `${adjustments.length} things`} so it stays readable</strong> — your colours are kept, just shaded where needed.</p>
          <ul>
            {adjustments.map((a) => {
              const key = HIGHLIGHT[a.token];
              const active = state.highlight === key;
              return (
                <li key={a.token}>
                  <span className={s.fitSwatches}><span style={{ background: a.from }} />→<span style={{ background: a.to }} /></span>
                  <span>{a.reason}</span>
                  {key && <button type="button" className={s.linkBtn} onClick={() => dispatch({ type: "highlight", token: active ? null : key })}>{active ? "Hide" : "Show me"}</button>}
                </li>
              );
            })}
            {fontNote && <li><span>Preview uses a stand-in for <strong>{state.site.font}</strong>. On your site, the assistant uses your real font.</span></li>}
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Controls**

`apps/platform/components/studio/Controls.tsx`:
```tsx
"use client";
import type { Dispatch, ReactNode } from "react";
import { googleFontUrl, type AgentConfig, type CardStyle, type Density, type Shape, type Voice } from "@concierge/agent/core";
import { FONT_CHOICES } from "@/lib/fonts";
import { isDarkHex, type Action, type StudioState } from "./state";
import s from "./studio.module.css";

const VOICES: [Voice, string, string][] = [
  ["warm", "Warm", "“Lovely choice — here are three I'd happily recommend.”"],
  ["neutral", "Neutral", "“Here are three options that fit what you asked for.”"],
  ["terse", "Straight to it", "“3 matches. Sorted by fit.”"],
];
const HEX = /^#[0-9a-f]{6}$/i;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className={s.group}><legend>{title}</legend>{children}</fieldset>;
}

function Thumbs<T extends string>({ label, value, options, onChange, render }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; render: (v: T) => ReactNode }) {
  return (
    <div className={s.thumbs} role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={s.thumb} onClick={() => onChange(v)}>
          <span className={s.thumbArt} aria-hidden="true">{render(v)}</span>{text}
        </button>
      ))}
    </div>
  );
}

export function Controls({ state, dispatch }: { state: StudioState; dispatch: Dispatch<Action> }) {
  const c = state.config;
  const patch = (p: Partial<AgentConfig>) => dispatch({ type: "patch", patch: p });
  const setFont = (family: string, display?: string) => {
    const families = [family !== "inherit" ? family : "", display ?? ""].filter(Boolean);
    patch({ font: { family, ...(display ? { display } : {}), ...(families.length ? { url: googleFontUrl(families) } : {}) } });
  };
  const candidates = state.candidates.length ? state.candidates : [{ hex: c.brand, reason: "current" }];

  return (
    <div className={s.controls}>
      <Group title="Look">
        <label className={s.label}>Brand colour</label>
        <div className={s.swatchRow}>
          {candidates.map((cand) => (
            <button key={cand.hex} type="button" title={`${cand.hex.toUpperCase()} — ${cand.reason}`} aria-label={`Use ${cand.hex}, ${cand.reason}`}
              aria-pressed={c.brand.toLowerCase() === cand.hex.toLowerCase()} className={s.dot} style={{ background: cand.hex }} onClick={() => patch({ brand: cand.hex })} />
          ))}
          <label className={s.dotPicker} title="Pick any colour">
            <input type="color" value={c.brand} onChange={(e) => patch({ brand: e.target.value })} aria-label="Pick any brand colour" />+
          </label>
        </div>

        <label className={s.label} htmlFor="font">Text font</label>
        <select id="font" className={s.select} value={c.font.family} onChange={(e) => setFont(e.target.value, c.font.display)}>
          <option value="inherit">Use my site's font{state.site.font ? ` (${state.site.font})` : ""} — recommended</option>
          {FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <label className={s.label} htmlFor="display">Heading font</label>
        <select id="display" className={s.select} value={c.font.display ?? ""} onChange={(e) => setFont(c.font.family, e.target.value || undefined)}>
          <option value="">Same as text</option>
          {[...new Set([state.site.font, ...FONT_CHOICES].filter(Boolean) as string[])].map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        <label className={s.label}>Page</label>
        <Thumbs<"light" | "dark"> label="Surface" value={c.surface} options={[["light", "Light"], ["dark", "Dark"]]}
          onChange={(surface) => {
            // Switching surface drops a background that belonged to the other surface; switching back restores the extracted one
            const extractedBg = state.extraction?.background;
            const extractedSurface = extractedBg ? (isDarkHex(extractedBg) ? "dark" : "light") : null;
            patch({ surface, background: extractedBg && surface === extractedSurface ? extractedBg : undefined });
          }}
          render={(v) => <span className={s.artSurface} data-v={v} />} />

        <label className={s.label}>Corners</label>
        <Thumbs<Shape> label="Corners" value={c.shape} options={[["square", "Square"], ["rounded", "Rounded"], ["soft", "Soft"]]} onChange={(shape) => patch({ shape })}
          render={(v) => <span className={s.artShape} style={{ borderRadius: v === "square" ? 1 : v === "rounded" ? 6 : 14 }} />} />

        <label className={s.label}>Spacing</label>
        <Thumbs<Density> label="Spacing" value={c.density} options={[["compact", "Compact"], ["regular", "Regular"], ["airy", "Airy"]]} onChange={(density) => patch({ density })}
          render={(v) => <span className={s.artDensity} data-v={v}><i /><i /><i /></span>} />
      </Group>

      <Group title="Personality">
        <label className={s.label} htmlFor="name">Assistant name</label>
        <input id="name" className={s.input} value={c.agent.name} onChange={(e) => patch({ agent: { ...c.agent, name: e.target.value } })} />
        <label className={s.label} htmlFor="greeting">Greeting</label>
        <textarea id="greeting" className={s.textarea} rows={3} value={c.agent.greeting} onChange={(e) => patch({ agent: { ...c.agent, greeting: e.target.value } })} />
        <label className={s.label}>Avatar</label>
        <div className={s.inlineRadios}>
          {state.site.logo && <label><input type="radio" checked={c.agent.avatar === state.site.logo} onChange={() => patch({ agent: { ...c.agent, avatar: state.site.logo } })} /> Your logo</label>}
          <label><input type="radio" checked={!c.agent.avatar} onChange={() => patch({ agent: { ...c.agent, avatar: undefined } })} /> Initials</label>
        </div>
        <label className={s.label}>Tone of voice</label>
        <div className={s.voices} role="radiogroup" aria-label="Tone of voice">
          {VOICES.map(([v, label, sample]) => (
            <button key={v} type="button" role="radio" aria-checked={c.voice === v} className={s.voice} onClick={() => patch({ voice: v })}>
              <strong>{label}</strong><span>{sample}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group title="Products">
        <Thumbs<CardStyle> label="Product cards" value={c.cardStyle} options={[["visual", "Picture-led"], ["spec", "Spec-led"]]} onChange={(cardStyle) => patch({ cardStyle })}
          render={(v) => <span className={s.artCard} data-v={v}><i /><i /><i /></span>} />
      </Group>

      <details className={s.exact}>
        <summary>Exact values <span className={s.muted}>— hex codes, custom font, launcher</span></summary>
        <label className={s.label} htmlFor="hex">Brand hex</label>
        <input id="hex" className={s.input} defaultValue={c.brand} key={c.brand} onBlur={(e) => HEX.test(e.target.value) && patch({ brand: e.target.value })} />
        <label className={s.label} htmlFor="accent">Accent hex (optional)</label>
        <input id="accent" className={s.input} defaultValue={c.accent ?? ""} placeholder="Derived from brand" onBlur={(e) => patch({ accent: HEX.test(e.target.value) ? e.target.value : undefined })} />
        <label className={s.label} htmlFor="bg">Background hex (optional)</label>
        <input id="bg" className={s.input} defaultValue={c.background ?? ""} key={c.background} placeholder="Derived from brand" onBlur={(e) => patch({ background: HEX.test(e.target.value) ? e.target.value : undefined })} />
        <label className={s.label} htmlFor="fonturl">Custom font stylesheet URL</label>
        <input id="fonturl" className={s.input} defaultValue={c.font.url ?? ""} placeholder="https://fonts.googleapis.com/…" onBlur={(e) => patch({ font: { ...c.font, url: e.target.value || undefined } })} />
        <label className={s.label}>Launcher position</label>
        <div className={s.inlineRadios}>
          <label><input type="radio" checked={c.launcher.position === "bottom-right"} onChange={() => patch({ launcher: { ...c.launcher, position: "bottom-right" } })} /> Bottom right</label>
          <label><input type="radio" checked={c.launcher.position === "bottom-left"} onChange={() => patch({ launcher: { ...c.launcher, position: "bottom-left" } })} /> Bottom left</label>
        </div>
        <label className={s.label} htmlFor="launcher">Launcher label</label>
        <input id="launcher" className={s.input} value={c.launcher.label ?? ""} placeholder={c.agent.name} onChange={(e) => patch({ launcher: { ...c.launcher, label: e.target.value || undefined } })} />
      </details>
    </div>
  );
}
```



- [ ] **Step 5: StepTune and wiring**

`apps/platform/components/studio/StepTune.tsx`:
```tsx
"use client";
import type { Dispatch } from "react";
import { Controls } from "./Controls";
import { FitCheck } from "./FitCheck";
import { Preview } from "./Preview";
import type { Action, StudioState } from "./state";
import s from "./studio.module.css";

export function StepTune({ state, dispatch }: { state: StudioState; dispatch: Dispatch<Action> }) {
  return (
    <main className={s.tune}>
      <Preview state={state} dispatch={dispatch} />
      <aside className={s.side}>
        <div className={s.sideScroll}>
          <h1 className={s.h2}>Tune it</h1>
          <p className={s.muted}>Changes show instantly on the left.</p>
          <Controls state={state} dispatch={dispatch} />
        </div>
        <div className={s.sideFoot}>
          <FitCheck state={state} dispatch={dispatch} />
          <button type="button" className={s.primary} onClick={() => dispatch({ type: "step", step: 3 })}>Looks right — get my snippet</button>
        </div>
      </aside>
    </main>
  );
}
```

In `Studio.tsx`, import `StepTune` and render `{state.step === 2 && <StepTune state={state} dispatch={dispatch} />}` in place of the Task 13 comment.

- [ ] **Step 6: Append styles**

Append to `studio.module.css`:
```css
.tune { display: grid; grid-template-columns: minmax(0, 1fr) 400px; height: calc(100vh - 61px); }
.previewCol { display: flex; flex-direction: column; min-width: 0; padding: 16px; gap: 12px; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; }
.segmented { display: inline-flex; padding: 3px; border-radius: 10px; background: var(--line); }
.segmented button { border: 0; background: transparent; padding: 6px 10px; border-radius: 8px; font-size: 13px; color: var(--ink-2); cursor: pointer; }
.segmented button[aria-checked="true"] { background: var(--card); color: var(--ink); box-shadow: 0 1px 2px rgb(0 0 0 / .08); }
.stageWrap { flex: 1; min-height: 0; display: grid; place-items: center; overflow: auto; border-radius: 16px; background: repeating-linear-gradient(45deg, #f1f0eb 0 10px, #eeede7 10px 20px); }
.stageDesktop, .stagePhone { position: relative; overflow: hidden; box-shadow: 0 20px 60px -20px rgb(0 0 0 / .25); }
.stageDesktop { width: 100%; height: 100%; min-height: 560px; }
.stagePhone { width: 375px; height: 740px; border-radius: 36px; border: 10px solid #111; }
.agentLayer { position: absolute; inset: 0; }
.agentLayer > * { width: 100%; height: 100%; }
.previewNote { margin: 0; font-size: 13px; color: var(--ink-3); }
.mock { position: absolute; inset: 0; overflow: hidden; }
.mockHeader { display: flex; align-items: center; gap: 24px; padding: 18px 28px; border-bottom: 1px solid rgb(127 127 127 / .2); }
.mockLogo { height: 32px; width: auto; }
.mockLogoText { font-size: 20px; font-weight: 600; }
.mockNav { display: flex; gap: 20px; flex: 1; font-size: 14px; opacity: .75; }
.mockCart { font-size: 14px; opacity: .75; }
.mockHero { padding: 48px 28px; display: grid; gap: 14px; max-width: 560px; }
.mockHeadline { font-size: clamp(28px, 4vw, 44px); line-height: 1.05; }
.mockLine { height: 12px; border-radius: 6px; }
.mockButton { width: 140px; height: 42px; margin-top: 8px; }
.mockGrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 0 28px; }
.mockTile { aspect-ratio: 3 / 4; border-radius: 6px; }
.stagePhone .mockNav, .stagePhone .mockGrid { display: none; }
.side { display: flex; flex-direction: column; min-height: 0; border-left: 1px solid var(--line); background: var(--card); }
.sideScroll { flex: 1; overflow-y: auto; padding: 20px 20px 8px; }
.sideFoot { display: grid; gap: 12px; padding: 16px 20px; border-top: 1px solid var(--line); }
.controls { display: grid; gap: 8px; margin-top: 12px; }
.group { border: 0; border-top: 1px solid var(--line); margin: 8px 0 0; padding: 16px 0 4px; display: grid; gap: 6px; }
.group legend { font-weight: 600; padding: 0; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-2); }
.label { font-size: 13px; font-weight: 600; margin-top: 8px; }
.input, .select, .textarea { width: 100%; padding: 9px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); font-size: 14px; }
.textarea { resize: vertical; }
.swatchRow { display: flex; flex-wrap: wrap; gap: 8px; }
.dot { width: 36px; height: 36px; border-radius: 50%; border: 0; cursor: pointer; box-shadow: inset 0 0 0 1px rgb(0 0 0 / .1); }
.dot[aria-pressed="true"] { outline: 2px solid var(--ink); outline-offset: 2px; }
.dotPicker { position: relative; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; border: 1px dashed var(--ink-3); cursor: pointer; color: var(--ink-2); }
.dotPicker input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.thumbs { display: flex; gap: 8px; }
.thumb { flex: 1; display: grid; justify-items: center; gap: 6px; padding: 10px 6px; border: 1px solid var(--line); border-radius: 10px; background: var(--paper); font-size: 12px; cursor: pointer; }
.thumb[aria-checked="true"] { outline: 2px solid var(--ink); border-color: transparent; background: var(--card); }
.thumbArt { display: grid; place-items: center; height: 36px; }
.artShape { width: 44px; height: 28px; background: var(--ink); }
.artSurface { width: 44px; height: 28px; border-radius: 4px; border: 1px solid var(--line); background: #fff; }
.artSurface[data-v="dark"] { background: #16161a; }
.artDensity { display: grid; width: 40px; }
.artDensity i { height: 3px; background: var(--ink-2); border-radius: 2px; }
.artDensity[data-v="compact"] { gap: 3px; }
.artDensity[data-v="regular"] { gap: 6px; }
.artDensity[data-v="airy"] { gap: 9px; }
.artCard { display: grid; gap: 3px; width: 44px; }
.artCard i { height: 4px; background: var(--ink-3); border-radius: 2px; }
.artCard[data-v="visual"] { grid-template-columns: 14px 1fr; grid-template-rows: repeat(2, 8px); }
.artCard[data-v="visual"] i:first-child { grid-row: span 2; height: auto; background: var(--ink); }
.artCard[data-v="spec"] { grid-template-columns: repeat(3, 1fr); }
.artCard[data-v="spec"] i { height: 10px; }
.inlineRadios { display: flex; gap: 16px; font-size: 14px; }
.voices { display: grid; gap: 6px; }
.voice { display: grid; gap: 2px; text-align: left; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--paper); cursor: pointer; }
.voice[aria-checked="true"] { outline: 2px solid var(--ink); border-color: transparent; background: var(--card); }
.voice span { font-size: 13px; color: var(--ink-2); }
.exact { margin-top: 12px; border-top: 1px solid var(--line); padding-top: 12px; display: grid; gap: 6px; }
.exact summary { cursor: pointer; font-weight: 600; font-size: 14px; }
.fitOk, .fitNotes { padding: 12px 14px; border-radius: 10px; font-size: 13px; }
.fitOk { background: var(--ok-soft); color: var(--ok); }
.fitNotes { background: var(--note-soft); color: var(--note); }
.fitOk p, .fitNotes p { margin: 0; }
.fitNotes ul { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.fitNotes li { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: start; }
.fitSwatches { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; }
.fitSwatches span { width: 14px; height: 14px; border-radius: 3px; box-shadow: inset 0 0 0 1px rgb(0 0 0 / .15); }
@media (max-width: 960px) {
  .tune { grid-template-columns: 1fr; height: auto; }
  .previewCol { height: 80vh; }
  .side { border-left: 0; border-top: 1px solid var(--line); }
  .stagePhone { transform: scale(.8); transform-origin: top center; }
}
```

- [ ] **Step 7: Verify**

From step 1, choose the Marginalia demo and continue. Expected: the mock page is cream with the M logo in EB Garamond. The widget is open mid-conversation with procedural picks, in oxblood with soft corners. Fit check is green. Then:
- Click the pale-pink swatch via the colour picker (`#F4C2C2`). Fit check turns amber and lists the link and button adjustments. "Show me" outlines the reply chips and "Details →" links (link), or the send button and launcher (btn).
- Switch to Phone: 375px frame, full-screen sheet. Switch to Closed: only the launcher.
- Change tone to "Straight to it": the conversation restarts with terse copy. Change product cards to Spec-led: the cards switch to spec layout.
- Sample products → Outdoor gear: the fishing near-miss view.
- At a narrow browser width the controls stack under the preview.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(platform): studio step 2 — in-context preview, brand controls and fit check

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 14: Studio Step 3 ("Add it to your site")

**Files:**
- Create: `apps/platform/components/studio/StepInstall.tsx`
- Modify: `apps/platform/components/studio/Studio.tsx`, `studio.module.css` (append)

**Interfaces:**
- Consumes: `POST /api/configs`, `StudioState.savedId`.
- Produces: on entering step 3 it saves the config (reusing `savedId`, so later edits overwrite the same id) and shows the snippet `<script src="${origin}/agent.js" data-config="${id}" async></script>`. It also shows a copy button, platform tabs, a mailto for "Send to my developer", and links to see the config live on both demo stores (`/demo/books?config=<id>`, `/demo/fishing?config=<id>`).

- [ ] **Step 1: StepInstall**

`apps/platform/components/studio/StepInstall.tsx`:
```tsx
"use client";
import { useEffect, useState, type Dispatch } from "react";
import type { Action, StudioState } from "./state";
import s from "./studio.module.css";

type Tab = "any" | "shopify" | "squarespace" | "wordpress" | "dev";
const TABS: [Tab, string][] = [["any", "Any website"], ["shopify", "Shopify"], ["squarespace", "Squarespace"], ["wordpress", "WordPress"], ["dev", "Send to my developer"]];
const STEPS: Record<Exclude<Tab, "dev">, string[]> = {
  any: ["Copy the snippet.", "Paste it just before the closing </body> tag on every page where you want the assistant.", "Publish. That's it."],
  shopify: ["In Shopify admin, go to Online Store → Themes.", "Click ⋯ → Edit code, and open layout/theme.liquid.", "Paste the snippet just above </body>, then Save."],
  squarespace: ["Go to Settings → Advanced → Code Injection.", "Paste the snippet into the Footer box.", "Save."],
  wordpress: ["Install a code-snippets plugin such as WPCode.", "Add Snippet → HTML snippet, and paste the code.", "Set location to “Site Wide Footer”, then activate."],
};

export function StepInstall({ state, dispatch }: { state: StudioState; dispatch: Dispatch<Action> }) {
  const [status, setStatus] = useState<"saving" | "saved" | "error">("saving");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>("any");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    let cancelled = false;
    fetch("/api/configs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...state.config, id: state.savedId ?? "" }) })
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) { setError(data.error); setStatus("error"); return; }
        dispatch({ type: "saved", id: data.id });
        setStatus("saved");
      })
      .catch(() => { if (!cancelled) { setError("Couldn't save — check your connection and try again."); setStatus("error"); } });
    return () => { cancelled = true; };
    // Save once per visit to this step
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const id = state.savedId;
  const snippet = id ? `<script src="${origin}/agent.js" data-config="${id}" async></script>` : "";
  const copy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };
  const mail = `mailto:?subject=${encodeURIComponent(`Please add our shopping assistant to ${state.site.name}`)}&body=${encodeURIComponent(
    `Hi,\n\nCould you add this snippet just before the closing </body> tag on every page of our site?\n\n${snippet}\n\nIt loads asynchronously and won't affect page speed or styles (it renders inside its own Shadow DOM).\n\nThanks!`,
  )}`;

  return (
    <main className={s.install}>
      <h1 className={s.h1}>Add it to your site</h1>
      <p className={s.lede}>One line of code. Any changes you make in Concierge later update your site automatically — no need to paste it again.</p>

      {status === "saving" && <p className={s.muted} aria-live="polite">Saving your design…</p>}
      {status === "error" && <p className={s.notice} role="alert">{error} <button type="button" className={s.linkBtn} onClick={() => dispatch({ type: "step", step: 2 })}>Back to editing</button></p>}

      {status === "saved" && id && (
        <>
          <div className={s.snippet}>
            <code>{snippet}</code>
            <button type="button" className={s.primary} onClick={copy} aria-live="polite">{copied ? "Copied ✓" : "Copy snippet"}</button>
          </div>

          <div className={s.tabs} role="tablist" aria-label="Where is your store?">
            {TABS.map(([t, label]) => (
              <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}>{label}</button>
            ))}
          </div>
          <div className={s.tabPanel} role="tabpanel">
            {tab === "dev" ? (
              <p>We'll write the email for you — it includes the snippet and a note that it won't touch their styles. <a className={s.linkBtn} href={mail}>Open email draft</a></p>
            ) : (
              <ol>{STEPS[tab].map((step) => <li key={step}>{step}</li>)}</ol>
            )}
          </div>

          <div className={s.tryLive}>
            <h2 className={s.h3}>See it on a real page first</h2>
            <p className={s.muted}>Your design, embedded with this exact snippet on our demo stores:</p>
            <p>
              <a className={s.linkBtn} href={`/demo/books?config=${id}`} target="_blank" rel="noreferrer">Bookshop demo ↗</a>{"  ·  "}
              <a className={s.linkBtn} href={`/demo/fishing?config=${id}`} target="_blank" rel="noreferrer">Outdoor demo ↗</a>
            </p>
          </div>
          <button type="button" className={s.secondary} onClick={() => dispatch({ type: "step", step: 2 })}>← Keep editing the design</button>
        </>
      )}
    </main>
  );
}
```

In `Studio.tsx`, import `StepInstall` and replace the remaining comment with the line below. Don't key it on the config: the `saved` action changes `config.id`, which would remount it and save in a loop. Leaving step 3 unmounts it anyway, so coming back re-saves.

```tsx
{state.step === 3 && <StepInstall state={state} dispatch={dispatch} />}
```

- [ ] **Step 2: Append styles**

Append to `studio.module.css`:
```css
.install { max-width: 760px; margin: 0 auto; padding: 64px 20px 96px; display: grid; gap: 20px; }
.install .h1, .install .lede { margin-bottom: 0; }
.snippet { display: flex; gap: 12px; align-items: center; padding: 16px; background: #16161a; color: #f4f4ef; border-radius: 14px; }
.snippet code { flex: 1; min-width: 0; font: 14px/1.5 ui-monospace, "SF Mono", Menlo, monospace; overflow-wrap: anywhere; }
.snippet .primary { background: #f4f4ef; color: #16161a; flex: none; }
.tabs { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid var(--line); }
.tabs button { border: 0; background: none; padding: 10px 12px; font-size: 14px; color: var(--ink-2); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tabs button[aria-selected="true"] { color: var(--ink); border-color: var(--ink); }
.tabPanel { font-size: 15px; }
.tabPanel ol { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
.tryLive { padding: 16px 20px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); }
.tryLive p { margin: 6px 0 0; }
.secondary { justify-self: start; height: 40px; padding: 0 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); cursor: pointer; }
@media (max-width: 640px) { .snippet { flex-direction: column; align-items: stretch; } }
```

- [ ] **Step 3: Verify**

Run the full studio flow from the Riffle demo URL. Expected: step 3 shows "Saving your design…", then the snippet with an id like `riffle-co-assistant-ab12`. Copy puts the exact snippet on the clipboard. Tabs switch instructions. "Send to my developer" opens a mail draft containing the snippet. "Bookshop demo ↗" opens `/demo/books?config=<id>` with *your* design on the bookshop. Go back to step 2, change the colour, return to step 3: same id, and the demo page reflects the new colour after a refresh.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(platform): studio step 3 — save, snippet, install guides, live demo links

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Deploy to Railway, README and DECISIONS.md

**Files:**
- Create: `railway.json`, `README.md`
- Modify: `DECISIONS.md`

**Interfaces:**
- Produces: one public Railway URL serving `/`, `/lab`, `/demo/books`, `/demo/fishing`. A volume is mounted at `/data`, and `CONFIG_DIR=/data/configs`.

- [ ] **Step 1: railway.json**

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "RAILPACK", "buildCommand": "pnpm build" },
  "deploy": { "startCommand": "pnpm start", "healthcheckPath": "/demo/books", "restartPolicyType": "ON_FAILURE" }
}
```

- [ ] **Step 2: README.md**

```markdown
# Concierge

An embeddable AI-style shopping assistant that takes on each merchant's brand, plus the studio where merchants set it up.

- **Studio** — `/` : match your store from a URL, a logo or a style → tune it in context → copy the snippet
- **Demo stores** — `/demo/books` (Marginalia) and `/demo/fishing` (Riffle & Co.): same `agent.js`, two configs
- **Lab** — `/lab` : the same agent under six deliberately different brands

## Run locally

Requires Node 22+ and pnpm 9.

    pnpm install
    pnpm build        # builds agent.js into apps/platform/public, then Next
    pnpm dev          # agent watch build + next dev on http://localhost:3000
    pnpm test         # token engine, matcher, conversation engine, style lint

Widget-only harness: `pnpm --filter @concierge/agent harness` (add `?lab` or `?autoplay=4`).

## How it fits together

- `packages/agent` — pure TS core (token engine, catalogs, matcher, scripted engine) and the Preact widget inside a `<concierge-agent>` Shadow-DOM web component, built to one `agent.js`.
- `apps/platform` — Next.js: studio, lab, demo stores, `/configs/:id.json`, `/api/configs`, `/api/extract`.

Embed snippet: `<script src="https://<host>/agent.js" data-config="<id>" async></script>`

The agent is scripted (no LLM) — see DECISIONS.md.
```

- [ ] **Step 3: Deploy**

Use the `railway:use-railway` skill. From the repo root: `railway init` (project "concierge"), `railway up`. Add a volume mounted at `/data`, set the variable `CONFIG_DIR=/data/configs`, and generate a public domain. **Ask the user before creating Railway resources.** This needs their logged-in Railway account (`! railway login` if needed).

Verify on the public URL: `/demo/books` and `/demo/fishing` load the widget. The studio flow saves a config. `/configs/<new id>.json` returns it. After a redeploy the saved config still exists (the volume works).

- [ ] **Step 4: Write DECISIONS.md (one page)**

Turn the running log into prose under the six headings. Keep it to about 500 words total. These points must be in it:
- **Merchant:** begin from the store they already have (URL, logo or style), not a settings form. Preview in context on a mock of their page. Controls use merchant ideas (look, personality, products). Hex codes sit under "Exact values". The fit check explains every automatic adjustment in plain language. The snippet carries an id, so edits never need re-pasting. `background` was added to the config because cream vs white matters.
- **Across brands:** one config becomes about 40 derived tokens in OKLCH. AA contrast is enforced with the hue kept. Components read only the tokens (a test fails on literal colours). Shadow DOM plus a reset of inherited text properties protects against hostile host CSS. `font-family` is deliberately inherited so "use my site's font" needs no setup. Card layout and voice change as well as colour. `/lab` is the proof.
- **AI overrides:** fill in what actually happened during the build. Candidates: rejecting an iframe embed (it fixes isolation but breaks font inheritance and mobile full-screen), rejecting a real LLM, rejecting per-brand CSS overrides, and replacing generic "no results" copy with computed near misses.
- **Cut:** real LLM, auth and accounts, real catalog import, the screenshot backdrop in the preview, and any other items from the spec's cut list that were actually cut.
- **Weakest part:** be honest. Likely URL extraction on JS-heavy real sites, or anyone being able to overwrite a saved config id (no auth).
- **Another hour:** e.g. per-merchant catalog import, an LLM behind the same engine interface (the `route`/`steps` split makes this a drop-in), or the screenshot backdrop.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: Railway deploy config, README and DECISIONS

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Spec coverage

| Spec section | Task(s) |
|---|---|
| §3 Architecture, config delivery, host integration | 1, 5, 8 |
| §4 Token engine, contrast enforcement, cardStyle/voice, /lab | 2, 5, 7, 10 |
| §5 Engine, strip, matcher, both journeys, mobile | 3, 4, 6, 7 |
| §6 Config page steps 1–3, extraction, logo, presets, fit check | 11, 12, 13, 14 |
| §7 Demo storefronts | 9 |
| §8 Light testing | 2, 3, 4, 5 |
| §9 Delivery (Railway, README, DECISIONS) | 15 |

Deviations from the spec, to record in DECISIONS.md: `packages/catalogs` was merged into `packages/agent` (the widget bundles the data anyway). `AgentConfig.background` was added. The avatar options are logo or initials ("none" was dropped).
