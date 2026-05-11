// Service worker registration with strict guards so it NEVER activates inside
// the Lovable preview iframe (which causes stale content & navigation issues).

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isPreviewHost(): boolean {
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

export function registerServiceWorker() {
  if (typeof window === "undefined") return;

  // Always clean up any leftover service workers in preview/iframe contexts
  if (isPreviewHost() || isInIframe()) {
    navigator.serviceWorker?.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
    return;
  }

  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return; // never in dev

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        /* swallow — push features will simply be unavailable */
      });
  });
}
