import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Smile, X } from "lucide-react";

const EMOJI_GROUPS: Record<string, string[]> = {
  Smileys: ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","🙂","😉","😍","🥰","😘","😎","🤩","🤔","😴","😇","🥹"],
  Gestures: ["👍","👎","👏","🙏","🙌","👐","🤝","✌️","🤞","🤟","🫶","🫡","💪","👋","🤲","🫰","👌","✊"],
  Hearts: ["❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💔","❤️‍🔥","💖","💗","💓","💞","💕","💘","💝"],
  Faith: ["✝️","☦️","🕊️","🌿","🌱","🌳","📖","🛐","💒","⛪","🕯️","✨","🌟","💫","⭐","🔥","💧","🌅"],
  Nature: ["🌸","🌺","🌻","🌼","🌷","🌹","🍀","🌍","🌎","🌏","🌞","🌝","🌚","🌙","☀️","⛅","🌧️","🌈"],
};

const PANEL_WIDTH = 304; // px (w-76)
const PANEL_MAX_HEIGHT = 320; // px
const VIEWPORT_PAD = 8; // px

export default function EmojiPicker({ onPick }: { onPick: (e: string) => void; anchor?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("Smileys");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const computePosition = () => {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Prefer above the button; fallback below if no room.
    const wantWidth = Math.min(PANEL_WIDTH, vw - VIEWPORT_PAD * 2);
    let left = rect.left + rect.width / 2 - wantWidth / 2;
    left = Math.max(VIEWPORT_PAD, Math.min(left, vw - wantWidth - VIEWPORT_PAD));
    let top = rect.top - PANEL_MAX_HEIGHT - 8;
    if (top < VIEWPORT_PAD) {
      // open downward
      top = Math.min(rect.bottom + 8, vh - PANEL_MAX_HEIGHT - VIEWPORT_PAD);
    }
    setPos({ left, top });
  };

  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => computePosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open]);

  const wantWidth = typeof window !== "undefined"
    ? Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_PAD * 2)
    : PANEL_WIDTH;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Emoji picker"
        className="flex-shrink-0 rounded-xl border border-input bg-card p-2.5 text-muted-foreground hover:bg-secondary transition-colors"
      >
        <Smile className="h-4 w-4" />
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[120]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[121] rounded-2xl border border-border bg-card shadow-elevated p-2"
            style={{ left: pos.left, top: pos.top, width: wantWidth, maxHeight: PANEL_MAX_HEIGHT }}
          >
            <div className="flex items-center justify-between px-1 pb-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">Emojis</span>
              <button onClick={() => setOpen(false)} aria-label="Close emoji picker">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1.5 mb-1.5 border-b border-border">
              {Object.keys(EMOJI_GROUPS).map(k => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-medium ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
                >
                  {k}
                </button>
              ))}
            </div>
            <div
              className="grid grid-cols-8 gap-1 overflow-y-auto"
              style={{ maxHeight: PANEL_MAX_HEIGHT - 80 }}
            >
              {EMOJI_GROUPS[tab].map(e => (
                <button
                  key={e}
                  onClick={() => onPick(e)}
                  className="text-lg leading-none rounded-md hover:bg-secondary p-1.5"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
