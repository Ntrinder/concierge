import type { ComponentChildren } from "preact";
import { getProduct } from "../catalogs";
import type { AgentConfig } from "../types";
import { CheckIcon } from "./icons";
import { formatPrice, ProductImageView } from "./ProductCard";

function BasketLink({ url, kind, count, className, children }: { url?: string; kind: "checkout" | "view-basket"; count: number; className: string; children: ComponentChildren }) {
  const onClick = (e: MouseEvent) => {
    const evt = new CustomEvent(`concierge:${kind}`, { cancelable: true, detail: { count } });
    window.dispatchEvent(evt);
    if (url && evt.defaultPrevented) e.preventDefault();
  };
  if (url) return <a href={url} class={className} onClick={onClick}>{children}</a>;
  return <button type="button" class={className} onClick={onClick}>{children}</button>;
}

export function InBasket({ config, productId, options, count }: { config: AgentConfig; productId: string; options: string[]; count: number }) {
  const product = getProduct(config.store, productId);
  if (!product) return null;
  const { checkoutUrl, basketUrl } = config.basket ?? {};
  return (
    <div class="in-basket">
      <div class="in-basket-status" role="status"><CheckIcon /> In your basket</div>
      <div class="in-basket-row">
        <ProductImageView image={product.image} product={product} size="sm" />
        <div class="in-basket-info">
          <div class="card-name">{product.name}</div>
          {options.length > 0 && <div class="in-basket-options">{options.join(" · ")}</div>}
          <div class="price">{formatPrice(product.price)}</div>
        </div>
      </div>
      <BasketLink url={checkoutUrl} kind="checkout" count={count} className="btn btn-primary btn-block t-btn">Checkout</BasketLink>
      <BasketLink url={basketUrl} kind="view-basket" count={count} className="in-basket-view t-link">{`View basket (${count})`}</BasketLink>
    </div>
  );
}
