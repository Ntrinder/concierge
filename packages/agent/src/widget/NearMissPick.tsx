import { getProduct } from "../catalogs";
import type { AgentConfig, Message } from "../types";
import { cls } from "./cls";
import { ChevronIcon } from "./icons";
import { formatPrice } from "./ProductCard";

type NearMiss = Extract<Message, { kind: "near-miss" }>;

export function NearMissPick({ config, pick, bends, used, onAdd, onBend }: {
  config: AgentConfig;
  pick: NearMiss["pick"];
  bends: NearMiss["bends"];
  used?: boolean;
  onAdd: (id: string) => void;
  onBend: (key: string, productId: string) => void;
}) {
  const product = getProduct(config.store, pick.productId);
  if (!product) return null;
  const isKit = product.attrs.kit === true;
  const addLabel = `${isKit ? "Add kit" : "Add"} · ${formatPrice(product.price)}`;

  return (
    <>
      <div class="pick" role="group" aria-label={`My pick: ${product.name}, 1 trade-off`}>
        <div class="pick-bar"><span>My pick</span><span>1 trade-off</span></div>
        <div class="pick-body">
          <div class="pick-head">
            <div class="card-head">
              <span class="card-name">{product.name}</span>
              <span class="card-byline">{product.byline}</span>
            </div>
            <span class="price">{formatPrice(product.price)}</span>
          </div>
          <div class="pick-grid" style={{ gridTemplateColumns: `repeat(${pick.cells.length}, minmax(0,1fr))` }}>
            {pick.cells.map((c) => (
              <div class={cls("pick-cell", c.fail && "is-fail")} key={c.label}>
                <div class="pick-cell-label">{c.label}</div>
                <div class="pick-cell-value">{c.value}</div>
              </div>
            ))}
          </div>
          <p class="pick-why">{pick.why}</p>
          <button type="button" class="btn btn-primary btn-block t-btn"
            aria-label={`Add ${product.name} to basket, ${formatPrice(product.price)}`}
            onClick={() => onAdd(product.id)}>
            {addLabel}
          </button>
        </div>
      </div>
      {bends.length > 0 && (
        <div class="bends">
          <div class="bends-heading">Or bend one rule</div>
          {bends.map((b) => {
            const bp = getProduct(config.store, b.productId);
            if (!bp) return null;
            return (
              <button key={b.productId} type="button" class="bend t-link" disabled={used}
                aria-label={`Bend the rule: ${b.text} — show ${bp.name}`}
                onClick={() => onBend(b.key, b.productId)}>
                <span class="bend-info">
                  <span class="bend-name">{bp.name} · {formatPrice(bp.price)}</span>
                  <span class="bend-text">{b.text}</span>
                </span>
                <ChevronIcon />
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
