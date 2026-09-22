import type { AgentConfig } from "@concierge/agent/core";
import { saveConfig, validate } from "@/lib/configStore";

export async function POST(req: Request) {
  const config = (await req.json().catch(() => null)) as AgentConfig | null;
  const error = validate(config ?? {});
  if (error || !config) return Response.json({ error: error ?? "Invalid JSON" }, { status: 400 });
  const id = await saveConfig(config);
  return Response.json({ id });
}
