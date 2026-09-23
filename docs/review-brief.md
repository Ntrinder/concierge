# Concierge — implementation brief (design & product review follow-ups)

Hand this to Claude Code from the repo root. It comes from a hands-on review of the deployed build
(studio steps 1–3, `/demo/books`, `/demo/fishing` at 1280px and 375px, `/lab`). Mockups for the
bigger items are on the "Concierge review" design canvas; the specs below repeat everything needed
to build without it.

## Context for the implementer

- Next.js app. The shopper agent is a web component `<concierge-agent>` rendering into a shadow root,
  themed through CSS custom properties (`--c-brand`, `--c-brand-soft`, `--c-on-brand-soft`,
  `--c-surface`, `--c-border`, `--c-muted`, `--r-btn`, `--fs-*`, `--s-*`, …) produced by a token engine.
- `/lab` renders six brands (Ask a bookseller, Riffle Guide, Neon, Sherbet, Mono, Pink Pages) with a
  375px toggle and a conversation-step picker. **Every agent change must look right on all six in Lab,
  at 375px and full width.** Treat Lab as the test harness; add conversation steps to it where a new
  state needs checking (e.g. post-add).
- Keep changes in the token engine + agent components. No per-brand CSS. If something only looks right
  for one brand, the token is wrong.
- Don't restructure things that already work well: URL-first matching, the contrast guard and its
  "Show me" explanation, tone-of-voice switching, the constraint strip with the Dropped/Added/Kept diff,
  near-miss headers, host basket integration.

Work in the order below. Each item has acceptance criteria; stop and check Lab after each.

---

## Phase 1 — Agent (highest impact, all small)

### P1. Constraint receipts on product cards

**Problem:** The shopper says "under 400 pages, nothing too gory", but results cards never show page
count or any evidence until they tap Compare. The agent asserts; it doesn't show.

**Build:**
- Each recommended product card gets a receipt row: one small pill per active constraint that the
  product satisfies, each with a check icon and the product's actual value where one exists
  (`✓ 392 pages`, `✓ Not gory`, `✓ History`; for Riffle: `✓ 58 cm packed`, `✓ 4 wt`).
- Derive from the active constraints (the strip) + product attributes. Cap at 3 pills; prefer
  constraints the shopper stated over inferred ones.
- Pill style: surface background, 1px border token, check icon in a success tone that passes 3:1 on
  the card surface, text at `--fs-sm`. Spec-led brands (Riffle, Mono, Neon) may render values in the
  mono/spec font already used in their spec grids.
- Card actions: add an inline primary **Add** button beside **Details** (≥44px tall) so a shopper can
  commit without opening detail.
- Detail view "Why this one": replace the repeated card blurb with a sentence tied to the conversation
  (e.g. "336 pages, true story, reads like a thriller — the history angle you said he's into now").
  Canned per-product strings keyed by constraint are fine for the demo.

**Accept when:** every card in both demo flows shows receipts matching the strip; values are real
product data; no pill wraps to a third line at 375px; looks right on all six Lab brands.

### P2. Commitment moment after "Add to basket"

**Problem:** Adding ends in a toast + "Anything else?". Gift wrap isn't echoed. "Choose this one" buttons
on the compare view stay live. The shopper is left without a next step at the moment of highest intent.

**Build:**
- Replace the toast with an **in-basket card**: check + "In your basket", cover/thumbnail, title,
  chosen options (format, "Gift wrapped" if ticked), price, then a full-width primary **Checkout** and a
  secondary text link **View basket (n)**. Checkout/View basket should call into the host integration
  (same mechanism that updates the store's Basket count); for the demo, link to the demo store's basket.
- After a choice from Compare: the chosen item gets a selected state (2px brand border + "✓ Chosen"),
  the others go muted/dashed, and their "Choose this one" buttons are removed or disabled.
- Follow-up assistant line + suggestions should be a relevant add-on, not generic
  (Marginalia: "Add a card" / "No thanks" / "Something for me too"; Riffle: "Add a leader & tippet pack").
- Placeholder copy for anything we can't know (delivery estimate) must be omitted rather than invented.

**Accept when:** both demo flows end on the in-basket card with a working Checkout/View basket;
gift wrap shows when chosen; no stale Choose buttons; a Lab step exists for this state.

### P4. Near-miss that makes a recommendation

**Problem:** Riffle "no exact match" shows three equal near-misses under identical warning bars. A
beginner has to weigh compromises they don't understand.

**Build:**
- Opening line states the conflict plainly: "Nothing hits all four. Here's what I'd buy as a beginner:"
- **One "My pick" card** first: header bar in brand fill reading `MY PICK` + `1 trade-off`; spec grid
  where the failing cell is highlighted (brand-tinted background, brand outline, value like `5 wt ≠ 3–4`)
  and passing cells show `✓`; a one-sentence rationale ("Everything's in the box, so you're fishing on
  day one. A 5 weight is a little heavy for tiny streams but forgiving to learn on."); primary
  `Add kit · €145`.
- Pick rule for the demo: fewest/smallest violations, tie-break on beginner-friendliness (kit includes
  reel + line) — hardcoding the pick for this scenario is acceptable.
- Remaining near-misses become compact **"Or bend one rule"** rows: name · price, then the single miss
  in a tinted mono line (`+€29 budget · otherwise perfect`, `packs to 85 cm · won't fit a daypack`),
  chevron; tapping relaxes that constraint in the strip and re-runs.
- Jargon: fold the explanation into the question — "a light rod (3–4 weight) suits small streams — go
  with that?" rather than "Small streams → 3–4 wt. Go with that?". Keep the "What does weight mean?" chip.

**Accept when:** the Riffle flow shows one pick with the failing spec visibly highlighted, two
bend-a-rule rows that actually relax the constraint, and it reads well in Neon/Mono in Lab.

### P5. Reclaim space at 375px

**Problem:** Suggestion chips wrap to 3 rows (~25% of viewport). The "Looking for" strip grows to 8 chips
including struck-through dropped ones and runs off-screen.

**Build:**
- **Collapsed constraint line** (default at all widths ≤ 480px, optional above): one row, button
  element, `min-height: 44px`: muted label (`For dad:` / spec brands: `SPEC`), then constraints joined
  as text with ellipsis overflow ("history, gripping, not gory, under 400 pp"; Riffle: `3–4 wt · ≤60 cm
  · ≤€150 · beginner`), then brand-coloured **Edit**. Edit opens a bottom sheet with the existing chips
  (removable) — reuse the current chip component.
- Dropped constraints: show struck-through for one turn (keep the Dropped/Added/Kept diff message), then
  remove from the strip.
- **Suggestions:** single row, `overflow-x: auto`, no wrap, hidden scrollbar, chips `flex: none`,
  ≥40px tall. Max 3 suggestions.

**Accept when:** at 375×812 the message area is ≥60% of panel height in every Lab step; nothing in the
strip or suggestion row overflows visibly without scroll affordance.

### P6. Pastel / low-chroma brands and the disabled send button

**Problem:** Sherbet (#F4C2C2 on white) passes contrast after the guard but reads as disabled. The empty-
input send button renders as a pale brand fill on every theme, so the brand looks washed out.

**Build (token engine):**
- Detect light, low-chroma brand colours (e.g. OKLCH L > ~0.75 and C < ~0.12, tune in Lab). For those,
  use the brand as **surface tint** (chips, user bubble, header avatar bg) and a near-black/deep-shade
  **ink** for actions (primary buttons, links, send). Surface this in the contrast-guard explanation
  ("Your colour is light, so we use it for backgrounds and a deep shade for buttons").
- **Disabled send**: outlined (1px border token, muted icon), not a faded brand fill. Enabled = full
  brand fill. Applies to all brands.

**Accept when:** Sherbet and Pink Pages look intentional (not disabled) in Lab; send button's empty vs
ready states are distinguishable on all six.

### Agent polish (quick)

- Header subtitle "Shopping assistant · replies instantly" → make merchant-editable, default empty (name only).
- Heading text treatment tokens: add `--heading-case` (text-transform) and `--heading-tracking`
  (letter-spacing), apply to panel title, card titles, launcher label. Riffle = uppercase + 0.06em; others
  none. Read from extraction where possible (computed style of site `h1`/`h2`).
- Empty state: show 3 starter prompts drawn from catalogue categories instead of 1
  (e.g. "A gift for a history buff", "Something short for a train", "A gripping mystery for my dad…").
- Compare: at <480px render as a two-column table (products as columns, attributes as rows, differing
  rows emphasised) or change copy from "Side by side"; left-align the "Why" text.
- Price formatting: always two decimals via `Intl.NumberFormat` (`€20.00`, not `€20`).
- Generated covers: clamp/scale title text so long titles don't clip ("Cartographer's"); mark cover
  art `aria-hidden="true"` so screen readers don't read title/author twice.
- Desktop panel height: `min(680px, 100vh - 116px)` overlaps sticky headers (covers Riffle's Cart at
  1280×860). Add a config `topOffset` (default 0, Riffle ~72px) or cap lower.

---

## Phase 2 — Configuration studio

### P3. Preview built from the merchant's own site (no screenshots)

**Decision:** Do **not** use a screenshot/iframe of the merchant's site — a fixed-width image won't reflow
to the phone frame, and many sites block framing/bots. Instead build the preview **from what extraction
already returns**, rendered responsively in the same preview frame.

**Build:**
- Extend extraction to also capture: logo (already), site name, nav link labels (first 3–4), hero
  headline (first `h1`), hero eyebrow/sub if easy, primary button colour/radius/text, page background,
  heading + body fonts, heading case/tracking (for the P-polish tokens).
- Replace the grey placeholder mock with a **"your homepage" mock** composed from those: header with
  logo + name + nav + "Basket (0)", hero with their headline in their heading font, a primary button in
  their button style, then neutral product-tile placeholders. Must render correctly in both Desktop and
  Phone preview modes and on light/dark sites.
- Fallback when a field is missing: keep that element as today's neutral placeholder.
- Label the backdrop subtly: "Preview on your homepage".

**Accept when:** matching the Marginalia and Riffle demo URLs produces a preview that is recognisably
that site in both Desktop and Phone modes; missing fields degrade gracefully.

### Step 1 — show the match, not hex codes (see "Studio-Match" mockup)

- After a successful match, layout becomes two columns (stack at <900px):
  - **Left:** "✓ Read marginalia.com" (success tone), H1 "Here's your assistant, dressed like
    Marginalia.", one-line explainer; then a list of **named roles**, each row = 36px swatch/sample,
    bold plain-language name + one-line role, and a **Change** button:
    - Brand colour — human colour name (nearest-name lookup, e.g. "Oxblood") + "Buttons, links and your
      chat bubbles — from your theme colour"
    - Background — "Warm paper" + "The background of your pages"
    - Font — "EB Garamond" + "Your site's font, loaded the same way your pages load it"
    - Logo — "Used as the assistant's avatar"
  - Primary **"Looks like us — continue"**, secondary link **"Show exact values"** (reveals hex list /
    other found colours).
  - Footer line: "No website yet? Upload a logo or start from a style." — the logo-upload and style cards
    move behind these links and are **hidden once a match succeeds**.
  - **Right:** live mini preview — their homepage mock (P3) with the open panel (greeting, one user
    bubble, one product card) and the launcher pill, all in their styles.
- Before a match, keep URL as the single primary action; logo/style remain as the secondary link.

### Tune it panel

- Remove the **"Books / Outdoor gear"** preview toggle (demo leakage). Optionally replace with
  "Preview with my products" later; not required now.
- Rename the panel's **Page: Light / Dark** to **"Assistant background"**. Keep the preview toolbar's
  "Light page / Dark page" but default it from the extracted site background.
- Promote a **Launcher** section out of "Exact values": label text, position (bottom right/left),
  style (pill with label / icon only). Focusing any launcher control switches the preview to **Closed**.
  "Exact values" keeps only hex inputs and custom font URL.
- Fix: Avatar radio shows neither option selected while the logo is in use — reflect current state.
- Preview column `position: sticky` so it doesn't scroll away with the panel; fit the phone frame to
  available viewport height (it clips at 1280×860 today).
- Greeting: when tone changes and the merchant hasn't edited the greeting, swap to the tone's default
  greeting (Warm / Neutral / Straight to it variants).

### Add it to your site

- **Save before copy:** replace "Come back to this studio in the same browser" with an email field
  ("Email me a link to edit this later") before/next to Copy snippet. Magic-link stub is fine for the demo
  (store config server-side keyed by config ID; show the ID).
- **Install check:** "Check my site" — input prefilled with the matched URL; server fetches the page and
  looks for `agent.js` + the `data-config` ID. States: checking → "Live on marginalia.com ✓" / "Not found
  yet — it can take a few minutes after publishing" with a re-check button.
- Copy fix: "See it on the bookshop demo (with sample books)" — drop "your".
- Snippet block: avoid breaking the tag mid-attribute; allow horizontal scroll or wrap at spaces.

---

## Verification checklist (run after each phase)

1. `/lab` — all six brands, every conversation step, at 375px and full width. Screenshot any that look
   off and fix at the token level.
2. `/demo/books` at 375×812: greeting → mystery for dad → police procedural → "gone off crime" →
   compare → choose → in-basket card → host Basket count increments.
3. `/demo/fishing` at 375×812: beginner rod → yes 3–4 wt → My pick + bend-a-rule rows → relax budget
   re-runs → add kit.
4. Studio: match both demo URLs, check Step 1 named roles + mini preview, Tune in Desktop/Phone and
   Open/Closed, contrast guard still fires on #D7263D + dark, snippet + install check.
5. Keyboard: tab through the agent; focus visible on every control; all touch targets ≥44px
   (suggestion chips ≥40px).

## Out of scope

Screenshot/iframe previews of merchant sites, real accounts/auth, real LLM calls, new demo stores.
