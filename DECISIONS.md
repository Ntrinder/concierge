# Decisions (running log — trimmed to one page at the end)

## Merchant & configuration page

- Added an optional `background` field to `AgentConfig` (types.ts), which is not in the original spec. Merchants care whether the panel reads as cream or white against their storefront, and extraction can find this colour directly from the site. `deriveTokens` uses it verbatim for `--c-bg` when present, else derives a near-white/near-black seed from the brand hue as before.

## Keeping the agent right across brands

## AI suggestions I overrode

## Cut for time

## Weakest part

## With another hour
