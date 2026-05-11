import { motion } from "framer-motion";
import { usePrograms } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { ChevronRight, Plus, X, Copy, ArrowLeft, Users, Calendar, Send, MessageCircle, LogOut, Edit, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { containsSpam, getSpamReason } from "@/lib/messageFilter";
import InviteShareSheet from "@/components/InviteShareSheet";

interface ProgramMessage {
  id: string;
  owner_id: string;
  message_text: string;
  created_at: string;
  updated_at: string;
}

interface ProgramNote {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const ProgramsPage = () => {
  const { user } = useAuth();
  const { programs, allPrograms, createProgram, deleteProgram, joinProgram, joinByCode } = usePrograms();
  const [tab, setTab] = useState<"my" | "joined" | "explore">("my");
  const [showCreate, setShowCreate] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [viewingProgram, setViewingProgram] = useState<string | null>(null);
  const [programView, setProgramView] = useState<"details" | "notes" | "broadcast">("details");
  const [broadcastMessages, setBroadcastMessages] = useState<ProgramMessage[]>([]);
  const [programNotes, setProgramNotes] = useState<ProgramNote[]>([]);
  const [broadcastText, setBroadcastText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageText, setEditMessageText] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [createData, setCreateData] = useState({ name: "", customName: "", description: "", startDate: "", endDate: "", visibility: "public" as "public" | "invite-only" });
  const [shareOpen, setShareOpen] = useState(false);

  const uid = user?.id || "";
  const myPrograms = programs.filter(p => p.ownerId === uid);
  const joinedPrograms = programs.filter(p => p.participants.includes(uid) && p.ownerId !== uid);
  const explorePrograms = allPrograms.filter(p => p.visibility === "public" && !p.participants.includes(uid) && p.ownerId !== uid);

  const presetNames = ["21-Day Prayer Challenge", "40-Day Fasting Program", "Bible in One Year", "7-Day Revival Prayer", "Other"];
  const inputClass = "mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10";

  const getDaysRemaining = (endDate: string) => Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000));
  const getProgress = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;
    const total = new Date(endDate).getTime() - new Date(startDate).getTime();
    if (total <= 0) return 100;
    const elapsed = Date.now() - new Date(startDate).getTime();
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  };

  const handleCreate = async () => {
    const name = createData.name === "Other" ? createData.customName : createData.name;
    if (!name) { toast.error("Enter a program name"); return; }
    if (!createData.startDate || !createData.endDate) { toast.error("Select dates"); return; }
    await createProgram({ name, description: createData.description, startDate: createData.startDate, endDate: createData.endDate, visibility: createData.visibility });
    toast.success("Program created!");
    setShowCreate(false);
    setCreateData({ name: "", customName: "", description: "", startDate: "", endDate: "", visibility: "public" });
  };

  const handleJoinByCode = async () => {
    if (!joinCodeInput) return;
    const result = await joinByCode(joinCodeInput);
    if (result) { toast.success("Joined program!"); setJoinCodeInput(""); } else { toast.error("Invalid program code"); }
  };

  const handleDeleteProgram = async (id: string) => {
    // Delete participants first, then program
    await supabase.from("program_participants").delete().eq("program_id", id);
    await (supabase.from("program_messages") as any).delete().eq("program_id", id);
    await (supabase.from("program_notes") as any).delete().eq("program_id", id);
    await supabase.from("programs").delete().eq("id", id);
    deleteProgram(id);
    toast.success("Program deleted permanently");
    setViewingProgram(null);
  };

  const handleLeaveProgram = async (programId: string) => {
    await supabase.from("program_participants").delete().eq("program_id", programId).eq("user_id", uid);
    toast.success("Left program");
    setViewingProgram(null);
    window.dispatchEvent(new Event("vine-data-change"));
  };

  const handleUpdateDescription = async (programId: string) => {
    await supabase.from("programs").update({ description: descriptionDraft }).eq("id", programId);
    setEditingDescription(false);
    toast.success("Description updated");
    window.dispatchEvent(new Event("vine-data-change"));
  };

  // Load broadcast messages
  const loadBroadcast = useCallback(async (programId: string) => {
    const { data } = await (supabase.from("program_messages") as any).select("*").eq("program_id", programId).order("created_at", { ascending: true });
    if (data) setBroadcastMessages(data);
  }, []);

  const loadNotes = useCallback(async (programId: string) => {
    const { data } = await (supabase.from("program_notes") as any).select("*").eq("program_id", programId).order("created_at", { ascending: false });
    if (data) setProgramNotes(data);
  }, []);

  // Real-time subscription for program messages
  useEffect(() => {
    if (!viewingProgram) return;
    loadBroadcast(viewingProgram);
    loadNotes(viewingProgram);

    const channel = supabase.channel(`program-${viewingProgram}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'program_messages', filter: `program_id=eq.${viewingProgram}` },
        () => loadBroadcast(viewingProgram))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [viewingProgram, loadBroadcast, loadNotes]);

  const sendBroadcast = async () => {
    if (!broadcastText.trim() || !viewingProgram) return;
    const reason = getSpamReason(broadcastText);
    if (reason) { toast.error(reason); return; }
    await (supabase.from("program_messages") as any).insert({ program_id: viewingProgram, owner_id: uid, message_text: broadcastText.trim() });
    setBroadcastText("");
  };

  const updateBroadcast = async () => {
    if (!editMessageText.trim() || !editingMessageId) return;
    await (supabase.from("program_messages") as any).update({ message_text: editMessageText.trim(), updated_at: new Date().toISOString() }).eq("id", editingMessageId);
    setBroadcastMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, message_text: editMessageText.trim() } : m));
    setEditingMessageId(null);
    setEditMessageText("");
    toast.success("Message updated");
  };

  const deleteBroadcast = async (id: string) => {
    await (supabase.from("program_messages") as any).delete().eq("id", id);
    setBroadcastMessages(prev => prev.filter(m => m.id !== id));
    toast.success("Message deleted");
  };

  const addNote = async () => {
    if (!noteText.trim() || !viewingProgram) return;
    await (supabase.from("program_notes") as any).insert({ program_id: viewingProgram, owner_id: uid, content: noteText.trim() });
    setNoteText("");
    loadNotes(viewingProgram);
    toast.success("Note added");
  };

  // Program detail view
  const viewedProgram = viewingProgram ? allPrograms.find(p => p.id === viewingProgram) || programs.find(p => p.id === viewingProgram) : null;
  if (viewedProgram) {
    const progress = getProgress(viewedProgram.startDate, viewedProgram.endDate);
    const daysLeft = getDaysRemaining(viewedProgram.endDate);
    const isJoined = viewedProgram.participants.includes(uid);
    const isOwner = viewedProgram.ownerId === uid;

    return (
      <div className="min-h-screen">
        <div className="px-5 pt-14 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => { setViewingProgram(null); setProgramView("details"); }} className="rounded-full border border-border bg-card p-2 hover:bg-secondary transition-colors">
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </button>
            <h1 className="text-xl font-bold tracking-tight flex-1">Program</h1>
          </div>

          {/* Program tabs */}
          <div className="flex rounded-xl bg-secondary p-1 mb-4">
            {(["details", "notes", "broadcast"] as const).map(t => (
              <button key={t} onClick={() => setProgramView(t)}
                className={`flex-1 rounded-lg py-2 text-xs font-medium capitalize transition-all ${programView === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                {t === "broadcast" ? "Updates" : t}
              </button>
            ))}
          </div>

          {programView === "details" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-lg font-bold">{viewedProgram.name}</h2>
                {editingDescription && isOwner ? (
                  <div className="mt-2 space-y-2">
                    <textarea value={descriptionDraft} onChange={e => setDescriptionDraft(e.target.value)}
                      rows={4} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none resize-none focus:border-primary/30" />
                    <div className="flex gap-2">
                      <button onClick={() => setEditingDescription(false)} className="flex-1 rounded-xl border border-border py-2 text-xs font-medium">Cancel</button>
                      <button onClick={() => handleUpdateDescription(viewedProgram.id)} className="flex-1 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground">Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {viewedProgram.description && <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{viewedProgram.description}</p>}
                    {isOwner && (
                      <button onClick={() => { setEditingDescription(true); setDescriptionDraft(viewedProgram.description); }}
                        className="mt-2 flex items-center gap-1 text-xs text-primary font-medium">
                        <Edit className="h-3 w-3" /> Edit Description
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border bg-card p-3.5">
                  <Calendar className="h-4 w-4 text-primary mb-1" />
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="text-sm font-medium">{viewedProgram.startDate || "Not set"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-3.5">
                  <Calendar className="h-4 w-4 text-primary mb-1" />
                  <p className="text-xs text-muted-foreground">End Date</p>
                  <p className="text-sm font-medium">{viewedProgram.endDate || "Not set"}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Users className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">{viewedProgram.participants.length} Participants</p>
                </div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold text-primary">{progress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary">
                  <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{daysLeft} days remaining</p>
              </div>
              {viewedProgram.inviteCode && (isOwner || isJoined) && (
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Invite Code</p>
                    <button onClick={() => setShareOpen(true)}
                      className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors">
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-primary flex-1">{viewedProgram.inviteCode}</span>
                    <button onClick={() => { navigator.clipboard.writeText(viewedProgram.inviteCode); toast.success("Copied!"); }} className="rounded-lg p-2 hover:bg-secondary" aria-label="Copy code">
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )}
              {!isJoined && !isOwner && (
                <button onClick={async () => { await joinProgram(viewedProgram.id); toast.success("Joined!"); setViewingProgram(null); }}
                  className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                  Join Program
                </button>
              )}
              {isJoined && !isOwner && (
                <div className="space-y-2">
                  <p className="text-center text-sm text-primary font-medium">✓ You've joined this program</p>
                  <button onClick={() => handleLeaveProgram(viewedProgram.id)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/15 bg-card py-3 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors">
                    <LogOut className="h-4 w-4" /> Leave Program
                  </button>
                </div>
              )}
              {isOwner && (
                <button onClick={() => handleDeleteProgram(viewedProgram.id)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/15 bg-card py-3 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors">
                  Delete Program
                </button>
              )}
            </div>
          )}

          {programView === "notes" && (
            <div className="space-y-4">
              {isOwner && (
                <div className="flex gap-2">
                  <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addNote()}
                    placeholder="Add a teaching note..." className="flex-1 rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-primary/30" />
                  <button onClick={addNote} className="rounded-xl bg-primary px-4 py-2.5 text-primary-foreground">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="space-y-2">
                {programNotes.length > 0 ? programNotes.map(note => (
                  <div key={note.id} className="rounded-xl border border-border bg-card p-3">
                    <p className="text-sm">{note.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(note.created_at).toLocaleString()}</p>
                  </div>
                )) : <p className="text-xs text-muted-foreground text-center py-8">No notes yet</p>}
              </div>
            </div>
          )}

          {programView === "broadcast" && (
            <div className="space-y-4">
              {isOwner && (
                <div className="flex gap-2">
                  <input type="text" value={broadcastText} onChange={e => setBroadcastText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendBroadcast()}
                    placeholder="Broadcast a message to participants..." className="flex-1 rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-primary/30" />
                  <button onClick={sendBroadcast} className="rounded-xl bg-primary px-4 py-2.5 text-primary-foreground">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="space-y-2">
                {broadcastMessages.length > 0 ? broadcastMessages.map(msg => (
                  <div key={msg.id} className="rounded-xl border border-border bg-card p-3">
                    {editingMessageId === msg.id ? (
                      <div className="flex gap-2">
                        <input type="text" value={editMessageText} onChange={e => setEditMessageText(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && updateBroadcast()}
                          className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none" />
                        <button onClick={updateBroadcast} className="text-xs text-primary font-semibold">Save</button>
                        <button onClick={() => setEditingMessageId(null)} className="text-xs text-muted-foreground">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm">{msg.message_text}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-muted-foreground">{new Date(msg.created_at).toLocaleString()}</p>
                          {isOwner && (
                            <div className="flex gap-2">
                              <button onClick={() => { setEditingMessageId(msg.id); setEditMessageText(msg.message_text); }} className="text-[10px] text-primary">Edit</button>
                              <button onClick={() => deleteBroadcast(msg.id)} className="text-[10px] text-destructive">Delete</button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <MessageCircle className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">No updates yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <InviteShareSheet kind="program" code={viewedProgram.inviteCode} name={viewedProgram.name}
          description={viewedProgram.description} open={shareOpen} onClose={() => setShareOpen(false)} />
      </div>
    );
  }

  if (showCreate) {
    return (
      <div className="min-h-screen">
        <div className="px-5 pt-14 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setShowCreate(false)} className="rounded-full border border-border bg-card p-2 hover:bg-secondary transition-colors"><X className="h-[18px] w-[18px]" strokeWidth={1.7} /></button>
            <h1 className="text-xl font-bold tracking-tight">Create Program</h1>
          </div>
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Program Name</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {presetNames.map(n => (
                  <button key={n} onClick={() => setCreateData({ ...createData, name: n })}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${createData.name === n ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>{n}</button>
                ))}
              </div>
              {createData.name === "Other" && <input type="text" value={createData.customName} onChange={e => setCreateData({ ...createData, customName: e.target.value })} placeholder="Enter name" className={inputClass} />}
            </div>
            <div><label className="text-sm font-medium text-muted-foreground">Description</label><textarea value={createData.description} onChange={e => setCreateData({ ...createData, description: e.target.value })} placeholder="Describe this program..." rows={3} className={`${inputClass} resize-none`} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium text-muted-foreground">Start Date</label><input type="date" value={createData.startDate} onChange={e => setCreateData({ ...createData, startDate: e.target.value })} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-muted-foreground">End Date</label><input type="date" value={createData.endDate} onChange={e => setCreateData({ ...createData, endDate: e.target.value })} className={inputClass} /></div>
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
            <button onClick={handleCreate} className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">Create Program</button>
          </div>
        </div>
      </div>
    );
  }

  const renderProgramCard = (program: typeof programs[0], i: number, showDelete = false) => {
    const progress = getProgress(program.startDate, program.endDate);
    const daysLeft = getDaysRemaining(program.endDate);
    return (
      <motion.div key={program.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.04, duration: 0.3 }} className="rounded-2xl border border-border bg-card p-4">
        <button onClick={() => setViewingProgram(program.id)} className="w-full text-left">
          <h3 className="text-sm font-semibold">{program.name}</h3>
          {program.description && <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">{program.description}</p>}
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span>{program.participants.length} participants</span>
            <span>{daysLeft} days left</span>
          </div>
          <div className="mt-3"><div className="flex items-center justify-between text-xs mb-1.5"><span className="text-muted-foreground">Progress</span><span className="font-semibold text-primary">{progress}%</span></div>
            <div className="h-1.5 w-full rounded-full bg-secondary"><div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div></div>
        </button>
        {showDelete && (
          <button onClick={() => handleDeleteProgram(program.id)}
            className="mt-3 w-full rounded-lg border border-destructive/15 py-2 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors">Delete Program</button>
        )}
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen">
      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Programs</h1><p className="text-sm text-muted-foreground mt-0.5">Spiritual campaigns & challenges</p></div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />Create
          </button>
        </div>

        <div className="mt-5 flex rounded-xl bg-secondary p-1">
          {(["my", "joined", "explore"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-200 ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {t === "my" ? "My Programs" : t === "joined" ? "Joined" : "Explore"}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Join by code</p>
          <div className="flex gap-2">
            <input type="text" value={joinCodeInput} onChange={e => setJoinCodeInput(e.target.value.toUpperCase())} placeholder="PRG-XXXX"
              className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-mono outline-none focus:border-primary/30" />
            <button onClick={handleJoinByCode} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground">Join</button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {tab === "my" && (myPrograms.length > 0 ? myPrograms.map((p, i) => renderProgramCard(p, i, true)) : <p className="text-sm text-muted-foreground text-center py-12">No programs created yet</p>)}
          {tab === "joined" && (joinedPrograms.length > 0 ? joinedPrograms.map((p, i) => renderProgramCard(p, i)) : <p className="text-sm text-muted-foreground text-center py-12">No programs joined yet</p>)}
          {tab === "explore" && (explorePrograms.length > 0 ? explorePrograms.map((p, i) => renderProgramCard(p, i)) : <p className="text-sm text-muted-foreground text-center py-12">No public programs available</p>)}
        </div>
      </div>
    </div>
  );
};

export default ProgramsPage;
