import { activeOnly, c, drop, present, upsert, type Script } from "./present";
import type { Reply } from "../types";

const OPENING = "Looking for a gripping mystery for my dad. He's read all of Rankin. Nothing too gory, and ideally under 400 pages.";
const CHANGE = "Actually, he's gone off crime lately — he's been reading a lot of history";

const C = {
  mystery: c({ key: "mystery", label: "Mystery", attr: "genres", op: "includes", value: "mystery", hard: true, group: "genre", short: "mystery", shortRank: 1 }),
  gripping: c({ key: "gripping", label: "Gripping", attr: "tags", op: "includes", value: "gripping", miss: "More slow-burn than gripping", receipt: "Gripping", receiptRank: 4, bend: "more slow-burn than gripping", short: "gripping", shortRank: 2 }),
  gore: c({ key: "gore", label: "Not too gory", attr: "gore", op: "max", value: 1, miss: "Grittier than you'd like", receipt: "Not gory", receiptRank: 2, bend: "grittier than you'd like", short: "not gory", shortRank: 3 }),
  pages: c({ key: "pages", label: "Under 400 pages", attr: "pages", op: "max", value: 400, miss: "{actual} pages", receipt: "{actual} pages", receiptRank: 1,
    cell: { label: "Pages", pass: "{actual} ✓", fail: "{actual} ≠ <{limit}", rank: 1 }, bend: "{actual} pages · a longer read", relabel: "Under {value} pages", short: "under {value} pp", shortRank: 4 }),
  notRankin: c({ key: "notRankin", label: "Not Rankin", attr: "author", op: "excludes", value: "Ian Rankin", hard: true, group: "genre", short: "not Rankin", shortRank: 5 }),
  procedural: c({ key: "procedural", label: "Police procedural", attr: "genres", op: "includes", value: "police-procedural", hard: true, group: "genre", receipt: "Police procedural", receiptRank: 3, short: "procedural", shortRank: 1 }),
  historical: c({ key: "historical", label: "Historical", attr: "genres", op: "includes", value: "historical", hard: true, group: "genre", receipt: "Historical", receiptRank: 3, short: "historical", shortRank: 1 }),
  nordic: c({ key: "nordic", label: "Nordic", attr: "genres", op: "includes", value: "nordic", hard: true, group: "genre", receipt: "Nordic", receiptRank: 3, short: "nordic", shortRank: 1 }),
  cosy: c({ key: "cosy", label: "Cosy", attr: "genres", op: "includes", value: "cosy", hard: true, group: "genre", receipt: "Cosy", receiptRank: 3, short: "cosy", shortRank: 1 }),
  history: c({ key: "history", label: "History", attr: "genres", op: "includes", value: "history", hard: true, group: "genre", receipt: "History", receiptRank: 3, short: "history", shortRank: 1 }),
};
const SUBSTYLES = [
  { re: /procedural|like rankin|rankin-?like/, c: C.procedural },
  { re: /historical/, c: C.historical },
  { re: /nordic|scandi/, c: C.nordic },
  { re: /cos[yi]|cozy/, c: C.cosy },
];
const SUBSTYLE_KEYS = new Set(SUBSTYLES.map((s) => s.c.key));

const AFTER_RESULTS: Reply[] = [
  { label: "Compare the first two", text: "Compare the first two" },
  { label: "Actually, he's gone off crime…", text: CHANGE },
  { label: "Something shorter", text: "Something shorter" },
];
const AFTER_HISTORY: Reply[] = [
  { label: "Compare the first two", text: "Compare the first two" },
  { label: "Something shorter", text: "Something shorter" },
];

export const books: Script = {
  store: "books",
  opening: OPENING,
  demoInputs: [OPENING, "Police procedural, like Rankin", CHANGE, "Compare the first two", { add: "b-cartographer", giftWrap: true }],
  greetingReplies: [{ label: "“A gripping mystery for my dad…”", text: OPENING }],
  stripLabel: "For dad:",

  route(text, state) {
    const t = text.toLowerCase();
    if (state.step === "start") return /mystery|crime|book|dad|read|novel/.test(t) ? "understand" : "fallback";
    if (state.step === "added") {
      if (/card/.test(t)) return "card";
      if (/no thanks|that's all|no$/.test(t)) return "done";
      if (/for me|myself/.test(t)) return "forMe";
    }
    if (/gone off|changed? (my|his) mind|instead|history|non-?fiction/.test(t)) return "changeMind";
    if (/compare/.test(t)) return "compare";
    if (/shorter|fewer pages|\d+\s*pages/.test(t)) return "pages";
    if (/surprise/.test(t) || SUBSTYLES.some((s) => s.re.test(t))) return "refine";
    return "fallback";
  },

  afterAdd(ctx, product) {
    if (product.id === "b-card") {
      return {
        messages: [{ kind: "text", text: ctx.v({ warm: "Done — the card's in your basket too. Tell me what to write whenever you check out.", neutral: "Card added.", terse: "Card added." }) }],
        replies: [],
      };
    }
    return {
      messages: [{ kind: "text", text: ctx.v({ warm: "Good choice for him. Shall I add a handwritten card? We'll write whatever you like inside.", neutral: "Added. Want a handwritten card with it?", terse: "Added. Add a card?" }) }],
      replies: [
        { label: "Add a card", text: "Add a card" },
        { label: "No thanks", text: "No thanks" },
        { label: "Something for me too", text: "Something for me too" },
      ],
      step: "added",
    };
  },

  steps: {
    understand: ({ v }) => ({
      constraints: [C.mystery, C.gripping, C.gore, C.pages, C.notRankin],
      messages: [
        { kind: "text", text: v({
          warm: "Lovely — a gripping mystery, not too gory, under 400 pages, and nothing he's already read from Rankin. I've pinned those up top so you can change them any time.",
          neutral: "Got it: a gripping mystery, not too gory, under 400 pages, and not Rankin. Those are pinned above — tap × to remove one.",
          terse: "Noted: mystery, gripping, low gore, under 400 pages, not Rankin.",
        }) },
        { kind: "text", text: v({
          warm: "One question so I choose well: does he like his mysteries Rankin-style, or would something a little different appeal?",
          neutral: "What kind of mystery does he usually enjoy?",
          terse: "Which style?",
        }) },
      ],
      replies: [
        { label: "Police procedural, like Rankin", text: "Police procedural, like Rankin" },
        { label: "Historical", text: "Historical" },
        { label: "Nordic", text: "Nordic" },
      ],
    }),

    refine: (ctx) => {
      const t = ctx.text.toLowerCase();
      const chosen = SUBSTYLES.find((s) => s.re.test(t))?.c;
      let constraints = drop(ctx.state.constraints, (x) => SUBSTYLE_KEYS.has(x.key));
      if (chosen) constraints = upsert(constraints, { ...chosen });
      const out = present(ctx, constraints, {
        match: { warm: "Here are the ones I'd happily put in his hands:", neutral: "These fit everything you've told me:", terse: "Matches:" },
        none: { warm: "Nothing in that style ticks every box — here's the one I'd choose, and what it gives up:", neutral: "No exact match in that style. My pick:", terse: "No exact match. Pick:" },
      });
      return { constraints, messages: out.messages, lastShown: out.lastShown, replies: AFTER_RESULTS };
    },

    changeMind: (ctx) => {
      const before = activeOnly(ctx.state.constraints);
      const dropped = before.filter((x) => x.group === "genre").map((x) => x.label).sort();
      const constraints = upsert(drop(ctx.state.constraints, (x) => x.group === "genre"), { ...C.history });
      const kept = before.filter((x) => x.group !== "genre").map((x) => x.label);
      const out = present(ctx, constraints, {
        match: { warm: "History that reads like a thriller — the first one bridges both worlds:", neutral: "History titles that fit:", terse: "Matches:" },
        none: { warm: "Nothing fits every box, but these are close:", neutral: "Closest history titles:", terse: "Closest:" },
      });
      return {
        constraints,
        lastShown: out.lastShown,
        replies: AFTER_HISTORY,
        messages: [
          { kind: "text", text: ctx.v({
            warm: "Ah, that changes things — happily. I'll let go of the crime and keep the rest: still gripping, still not gory, still under 400 pages.",
            neutral: "No problem. Swapping crime for history and keeping everything else.",
            terse: "Swapped crime → history. Rest kept.",
          }) },
          { kind: "constraint-change", kept, dropped, added: ["History"] },
          ...out.messages,
        ],
      };
    },

    pages: (ctx) => {
      const current = ctx.state.constraints.find((x) => x.key === "pages");
      const asked = Number(ctx.text.match(/(\d+)\s*pages/)?.[1]);
      const limit = asked || Math.max(200, Number(current?.value ?? 400) - 80);
      const constraints = upsert(ctx.state.constraints, { ...C.pages, value: limit, label: `Under ${limit} pages` });
      const out = present(ctx, constraints, {
        match: { warm: `Keeping it under ${limit} pages:`, neutral: `Under ${limit} pages:`, terse: `≤${limit} pages:` },
        none: { warm: `Nothing quite that short fits — these are the nearest:`, neutral: "Closest options:", terse: "Closest:" },
      });
      return { constraints, messages: out.messages, lastShown: out.lastShown, replies: ctx.state.replies };
    },

    compare: (ctx) => {
      const ids = ctx.state.lastShown.slice(0, 2);
      if (ids.length < 2) {
        return { messages: [{ kind: "text", text: ctx.v({ warm: "There's only one to look at — tap it for the details.", neutral: "Only one option to compare — tap it for details.", terse: "Only one. Tap for details." }) }], replies: ctx.state.replies };
      }
      return {
        messages: [
          { kind: "text", text: ctx.v({ warm: "Side by side — tap “Choose” on the one that feels right:", neutral: "Here's how they compare:", terse: "Comparison:" }) },
          { kind: "compare", productIds: ids },
        ],
        replies: [],
      };
    },

    card: (ctx) => ({
      messages: [
        { kind: "text", text: ctx.v({ warm: "Here it is — tap Add and it'll go in with the book.", neutral: "Here's the card:", terse: "Card:" }) },
        { kind: "products", mode: "match", items: [{ productId: "b-card", receipts: [] }] },
      ],
      replies: [],
    }),

    done: (ctx) => ({
      messages: [{ kind: "text", text: ctx.v({ warm: "Lovely. I hope he enjoys it.", neutral: "Great — enjoy.", terse: "Done." }) }],
      replies: [],
    }),

    forMe: (ctx) => ({
      step: "start",
      messages: [{ kind: "text", text: ctx.v({ warm: "Happily — tell me a little about what you like to read and I'll start a fresh search.", neutral: "Sure — what do you like to read?", terse: "What do you read?" }) }],
      replies: [],
    }),

    fallback: (ctx) => ({
      step: ctx.state.step,
      messages: [{ kind: "text", text: ctx.v({
        warm: "I didn't quite catch that — I'm best at narrowing books down by style, length and what he's enjoyed before. Want to try one of these?",
        neutral: "Sorry, I didn't follow. I can narrow by style, length or mood — or pick one of these:",
        terse: "Didn't catch that. Try one of these:",
      }) }],
      replies: ctx.state.replies,
    }),
  },
};
