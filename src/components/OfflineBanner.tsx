import { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

export default function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [justReconnected, setJustReconnected] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      if (wasOffline.current) {
        wasOffline.current = false;
        setJustReconnected(true);
        setTimeout(() => setJustReconnected(false), 2500);
      }
    };
    const goOffline = () => { wasOffline.current = true; setOnline(false); };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online && !justReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 top-2 z-[200] -translate-x-1/2 flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium shadow-md ${
        online ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"
      }`}
    >
      {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {online ? "Back online" : "You are offline"}
    </div>
  );
}
