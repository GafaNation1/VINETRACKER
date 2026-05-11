// Edge function that sends Web Push notifications using VAPID.
// Invoked from the client (or future triggers) with: { user_ids: string[], title, body, url?, tag? }
// All responses include CORS headers.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGINS = new Set([
  "https://vine-track.lovable.app",
  "https://id-preview--01914b74-18b5-40d4-b091-e50d5fa2a7df.lovable.app",
  "https://01914b74-18b5-40d4-b091-e50d5fa2a7df.lovableproject.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
]);

function buildCors(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.has(origin) || /\.lovable\.(app|dev)$/.test(new URL(origin || "https://x").hostname || "");
  return {
    "Access-Control-Allow-Origin": allow ? origin : "https://vine-track.lovable.app",
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  } as Record<string, string>;
}

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:notifications@vinetracker.app";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  } catch (e) {
    console.error("VAPID setup failed", e);
  }
}

interface Payload {
  user_ids: string[];
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

Deno.serve(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(
      JSON.stringify({ error: "VAPID keys not configured on server" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // Auth: accept either a logged-in user JWT OR the service-role key (used by DB triggers)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const isServiceCall = !!serviceKey && token === serviceKey;

  let callerId = "";
  if (!isServiceCall) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    callerId = (claims.claims as any).sub as string;
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!Array.isArray(body.user_ids) || body.user_ids.length === 0 || !body.title || !body.body) {
    return new Response(
      JSON.stringify({ error: "user_ids[], title, body required" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // Basic input bounds
  if (body.user_ids.length > 500 || body.title.length > 200 || body.body.length > 1000) {
    return new Response(JSON.stringify({ error: "Payload too large" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Use service role to read subscriptions for any recipient user
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Authorization (skip for service-role calls): caller must be admin OR every target must share a group/program with caller, OR be self
  if (!isServiceCall) {
    const { data: adminRow } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();

    if (!adminRow) {
      const targets = Array.from(new Set(body.user_ids.filter((u) => u && u !== callerId)));
      if (targets.length > 0) {
        const { data: callerGroups } = await admin
          .from("group_members").select("group_id").eq("user_id", callerId).eq("status", "active");
        const groupIds = (callerGroups || []).map((g: any) => g.group_id);
        const { data: callerPrograms } = await admin
          .from("program_participants").select("program_id").eq("user_id", callerId);
        const { data: ownedPrograms } = await admin
          .from("programs").select("id").eq("owner_id", callerId);
        const programIds = [
          ...(callerPrograms || []).map((p: any) => p.program_id),
          ...(ownedPrograms || []).map((p: any) => p.id),
        ];

        const sharedUsers = new Set<string>();
        if (groupIds.length > 0) {
          const { data: gm } = await admin
            .from("group_members").select("user_id").in("group_id", groupIds).eq("status", "active");
          (gm || []).forEach((r: any) => sharedUsers.add(r.user_id));
        }
        if (programIds.length > 0) {
          const { data: pp } = await admin
            .from("program_participants").select("user_id").in("program_id", programIds);
          (pp || []).forEach((r: any) => sharedUsers.add(r.user_id));
        }

        const unauthorized = targets.filter((u) => !sharedUsers.has(u));
        if (unauthorized.length > 0) {
          return new Response(
            JSON.stringify({ error: "Forbidden: cannot notify users you don't share a group or program with" }),
            { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
          );
        }
      }
    }
  }
  const { data: subs, error: subErr } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", body.user_ids);

  if (subErr) {
    return new Response(JSON.stringify({ error: subErr.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const payload = JSON.stringify({
    title: body.title,
    body: body.body,
    url: body.url || "/",
    tag: body.tag,
  });

  let sent = 0;
  let failed = 0;
  await Promise.all(
    (subs || []).map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (e: any) {
        failed++;
        // 404/410 means the subscription is gone — clean it up
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    })
  );

  return new Response(JSON.stringify({ sent, failed }), {
    headers: { ...cors, "Content-Type": "application/json" },
    status: 200,
  });
});
