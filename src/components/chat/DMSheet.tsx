import { useEffect, useRef, useState, useCallback } from "react";
import { X, Send, Reply, Paperclip, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { getSpamReason } from "@/lib/messageFilter";
import { uploadChatMedia, type ChatMessageType } from "@/lib/chatMedia";
import EmojiPicker from "./EmojiPicker";
import ChatMediaBubble from "./ChatMediaBubble";
import AutoResizeTextarea from "./AutoResizeTextarea";

interface PartnerProfile {
  id: string;
  full_name?: string;
  avatar_url?: string;
}

interface DMMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: ChatMessageType;
  media_url: string | null;
  media_meta: any;
  reply_to_id: string | null;
  created_at: string;
  pending?: boolean;
  failed?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  partner: PartnerProfile | null;
}

const PAGE_SIZE = 30;

export default function DMSheet({ open, onClose, currentUserId, partner }: Props) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<DMMessage | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Find or create conversation
  useEffect(() => {
    if (!open || !partner || !currentUserId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [u1, u2] = [currentUserId, partner.id].sort();
      const { data: existing } = await (supabase as any)
        .from("conversations")
        .select("id")
        .eq("user_1", u1)
        .eq("user_2", u2)
        .maybeSingle();

      let convId = existing?.id;
      if (!convId) {
        const { data: created, error } = await (supabase as any)
          .from("conversations")
          .insert({ user_1: u1, user_2: u2 })
          .select("id")
          .single();
        if (error) {
          toast.error("Could not open chat");
          setLoading(false);
          return;
        }
        convId = created.id;
      }
      if (cancelled) return;
      setConversationId(convId);
      await loadInitial(convId);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, partner, currentUserId]);

  const loadInitial = useCallback(async (convId: string) => {
    const { data } = await (supabase as any)
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", convId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    const rows = (data || []).reverse();
    setMessages(rows);
    setHasMore((data?.length || 0) === PAGE_SIZE);
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 50);
  }, []);

  const loadOlder = useCallback(async () => {
    if (!conversationId || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0].created_at;
    const prevHeight = listRef.current?.scrollHeight ?? 0;
    const { data } = await (supabase as any)
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .lt("created_at", oldest)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    const older = (data || []).reverse();
    setMessages(prev => [...older, ...prev]);
    setHasMore((data?.length || 0) === PAGE_SIZE);
    requestAnimationFrame(() => {
      if (!listRef.current) return;
      const newHeight = listRef.current.scrollHeight;
      listRef.current.scrollTop = newHeight - prevHeight;
    });
    setLoadingMore(false);
  }, [conversationId, loadingMore, messages]);

  // Realtime
  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase
      .channel(`dm-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "conversation_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const row = payload.new as DMMessage;
        setMessages(prev => {
          // Replace optimistic if same sender + same content + still pending
          const idx = prev.findIndex(m => m.pending && m.sender_id === row.sender_id && m.content === row.content && m.message_type === row.message_type);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = row;
            return next;
          }
          if (prev.some(m => m.id === row.id)) return prev;
          return [...prev, row];
        });
        setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 30);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId]);

  const send = async () => {
    if (sending || !conversationId) return;
    const body = text.trim();
    if (!body) return;
    const reason = getSpamReason(body);
    if (reason) { toast.error(reason); return; }
    setSending(true);
    const tempId = `tmp-${Date.now()}`;
    const optimistic: DMMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: body,
      message_type: "text",
      media_url: null,
      media_meta: null,
      reply_to_id: replyTo?.id || null,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setText("");
    const replyId = replyTo?.id || null;
    setReplyTo(null);
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 20);

    const { error } = await (supabase as any).from("conversation_messages").insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: body,
      message_type: "text",
      reply_to_id: replyId,
    });
    setSending(false);
    if (error) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, failed: true, pending: false } : m));
      toast.error("Failed to send");
    }
  };

  const sendMedia = async (file: File) => {
    if (!conversationId || sending) return;
    setSending(true);
    const tempId = `tmp-${Date.now()}`;
    try {
      const up = await uploadChatMedia(file, currentUserId);
      const optimistic: DMMessage = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: file.name,
        message_type: up.type,
        media_url: up.path,
        media_meta: up.meta,
        reply_to_id: null,
        created_at: new Date().toISOString(),
        pending: true,
      };
      setMessages(prev => [...prev, optimistic]);
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 20);

      const { error } = await (supabase as any).from("conversation_messages").insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: file.name,
        message_type: up.type,
        media_url: up.path,
        media_meta: up.meta,
      });
      if (error) throw error;
    } catch (e: any) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, failed: true, pending: false } : m));
      toast.error(e?.message || "Upload failed");
    } finally {
      setSending(false);
    }
  };

  const onScroll = () => {
    if (listRef.current && listRef.current.scrollTop < 60 && hasMore && !loadingMore) {
      loadOlder();
    }
  };

  if (!open || !partner) return null;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/50" onClick={onClose}>
      <div
        className="mt-auto flex h-[92vh] sm:h-[85vh] max-h-[100dvh] flex-col rounded-t-3xl bg-background shadow-elevated overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex-shrink-0 flex items-center gap-3 border-b border-border px-4 pt-4 pb-3">
          <div className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-muted" />
          <Avatar className="h-9 w-9">
            {partner.avatar_url ? <AvatarImage src={partner.avatar_url} /> : null}
            <AvatarFallback className="bg-accent text-accent-foreground text-xs font-bold">
              {(partner.full_name || "U")[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{partner.full_name || "User"}</p>
            <p className="text-[10px] text-muted-foreground">Direct message · private</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-secondary" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loadingMore && (
            <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          )}
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center px-6">
              <p className="text-xs text-muted-foreground">Start a private conversation with {partner.full_name || "this user"}.</p>
            </div>
          ) : (
            messages.map(m => {
              const mine = m.sender_id === currentUserId;
              const parent = m.reply_to_id ? messages.find(x => x.id === m.reply_to_id) : null;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-card border border-border"} ${m.pending ? "opacity-70" : ""} ${m.failed ? "ring-1 ring-destructive" : ""}`}>
                    {parent && (
                      <div className={`mb-1.5 rounded-lg px-2 py-1 border-l-2 ${mine ? "border-primary-foreground/40 bg-primary-foreground/10" : "border-primary/40 bg-accent"}`}>
                        <p className="text-[10px] opacity-80 truncate">{parent.content || "[media]"}</p>
                      </div>
                    )}
                    {m.message_type === "text" ? (
                      <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                    ) : m.media_url ? (
                      <ChatMediaBubble type={m.message_type as any} path={m.media_url} meta={m.media_meta || { name: m.content }} />
                    ) : null}
                    <div className="mt-1 flex items-center justify-end gap-2 text-[9px] opacity-70">
                      <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {m.failed && (
                        <button onClick={() => { setMessages(prev => prev.filter(x => x.id !== m.id)); setText(m.content); }} className="underline">Retry</button>
                      )}
                      {!m.failed && !m.pending && (
                        <button onClick={() => setReplyTo(m)} className="underline">Reply</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer (sticky bottom of sheet, respects safe area) */}
        <div className="border-t border-border bg-background px-3 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)]">
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/20 bg-accent px-3 py-2">
              <Reply className="h-3 w-3 text-primary" />
              <p className="flex-1 text-[10px] truncate">{replyTo.content || "[media]"}</p>
              <button onClick={() => setReplyTo(null)}><X className="h-3 w-3" /></button>
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*,audio/*,application/pdf,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) sendMedia(f); e.target.value = ""; }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={sending}
              aria-label="Attach"
              className="flex-shrink-0 rounded-xl border border-input bg-card p-2 text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <EmojiPicker onPick={(e) => setText(t => t + e)} />
            <AutoResizeTextarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Message…"
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              aria-label="Send"
              className="flex-shrink-0 rounded-xl bg-primary p-2.5 text-primary-foreground disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
