# Decisions (running log — trimmed to one page at the end)

## Merchant & configuration page

- Added an optional `background` field to `AgentConfig` (types.ts), which is not in the original spec. Merchants care whether the panel reads as cream or white against their storefront, and extraction can find this colour directly from the site. `deriveTokens` uses it verbatim for `--c-bg` when present, else derives a near-white/near-black seed from the brand hue as before.

## Keeping the agent right across brands

## AI suggestions I overrode

## Cut for time

## Weakest part

- Brand extraction (`lib/extract.ts`) is best-effort by design, verified against real sites. `https://www.aesop.com` blocks the extractor's UA with a 403 (site clearly fingerprints/blocks non-browser fetches), so the API returns 422 there — the intended fallback is logo upload. `https://stripe.com` works well: `brand[0]` is `#533afd` (Stripe's actual purple, reason "named as a brand colour in your CSS"), background `#ffffff`, radius `4`, but `fonts` comes back as self-hosted family names (`sohne-var`, `SourceCodePro`) rather than loadable web fonts, and `logo` picks up a marketing image instead of the nav logo since Stripe's header logo has no `logo`-ish alt/class/src to match on. Confirms the heuristic is genuinely best-effort on non-demo sites — good on colour, weak on logo/font for real-world markup that doesn't cooperate.

## With another hour
