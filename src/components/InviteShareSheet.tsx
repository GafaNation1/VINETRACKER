// Reusable bottom sheet for sharing a group / program invite link.
import { useState } from "react";
import { X, Copy, Share2, MessageCircle, Send, Mail, Check } from "lucide-react";
import { toast } from "sonner";
import { buildMessengerLinks, shareInvite, type InviteKind } from "@/lib/shareInvite";

interface Props {
  kind: InviteKind;
  code: string;
  name: string;
  description?: string;
  open: boolean;
  onClose: () => void;
}

const InviteShareSheet = ({ kind, code, name, description, open, onClose }: Props) => {
  const [copied, setCopied] = useState(false);
  if (!open) return null;
  const links = buildMessengerLinks({ kind, code, name, description });

  const handleNative = async () => {
    const result = await shareInvite({ kind, code, name, description });
    if (result === "shared") toast.success("Shared!");
    else if (result === "copied") { setCopied(true); toast.success("Link copied"); setTimeout(() => setCopied(false), 1500); }
    else toast.error("Sharing not supported");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(links.url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error("Could not copy"); }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch { toast.error("Could not copy"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-5">
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-card border border-border p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Invite people</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-secondary">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Share this link or invite code so others can join <span className="font-semibold text-foreground">{name}</span>.
        </p>

        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Invite code</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-primary flex-1 truncate">{code}</span>
            <button onClick={copyCode} className="rounded-lg p-2 hover:bg-secondary" aria-label="Copy code">
              <Copy className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Shareable link</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs flex-1 truncate text-foreground/80">{links.url}</span>
            <button onClick={copyLink} className="rounded-lg p-2 hover:bg-secondary" aria-label="Copy link">
              {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>
        </div>

        <button
          onClick={handleNative}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Share2 className="h-4 w-4" /> Share via device
        </button>

        <div className="grid grid-cols-4 gap-2">
          <a href={links.whatsapp} target="_blank" rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3 hover:bg-secondary transition-colors">
            <MessageCircle className="h-5 w-5 text-[#25D366]" />
            <span className="text-[10px] font-medium">WhatsApp</span>
          </a>
          <a href={links.telegram} target="_blank" rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3 hover:bg-secondary transition-colors">
            <Send className="h-5 w-5 text-[#229ED9]" />
            <span className="text-[10px] font-medium">Telegram</span>
          </a>
          <a href={links.sms}
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3 hover:bg-secondary transition-colors">
            <MessageCircle className="h-5 w-5 text-primary" />
            <span className="text-[10px] font-medium">SMS</span>
          </a>
          <a href={links.email}
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3 hover:bg-secondary transition-colors">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <span className="text-[10px] font-medium">Email</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default InviteShareSheet;
