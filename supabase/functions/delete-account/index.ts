// Permanently deletes the signed-in user's account: their photos in storage,
// then the auth user (the database cascades to profile, closet, posts, etc.).
// Required by Google Play's account deletion policy.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKETS = ["closet", "posts", "avatars"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function serviceKey(): string {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      if (parsed?.default) return parsed.default;
    } catch {
      // fall through to the legacy key
    }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("No service key configured");
  return legacy;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Not signed in" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: "Not signed in" }, 401);

  try {
    for (const bucket of BUCKETS) {
      // Files live at <user id>/<file>. Remove in pages until the folder is empty.
      while (true) {
        const { data: files, error } = await admin.storage
          .from(bucket)
          .list(user.id, { limit: 1000 });
        if (error) throw error;
        if (!files || files.length === 0) break;
        const { error: removeError } = await admin.storage
          .from(bucket)
          .remove(files.map((f) => `${user.id}/${f.name}`));
        if (removeError) throw removeError;
        if (files.length < 1000) break;
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return json({ deleted: true });
  } catch (e) {
    console.error("delete-account failed", user.id, e);
    return json({ error: "Could not delete account. Please try again or contact support." }, 500);
  }
});
