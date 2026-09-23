import { c, drop, present, upsert, type Script } from "./present";
import type { Reply } from "../types";

const OPENING = "Need a beginner fly rod for small streams, packs down small enough for hiking, under €150.";

const C = {
  flyRod: c({ key: "flyRod", label: "Fly rod", attr: "flyRod", op: "eq", value: true, hard: true }),
  beginner: c({ key: "beginner", label: "Beginner-friendly", attr: "beginner", op: "eq", value: true, miss: "Built for experienced casters", receipt: "Beginner-friendly", receiptRank: 2 }),
  packable: c({ key: "packable", label: "Packs ≤ 60 cm", attr: "packedCm", op: "max", value: 60, miss: "Packs to {actual} cm", receipt: "{actual} cm packed", receiptRank: 1 }),
  budget: c({ key: "budget", label: "Under €150", attr: "price", op: "max", value: 150, miss: "€{over} over budget" }),
  weight: c({ key: "weight", label: "3–4 wt", attr: "lineWeight", op: "max", value: 4, miss: "{actual} wt — heavier than ideal for small streams", receipt: "{actual} wt", receiptRank: 1 }),
};

const NEAR_MISS_REPLIES: Reply[] = [
  { label: "Stretch the budget to €200", text: "Stretch the budget to €200" },
  { label: "Pack size can be bigger", text: "Pack size can be bigger" },
  { label: "Tell me when a match lands", text: "Tell me when a match lands" },
];
const CONFIRM: Reply[] = [
  { label: "Yes, 3–4 weight", text: "Yes, 3–4 weight" },
  { label: "What does weight mean?", text: "What does weight mean?" },
];
const WEIGHT_COPY = {
  match: { warm: "Good news — these tick every box:", neutral: "These match everything:", terse: "Matches:" },
  none: {
    warm: "Honest answer: nothing we stock ticks every box. Here's the closest from each direction — each one misses on just one thing:",
    neutral: "Nothing matches all five. Closest options, each missing one requirement:",
    terse: "No exact match. Closest, one miss each:",
  },
};

export const fishing: Script = {
  store: "fishing",
  opening: OPENING,
  demoInputs: [OPENING, "Yes, 3–4 weight", "Stretch the budget to €200", "Compare the first two", { add: "f-stillwater-trail" }],
  greetingReplies: [{ label: "“Beginner fly rod for small streams…”", text: OPENING }],

  route(text, state) {
    const t = text.toLowerCase();
    if (state.step === "start") return /rod|fly|stream|hik|fish|reel/.test(t) ? "understand" : "fallback";
    if (state.step === "added") {
      if (/leader|tippet/.test(t)) return "leaderPack";
      if (/no thanks|no$/.test(t)) return "doneAdd";
    }
    if ((state.step === "understand" || state.step === "explain") && /^(yes|yep|sure|ok)|3.?4|sounds good|go with/.test(t)) return "weight";
    if (/what does|explain|not sure|mean/.test(t)) return "explain";
    if (/tell me when|notify|let me know/.test(t)) return "notify";
    if (/stretch|budget|spend more|€\s?\d+|\d+\s?(eur|euro)/.test(t)) return "budget";
    if (/pack size|bigger|longer is fine|doesn'?t (need|have) to pack|relax/.test(t)) return "relaxPack";
    if (/compare/.test(t)) return "compare";
    return "fallback";
  },

  afterAdd(ctx, product) {
    if (product.id === "f-leader-tippet") {
      return {
        messages: [{ kind: "text", text: ctx.v({ warm: "That's you set — tie on a fly and go.", neutral: "Leader pack added.", terse: "Added." }) }],
        replies: [],
      };
    }
    return {
      messages: [{ kind: "text", text: ctx.v({ warm: "Good pick. You'll need a leader and tippet to tie on a fly — want me to add a pack?", neutral: "Added. You'll also need leader and tippet — add a pack?", terse: "Added. Need leader & tippet?" }) }],
      replies: [
        { label: "Add a leader & tippet pack", text: "Add a leader & tippet pack" },
        { label: "No thanks", text: "No thanks" },
      ],
      step: "added",
    };
  },

  steps: {
    understand: ({ v }) => ({
      constraints: [C.flyRod, C.beginner, C.packable, C.budget],
      messages: [
        { kind: "text", text: v({
          warm: "Nice — a first fly rod you can hike in with. I've pinned what you told me above.",
          neutral: "Got it: beginner fly rod, packs down for hiking, under €150.",
          terse: "Beginner fly rod. Packs ≤ 60 cm. Under €150.",
        }) },
        { kind: "text", text: v({
          warm: "One thing worth knowing: on small streams a light 3–4 weight rod makes casting under trees easier and small trout more fun. Shall I stick to those?",
          neutral: "For small streams, a 3–4 weight is ideal. OK to go with that?",
          terse: "Small streams → 3–4 wt. Go with that?",
        }) },
      ],
      replies: CONFIRM,
    }),

    explain: ({ v }) => ({
      messages: [{ kind: "text", text: v({
        warm: "Rod “weight” is about the line it casts, not how heavy it is. Lighter (3–4) lands softly on small, clear water and bends nicely with small trout; 5–6 is the all-rounder for bigger rivers and wind. For small streams, lighter is kinder.",
        neutral: "Weight refers to the line the rod casts. 3–4 wt suits small streams and small fish; 5–6 wt suits bigger rivers and wind.",
        terse: "Weight = line class. 3–4: small water. 5–6: big rivers, wind.",
      }) }],
      replies: [CONFIRM[0]],
    }),

    weight: (ctx) => {
      const constraints = upsert(ctx.state.constraints, { ...C.weight });
      const out = present(ctx, constraints, WEIGHT_COPY);
      return { constraints, messages: out.messages, lastShown: out.lastShown, replies: out.mode === "near-miss" ? NEAR_MISS_REPLIES : [{ label: "Compare the first two", text: "Compare the first two" }] };
    },

    budget: (ctx) => {
      const limit = Number(ctx.text.match(/(\d{2,4})/)?.[1]) || 200;
      const constraints = upsert(ctx.state.constraints, { ...C.budget, value: limit, label: `Under €${limit}` });
      const out = present(ctx, constraints, {
        match: { warm: `Stretching to €${limit} opens things up:`, neutral: `Under €${limit}:`, terse: `≤ €${limit}:` },
        none: { warm: `Even at €${limit}, nothing ticks every box — closest:`, neutral: "Still no exact match. Closest:", terse: "Closest:" },
      });
      return { constraints, messages: out.messages, lastShown: out.lastShown, replies: out.lastShown.length >= 2 ? [{ label: "Compare the first two", text: "Compare the first two" }] : [] };
    },

    relaxPack: (ctx) => {
      const constraints = drop(ctx.state.constraints, (x) => x.key === "packable");
      const out = present(ctx, constraints, {
        match: { warm: "If it can ride on the outside of your pack, these fit everything else:", neutral: "Without the pack-size limit:", terse: "No pack limit:" },
        none: { warm: "Closest without the pack-size limit:", neutral: "Closest:", terse: "Closest:" },
      });
      return { constraints, messages: out.messages, lastShown: out.lastShown, replies: out.lastShown.length >= 2 ? [{ label: "Compare the first two", text: "Compare the first two" }] : [] };
    },

    notify: ({ v }) => ({
      messages: [
        { kind: "text", text: v({
          warm: "Happy to. Leave your email and I'll let you know the moment a packable 3–4 wt under €150 comes in.",
          neutral: "Leave your email and we'll tell you when a match arrives.",
          terse: "Email me when a match arrives:",
        }) },
        { kind: "notify-form" },
      ],
      replies: [NEAR_MISS_REPLIES[0], NEAR_MISS_REPLIES[1]],
    }),

    compare: (ctx) => {
      const ids = ctx.state.lastShown.slice(0, 2);
      if (ids.length < 2) {
        return { messages: [{ kind: "text", text: ctx.v({ warm: "There's just one here — tap it for the full specs.", neutral: "Only one option — tap it for specs.", terse: "One option. Tap for specs." }) }], replies: ctx.state.replies };
      }
      return {
        messages: [
          { kind: "text", text: ctx.v({ warm: "Here they are side by side:", neutral: "Spec comparison:", terse: "Specs:" }) },
          { kind: "compare", productIds: ids },
        ],
        replies: [],
      };
    },

    leaderPack: (ctx) => ({
      messages: [
        { kind: "text", text: ctx.v({ warm: "Here's the pack — it suits a 3–5 wt rod.", neutral: "Leader & tippet pack:", terse: "Pack:" }) },
        { kind: "products", mode: "match", items: [{ productId: "f-leader-tippet", receipts: [] }] },
      ],
      replies: [],
    }),

    doneAdd: (ctx) => ({
      messages: [{ kind: "text", text: ctx.v({ warm: "Enjoy the water.", neutral: "Great — enjoy.", terse: "Done." }) }],
      replies: [],
    }),

    fallback: (ctx) => ({
      step: ctx.state.step,
      messages: [{ kind: "text", text: ctx.v({
        warm: "Not sure I followed — I can narrow things down by budget, rod weight or how small it packs. Try one of these:",
        neutral: "I didn't catch that. I can filter by budget, weight or packed length:",
        terse: "Unclear. Options:",
      }) }],
      replies: ctx.state.replies,
    }),
  },
};
