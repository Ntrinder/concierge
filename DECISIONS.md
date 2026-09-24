# Decisions

## The merchant on the configuration page

Most merchants arrive with a store, not a spec. I started the studio from what they already have — a URL to extract from, a logo to upload, or a style to pick — rather than a settings form asking for colours and fonts up front. Whichever path they take, they land in the same place: a preview of the agent running in context on a mock of their page, so they're judging it the way a visitor would, not reading hex codes in isolation.

The controls speak in merchant terms — look, personality, which products it leans on — with exact hex/font values available under an "Exact values" section for the minority who have them ready. A fit check explains, in plain language, every automatic adjustment the token engine made (e.g. "lightened your accent to keep text readable") so nothing changes silently. The embed snippet carries a config id rather than inline values, so an edit never needs re-pasting on the merchant's site. I added an optional `background` field to `AgentConfig` outside the original spec because cream-vs-white is exactly the fidelity a merchant notices on their own storefront, and extraction can read it straight from the page.

## Keeping the agent right across brands

One config becomes roughly 40 derived design tokens in OKLCH, not a handful of raw colours. Contrast against AA is enforced per token while preserving the input hue, rather than falling back to a generic safe palette — a merchant's chosen colour should still look like their colour once it's fixed. Every component reads only from tokens; a test fails on any literal colour in the widget stylesheet, which is what makes the six brands in `/lab` a real proof rather than a demo I hand-tuned.

The widget runs inside a `<concierge-agent>` Shadow DOM web component with a reset of inherited text properties, so a hostile or just messy host stylesheet can't reach in and break it. `font-family` is the one property I deliberately let inherit through the shadow boundary, so "use my site's font" needs no setup for the common case. Card layout and the agent's voice shift with the brand's personality setting too, not just colour — a technical outdoor brand and a warm editorial one shouldn't be palette swaps of each other.

## What AI tooling suggested that I overrode

I worked from an AI-written design and plan, and these are places I went against it:

- **Real LLM and an iframe embed.** The design suggested both. I chose a scripted engine because a live demo must be deterministic and testable (the `route`/`steps` seam keeps an LLM drop-in possible), and Shadow DOM because an iframe breaks font inheritance and can't do a real full-screen phone sheet.
- **Constraint chips.** The plan updated the chips the moment a message was sent, before the agent had "spoken". I made them follow the reveal.
- **Preview remounting.** The plan keyed the preview element on open/closed; the remount dropped its `.config`, blanking the merchant's design. I removed the key.
- **Contrast engine.** The plan chained single-target contrast fixes, which failed AA on mid-grey backgrounds (fixing one surface broke the other). I replaced it with a joint search and a mid-grey test sweep.
- **SSRF guard.** The plan's extractor trusted the Host header and followed redirects. I made the allowlist local-only or operator-set, and re-validate every redirect.
- **Silent overwrite.** The plan's config endpoint allowed silent overwrite by public id. I added a per-config edit token: returned once, stored only as a SHA-256, required to overwrite.

## After the design review

A hands-on review of the first build (`docs/review-brief.md`, mockups in `docs/mockups/`) led to a second round:

- **Agent.** Product cards show a receipt of which of the shopper's constraints each one meets. Adding to the basket gives an in-basket card with checkout and basket links, handed to the host page as events. When nothing fits every constraint, the agent now recommends one near-miss, shows the trade-off in a small grid and offers to bend just that one rule. At 375px the constraint strip collapses to one line with an edit sheet, giving the conversation back most of the screen. Pastel brands get deep-shade buttons so they stay readable.
- **Studio.** Step 1 shows what was matched as named roles (brand colour "Oxblood", taken from your CSS) rather than hex codes, with inline Change panels and a live preview. The preview is built from the merchant's own homepage (nav, headline, button, fonts) instead of a screenshot, so it reflows to phone width and follows edits. The last step adds a "Check my site" install check.
- **Rules for the round.** No per-brand CSS: every fix lands in the token engine or shared components and is checked on all six Lab brands at both widths. No invented data: where the mockups showed things we don't know (delivery dates, for instance), they're left out rather than faked.

## What I cut for time

A real LLM, accounts/auth, a real catalog import pipeline (products are invented per demo), Playwright end-to-end coverage (light Vitest only), and sending the "email me a link to edit this later" email (the studio shows what it would send; it doesn't send or keep the address).

## The weakest part

URL extraction is best-effort and it shows on real, JS-heavy or anti-bot sites — `aesop.com` 403s the extractor's fetch outright, and even a cooperative site like `stripe.com` returns self-hosted font names that don't resolve to loadable web fonts and picks up the wrong logo image. There are no accounts: the edit token lives in one browser's local storage, so clearing it (or switching machines) means saving a new design and re-pasting the snippet. And 375px was verified in a genuine 375px-wide iframe viewport in desktop Chrome, not on a physical phone.

## With another hour

Wire a real per-merchant catalog import instead of static demo data; drop a real LLM in behind the same `route`/`steps` engine interface, which was built as a seam for exactly this; send the edit-link email, which is the first step towards accounts; and fix how a found logo becomes the avatar. A wide wordmark gets cropped to fill the round avatar, so Google's shows as a zoomed-in "oog". It should fit the whole logo inside the circle, or prefer a square icon from the site when there is one.
