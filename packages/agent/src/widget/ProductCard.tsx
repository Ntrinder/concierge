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
