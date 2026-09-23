# Decisions

## The merchant on the configuration page

Most merchants arrive with a store, not a spec. I started the studio from what they already have — a URL to extract from, a logo to upload, or a style to pick — rather than a settings form asking for colours and fonts up front. Whichever path they take, they land in the same place: a preview of the agent running in context on a mock of their page, so they're judging it the way a visitor would, not reading hex codes in isolation.

The controls speak in merchant terms — look, personality, which products it leans on — with exact hex/font values available under an "Exact values" section for the minority who have them ready. A fit check explains, in plain language, every automatic adjustment the token engine made (e.g. "lightened your accent to keep text readable") so nothing changes silently. The embed snippet carries a config id rather than inline values, so an edit never needs re-pasting on the merchant's site. I added an optional `background` field to `AgentConfig` outside the original spec because cream-vs-white is exactly the fidelity a merchant notices on their own storefront, and extraction can read it straight from the page.

## Keeping the agent right across brands

One config becomes roughly 40 derived design tokens in OKLCH, not a handful of raw colours. Contrast against AA is enforced per token while preserving the input hue, rather than falling back to a generic safe palette — a merchant's chosen colour should still look like their colour once it's fixed. Every component reads only from tokens; a lint test fails the build on any literal colour in component code, which is what makes the six brands in `/lab` a real proof rather than a demo I hand-tuned.

The widget runs inside a `<concierge-agent>` Shadow DOM web component with a reset of inherited text properties, so a hostile or just messy host stylesheet can't reach in and break it. `font-family` is the one property I deliberately let inherit through the shadow boundary, so "use my site's font" needs no setup for the common case. Card layout and the agent's voice shift with the brand's personality setting too, not just colour — a technical outdoor brand and a warm editorial one shouldn't be palette swaps of each other.

## What AI tooling suggested that I overrode

I rejected an iframe-based embed even though it's the more common answer for host-page isolation — it breaks font inheritance and can't do a real mobile full-screen presentation, both of which mattered more here than the isolation. I rejected a real LLM behind the agent in favour of a scripted engine, since a scripted `route`/`steps` engine is deterministic to test and demo. Review caught the constraint strip updating before the agent had finished narrating (it should land after the reveal, not race it), and caught the preview remounting on a stray React key, which silently dropped the merchant's in-progress config. The SSRF guard for URL extraction also trusted the incoming Host header in one path; that was closed to a dev-only allowlist with re-validated redirects.

## What I cut for time

A real LLM, accounts/auth, a real catalog import pipeline (products are invented per demo), Playwright end-to-end coverage (light Vitest only), and the screenshot backdrop behind the in-context preview (it uses a built mock page instead).

## The weakest part

URL extraction is best-effort and it shows on real, JS-heavy or anti-bot sites — `aesop.com` 403s the extractor's fetch outright, and even a cooperative site like `stripe.com` returns self-hosted font names that don't resolve to loadable web fonts and picks up the wrong logo image. There's no auth, so any saved config id can be overwritten by anyone who has it. And 375px was verified with DevTools/simulated widths, not a real phone.

## With another hour

Wire a real per-merchant catalog import instead of static demo data; drop a real LLM in behind the same `route`/`steps` engine interface, which was built as a seam for exactly this; and build the screenshot backdrop for the preview.
