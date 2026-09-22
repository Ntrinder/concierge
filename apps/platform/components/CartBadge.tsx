"use client";
import { useEffect, useState } from "react";

export function CartBadge({ className, toastClassName, label = "Basket" }: { className?: string; toastClassName?: string; label?: string }) {
  const [count, setCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    const onAdd = (e: Event) => {
      const { name, qty } = (e as CustomEvent<{ name: string; qty: number }>).detail;
      setCount((c) => c + qty);
      setToast(`Added “${name}” to your basket`);
      setTimeout(() => setToast(null), 3200);
    };
    window.addEventListener("concierge:add-to-cart", onAdd);
    return () => window.removeEventListener("concierge:add-to-cart", onAdd);
  }, []);
  return (
    <>
      <span className={className} aria-live="polite">{label} ({count})</span>
      {toast && <div className={toastClassName} role="status">{toast}</div>}
    </>
  );
}
