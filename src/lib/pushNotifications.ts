// Web Push subscription helpers
import { supabase } from "@/integrations/supabase/client";

// Public VAPID key generated for this project. Safe to expose.
export const VAPID_PUBLIC_KEY =
  "BL5v71_UDR8CeHO06eUG_bk66SMUHs_omxuRArfEX1BOaXUrgMoBnAj7ygeufpXWs5uxb47Vwkcq2n06Pzdk4_8";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function isPreviewOrIframe(): boolean {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

export async function isPushSupported(): Promise<boolean> {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "default") return await Notification.requestPermission();
  return Notification.permission;
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  if (isPreviewOrIframe()) return false;
  if (!(await isPushSupported())) return false;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  if (!json.endpoint || !json.keys) return false;
  await (supabase.from("push_subscriptions") as any).upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: "user_id,endpoint" }
  );
  return true;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!(await isPushSupported())) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await (supabase.from("push_subscriptions") as any).delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}
