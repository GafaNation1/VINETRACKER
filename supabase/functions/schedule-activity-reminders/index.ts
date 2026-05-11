// deno-lint-ignore-file no-explicit-any
// Runs every minute via pg_cron. Two responsibilities:
//   1. Insert a reminder notification when an activity's start_time is reached
//      (deduped via activity_reminders_sent).
//   2. Drain any notification rows where push_sent_at IS NULL by sending a
//      Web Push for each, then marking the row delivered. This works for
//      reminder + group + dm + program + announcement notifications.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// This function is invoked by pg_cron / service role only — it never serves a
// browser. We still emit CORS headers for safety and restrict the origin to
// known Lovable + production domains rather than a wildcard.
const ALLOWED_ORIGINS = new Set([
  "https://vine-track.lovable.app",
  "https://id-preview--01914b74-18b5-40d4-b091-e50d5fa2a7df.lovable.app",
  "https://01914b74-18b5-40d4-b091-e50d5fa2a7df.lovableproject.com",
]);
function buildCors(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.has(origin) ||
    /\.lovable\.(app|dev)$/.test((() => { try { return new URL(origin).hostname; } catch { return ""; } })());
  return {
    "Access-Control-Allow-Origin": allow ? origin : "https://vine-track.lovable.app",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  } as Record<string, string>;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function pushTitleFor(type: string): string {
  switch (type) {
    case "group": return "New group message";
    case "dm": return "New message";
    case "program": return "Program update";
    case "announcement": return "Vine Tracker announcement";
    case "reminder": return "Activity reminder";
    default: return "Vine Tracker";
  }
}

function deepLinkFor(n: any): string {
  switch (n.action_type) {
    case "open-activity": return n.activity_id ? `/activity/${n.activity_id}` : "/notifications";
    case "open-group": return "/groups";
    case "open-dm": return "/groups";
    case "open-program": return "/programs";
    case "open-announcement": return "/settings";
    default: return "/notifications";
  }
}

async function dispatchPendingPushes(supabase: any) {
  // Pick up to 200 unsent notifications from the last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: pending, error } = await supabase
    .from("notifications")
    .select("id, user_id, type, message, action_type, action_id, activity_id")
    .is("push_sent_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error || !pending?.length) return { dispatched: 0 };

  // Group by user to fetch their preferences once
  const userIds = Array.from(new Set(pending.map((n: any) => n.user_id)));
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("user_id, group_chat, activity_reminders, program_updates, announcements")
    .in("user_id", userIds);
  const prefByUser = new Map<string, any>();
  (prefs || []).forEach((p: any) => prefByUser.set(p.user_id, p));

  let dispatched = 0;
  for (const n of pending) {
    const p = prefByUser.get(n.user_id) || {};
    const allowed =
      (n.type === "group" && p.group_chat !== false) ||
      (n.type === "dm" && true) ||
      (n.type === "program" && p.program_updates !== false) ||
      (n.type === "announcement" && p.announcements !== false) ||
      (n.type === "reminder" && p.activity_reminders !== false) ||
      !["group", "dm", "program", "announcement", "reminder"].includes(n.type);

    if (allowed) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({
            user_ids: [n.user_id],
            title: pushTitleFor(n.type),
            body: n.message,
            url: deepLinkFor(n),
            tag: `${n.type}:${n.action_id || n.id}`,
          }),
        });
        dispatched++;
      } catch (_) { /* swallow individual failures */ }
    }

    // Mark delivered (or skipped) so we don't retry forever
    await supabase
      .from("notifications")
      .update({ push_sent_at: new Date().toISOString() })
      .eq("id", n.id);
  }
  return { dispatched };
}

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // 1) Activity start-time reminders
    const { data: acts, error } = await supabase
      .from("activities")
      .select("id, user_id, title, start_date, start_time, status")
      .eq("status", "ongoing")
      .eq("start_date", today)
      .not("start_time", "is", null)
      .neq("start_time", "");
    if (error) throw error;

    let scheduled = 0;
    for (const a of acts ?? []) {
      const t = (a as any).start_time as string;
      if (!t) continue;
      const [hh, mm] = t.split(":").map((n: string) => parseInt(n, 10));
      if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
      const at = new Date(now);
      at.setHours(hh, mm, 0, 0);
      const delta = now.getTime() - at.getTime();
      // fire if scheduled within last 5 min or up to 1 min in the future
      if (delta < -60 * 1000 || delta > 5 * 60 * 1000) continue;

      const { error: insErr } = await supabase
        .from("activity_reminders_sent")
        .insert({
          activity_id: a.id,
          user_id: (a as any).user_id,
          scheduled_for: at.toISOString(),
        });
      if (insErr) continue; // unique violation = already sent

      await supabase.from("notifications").insert({
        user_id: (a as any).user_id,
        type: "reminder",
        message: `Time for: ${(a as any).title}`,
        action_type: "open-activity",
        action_id: (a as any).id,
        activity_id: (a as any).id,
      });
      scheduled += 1;
    }

    // 2) Drain pending pushes for ALL notification types
    const { dispatched } = await dispatchPendingPushes(supabase);

    return new Response(
      JSON.stringify({ ok: true, scanned: acts?.length ?? 0, scheduled, dispatched }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
