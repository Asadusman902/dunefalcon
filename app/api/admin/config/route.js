import { isAdmin, unauthorized } from "@/lib/auth";
import { getConfig } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAdmin()) return unauthorized();
  return Response.json(await getConfig({ includeHidden: true }));
}
