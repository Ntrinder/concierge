import { getProduct } from "../catalogs";
import type { AgentConfig } from "../types";

export function ProductList({ config, items, onOpen }: { config: AgentConfig; items: { productId: string; flag?: string }[]; mode: "match" | "near-miss"; onOpen: (id: string) => void }) {
  return <ul>{items.map((i) => <li key={i.productId}><button type="button" onClick={() => onOpen(i.productId)}>{getProduct(config.store, i.productId)?.name}</button> {i.flag}</li>)}</ul>;
}
export function Compare({ productIds }: { config: AgentConfig; productIds: string[]; compact: boolean; onChoose: (id: string) => void }) {
  return <p>Compare: {productIds.join(" vs ")}</p>;
}
export function NotifyForm({ done }: { done?: string; onSubmit: (email: string) => void }) {
  return <p>{done ?? "notify form"}</p>;
}
export function AddedNote({ productId }: { config: AgentConfig; productId: string }) {
  return <p>Added {productId}</p>;
}
