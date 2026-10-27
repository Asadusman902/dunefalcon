import { createClient } from "@supabase/supabase-js";

let client = null;

// Server-only client. Uses the service role key, so never import this
// into browser code. Row Level Security blocks everyone else.
export function supabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  // no-store: Next.js would otherwise cache these requests, so admin edits wouldn't show on the site.
  const fetchNoStore = (input, init) => fetch(input, { ...init, cache: "no-store" });
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchNoStore } });
  return client;
}
