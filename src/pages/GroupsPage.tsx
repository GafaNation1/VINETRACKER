import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Search, Copy, RefreshCw, Trash2, Users, Shield, X, Send, MessageCircle, LogOut, FileText, Edit, Eye, Reply, Share2, Paperclip, Loader2 } from "lucide-react";
import { useGroups } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSpamReason } from "@/lib/messageFilter";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import InviteShareSheet from "@/components/InviteShareSheet";
import EmojiPicker from "@/components/chat/EmojiPicker";
import ChatMediaBubble from "@/components/chat/ChatMediaBubble";
import AutoResizeTextarea from "@/components/chat/AutoResizeTextarea";
import DMSheet from "@/components/chat/DMSheet";
import { uploadChatMedia, type ChatMessageType } from "@/lib/chatMedia";

const groupTypes = ["Fellowship", "Discipleship", "Prayer", "Ministry", "Bible Study"];
const defaultActivityTypes = ["Prayer", "Bible Reading", "Fasting", "Worship", "Meditation", "Journaling", "Evangelism"];

interface GroupMessage {
  id: string;
  sender_id: string;
  message_text: string;
  created_at: string;
  reply_to_id?: string | null;
  message_type?: ChatMessageType;
  media_url?: string | null;
  media_meta?: any;
  pending?: boolean;
  failed?: boolean;
}

interface GroupNote {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface ProfileLite { id: string; full_name: string; avatar_url: string }

const PAGE_SIZE = 30;

const GroupsPage = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { groups, publicGroups, createGroup, deleteGroup, regenerateInviteCode, joinGroupByCode, removeMember, promoteMember, updateGroup } = useGroups();
  const [tab, setTab] = useState<"my" | "join">("my");
  const [searchQuery, setSearchQuery] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [managingGroup, setManagingGroup] = useState<string | null>(null);
  const [groupView, setGroupView] = useState<"members" | "notes" | "chat">("members");
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [notes, setNotes] = useState<GroupNote[]>([]);
  const [messageText, setMessageText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [profileMap, setProfileMap] = useState<Record<string, ProfileLite>>({});
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [dmPartner, setDmPartner] = useState<ProfileLite | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sendingLockRef = useRef(false);
  const [createData, setCreateData] = useState({
    name: "", type: "Fellowship", customType: "", description: "",
    visibility: "public" as "public" | "invite-only",
    activityTypes: ["Prayer", "Bible Reading"] as string[], customActivity: "", duration: "",
  });

  const uid = authUser?.id || "";
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);

  const myGroups = groups.filter(g => g.members.some(m => m.userId === uid && m.status === "active"));
  const searchResults = searchQuery
    ? publicGroups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : publicGroups;

  // Deep-link: if a notification asked to open a specific group/DM/message, do it on mount.
  useEffect(() => {
    if (!uid) return;
    const raw = sessionStorage.getItem("vine:deepLink");
    if (!raw) return;
    try {
      const target = JSON.parse(raw);
      if (target.actionType === "open-group" && target.groupId) {
        setManagingGroup(target.groupId);
        setGroupView("chat");
        if (target.messageId) setHighlightMessageId(target.messageId);
        sessionStorage.removeItem("vine:deepLink");
      } else if (target.actionType === "open-dm" && target.conversationId) {
        // Resolve other participant from the conversation
        (async () => {
          const { data: conv } = await (supabase as any).from("conversations")
            .select("user_1,user_2").eq("id", target.conversationId).maybeSingle();
          if (!conv) return;
          const otherId = conv.user_1 === uid ? conv.user_2 : conv.user_1;
          const { data: prof } = await supabase.from("profiles")
            .select("id,full_name,avatar_url").eq("id", otherId).maybeSingle();
          setDmPartner(prof ? { id: prof.id, full_name: prof.full_name || "User", avatar_url: prof.avatar_url || "" } : { id: otherId, full_name: "User", avatar_url: "" });
          sessionStorage.removeItem("vine:deepLink");
        })();
      }
    } catch { /* ignore */ }
  }, [uid]);

  const handleCreate = () => {
    if (!createData.name.trim()) { toast.error("Enter a group name"); return; }
    createGroup({
      name: createData.name.trim(), type: createData.customType || createData.type,
      description: createData.description, visibility: createData.visibility,
      activityTypes: createData.activityTypes, duration: createData.duration,
    });
    toast.success("Group created!");
    setShowCreate(false);
    setCreateData({ name: "", type: "Fellowship", customType: "", description: "", visibility: "public", activityTypes: ["Prayer", "Bible Reading"], customActivity: "", duration: "" });
  };

  const handleJoinByCode = () => {
    if (!joinCode.trim()) return;
    joinGroupByCode(joinCode.trim()).then(result => {
      if (result) { toast.success("Joined group!"); setJoinCode(""); setTab("my"); }
      else toast.error("Invalid invite code");
    });
  };

  const handleJoinPublic = (groupId: string) => {
    const group = [...groups, ...publicGroups].find(g => g.id === groupId);
    if (!group) return;
    joinGroupByCode(group.inviteCode).then(() => toast.success(`Joined ${group.name}!`));
  };

  const handleLeaveGroup = async (groupId: string) => {
    await supabase.from("group_members").update({ status: "left", left_at: new Date().toISOString() }).eq("group_id", groupId).eq("user_id", uid);
    toast.success("Left group");
    setManagingGroup(null);
    setGroupView("members");
    window.dispatchEvent(new Event("vine-data-change"));
  };

  const handleUpdateDescription = async (groupId: string) => {
    await supabase.from("groups").update({ description: descriptionDraft }).eq("id", groupId);
    updateGroup(groupId, { description: descriptionDraft });
    setEditingDescription(false);
    toast.success("Description updated");
  };

  // Prefetch group member profiles in one shot, mapped by id
  const prefetchProfiles = useCallback(async (groupId: string) => {
    const group = [...groups, ...publicGroups].find(g => g.id === groupId);
    if (!group) return;
    const ids = Array.from(new Set(group.members.map(m => m.userId)));
    if (ids.length === 0) return;
    const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids);
    const map: Record<string, ProfileLite> = {};
    data?.forEach(p => { map[p.id] = { id: p.id, full_name: p.full_name || "User", avatar_url: p.avatar_url || "" }; });
    setProfileMap(prev => ({ ...prev, ...map }));
  }, [groups, publicGroups]);

  // Load latest 30 messages, expanding to include a deep-linked message if needed.
  const loadInitialMessages = useCallback(async (groupId: string) => {
    setLoadingChat(true);
    let limit = PAGE_SIZE;
    if (highlightMessageId) {
      // Pull enough rows to likely include the target. Cap at 500.
      limit = 500;
    }
    const { data } = await (supabase as any)
      .from("group_messages")
      .select("*")
      .eq("group_id", groupId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    const rows = (data || []).reverse();
    setMessages(rows);
    setHasMore((data?.length || 0) === limit && limit === PAGE_SIZE);
    setLoadingChat(false);
    setTimeout(() => {
      if (highlightMessageId) {
        const el = document.getElementById(`msg-${highlightMessageId}`);
        if (el && messagesScrollRef.current) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
          el.classList.add("ring-2", "ring-primary", "rounded-2xl");
          setTimeout(() => el.classList.remove("ring-2", "ring-primary", "rounded-2xl"), 2200);
        } else if (messagesScrollRef.current) {
          messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
        }
      } else if (messagesScrollRef.current) {
        messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
      }
    }, 80);
  }, [highlightMessageId]);

  const loadOlder = useCallback(async () => {
    if (!managingGroup || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0].created_at;
    const prevHeight = messagesScrollRef.current?.scrollHeight ?? 0;
    const { data } = await (supabase as any)
      .from("group_messages")
      .select("*")
      .eq("group_id", managingGroup)
      .is("deleted_at", null)
      .lt("created_at", oldest)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    const older = (data || []).reverse();
    setMessages(prev => [...older, ...prev]);
    setHasMore((data?.length || 0) === PAGE_SIZE);
    requestAnimationFrame(() => {
      if (messagesScrollRef.current) {
        const newHeight = messagesScrollRef.current.scrollHeight;
        messagesScrollRef.current.scrollTop = newHeight - prevHeight;
      }
    });
    setLoadingMore(false);
  }, [managingGroup, loadingMore, messages]);

  const loadNotes = useCallback(async (groupId: string) => {
    const { data } = await (supabase.from("group_notes") as any).select("*").eq("group_id", groupId).eq("user_id", uid).order("created_at", { ascending: false });
    if (data) setNotes(data.map((n: any) => ({ id: n.id, user_id: n.user_id, content: n.content, created_at: n.created_at })));
  }, [uid]);

  const loadHidden = useCallback(async () => {
    if (!uid) return;
    const { data } = await (supabase.from("hidden_messages") as any).select("message_id").eq("user_id", uid);
    if (data) setHiddenIds(new Set(data.map((r: any) => r.message_id)));
  }, [uid]);

  // Load on group/view change + realtime
  useEffect(() => {
    if (!managingGroup) return;
    prefetchProfiles(managingGroup);
    loadInitialMessages(managingGroup);
    loadNotes(managingGroup);
    loadHidden();

    const channel = supabase.channel(`group-${managingGroup}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${managingGroup}` },
        (payload) => {
          const row = payload.new as GroupMessage;
          setMessages(prev => {
            // Replace any matching pending optimistic message
            const idx = prev.findIndex(m => m.pending && m.sender_id === row.sender_id && m.message_text === row.message_text && (m.message_type || "text") === (row.message_type || "text"));
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = row;
              return next;
            }
            if (prev.some(m => m.id === row.id)) return prev;
            return [...prev, row];
          });
          setTimeout(() => {
            if (messagesScrollRef.current) {
              const el = messagesScrollRef.current;
              const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
              if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            }
          }, 30);
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${managingGroup}` },
        (payload) => {
          const id = (payload.old as any)?.id;
          if (id) setMessages(prev => prev.filter(m => m.id !== id));
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [managingGroup, loadInitialMessages, loadNotes, loadHidden, prefetchProfiles]);

  const onChatScroll = () => {
    const el = messagesScrollRef.current;
    if (el && el.scrollTop < 60 && hasMore && !loadingMore) loadOlder();
  };

  const sendMessage = async () => {
    if (sendingLockRef.current || !managingGroup) return;
    const text = messageText.trim();
    if (!text) return;
    const reason = getSpamReason(text);
    if (reason) { toast.error(reason); return; }
    sendingLockRef.current = true;
    setSending(true);
    const tempId = `tmp-${Date.now()}`;
    const replyId = replyTo?.id || null;
    const optimistic: GroupMessage = {
      id: tempId, sender_id: uid, message_text: text, created_at: new Date().toISOString(),
      reply_to_id: replyId, message_type: "text", pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setMessageText("");
    setReplyTo(null);
    setTimeout(() => messagesScrollRef.current?.scrollTo({ top: messagesScrollRef.current.scrollHeight, behavior: "smooth" }), 20);

    const { error } = await (supabase.from("group_messages") as any).insert({
      group_id: managingGroup, sender_id: uid, message_text: text, reply_to_id: replyId, message_type: "text",
    });
    sendingLockRef.current = false;
    setSending(false);
    if (error) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, pending: false, failed: true } : m));
      toast.error("Failed to send");
    }
  };

  const sendMedia = async (file: File) => {
    if (sendingLockRef.current || !managingGroup) return;
    sendingLockRef.current = true;
    setSending(true);
    const tempId = `tmp-${Date.now()}`;
    try {
      const up = await uploadChatMedia(file, uid);
      const optimistic: GroupMessage = {
        id: tempId, sender_id: uid, message_text: file.name, created_at: new Date().toISOString(),
        message_type: up.type, media_url: up.path, media_meta: up.meta, pending: true,
      };
      setMessages(prev => [...prev, optimistic]);
      setTimeout(() => messagesScrollRef.current?.scrollTo({ top: messagesScrollRef.current.scrollHeight, behavior: "smooth" }), 20);

      const { error } = await (supabase.from("group_messages") as any).insert({
        group_id: managingGroup, sender_id: uid, message_text: file.name,
        message_type: up.type, media_url: up.path, media_meta: up.meta,
      });
      if (error) throw error;
    } catch (e: any) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, pending: false, failed: true } : m));
      toast.error(e?.message || "Upload failed");
    } finally {
      sendingLockRef.current = false;
      setSending(false);
    }
  };

  const deleteOwnMessage = async (id: string) => {
    if (id.startsWith("tmp-")) {
      setMessages(prev => prev.filter(m => m.id !== id));
      return;
    }
    setMessages(prev => prev.filter(m => m.id !== id));
    await (supabase.from("group_messages") as any).delete().eq("id", id);
  };

  const hideMessage = async (id: string) => {
    setHiddenIds(prev => new Set(prev).add(id));
    await (supabase.from("hidden_messages") as any).insert({
      user_id: uid, message_id: id, message_type: "group",
    });
  };

  const adminDeleteMessage = async (id: string) => {
    await (supabase.from("group_messages") as any).delete().eq("id", id);
    setMessages(prev => prev.filter(m => m.id !== id));
    toast.success("Message deleted");
  };

  const addNote = async () => {
    if (!noteText.trim() || !managingGroup) return;
    const reason = getSpamReason(noteText);
    if (reason) { toast.error(reason); return; }
    await (supabase.from("group_notes") as any).insert({ group_id: managingGroup, user_id: uid, content: noteText.trim() });
    setNoteText("");
    loadNotes(managingGroup);
    toast.success("Note added");
  };

  const deleteNote = async (id: string) => {
    await (supabase.from("group_notes") as any).delete().eq("id", id);
    setNotes(prev => prev.filter(n => n.id !== id));
    toast.success("Note deleted");
  };

  const saveEditNote = async (id: string) => {
    if (!editNoteText.trim()) return;
    await (supabase.from("group_notes") as any).update({ content: editNoteText.trim() }).eq("id", id);
    setNotes(prev => prev.map(n => n.id === id ? { ...n, content: editNoteText.trim() } : n));
    setEditingNoteId(null);
    setEditNoteText("");
    toast.success("Note updated");
  };

  const managedGroup = managingGroup ? [...groups, ...publicGroups].find(g => g.id === managingGroup) : null;
  const isAdmin = managedGroup?.members.some(m => m.userId === uid && (m.role === "admin" || m.role === "co-leader" || m.role === "co_leader"));
  const isMember = managedGroup?.members.some(m => m.userId === uid && m.status === "active");

  const visibleMessages = useMemo(() => messages.filter(m => !hiddenIds.has(m.id)), [messages, hiddenIds]);

  // Group detail/manage panel
  if (managedGroup && isMember) {
    const activeMembers = managedGroup.members.filter(m => m.status === "active");
    const isChatView = groupView === "chat";

    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-background">
        {/* Header (fixed) */}
        <div className="flex-shrink-0 px-5 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3 border-b border-border/50">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => { setManagingGroup(null); setGroupView("members"); }} className="rounded-full border border-border bg-card p-2 transition-colors hover:bg-secondary" aria-label="Back">
              <X className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold tracking-tight truncate">{managedGroup.name}</h1>
              <p className="text-xs text-muted-foreground">{managedGroup.type} · {managedGroup.visibility}</p>
            </div>
            <button onClick={() => { setShowDescription(true); setDescriptionDraft(managedGroup.description); }}
              className="rounded-lg p-2 hover:bg-secondary" title="View Description" aria-label="View description">
              <Eye className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {showDescription && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
              <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Group Description</h3>
                  <button onClick={() => { setShowDescription(false); setEditingDescription(false); }}><X className="h-4 w-4 text-muted-foreground" /></button>
                </div>
                {editingDescription && isAdmin ? (
                  <div className="space-y-2">
                    <textarea value={descriptionDraft} onChange={e => setDescriptionDraft(e.target.value)}
                      rows={5} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none resize-none focus:border-primary/30" />
                    <div className="flex gap-2">
                      <button onClick={() => setEditingDescription(false)} className="flex-1 rounded-xl border border-border py-2 text-xs font-medium">Cancel</button>
                      <button onClick={() => handleUpdateDescription(managedGroup.id)} className="flex-1 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground">Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground leading-relaxed">{managedGroup.description || "No description set."}</p>
                    {isAdmin && (
                      <button onClick={() => setEditingDescription(true)} className="flex items-center gap-1 text-xs text-primary font-medium">
                        <Edit className="h-3 w-3" /> Edit Description
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex rounded-xl bg-secondary p-1 mt-2">
            {(["members", "notes", "chat"] as const).map(t => (
              <button key={t} onClick={() => setGroupView(t)}
                className={`flex-1 rounded-lg py-2 text-xs font-medium capitalize transition-all ${groupView === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Content area */}
        {!isChatView ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)]">
            {groupView === "members" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Invite Code</p>
                    <button onClick={() => setShareOpen(true)}
                      className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors">
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-primary flex-1">{managedGroup.inviteCode}</span>
                    <button onClick={() => { navigator.clipboard.writeText(managedGroup.inviteCode); toast.success("Copied!"); }} className="rounded-lg p-2 hover:bg-secondary" aria-label="Copy code">
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {isAdmin && (
                      <button onClick={() => { regenerateInviteCode(managedGroup.id); toast.success("Code regenerated!"); }} className="rounded-lg p-2 hover:bg-secondary" aria-label="Regenerate code">
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-semibold">Members ({activeMembers.length})</h3>
                <div className="space-y-2">
                  {activeMembers.map(m => {
                    const profile = profileMap[m.userId];
                    const displayName = profile?.full_name || m.username || "User";
                    return (
                      <div key={m.userId} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (m.userId === uid) return;
                            setDmPartner(profile || { id: m.userId, full_name: m.username || "User", avatar_url: "" });
                          }}
                          aria-label={`Open chat with ${displayName}`}
                          className="rounded-full"
                        >
                          <Avatar className="h-9 w-9">
                            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} /> : null}
                            <AvatarFallback className="bg-accent text-accent-foreground text-xs font-bold">
                              {displayName[0]}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (m.userId === uid) return;
                            setDmPartner(profile || { id: m.userId, full_name: m.username || "User", avatar_url: "" });
                          }}
                          className="flex-1 text-left min-w-0"
                        >
                          <p className="text-sm font-medium truncate">{displayName}{m.userId === uid && " (you)"}</p>
                          <p className="text-[10px] text-muted-foreground">Joined {new Date(m.joinedAt).toLocaleDateString()}</p>
                        </button>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.role === "admin" ? "bg-primary/10 text-primary" : (m.role === "co-leader" || m.role === "co_leader") ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>
                          {m.role === "co_leader" ? "co-leader" : m.role}
                        </span>
                        {isAdmin && m.userId !== uid && (
                          <div className="flex gap-1">
                            <button onClick={() => { promoteMember(managedGroup.id, m.userId, (m.role === "co-leader" || m.role === "co_leader") ? "member" : "co_leader"); toast.success("Role updated"); }}
                              className="rounded-lg p-1.5 hover:bg-secondary" aria-label="Toggle role"><Shield className="h-3.5 w-3.5 text-muted-foreground" /></button>
                            <button onClick={() => { removeMember(managedGroup.id, m.userId); toast.success("Member removed"); }}
                              className="rounded-lg p-1.5 hover:bg-destructive/10" aria-label="Remove member"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!isAdmin && (
                  <button onClick={() => handleLeaveGroup(managedGroup.id)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/15 bg-card py-3 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors">
                    <LogOut className="h-4 w-4" /> Leave Group
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => { deleteGroup(managedGroup.id); setManagingGroup(null); toast.success("Group deleted"); }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/15 bg-card py-3 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors">
                    <Trash2 className="h-4 w-4" /> Delete Group
                  </button>
                )}
              </div>
            )}

            {groupView === "notes" && (
              <div className="space-y-4">
                <p className="text-[10px] text-muted-foreground text-center">Your private notes for this group</p>
                <div className="flex gap-2">
                  <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addNote()}
                    placeholder="Write a private note..." className="flex-1 rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-primary/30" />
                  <button onClick={addNote} disabled={!noteText.trim()} className="rounded-xl bg-primary px-4 py-2.5 text-primary-foreground disabled:opacity-50" aria-label="Add note">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {notes.length > 0 ? notes.map(note => (
                    <div key={note.id} className="rounded-xl border border-border bg-card p-3">
                      {editingNoteId === note.id ? (
                        <div className="space-y-2">
                          <textarea value={editNoteText} onChange={e => setEditNoteText(e.target.value)}
                            rows={3} className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none resize-none" />
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingNoteId(null); setEditNoteText(""); }}
                              className="flex-1 rounded-lg border border-border py-1.5 text-xs">Cancel</button>
                            <button onClick={() => saveEditNote(note.id)}
                              className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground">Save</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm">{note.content}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{new Date(note.created_at).toLocaleString()}</p>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => { setEditingNoteId(note.id); setEditNoteText(note.content); }}
                              className="rounded-lg p-1 hover:bg-secondary" aria-label="Edit note">
                              <Edit className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button onClick={() => deleteNote(note.id)} className="rounded-lg p-1 hover:bg-destructive/10" aria-label="Delete note">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="flex flex-col items-center py-8 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">No notes yet. Your notes are private and only visible to you.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          // CHAT VIEW: messages fill flex, composer pinned to bottom of viewport
          <>
            <div
              ref={messagesScrollRef}
              onScroll={onChatScroll}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
            >
              {loadingMore && (
                <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              )}
              {loadingChat ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : visibleMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No messages yet. Start the conversation!</p>
                  </div>
                </div>
              ) : visibleMessages.map(msg => {
                const parent = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;
                const isMine = msg.sender_id === uid;
                const profile = profileMap[msg.sender_id];
                const displayName = profile?.full_name || "User";
                const type = (msg.message_type || "text") as ChatMessageType;
                return (
                  <div key={msg.id} id={`msg-${msg.id}`} className={`flex gap-2 group ${isMine ? "flex-row-reverse" : ""}`}>
                    {!isMine && (
                      <button
                        type="button"
                        onClick={() => setDmPartner(profile || { id: msg.sender_id, full_name: displayName, avatar_url: "" })}
                        aria-label={`Message ${displayName}`}
                      >
                        <Avatar className="h-7 w-7 flex-shrink-0 mt-1">
                          {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} /> : null}
                          <AvatarFallback className="bg-accent text-accent-foreground text-[10px] font-bold">
                            {displayName[0]}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    )}
                    <div className={`max-w-[75%] rounded-2xl p-3 ${isMine ? "bg-primary text-primary-foreground" : "bg-card border border-border"} ${msg.pending ? "opacity-70" : ""} ${msg.failed ? "ring-1 ring-destructive" : ""}`}>
                      {!isMine && <p className="text-[10px] font-semibold mb-0.5 opacity-70">{displayName}</p>}
                      {parent && (
                        <div className={`mb-1.5 rounded-lg px-2 py-1 border-l-2 ${isMine ? "border-primary-foreground/40 bg-primary-foreground/10" : "border-primary/40 bg-accent"}`}>
                          <p className="text-[9px] font-semibold opacity-70 truncate">{profileMap[parent.sender_id]?.full_name || "User"}</p>
                          <p className="text-[10px] opacity-80 truncate">{parent.message_text || "[media]"}</p>
                        </div>
                      )}
                      {type === "text" ? (
                        <p className="text-sm break-words whitespace-pre-wrap">{msg.message_text}</p>
                      ) : msg.media_url ? (
                        <ChatMediaBubble type={type as any} path={msg.media_url} meta={msg.media_meta || { name: msg.message_text }} />
                      ) : (
                        <p className="text-sm italic opacity-70">[attachment]</p>
                      )}
                      <div className="mt-1 flex items-center justify-end gap-2 text-[9px] opacity-70">
                        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {msg.failed && (
                          <button onClick={() => { setMessages(prev => prev.filter(m => m.id !== msg.id)); if (type === "text") setMessageText(msg.message_text); }} className="underline">Retry</button>
                        )}
                        {!msg.failed && !msg.pending && (
                          <>
                            <button onClick={() => setReplyTo(msg)} className="underline">Reply</button>
                            {isMine && (
                              <button onClick={() => deleteOwnMessage(msg.id)} className="underline">Delete</button>
                            )}
                            {!isMine && (
                              <button onClick={() => hideMessage(msg.id)} className="underline">Hide</button>
                            )}
                            {isAdmin && !isMine && (
                              <button onClick={() => adminDeleteMessage(msg.id)} className="underline text-destructive-foreground/90">Remove</button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Composer pinned to bottom of viewport */}
            <div
              className="flex-shrink-0 border-t border-border bg-background/95 backdrop-blur-xl px-3 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)]"
            >
              {replyTo && (
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/20 bg-accent px-3 py-2">
                  <Reply className="h-3 w-3 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-primary truncate">Replying to {profileMap[replyTo.sender_id]?.full_name || "User"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{replyTo.message_text || "[media]"}</p>
                  </div>
                  <button onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X className="h-3 w-3 text-muted-foreground" /></button>
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
                <EmojiPicker onPick={(e) => setMessageText(t => t + e)} />
                <AutoResizeTextarea
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !sending) { e.preventDefault(); sendMessage(); } }}
                  disabled={sending}
                  placeholder="Type a message..."
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !messageText.trim()}
                  aria-label="Send message"
                  className="flex-shrink-0 rounded-xl bg-primary p-2.5 text-primary-foreground disabled:opacity-50 transition-opacity"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        )}

        <InviteShareSheet kind="group" code={managedGroup.inviteCode} name={managedGroup.name}
          description={managedGroup.description} open={shareOpen} onClose={() => setShareOpen(false)} />

        <DMSheet
          open={!!dmPartner}
          onClose={() => setDmPartner(null)}
          currentUserId={uid}
          partner={dmPartner}
        />
      </div>
    );
  }

  // Create group panel
  if (showCreate) {
    return (
      <div className="min-h-screen">
        <div className="px-5 pt-14 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setShowCreate(false)} className="rounded-full border border-border bg-card p-2 transition-colors hover:bg-secondary" aria-label="Back">
              <X className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </button>
            <h1 className="text-xl font-bold tracking-tight">Create Group</h1>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Group Name</label>
              <input type="text" value={createData.name} onChange={e => setCreateData({ ...createData, name: e.target.value })}
                placeholder="e.g., Youth Fellowship" className="mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10" />
              {!createData.name.trim() && <p className="mt-1 text-[10px] text-muted-foreground">Required</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Group Type</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[...groupTypes, "Other"].map(t => (
                  <button key={t} onClick={() => setCreateData({ ...createData, type: t })}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${createData.type === t ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
                    {t}
                  </button>
                ))}
              </div>
              {createData.type === "Other" && (
                <input type="text" value={createData.customType} onChange={e => setCreateData({ ...createData, customType: e.target.value })}
                  placeholder="Enter custom type" className="mt-2 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10" />
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <textarea value={createData.description} onChange={e => setCreateData({ ...createData, description: e.target.value })}
                placeholder="Describe your group..." rows={3} className="mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none resize-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10" />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Visibility</label>
              <div className="mt-2 flex gap-2">
                {(["public", "invite-only"] as const).map(v => (
                  <button key={v} onClick={() => setCreateData({ ...createData, visibility: v })}
                    className={`flex-1 rounded-xl py-2.5 text-xs font-medium transition-all ${createData.visibility === v ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
                    {v === "public" ? "🌐 Public" : "🔒 Invite Only"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Activity Types</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {defaultActivityTypes.map(t => (
                  <button key={t} onClick={() => setCreateData(prev => ({
                    ...prev, activityTypes: prev.activityTypes.includes(t) ? prev.activityTypes.filter(a => a !== t) : [...prev.activityTypes, t],
                  }))}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${createData.activityTypes.includes(t) ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Duration (Optional)</label>
              <input type="text" value={createData.duration} onChange={e => setCreateData({ ...createData, duration: e.target.value })}
                placeholder="e.g., 30 days, 6 months" className="mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10" />
            </div>

            <button onClick={handleCreate} disabled={!createData.name.trim()}
              className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
              Create Group
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Your spiritual communities</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <Plus className="h-4 w-4" />Create
          </button>
        </div>

        <div className="mt-5 flex rounded-xl bg-secondary p-1">
          {(["my", "join"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-200 ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {t === "my" ? "My Groups" : "Discover"}
            </button>
          ))}
        </div>

        {tab === "my" && (
          <div className="mt-4 space-y-2">
            {myGroups.length > 0 ? myGroups.map((group, i) => {
              const myRole = group.members.find(m => m.userId === uid)?.role;
              const activeCount = group.members.filter(m => m.status === "active").length;
              return (
                <motion.div key={group.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-sm font-bold text-accent-foreground">
                      {group.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{group.type} · {activeCount} members</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${myRole === "admin" ? "bg-primary/10 text-primary" : (myRole === "co-leader" || myRole === "co_leader") ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      {myRole === "co_leader" ? "co-leader" : myRole}
                    </span>
                  </div>
                  <button onClick={() => setManagingGroup(group.id)}
                    className="mt-3 w-full rounded-lg bg-secondary py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    Open Group
                  </button>
                </motion.div>
              );
            }) : (
              <div className="flex flex-col items-center py-12 text-center">
                <Users className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">No groups yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create or join a group to get started</p>
              </div>
            )}
          </div>
        )}

        {tab === "join" && (
          <div className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search public groups..." className="w-full rounded-xl border border-input bg-card py-3 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary/30 focus:ring-2 focus:ring-primary/10" />
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Have an invite code?</p>
              <div className="flex gap-2">
                <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="VINE-XXXXXX" className="flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary/30" />
                <button onClick={handleJoinByCode} disabled={!joinCode.trim()} className="rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">Join</button>
              </div>
            </div>

            <div className="space-y-2">
              {searchResults.length > 0 ? searchResults.map(group => {
                const alreadyMember = group.members.some(m => m.userId === uid && m.status === "active");
                return (
                  <div key={group.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-sm font-bold text-accent-foreground">
                      {group.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{group.type} · {group.members.filter(m => m.status === "active").length} members</p>
                    </div>
                    {alreadyMember ? (
                      <button onClick={() => { setTab("my"); setManagingGroup(group.id); }}
                        className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium">Open</button>
                    ) : (
                      <button onClick={() => handleJoinPublic(group.id)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Join</button>
                    )}
                  </div>
                );
              }) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <Search className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">No public groups found</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupsPage;
