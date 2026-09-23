import { CATALOGS, getProduct } from "../catalogs";
import { attrOf, fill } from "../matcher";
import type { AgentDraft, Constraint, ConvState, Message, StoreKey, Voice, VoiceCopy } from "../types";
import { SCRIPTS } from "./index";
import { drop, present, upsert, type Ctx, type TurnOutput } from "./present";

export function initialState(store: StoreKey, voice: Voice): ConvState {
  return { store, voice, step: "start", turn: 0, seq: 0, constraints: [], messages: [], replies: SCRIPTS[store].greetingReplies, lastShown: [], basketCount: 0 };
}

type NewMessage = { role: "user"; kind: "text"; text: string } | ({ role: "agent" } & AgentDraft);

function push(s: ConvState, m: NewMessage): ConvState {
  const seq = s.seq + 1;
  return { ...s, seq, messages: [...s.messages, { ...m, id: `m${seq}` } as Message] };
}

function stamp(prev: Constraint[], next: Constraint[], turn: number): Constraint[] {
  return next.map((c) => {
    const p = prev.find((x) => x.key === c.key);
    const changed = !p || p.status !== c.status || p.value !== c.value;
    return changed ? { ...c, changedAt: turn } : { ...c, changedAt: p.changedAt };
  });
}

function ctxFor(s: ConvState, text: string): Ctx {
  return { state: s, products: CATALOGS[s.store], text, v: (c: VoiceCopy) => c[s.voice], script: SCRIPTS[s.store] };
}

function apply(s: ConvState, out: TurnOutput, step: string): ConvState {
  const turn = s.turn + 1;
  let next: ConvState = {
    ...s,
    turn,
    step: out.step ?? step,
    replies: out.replies,
    lastShown: out.lastShown ?? s.lastShown,
    constraints: out.constraints ? stamp(s.constraints, out.constraints, turn) : s.constraints,
    ...(out.stripLabel !== undefined ? { stripLabel: out.stripLabel } : {}),
  };
  for (const d of out.messages) next = push(next, { role: "agent", ...d });
  return next;
}

export function send(state: ConvState, text: string): ConvState {
  const script = SCRIPTS[state.store];
  const s = push(state, { role: "user", kind: "text", text });
  const key = script.route(text, s);
  const run = script.steps[key] ?? script.steps.fallback;
  return apply(s, run(ctxFor(s, text)), key);
}

export function removeConstraint(state: ConvState, key: string): ConvState {
  const target = state.constraints.find((x) => x.key === key && x.status === "active");
  if (!target || target.hard) return state;
  const constraints = state.constraints.map((x) => (x.key === key ? { ...x, status: "dropped" as const } : x));
  const ctx = ctxFor(state, "");
  const out = present(ctx, constraints, {
    match: { warm: `Without “${target.label}”, here's what opens up:`, neutral: `Without “${target.label}”:`, terse: `Dropped “${target.label}”:` },
    none: { warm: `Without “${target.label}”, these come closest:`, neutral: "Closest options:", terse: "Closest:" },
  });
  return apply(state, { constraints, messages: out.messages, lastShown: out.lastShown, replies: state.replies }, state.step);
}

export function bendConstraint(state: ConvState, key: string, productId: string): ConvState {
  const target = state.constraints.find((x) => x.key === key && x.status === "active");
  if (!target || target.hard) return state;
  const product = getProduct(state.store, productId);
  const actual = product ? attrOf(product, target.attr) : undefined;
  const constraints =
    (target.op === "max" || target.op === "min") && typeof actual === "number"
      ? upsert(state.constraints, {
          ...target,
          value: actual,
          label: target.relabel ? fill(target.relabel, { ...target, value: actual }, actual) : target.label,
          short: target.shortBent ?? target.short,
        })
      : drop(state.constraints, (x) => x.key === key);

  // Disable the bend rows on the near-miss message that offered this trade-off
  const nearMiss = [...state.messages].reverse().find((m) => m.role === "agent" && m.kind === "near-miss" && !m.used);
  const messages = nearMiss ? state.messages.map((m) => (m.id === nearMiss.id ? { ...m, used: true } : m)) : state.messages;
  const s = { ...state, messages };

  const ctx = ctxFor(s, "");
  const out = present(ctx, constraints, {
    match: { warm: "Bending that one — here's what fits now:", neutral: "Adjusted. These fit:", terse: "Adjusted:" },
    none: { warm: "Even bent, nothing ticks every box — here's my pick:", neutral: "Still no exact match. My pick:", terse: "Pick:" },
  });
  return apply(s, { constraints, messages: out.messages, lastShown: out.lastShown, replies: state.replies }, state.step);
}

export function markAdded(state: ConvState, productId: string, opts: { giftWrap: boolean } = { giftWrap: false }): ConvState {
  const script = SCRIPTS[state.store];
  const v = (c: VoiceCopy) => c[state.voice];
  const product = getProduct(state.store, productId);
  const count = state.basketCount + 1;
  const format = product?.specs.find((s) => s.label === "Format")?.value;
  const options = [...(format ? [format] : []), ...(opts.giftWrap ? ["Gift wrapped"] : [])];

  // Attribute the *most recent* compare that offered this product, so choosing
  // from an older comparison doesn't retroactively mark a later one.
  const target = [...state.messages].reverse().find((m) => m.role === "agent" && m.kind === "compare" && m.productIds.includes(productId) && !m.chosen);
  const messages = target ? state.messages.map((m) => (m.id === target.id ? { ...m, chosen: productId } : m)) : state.messages;
  const s = { ...state, messages };

  const after = product && script.afterAdd ? script.afterAdd({ state: s, products: CATALOGS[s.store], text: "", v, script }, product) : undefined;
  const fallback: AgentDraft = { kind: "text", text: v({ warm: "It's in your basket. Anything else I can help you find?", neutral: "Added. Anything else?", terse: "Added." }) };

  return apply({ ...s, basketCount: count }, {
    messages: [{ kind: "added", productId, options, count }, ...(after?.messages.length ? after.messages : [fallback])],
    replies: after?.replies ?? [],
    step: after?.step,
  }, state.step);
}

export function submitNotify(state: ConvState, messageId: string, email: string): ConvState {
  const messages = state.messages.map((m) => (m.id === messageId && m.kind === "notify-form" ? { ...m, done: email } : m));
  const v = (c: VoiceCopy) => c[state.voice];
  return apply({ ...state, messages }, {
    messages: [{ kind: "text", text: v({ warm: `Done — I'll email ${email} as soon as a match lands.`, neutral: `We'll email ${email} when a match arrives.`, terse: `Will notify ${email}.` }) }],
    replies: state.replies,
  }, state.step);
}

export function replay(store: StoreKey, voice: Voice, count: number): ConvState {
  let s = initialState(store, voice);
  for (const input of SCRIPTS[store].demoInputs.slice(0, count)) {
    s = typeof input === "string" ? send(s, input) : markAdded(s, input.add, { giftWrap: input.giftWrap ?? false });
  }
  return s;
}
