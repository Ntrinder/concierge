import type { StoreKey } from "../types";
import { books } from "./books";
import { fishing } from "./fishing";
import type { Script } from "./present";

export const SCRIPTS: Record<StoreKey, Script> = { books, fishing };
export type { Script } from "./present";
