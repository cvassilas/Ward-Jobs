// Ward Jobs: tell the other phones on a team that the list has changed.
// Deploy in Supabase → Edge Functions → "Deploy a new function" → "Via editor", name: ward-notify,
// paste this file, and turn OFF "Verify JWT" in the function's settings.
// Secrets (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
// The message is deliberately generic: the server can't read the encrypted list, and nothing
// about patients appears on a locked screen.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

webpush.setVapidDetails("mailto:ward-jobs@example.invalid", Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { space, exclude, kind } = await req.json();
    if (typeof space !== "string" || space.length < 20) return new Response("bad space", { status: 400, headers: cors });
    const cutoff = new Date(Date.now() - 60_000).toISOString(); // at most one alert a minute per phone
    const { data: subs } = await db.from("ward_push_subs").select("*").eq("space_id", space)
      .or(`last_sent.is.null,last_sent.lt.${cutoff}`);
    const targets = (subs || []).filter((s: any) => s.endpoint !== exclude);
    const payload = JSON.stringify({
      title: "Ward Jobs",
      body: kind === "urgent" ? "An urgent job was added to your team list" : "Your team list has been updated",
      tag: "ward-jobs-update",
    });
    let sent = 0;
    await Promise.all(targets.map(async (s: any) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: kind === "urgent" ? "high" : "normal" });
        sent++;
        await db.from("ward_push_subs").update({ last_sent: new Date().toISOString() }).eq("endpoint", s.endpoint);
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("ward_push_subs").delete().eq("endpoint", s.endpoint);
      }
    }));
    return new Response(JSON.stringify({ sent }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
