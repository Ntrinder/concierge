"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface BasketItem { productId: string; name: string; price: number; qty: number; options: Record<string, unknown> }
type AddDetail = { productId: string; name: string; price: number; qty: number; options?: Record<string, unknown> };

const key = (store: "books" | "fishing") => `concierge-basket:${store}`;

function readBasket(store: "books" | "fishing"): BasketItem[] {
  try {
    const raw = sessionStorage.getItem(key(store));
    return raw ? (JSON.parse(raw) as BasketItem[]) : [];
  } catch {
    return [];
  }
}

function writeBasket(store: "books" | "fishing", items: BasketItem[]) {
  try {
    sessionStorage.setItem(key(store), JSON.stringify(items));
  } catch {
    // ignore — private browsing / blocked storage
  }
}

export function CartBadge({ className, store, label = "Basket" }: { className?: string; store: "books" | "fishing"; label?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(readBasket(store).reduce((n, i) => n + i.qty, 0));
    const onAdd = (e: Event) => {
      const detail = (e as CustomEvent<AddDetail>).detail;
      const items = [...readBasket(store), { productId: detail.productId, name: detail.name, price: detail.price, qty: detail.qty, options: detail.options ?? {} }];
      writeBasket(store, items);
      setCount(items.reduce((n, i) => n + i.qty, 0));
    };
    window.addEventListener("concierge:add-to-cart", onAdd);
    return () => window.removeEventListener("concierge:add-to-cart", onAdd);
  }, [store]);
  return <Link href={`/demo/${store}/basket`} className={className} aria-live="polite">{label} ({count})</Link>;
}
