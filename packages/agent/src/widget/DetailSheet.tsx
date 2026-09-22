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
