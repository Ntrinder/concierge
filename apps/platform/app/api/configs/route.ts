import type { AgentConfig } from "@concierge/agent/core";
import { ForbiddenError, saveConfig, validate } from "@/lib/configStore";

/**
 * POST a config. New designs get `{ id, editToken }`; the token is shown once and
 * must be sent back as `x-edit-token` to overwrite that id later.
 */
export async function POST(req: Request) {
  const config = (await req.json().catch(() => null)) as AgentConfig | null;
  const error = validate(config ?? {});
  if (error || !config) return Response.json({ error: error ?? "Invalid JSON" }, { status: 400 });
  try {
    return Response.json(await saveConfig(config, req.headers.get("x-edit-token")));
  } catch (err) {
    if (err instanceof ForbiddenError) return Response.json({ error: err.message }, { status: 403 });
    return Response.json({ error: "Couldn't save your design — try again." }, { status: 500 });
  }
}
