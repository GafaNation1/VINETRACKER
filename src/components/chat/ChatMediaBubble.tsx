import { useEffect, useState } from "react";
import { FileText, Download, Play, X } from "lucide-react";
import { getChatMediaUrl } from "@/lib/chatMedia";

interface Props {
  type: "image" | "video" | "audio" | "file";
  path: string;
  meta?: { name?: string; size?: number; mime?: string };
}

export default function ChatMediaBubble({ type, path, meta }: Props) {
  const [url, setUrl] = useState<string>("");
  const [urlError, setUrlError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    let alive = true;
    setUrl("");
    setUrlError(false);
    setLoaded(false);
    setErrored(false);
    getChatMediaUrl(path)
      .then(u => {
        if (!alive) return;
        if (!u) setUrlError(true);
        else setUrl(u);
      })
      .catch(() => { if (alive) setUrlError(true); });
    return () => { alive = false; };
  }, [path]);

  if (urlError) {
    return (
      <div className="flex h-20 w-48 items-center justify-center rounded-xl bg-secondary text-[11px] text-muted-foreground px-3 text-center">
        Attachment unavailable
      </div>
    );
  }

  if (!url) {
    return <div className="h-32 w-48 rounded-xl bg-secondary animate-pulse" />;
  }

  if (type === "image") {
    return (
      <>
        <button type="button" onClick={() => setLightbox(true)} className="block relative">
          {!loaded && !errored && (
            <div className="h-40 w-56 rounded-xl bg-secondary animate-pulse" />
          )}
          {errored ? (
            <div className="flex h-32 w-48 items-center justify-center rounded-xl bg-secondary text-xs text-muted-foreground">
              Image unavailable
            </div>
          ) : (
            <img
              src={url}
              alt={meta?.name || "image"}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              onError={() => setErrored(true)}
              className={`max-h-56 max-w-[14rem] rounded-xl object-cover ${loaded ? "block" : "hidden"}`}
            />
          )}
        </button>
        {lightbox && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4" onClick={() => setLightbox(false)}>
            <button type="button" className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+12px)] rounded-full bg-white/15 p-2 text-white" onClick={() => setLightbox(false)} aria-label="Close image">
              <X className="h-5 w-5" />
            </button>
            <img src={url} alt={meta?.name || "image"} className="max-h-full max-w-full object-contain" />
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              download={meta?.name}
              onClick={e => e.stopPropagation()}
              className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+16px)] left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-medium text-white"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          </div>
        )}
      </>
    );
  }

  if (type === "video") {
    return (
      <video src={url} controls preload="metadata" className="max-h-64 max-w-[16rem] rounded-xl bg-black" />
    );
  }

  if (type === "audio") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 min-w-[12rem]">
        <Play className="h-4 w-4 text-primary" />
        <audio src={url} controls className="h-8 max-w-[12rem]" />
      </div>
    );
  }

  // file
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={meta?.name}
      className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 hover:bg-secondary transition-colors min-w-[12rem]"
    >
      <FileText className="h-5 w-5 text-primary flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold truncate">{meta?.name || "Attachment"}</p>
        {meta?.size != null && (
          <p className="text-[10px] text-muted-foreground">{formatSize(meta.size)}</p>
        )}
      </div>
      <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </a>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
