# Concierge

An embeddable AI-style shopping assistant that takes on each merchant's brand, plus the studio where merchants set it up.

Live: https://concierge-production-485a.up.railway.app

- **Studio** — `/` : match your store from a URL (or a logo, or a style) and confirm what was picked up → tune it on a preview of your own homepage → copy the snippet and check it's live on your site
- **Demo stores** — `/demo/books` (Marginalia) and `/demo/fishing` (Riffle & Co.): same `agent.js`, two configs, each with a basket page (`/demo/books/basket`, `/demo/fishing/basket`) the agent hands off to
- **Lab** — `/lab` : the same agent under six deliberately different brands, at 375px or full width, at any step of the conversation

## Run locally

Requires Node 22+ and pnpm 9.

    pnpm install
    pnpm build        # builds agent.js into apps/platform/public, then Next
    pnpm dev          # agent watch build + next dev on http://localhost:3000
    pnpm test         # token engine, matcher, conversation engine, card receipts, style lint

The studio's "Try a demo store" shortcut reads the demo pages on this same server. Under `pnpm dev` any `localhost`/`127.0.0.1` port is allowed; a local production build (`pnpm start`) blocks loopback like any private address, so either use `pnpm dev` or allow your host explicitly, e.g. `EXTRACT_ALLOW_HOSTS=localhost:3000 pnpm start`.

Saving a design returns a one-time edit token (kept in the studio's local storage). Only its SHA-256 is stored, next to the config; overwriting that config id requires the token.

Widget-only harness: `pnpm --filter @concierge/agent harness` (add `?lab` or `?autoplay=4`).

## How it fits together

- `packages/agent` — pure TS core (token engine, catalogs, matcher, scripted engine) and the Preact widget inside a `<concierge-agent>` Shadow-DOM web component, built to one `agent.js`.
- `apps/platform` — Next.js: studio, lab, demo stores, `/configs/:id.json`, `/api/configs`, `/api/extract` (reads a merchant's page), `/api/install-check` (looks for the snippet on it).

Embed snippet: `<script src="https://<host>/agent.js" data-config="<id>" async></script>`

The agent tells the host page what's happening through DOM events: `concierge:add-to-cart`, and cancelable `concierge:checkout` / `concierge:view-basket` (otherwise it follows `basket.checkoutUrl` / `basket.basketUrl` from the config).

The agent is scripted (no LLM) — see DECISIONS.md.

## Docs

- `DECISIONS.md` — the choices behind it, what was cut, the weakest part
- `docs/review-brief.md` and `docs/mockups/` — the design review the second round of work implemented
- `docs/superpowers/` — the original design spec and implementation plan

## Deploy

Railway, from the repo root: `railway up`. There's no deploy on push.
