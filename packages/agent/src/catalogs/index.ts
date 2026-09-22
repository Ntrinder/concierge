import type { Product, StoreKey } from "../types";
import { BOOKS } from "./books";
import { FISHING } from "./fishing";

export const CATALOGS: Record<StoreKey, Product[]> = { books: BOOKS, fishing: FISHING };

export function getProduct(store: StoreKey, id: string): Product | undefined {
  return CATALOGS[store].find((p) => p.id === id);
}
