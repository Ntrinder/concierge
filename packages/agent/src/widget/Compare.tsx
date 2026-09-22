import { getProduct } from "../catalogs";
import type { AgentConfig, Product } from "../types";
import { formatPrice, ProductImageView } from "./ProductCard";

export function Compare({ config, productIds, compact, onChoose }: { config: AgentConfig; productIds: string[]; compact: boolean; onChoose: (id: string) => void }) {
  const products = productIds.map((id) => getProduct(config.store, id)).filter((p): p is Product => !!p);
  const labels = [...new Set(products.flatMap((p) => p.specs.map((s) => s.label)))];
  const specOf = (p: Product, label: string) => p.specs.find((s) => s.label === label)?.value ?? "—";
  const mono = config.cardStyle === "spec";

  if (compact) {
    return (
      <div class="compare-stack">
        {products.map((p) => (
          <div class="compare-card" key={p.id}>
            <div class="compare-card-head">
              <ProductImageView image={p.image} product={p} size="sm" />
              <div><div class="card-name">{p.name}</div><div class="price">{formatPrice(p.price)}</div></div>
            </div>
            <dl class="compare-dl">
              {labels.map((l) => <div key={l}><dt>{l}</dt><dd class={mono ? "mono" : ""}>{specOf(p, l)}</dd></div>)}
              {!mono && <div><dt>Why</dt><dd>{p.why}</dd></div>}
            </dl>
            <button type="button" class="btn btn-primary btn-block t-btn" onClick={() => onChoose(p.id)}>Choose this one</button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div class="compare">
      <table>
        <thead>
          <tr><th scope="col"><span class="sr">Attribute</span></th>{products.map((p) => <th scope="col" key={p.id}>{p.name}</th>)}</tr>
        </thead>
        <tbody>
          <tr><th scope="row">Price</th>{products.map((p) => <td key={p.id} class="price">{formatPrice(p.price)}</td>)}</tr>
          {labels.map((l) => (
            <tr key={l}><th scope="row">{l}</th>{products.map((p) => <td key={p.id} class={mono ? "mono" : ""}>{specOf(p, l)}</td>)}</tr>
          ))}
          {!mono && <tr><th scope="row">Why</th>{products.map((p) => <td key={p.id}>{p.why}</td>)}</tr>}
          <tr class="compare-actions"><th scope="row"><span class="sr">Choose</span></th>{products.map((p) => (
            <td key={p.id}><button type="button" class="btn btn-primary t-btn" onClick={() => onChoose(p.id)}>Choose</button></td>
          ))}</tr>
        </tbody>
      </table>
    </div>
  );
}
