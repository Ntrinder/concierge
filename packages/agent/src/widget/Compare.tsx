import { getProduct } from "../catalogs";
import type { AgentConfig, Product } from "../types";
import { cls } from "./cls";
import { formatPrice, ProductImageView } from "./ProductCard";

export function Compare({ config, productIds, chosen, onChoose }: { config: AgentConfig; productIds: string[]; chosen?: string; onChoose: (id: string) => void }) {
  const products = productIds.map((id) => getProduct(config.store, id)).filter((p): p is Product => !!p);
  const labels = [...new Set(products.flatMap((p) => p.specs.map((s) => s.label)))];
  const specOf = (p: Product, label: string) => p.specs.find((s) => s.label === label)?.value ?? "—";
  const mono = config.cardStyle === "spec";
  const differs = (values: string[]) => new Set(values).size > 1;

  if (chosen) {
    return (
      <div class="compare-done">
        {products.map((p) => {
          const isChosen = p.id === chosen;
          return (
            <div class={cls("compare-done-row", isChosen ? "is-chosen" : "is-other")} key={p.id}>
              <ProductImageView image={p.image} product={p} size="xs" />
              <div class="compare-done-info">
                <div class="card-name">{p.name}</div>
                <div class="compare-done-sub">{isChosen ? formatPrice(p.price) : `${formatPrice(p.price)} · compared`}</div>
              </div>
              {isChosen && <span class="compare-done-check">✓ Chosen</span>}
            </div>
          );
        })}
      </div>
    );
  }

  const priceDiff = differs(products.map((p) => formatPrice(p.price)));

  return (
    <div class="compare">
      <table>
        <thead>
          <tr><th scope="col"><span class="sr">Attribute</span></th>{products.map((p) => <th scope="col" key={p.id}>{p.name}</th>)}</tr>
        </thead>
        <tbody>
          <tr class={priceDiff ? "is-diff" : ""}><th scope="row">Price</th>{products.map((p) => <td key={p.id} class="price">{formatPrice(p.price)}</td>)}</tr>
          {labels.map((l) => {
            const values = products.map((p) => specOf(p, l));
            return (
              <tr key={l} class={differs(values) ? "is-diff" : ""}><th scope="row">{l}</th>{products.map((p) => <td key={p.id} class={mono ? "mono" : ""}>{specOf(p, l)}</td>)}</tr>
            );
          })}
          {!mono && <tr class="compare-why"><th scope="row">Why</th>{products.map((p) => <td key={p.id}>{p.why}</td>)}</tr>}
          <tr class="compare-actions"><th scope="row"><span class="sr">Choose</span></th>{products.map((p) => (
            <td key={p.id}><button type="button" class="btn btn-primary btn-block t-btn" aria-label={`Choose ${p.name}`} onClick={() => onChoose(p.id)}>Choose</button></td>
          ))}</tr>
        </tbody>
      </table>
    </div>
  );
}
