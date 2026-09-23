import { converter, differenceEuclidean } from "culori";

/**
 * Friendly names a shop owner would recognise, spread across neutrals and each hue at
 * light / mid / deep lightness. Nearest-by-OKLCH picks one; anything too far from every
 * entry gets a generic "{Light|Deep} {family}" name instead of a wrong fancy one.
 */
export const COLOUR_NAMES: readonly (readonly [hex: string, name: string])[] = [
  // whites, papers, creams
  ["#FFFFFF", "White"],
  ["#FBF8F1", "Warm white"],
  ["#F3F6FA", "Cool white"],
  ["#F2F2F0", "Off-white"],
  ["#F6F1E7", "Warm paper"],
  ["#F2E6CC", "Cream"],
  ["#E4D9C4", "Oatmeal"],
  ["#D9C7A3", "Sand"],
  ["#C9C3B8", "Stone"],
  // greys
  ["#EDEDED", "Pale grey"],
  ["#E1E5EA", "Mist grey"],
  ["#BFC3C7", "Silver"],
  ["#A6A6A6", "Dove grey"],
  ["#8E867C", "Warm grey"],
  ["#7F7F7F", "Mid grey"],
  ["#66707B", "Slate grey"],
  ["#4A4A4F", "Graphite"],
  ["#333333", "Charcoal"],
  ["#2B3237", "Gunmetal"],
  // near-blacks
  ["#101214", "Carbon"],
  ["#111111", "Ink black"],
  ["#000000", "Black"],
  ["#2A1C15", "Espresso"],
  ["#121A2B", "Midnight"],
  // reds
  ["#F2786B", "Coral"],
  ["#E5412D", "Tomato red"],
  ["#D7263D", "Poppy red"],
  ["#B5172E", "Crimson"],
  ["#A63A2B", "Brick red"],
  ["#7A2E2E", "Oxblood"],
  ["#6A1A2A", "Burgundy"],
  ["#4A181D", "Maroon"],
  // oranges
  ["#FBCBA8", "Peach"],
  ["#F6A15E", "Apricot"],
  ["#FF5A1F", "Blaze orange"],
  ["#F58A1F", "Tangerine"],
  ["#C4561B", "Burnt orange"],
  ["#C46A4A", "Terracotta"],
  ["#963F1F", "Rust"],
  // browns
  ["#C8A97E", "Tan"],
  ["#B5854F", "Camel"],
  ["#9C6630", "Caramel"],
  ["#7B4A2E", "Chestnut"],
  ["#5B3A29", "Walnut"],
  ["#40261A", "Chocolate"],
  // yellows
  ["#F8E9A6", "Butter"],
  ["#F4DA3A", "Lemon"],
  ["#F2B705", "Sunflower"],
  ["#C99A1E", "Mustard"],
  ["#9E7618", "Ochre"],
  ["#6B6B2A", "Olive"],
  // greens
  ["#C4E8D0", "Mint"],
  ["#9CAF88", "Sage"],
  ["#9ACD32", "Lime"],
  ["#4CAF50", "Leaf green"],
  ["#13875A", "Emerald"],
  ["#5A6B3A", "Moss"],
  ["#3C4F3A", "Hunter green"],
  ["#1F5135", "Forest green"],
  ["#0F3827", "Bottle green"],
  // teals and cyans
  ["#A8DCD1", "Seafoam"],
  ["#3FC1C9", "Aqua"],
  ["#0F7C80", "Teal"],
  ["#0B4F52", "Deep teal"],
  ["#1F4552", "Petrol"],
  // blues
  ["#C7DBEE", "Powder blue"],
  ["#7CB9E8", "Sky blue"],
  ["#6495ED", "Cornflower"],
  ["#C9CCF5", "Periwinkle"],
  ["#1E88E5", "Azure"],
  ["#1F4FB5", "Cobalt"],
  ["#3346D3", "Royal blue"],
  ["#3B5B85", "Denim"],
  ["#4F6D8A", "Steel blue"],
  ["#1B2A4A", "Navy"],
  // purples
  ["#D8CCEF", "Lavender"],
  ["#B39DDB", "Lilac"],
  ["#7E57C2", "Violet"],
  ["#3F2A8C", "Indigo"],
  ["#6B2D5C", "Plum"],
  ["#3B1F33", "Aubergine"],
  ["#9E7A8F", "Mauve"],
  // pinks
  ["#F4C9CC", "Blush"],
  ["#D4A5A5", "Dusty pink"],
  ["#E57A8D", "Rose"],
  ["#E83E8C", "Hot pink"],
  ["#C2187D", "Magenta"],
  ["#D63AAF", "Fuchsia"],
  ["#B0264F", "Raspberry"],
];

const toOklch = converter("oklch");
const distance = differenceEuclidean("oklch");
/** ΔE in OKLCH beyond which the nearest named colour is more misleading than helpful. */
const MAX_DISTANCE = 0.07;

const ENTRIES = COLOUR_NAMES.map(([hex, name]) => ({ name, lch: toOklch(hex)! }));

function family(l: number, c: number, h: number): string {
  if (c < 0.03) return l > 0.93 ? "white" : l < 0.2 ? "black" : "grey";
  if (h >= 20 && h < 75 && l < 0.55) return "brown";
  if (h < 15 || h >= 345) return "pink";
  if (h < 45) return "red";
  if (h < 75) return "orange";
  if (h < 110) return "yellow";
  if (h < 165) return "green";
  if (h < 215) return "teal";
  if (h < 275) return "blue";
  if (h < 315) return "purple";
  if (h < 345) return "magenta";
  return "pink";
}

/** Nearest friendly name for a hex colour, e.g. "#7A2E2E" → "Oxblood". */
export function colourName(hex: string): string {
  const lch = toOklch(hex);
  if (!lch) return hex.toUpperCase();
  let best = ENTRIES[0]!, bestD = Infinity;
  for (const e of ENTRIES) {
    const d = distance(lch, e.lch);
    if (d < bestD) { best = e; bestD = d; }
  }
  if (bestD <= MAX_DISTANCE) return best.name;
  const fam = family(lch.l, lch.c ?? 0, lch.h ?? 0);
  if (fam === "white" || fam === "black") return fam[0]!.toUpperCase() + fam.slice(1);
  const tone = lch.l > 0.78 ? "Light " : lch.l < 0.45 ? "Deep " : "";
  const name = `${tone}${fam}`;
  return name[0]!.toUpperCase() + name.slice(1);
}
