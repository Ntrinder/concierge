export type StoreKey = "books" | "fishing";
export type Voice = "warm" | "neutral" | "terse";
export type Shape = "soft" | "rounded" | "square";
export type Density = "airy" | "regular" | "compact";
export type CardStyle = "visual" | "spec";

export interface AgentConfig {
  id: string;
  store: StoreKey;
  brand: string;
  accent?: string;
  background?: string;
  surface: "light" | "dark";
  /** family "inherit" = use the host site's font */
  font: { family: string; display?: string; url?: string };
  shape: Shape;
  density: Density;
  voice: Voice;
  cardStyle: CardStyle;
  agent: { name: string; avatar?: string; greeting: string };
  launcher: { position: "bottom-right" | "bottom-left"; label?: string };
  basket?: { checkoutUrl?: string; basketUrl?: string };
}

export interface TokenAdjustment { token: string; from: string; to: string; reason: string }
export interface TokenResult { vars: Record<string, string>; adjustments: TokenAdjustment[] }

export type AttrValue = string | number | boolean | string[];

export type ProductImage =
  | { kind: "cover"; bg: string; fg: string; motif: "band" | "circle" | "rule" }
  | { kind: "glyph"; glyph: "rod" | "reel" | "kit" };

export interface Product {
  id: string;
  store: StoreKey;
  name: string;
  byline: string;
  price: number;
  blurb: string;
  why: string;
  /** "Why this one" text keyed by constraint key, used instead of `why` when that constraint is active */
  whyFor?: Record<string, string>;
  attrs: Record<string, AttrValue>;
  specs: { label: string; value: string }[];
  image: ProductImage;
}

export interface Constraint {
  key: string;
  label: string;
  attr: string;
  op: "includes" | "excludes" | "max" | "min" | "eq";
  value: string | number | boolean;
  /** hard constraints define the category; near misses never break them and shoppers can't remove them */
  hard?: boolean;
  group?: string;
  /** near-miss text template: {actual} {limit} {over} */
  miss?: string;
  /** receipt pill text when a product satisfies this constraint; {actual} = product value. No template → no pill. */
  receipt?: string;
  /** lower shows first; default 9 */
  receiptRank?: number;
  status: "active" | "dropped";
  /** turn number when this constraint was added or dropped (set by the engine) */
  changedAt?: number;
}

export interface Violation { constraint: Constraint; actual: AttrValue | undefined; severity: number; text: string }
export interface NearMiss { product: Product; violation: Violation }
export interface MatchResult { matches: Product[]; nearMisses: NearMiss[] }

export interface Reply { label: string; text: string }
export type VoiceCopy = Record<Voice, string>;

export type AgentDraft =
  | { kind: "text"; text: string }
  | { kind: "products"; mode: "match" | "near-miss"; items: { productId: string; flag?: string; receipts?: string[] }[] }
  | { kind: "constraint-change"; kept: string[]; dropped: string[]; added: string[] }
  | { kind: "compare"; productIds: string[]; chosen?: string }
  | { kind: "notify-form"; done?: string }
  | { kind: "added"; productId: string; options: string[]; count: number };

export type Message =
  | { id: string; role: "user"; kind: "text"; text: string }
  | ({ id: string; role: "agent" } & AgentDraft);

export interface ConvState {
  store: StoreKey;
  voice: Voice;
  step: string;
  turn: number;
  seq: number;
  constraints: Constraint[];
  messages: Message[];
  replies: Reply[];
  lastShown: string[];
  basketCount: number;
}
