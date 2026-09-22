import { promises as fs } from "node:fs";
import path from "node:path";
import { DEMO_CONFIGS, type AgentConfig } from "@concierge/agent/core";

const DATA_DIR = process.env.CONFIG_DIR ?? path.join(process.cwd(), ".data", "configs");
const ID_RE = /^[a-z0-9-]{1,64}$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const DEMO_IDS = new Set(Object.keys(DEMO_CONFIGS));

export async function readConfig(id: string): Promise<AgentConfig | null> {
  if (!ID_RE.test(id)) return null;
  if (DEMO_IDS.has(id)) return DEMO_CONFIGS[id as keyof typeof DEMO_CONFIGS];
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf8")) as AgentConfig;
  } catch {
    return null;
  }
}

export function validate(c: Partial<AgentConfig>): string | null {
  if (!c || typeof c !== "object") return "Missing config";
  if (!c.brand || !HEX_RE.test(c.brand)) return "Brand colour must be a 6-digit hex";
  if (c.background && !HEX_RE.test(c.background)) return "Background must be a 6-digit hex";
  if (c.accent && !HEX_RE.test(c.accent)) return "Accent must be a 6-digit hex";
  if (c.store !== "books" && c.store !== "fishing") return "Unknown store";
  if (!c.agent?.name || !c.agent.greeting) return "Assistant name and greeting are required";
  if (JSON.stringify(c).length > 200_000) return "Config too large (is the logo huge?)";
  return null;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "store";

export async function saveConfig(config: AgentConfig): Promise<string> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  let id = config.id;
  const existing = id && ID_RE.test(id) && !DEMO_IDS.has(id) ? await readConfig(id) : null;
  if (!existing) id = `${slug(config.agent.name)}-${Math.random().toString(36).slice(2, 6)}`;
  await fs.writeFile(path.join(DATA_DIR, `${id}.json`), JSON.stringify({ ...config, id }, null, 2));
  return id;
}
