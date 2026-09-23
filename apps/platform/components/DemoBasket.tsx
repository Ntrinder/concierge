"use client";
import { useEffect, useState } from "react";

interface BasketItem { productId: string; name: string; price: number; qty: number; options: Record<string, unknown> }

export interface DemoBasketClassNames {
  root?: string; heading?: string; row?: string; rowName?: string; rowOptions?: string; rowPrice?: string;
  total?: string; empty?: string; note?: string; link?: string;
}

export function DemoBasket({ store, backHref, classNames = {} }: { store: "books" | "fishing"; backHref: string; classNames?: DemoBasketClassNames }) {
  const [items, setItems] = useState<BasketItem[] | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`concierge-basket:${store}`);
      setItems(raw ? (JSON.parse(raw) as BasketItem[]) : []);
    } catch {
      setItems([]);
    }
  }, [store]);

  if (items === null) return null;
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <div className={classNames.root}>
      <h1 className={classNames.heading}>Your basket</h1>
      {items.length === 0 ? (
        <p className={classNames.empty}>Your basket is empty. <a href={backHref} className={classNames.link}>Back to the store</a></p>
      ) : (
        <>
          {items.map((item, i) => (
            <div className={classNames.row} key={i}>
              <span>
                <span className={classNames.rowName}>{item.name}</span>
                {item.options?.giftWrap ? <span className={classNames.rowOptions}>Gift wrapped</span> : null}
              </span>
              <span className={classNames.rowPrice}>€{(item.price * item.qty).toFixed(2)}</span>
            </div>
          ))}
          <div className={classNames.total}><span>Total</span><span>€{total.toFixed(2)}</span></div>
        </>
      )}
      <p className={classNames.note}>This is a demo store — checkout ends here.</p>
    </div>
  );
}
