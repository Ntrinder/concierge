# Concierge — Embeddable Shopping Agent: Design

Date: 2026-09-22
Status: Approved in brainstorming, pending spec review
Context: 72-hour take-home. Brief: `~/Downloads/take_home_assignment_minimal.md`.
Nature: proof of concept. Interface quality is graded; code structure secondary.

## 1. Goal

Build two things for a fictional platform, **Concierge**:

1. A **configuration page** where a merchant (often non-technical, but brand-obsessive) makes the agent match their store and copies an embed snippet.
2. The **agent itself**, embedded on two demo storefronts with visibly different brands — **Marginalia** (independent bookshop) and **Riffle & Co.** (fishing tackle) — from the same code, differing only by config.

Success = the agent looks native on both stores, works at 375px, carries a shopper from an open-ended need to a confident "add to basket", and shows one non-happy moment per store.

## 2. Key decisions (summary)

| Decision | Choice | Why |
|---|---|---|
| Agent intelligence | Scripted, deterministic; no LLM | Brief allows it; reliable demo; time goes to UI |
| Embed | Real `<script>` + web component in Shadow DOM | Snippet genuinely works; isolation from host CSS both ways |
| Widget UI lib | Preact inside the web component | ~30kb, React-like, fast to extend live |
| Brands | Marginalia (books), Riffle & Co. (fishing) | Taste-led vs spec-led → layout and voice must differ, not just colour |
| Non-happy moments | Books: change of mind. Fishing: nothing matches | One each, both built on the constraint strip |
| Config page approach | "Start from what you have" (URL / logo / style) → tune in context → snippet | Resolves precision vs non-technical tension |
| Snippet carries | Config ID, not config | Merchant updates without re-pasting |
| Hosting | Single Railway service (Next.js) + Railway volume for saved configs | One deploy, one link |
| Testing | Very light: a few Vitest unit tests on token engine + matcher | POC; no Playwright |

## 3. Architecture

pnpm workspace monorepo at `~/src/concierge`:

```
packages/agent      Embeddable widget. Vite library mode → agent.js (IIFE).
                    - <concierge-agent> custom element, Shadow DOM, Preact inside
                    - tokens/: config → CSS custom properties (OKLCH)
                    - engine/: conversation state machine, intent matcher, catalog matcher
                    - ui/: components (read CSS variables only)
packages/catalogs   Fake product data + scripted journeys (per store, per voice)
apps/platform       Next.js app, deployed as one Railway service:
                    - /                 config page (3 steps)
                    - /lab              widget under ~6 configs in a grid
                    - /demo/books       Marginalia storefront
                    - /demo/fishing     Riffle & Co. storefront
                    - /agent.js         built widget bundle (copied into public/ at build)
                    - /configs/:id.json config lookup
                    - /api/extract?url= brand extraction
                    - /api/configs      save a config (POST) → returns id
```

### Config delivery
- Snippet: `<script src="https://<host>/agent.js" data-config="<id>" async></script>`.
- `agent.js` reads `data-config`, fetches `/configs/:id.json`, mounts `<concierge-agent>` on `document.body`.
- Demo configs (`marginalia`, `riffle`) are JSON files committed to the repo.
- Merchant-saved configs are JSON files on a Railway volume (path from env var `CONFIG_DIR`; falls back to a local `.data/` dir in dev).
- The config page preview mounts the same web component and passes the config object directly (no fetch) so edits apply instantly.

### Host integration
- Shadow DOM isolates styles both ways. `font-family` is inherited from the host, which makes "Use my site's font" work with zero config.
- High `z-index` on the host element; launcher respects safe-area insets.
- Add to basket dispatches `CustomEvent('concierge:add-to-cart', { detail: { productId, qty, options } })` on `window`. Demo storefronts listen and update their own cart badge.

## 4. Token engine

### Merchant config (input)
```ts
type AgentConfig = {
  id: string;
  store: string;                          // catalog key: "books" | "fishing"
  brand: string;                          // hex, required
  accent?: string;                        // hex, else derived
  surface: "light" | "dark";
  font: { family: "inherit" | string; display?: string; url?: string };
  shape: "soft" | "rounded" | "square";
  density: "airy" | "regular" | "compact";
  voice: "warm" | "neutral" | "terse";
  cardStyle: "visual" | "spec";
  agent: { name: string; avatar?: string; greeting: string };
  launcher: { position: "bottom-right" | "bottom-left"; label?: string };
};
```

### Derivation (output: ~40 CSS custom properties)
- Brand → 10-step OKLCH lightness scale at constant hue. Surface, raised surface, border, muted text, hover, pressed are drawn from it (inverted for `dark`).
- Accent derived (hue-shifted) if absent.
- **Contrast enforced:** every text/background pair is checked against WCAG AA (4.5:1 body, 3:1 large/UI). If brand fails as a button fill with its text colour, adjust its lightness along the same hue until it passes. Text on brand picks black or white by contrast. The engine returns a list of adjustments (`{ token, from, to, reason }`) that the config page's fit check displays.
- Shape → radius scale (square 0/2px, rounded 6/10px, soft 14/20px + pill buttons).
- Density → spacing scale, card padding, message gap, line length.
- Font → body family + optional display family for headings; `url` injects a `<link>` into the host document head (fonts can't load from inside a shadow root reliably).

### Rules
- Components use CSS variables only; no literal colours or pixel radii in component styles.
- `cardStyle` switches product card **layout** (cover-led vs spec table), not just styling.
- `voice` selects copy variants in the scripted conversation.

### /lab
A grid of the widget (open, mid-conversation) under ~6 configs: Marginalia, Riffle, garish neon, dark monochrome, pastel, "hot pink + serif + square". Presentation proof that it's built, not styled.

## 5. Conversation engine

### State
`{ constraints: Constraint[], step: StepId, shortlist: ProductId[], compare: ProductId[], detail?: ProductId }`

A `Constraint` has `{ key, label, kind: "include" | "exclude" | "max" | "min", value, status: "active" | "dropped" }`.

### Constraint strip
A horizontally scrolling row of chips pinned under the header, showing what the agent thinks the shopper wants. Shoppers can tap to edit or remove a chip; this re-runs the matcher. Dropped constraints animate out (strike-through, fade) and new ones animate in.

### Matcher
Real filter over the catalog. Returns:
- `matches`: satisfy all active constraints, ranked.
- `nearMisses`: violate exactly one constraint, each tagged `{ constraint, delta }` (e.g. "€29 over budget", "packs to 85cm, not 60cm"), ranked by smallest violation.

"Nothing matches" is computed from the data, not written into the script.

### Script and input
- Per-store state machine of turns. Each turn's copy has `warm | neutral | terse` variants.
- Suggested reply chips drive the golden path.
- Free text → keyword/intent matcher (budget, page count, length, "cheaper", "actually…", genre/species words). Anything it doesn't recognise → an honest fallback listing what it can help with, plus chips.
- Pacing: short typing indicator, then word-by-word reveal.

### Journey: Marginalia (books) — change of mind
1. Opening: *"Looking for a gripping mystery for my dad. He's read all of Rankin. Nothing too gory, and ideally under 400 pages."* → strip: `Mystery` `Not gory` `< 400 pages` `Not Rankin`.
2. One clarifying question with chips: police procedural like Rankin / historical / Nordic / cosy.
3. Three cover-led cards, each with a one-line "why he'll like it" tied to the constraints.
4. **Change of mind:** *"Actually, he's gone off crime lately. He's been reading a lot of history."* The agent says what it's keeping and what it's dropping. `Mystery` is struck and fades, `History` arrives, `Gripping` and `< 400 pages` stay. New picks: narrative history and historical thrillers that bridge both.
5. Compare two side by side → detail sheet (why this one, page count, "if he liked X") → Add to basket (+ gift wrap toggle).

### Journey: Riffle & Co. (fishing) — nothing matches
1. Opening: *"Need a beginner fly rod for small streams, packs down small enough for hiking, under €150."* → strip: `Beginner` `Small streams` `Packable` `< €150`.
2. The agent adds expertise: *"For small streams a 3–4 weight is ideal — OK to go with that?"* → adds a `3–4 wt` chip.
3. **Nothing matches:** *"Nothing hits all of them. Here's the closest from each direction."* Three near-miss cards, each with its broken constraint flagged on the card:
   - €179 4-piece packable 4wt → €29 over budget
   - €129 3-piece 7ft → packs to 85cm
   - €145 5wt combo → heavier than ideal for small streams
   Chips: *Stretch the budget / Relax pack size / Tell me when a match lands* (the last captures an email in the widget and confirms; no backend).
4. Spec-table comparison → detail sheet → Add to basket.

### Catalogs
- Books: ~20 titles (invented), fields: title, author, cover (generated/CSS covers), genre tags, pages, gore level, price, blurb, "why" hooks, comparable authors.
- Fishing: ~15 products (rods, combos, reels), fields: name, type, weight (wt), length, pieces, packed length, price, skill level, specs.
- Data is shaped so the journeys above really do fall out of the matcher.

### Mobile (≤ 480px)
Full-screen sheet instead of a floating panel. The strip scrolls sideways, comparison stacks vertically, the detail sheet slides over the chat, and the input stays above the on-screen keyboard. Verified at 375px on both brands.

## 6. Config page

Concierge's own UI is deliberately calm (off-white, one ink colour, a clean grotesk) so the merchant's brand in the preview is the most colourful thing on screen. Three steps on one route with a progress indicator.

### Step 1 — "Let's make it look like your store"
- Primary: paste store URL → `/api/extract`.
  - Server fetches HTML plus linked stylesheets (with a time limit and size cap), collects colours from CSS, `theme-color` meta and inline styles; picks the most frequent saturated colours (weighting button/link selectors); takes the first non-generic `font-family`; the modal `border-radius`; logo from `og:image` / `link[rel=icon]` / `img[alt*=logo]`.
  - UI shows progress ("Found your colours… your font… your logo"), then findings as swatches with a reason ("on your buttons and links"). Each finding can be swapped with one tap from the other candidates.
  - Weak or failed extraction → plain-language message, carries the URL forward, and suggests upload.
- Secondary: upload logo → palette extracted in the browser via canvas sampling (quantise, drop near-greys, rank by frequency × saturation).
- Tertiary: start from a style (Editorial, Technical, Playful, Minimal).
- Each route produces a full `AgentConfig` with sensible defaults.

### Step 2 — "Tune it"
- **Preview (~60%)**: the real web component, open, mid-conversation (cards, chips, comparison visible), on a mock storefront in the merchant's colours, fonts and logo. Toggles: desktop / mobile (375px frame), launcher closed / open, light / dark host page.
- **Controls, grouped by merchant concepts:**
  - Look: brand colour (swatch + candidates from their site), font ("Use my site's font" default / pick), shape (3 thumbnails), density (3 thumbnails)
  - Personality: agent name, avatar (logo / initials / none), greeting, voice (3 options, each showing a sample sentence)
  - Products: card style (visual / spec thumbnails)
  - Exact values (collapsed): brand and accent hex, custom font URL, launcher position and label
- **Fit check bar**: green when everything passes; otherwise plain-language adjustment notes from the token engine, each with "Show me" to highlight the element in the preview.

### Step 3 — "Add it to your site"
- Save (POST `/api/configs`) → id → snippet in a large code block with a Copy button that confirms.
- Tabs: Any website / Shopify / Squarespace / WordPress / Send to my developer (`mailto:` pre-filled).
- Note: "Changes you make here update your site automatically — no need to re-paste."

## 7. Demo storefronts

Static pages under `/demo/books` and `/demo/fishing`. Each has a convincing header, hero, a product grid from the same catalog, a cart badge listening for `concierge:add-to-cart`, and the real snippet tag. Their own CSS is intentionally distinct (Marginalia: cream, Fraunces/EB Garamond, oxblood; Riffle: near-black/slate, high-vis accent, condensed grotesk + mono) so the widget's fit is visible.

## 8. Testing (light — POC)

Vitest only, a handful of tests:
- Token engine: contrast pairs pass AA for the demo configs and a small set of awkward colours (yellow, pale pastel, near-black).
- Matcher: fishing opening returns zero matches and the three expected near misses with correct deltas; books change-of-mind swaps genre and keeps other constraints.

Everything else is checked by hand in the browser (both stores at 375px and desktop, /lab grid).

## 9. Delivery

- Railway: one service (Next.js), a volume mounted at `CONFIG_DIR`. Build step builds `packages/agent` and copies `agent.js` into `apps/platform/public/`.
- Repo on GitHub, README: `pnpm i && pnpm dev`, URLs of each page.
- `DECISIONS.md` kept as a running log during the build (particularly AI suggestions that were overridden), trimmed to one page at the end, covering the six headings in the brief.

## 10. Scope and cut order

Must-haves (never cut): token engine + contrast enforcement, both journeys with their non-happy moments, 375px behaviour, working snippet on both stores, config page steps 1–3 with at least one extraction route, DECISIONS.md.

Cut in this order if time runs short:
1. Blurred screenshot of the merchant's site behind the preview
2. Shopify / Squarespace / WordPress tabs (keep "Any website")
3. URL extraction polish (keep a basic version; logo upload is the dependable fallback)
4. Third voice variant (keep warm + terse)
5. /lab reduced to 3 configs

## 11. Out of scope

Real LLM, real accounts/auth, real checkout, analytics, i18n, merchant catalog import.
