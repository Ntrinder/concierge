import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DEMO_CONFIGS, type AgentConfig } from "@concierge/agent/core";

const DATA_DIR = process.env.CONFIG_DIR ?? path.join(process.cwd(), ".data", "configs");
const ID_RE = /^[a-z0-9-]{1,64}$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const DEMO_IDS = new Set(Object.keys(DEMO_CONFIGS));
const FONT_URL_PREFIX = "https://fonts.googleapis.com/";
// Font names are interpolated into a <style> inside the widget's shadow root
const FONT_NAME_RE = /^[^;{}<>"'\\]{1,80}$/;

const ENUMS = {
  surface: ["light", "dark"],
  shape: ["soft", "rounded", "square"],
  density: ["airy", "regular", "compact"],
  voice: ["warm", "neutral", "terse"],
  cardStyle: ["visual", "spec"],
  position: ["bottom-right", "bottom-left"],
} as const;

const configPath = (id: string) => path.join(DATA_DIR, `${id}.json`);
// The edit-token hash lives in a sidecar file, never in the public JSON served at /configs/:id.json
const keyPath = (id: string) => path.join(DATA_DIR, `${id}.key`);
const sha256 = (s: string) => createHash("sha256").update(s).digest();

export async function readConfig(id: string): Promise<AgentConfig | null> {
  if (!ID_RE.test(id)) return null;
  if (DEMO_IDS.has(id)) return DEMO_CONFIGS[id as keyof typeof DEMO_CONFIGS];
  try {
    return JSON.parse(await fs.readFile(configPath(id), "utf8")) as AgentConfig;
  } catch {
    return null;
  }
}

const isStr = (v: unknown, max = 500): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const oneOf = (v: unknown, list: readonly string[]) => typeof v === "string" && list.includes(v);

function validAvatar(a: string): boolean {
  if (a.startsWith("data:")) return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(a);
  if (a.startsWith("/")) return /^\/demo\/[\w./-]+$/.test(a) && !a.includes("..");
  try {
    return new URL(a).protocol === "https:";
  } catch {
    return false;
  }
}

export function validate(c: Partial<AgentConfig>): string | null {
  if (!c || typeof c !== "object") return "Missing config";
  if (JSON.stringify(c).length > 200_000) return "Config too large (is the logo huge?)";
  if (typeof c.brand !== "string" || !HEX_RE.test(c.brand)) return "Brand colour must be a 6-digit hex";
  if (c.background !== undefined && (typeof c.background !== "string" || !HEX_RE.test(c.background))) return "Background must be a 6-digit hex";
  if (c.accent !== undefined && (typeof c.accent !== "string" || !HEX_RE.test(c.accent))) return "Accent must be a 6-digit hex";
  if (c.store !== "books" && c.store !== "fishing") return "Unknown store";
  if (!oneOf(c.surface, ENUMS.surface)) return "Surface must be light or dark";
  if (!oneOf(c.shape, ENUMS.shape)) return "Unknown shape";
  if (!oneOf(c.density, ENUMS.density)) return "Unknown density";
  if (!oneOf(c.voice, ENUMS.voice)) return "Unknown voice";
  if (!oneOf(c.cardStyle, ENUMS.cardStyle)) return "Unknown card style";

  const font = c.font as unknown;
  if (!font || typeof font !== "object" || Array.isArray(font)) return "Font settings are missing";
  const { family, display, url } = font as Record<string, unknown>;
  if (typeof family !== "string" || !FONT_NAME_RE.test(family)) return "Font name must be under 80 characters, without ; { } < > or quotes";
  if (display !== undefined && (typeof display !== "string" || !FONT_NAME_RE.test(display))) return "Heading font name must be under 80 characters, without ; { } < > or quotes";
  if (url !== undefined && (typeof url !== "string" || url.length > 1000 || !url.startsWith(FONT_URL_PREFIX))) {
    return "Custom font stylesheets must come from Google Fonts (https://fonts.googleapis.com/…)";
  }

  const agent = c.agent as unknown as Record<string, unknown> | undefined;
  if (!agent || typeof agent !== "object") return "Assistant name and greeting are required";
  if (!isStr(agent.name, 80) || !isStr(agent.greeting, 1000)) return "Assistant name and greeting are required";
  if (agent.avatar !== undefined && (typeof agent.avatar !== "string" || !validAvatar(agent.avatar))) {
    return "Logo must be an https:// image or an uploaded PNG";
  }

  const launcher = c.launcher as unknown as Record<string, unknown> | undefined;
  if (!launcher || typeof launcher !== "object" || !oneOf(launcher.position, ENUMS.position)) return "Launcher position must be bottom-right or bottom-left";
  if (launcher.label !== undefined && !isStr(launcher.label, 80)) return "Launcher label must be under 80 characters";
  return null;
}

/** Keep only known fields, so nothing unexpected is stored and re-served publicly. */
function clean(c: AgentConfig, id: string): AgentConfig {
  return {
    id,
    store: c.store,
    brand: c.brand,
    ...(c.accent ? { accent: c.accent } : {}),
    ...(c.background ? { background: c.background } : {}),
    surface: c.surface,
    font: { family: c.font.family, ...(c.font.display ? { display: c.font.display } : {}), ...(c.font.url ? { url: c.font.url } : {}) },
    shape: c.shape,
    density: c.density,
    voice: c.voice,
    cardStyle: c.cardStyle,
    agent: { name: c.agent.name, greeting: c.agent.greeting, ...(c.agent.avatar ? { avatar: c.agent.avatar } : {}) },
    launcher: { position: c.launcher.position, ...(c.launcher.label ? { label: c.launcher.label } : {}) },
  };
}

export class ForbiddenError extends Error {}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "store";

async function tokenMatches(id: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  try {
    const stored = Buffer.from((await fs.readFile(keyPath(id), "utf8")).trim(), "hex");
    const given = sha256(token);
    return stored.length === given.length && timingSafeEqual(stored, given);
  } catch {
    return false; // no sidecar (e.g. saved before edit tokens existed) = nobody can overwrite it
  }
}

/**
 * Saves a config. Overwriting an existing id requires the edit token that was
 * returned when that id was first saved (only its SHA-256 is stored). An unknown
 * or demo id is never overwritten — it gets a fresh id and a fresh token.
 */
export async function saveConfig(config: AgentConfig, editToken: string | null): Promise<{ id: string; editToken?: string }> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const requested = typeof config.id === "string" && ID_RE.test(config.id) && !DEMO_IDS.has(config.id) ? config.id : null;
  if (requested && (await readConfig(requested))) {
    if (!(await tokenMatches(requested, editToken))) throw new ForbiddenError("This design was saved from another browser session, so it can't be changed from here. Save it as a new design instead.");
    await fs.writeFile(configPath(requested), JSON.stringify(clean(config, requested), null, 2));
    return { id: requested };
  }

  const token = randomBytes(24).toString("base64url");
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = `${slug(config.agent.name)}-${randomBytes(4).toString("hex").slice(0, 6)}`;
    try {
      // "wx" = fail if the id already exists, so a collision never clobbers someone else's design
      await fs.writeFile(keyPath(id), sha256(token).toString("hex"), { flag: "wx" });
    } catch {
      continue;
    }
    await fs.writeFile(configPath(id), JSON.stringify(clean(config, id), null, 2));
    return { id, editToken: token };
  }
  throw new Error("Couldn't allocate a config id");
}
