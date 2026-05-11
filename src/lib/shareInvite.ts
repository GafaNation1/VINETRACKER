// Helpers for sharing group / program invite links across devices.
// Builds a deep link, copies it, and uses the Web Share API when available.

export type InviteKind = "group" | "program" | "mentorship";

export function buildInviteUrl(kind: InviteKind, code: string): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://vine-track.lovable.app";
  return `${origin}/invite/${kind}/${encodeURIComponent(code)}`;
}

export interface SharePayload {
  kind: InviteKind;
  code: string;
  name: string;
  description?: string;
}

/** Native share sheet on supported devices, otherwise copies link to clipboard. */
export async function shareInvite(payload: SharePayload): Promise<"shared" | "copied" | "failed"> {
  const url = buildInviteUrl(payload.kind, payload.code);
  const label = payload.kind === "program" ? "program" : payload.kind === "mentorship" ? "mentorship" : "group";
  const title = `Join "${payload.name}" on Vine Tracker`;
  const text =
    `${payload.description ? payload.description + "\n\n" : ""}` +
    `You're invited to join the ${label} "${payload.name}" on Vine Tracker.\n` +
    `Tap the link or use invite code ${payload.code}:`;

  // Native share sheet (mobile + supported desktops)
  try {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      await (navigator as any).share({ title, text, url });
      return "shared";
    }
  } catch {
    // user dismissed or share failed — fall through to copy
  }

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(`${title}\n${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Pre-built deep links for popular messengers. */
export function buildMessengerLinks(payload: SharePayload) {
  const url = buildInviteUrl(payload.kind, payload.code);
  const label = payload.kind === "program" ? "program" : "group";
  const text = `Join my ${label} "${payload.name}" on Vine Tracker: ${url}`;
  const enc = encodeURIComponent(text);
  return {
    url,
    whatsapp: `https://wa.me/?text=${enc}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`Join my ${label} "${payload.name}" on Vine Tracker`)}`,
    sms: `sms:?body=${enc}`,
    email: `mailto:?subject=${encodeURIComponent(`Join "${payload.name}" on Vine Tracker`)}&body=${enc}`,
    copyText: text,
  };
}
