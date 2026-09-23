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
