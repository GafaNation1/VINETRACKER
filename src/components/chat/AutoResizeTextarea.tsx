import { forwardRef, useEffect, useRef, TextareaHTMLAttributes } from "react";

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxHeight?: number;
}

/**
 * Auto-expanding textarea for chat composers.
 * Grows with content up to maxHeight, then scrolls.
 */
const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ maxHeight = 140, value, onChange, className = "", rows = 1, ...rest }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const setRefs = (el: HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as any).current = el;
    };

    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      const next = Math.min(el.scrollHeight, maxHeight);
      el.style.height = `${next}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    }, [value, maxHeight]);

    return (
      <textarea
        ref={setRefs}
        rows={rows}
        value={value}
        onChange={onChange}
        className={`min-w-0 flex-1 resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm leading-snug outline-none focus:border-primary/30 disabled:opacity-60 ${className}`}
        {...rest}
      />
    );
  }
);
AutoResizeTextarea.displayName = "AutoResizeTextarea";

export default AutoResizeTextarea;
