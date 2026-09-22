import { readConfig } from "@/lib/configStore";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const id = file.replace(/\.json$/, "");
  const config = await readConfig(id);
  if (!config) return Response.json({ error: "Not found" }, { status: 404, headers: CORS });
  return Response.json(config, { headers: { ...CORS, "Cache-Control": "no-store" } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
