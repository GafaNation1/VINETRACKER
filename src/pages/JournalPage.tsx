import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X, Trash2, Edit, Save } from "lucide-react";
import { useJournal } from "@/lib/store";
import { toast } from "sonner";
import { motion } from "framer-motion";

const JournalPage = () => {
  const navigate = useNavigate();
  const { entries, addEntry, updateEntry, deleteEntry } = useJournal();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [createData, setCreateData] = useState({ title: "", content: "" });
  const [editData, setEditData] = useState({ title: "", content: "" });

  const inputClass = "mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10";

  const handleCreate = () => {
    if (!createData.title) { toast.error("Enter a title"); return; }
    addEntry(createData);
    toast.success("Entry created!");
    setShowCreate(false);
    setCreateData({ title: "", content: "" });
  };

  const startEdit = (entry: { id: string; title: string; content: string }) => {
    setEditingId(entry.id);
    setEditData({ title: entry.title, content: entry.content });
    setReadingId(null);
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateEntry(editingId, editData);
    toast.success("Entry updated!");
    setEditingId(null);
  };

  const readingEntry = readingId ? entries.find(e => e.id === readingId) : null;

  // Full read view
  if (readingEntry) {
    return (
      <div className="min-h-screen">
        <div className="px-5 pt-14 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setReadingId(null)} className="rounded-full border border-border bg-card p-2 hover:bg-secondary transition-colors">
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold tracking-tight truncate">{readingEntry.title}</h1>
              <p className="text-xs text-muted-foreground">
                {new Date(readingEntry.createdAt).toLocaleDateString()} · Last edited {new Date(readingEntry.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <button onClick={() => startEdit(readingEntry)} className="rounded-lg p-2 hover:bg-secondary">
              <Edit className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{readingEntry.content || "No content yet."}</p>
          </div>
        </div>
      </div>
    );
  }

  // Edit view
  if (editingId) {
    return (
      <div className="min-h-screen">
        <div className="px-5 pt-14 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setEditingId(null)} className="rounded-full border border-border bg-card p-2 hover:bg-secondary transition-colors">
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </button>
            <h1 className="text-xl font-bold tracking-tight flex-1">Edit Entry</h1>
            <button onClick={saveEdit} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
              <Save className="h-3.5 w-3.5" />Save
            </button>
          </div>
          <div className="space-y-4">
            <input type="text" value={editData.title} onChange={e => setEditData({ ...editData, title: e.target.value })} className={inputClass} />
            <textarea value={editData.content} onChange={e => setEditData({ ...editData, content: e.target.value })} rows={16} className={`${inputClass} resize-none`} />
          </div>
        </div>
      </div>
    );
  }

  // Create view
  if (showCreate) {
    return (
      <div className="min-h-screen">
        <div className="px-5 pt-14 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setShowCreate(false)} className="rounded-full border border-border bg-card p-2 hover:bg-secondary transition-colors">
              <X className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </button>
            <h1 className="text-xl font-bold tracking-tight">New Journal Entry</h1>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Title</label>
              <input type="text" value={createData.title} onChange={e => setCreateData({ ...createData, title: e.target.value })}
                placeholder="e.g., Morning Reflection" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Content</label>
              <textarea value={createData.content} onChange={e => setCreateData({ ...createData, content: e.target.value })}
                placeholder="Write your thoughts, reflections..." rows={12} className={`${inputClass} resize-none`} />
            </div>
            <button onClick={handleCreate} className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              Save Entry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen">
      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="rounded-full border border-border bg-card p-2 hover:bg-secondary transition-colors">
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </button>
            <h1 className="text-xl font-bold tracking-tight">Journal</h1>
          </div>
          <button onClick={() => setShowCreate(true)} className="rounded-full border border-border bg-card p-2 hover:bg-secondary transition-colors">
            <Plus className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </button>
        </div>

        <div className="space-y-2">
          {entries.length > 0 ? entries.map((entry, i) => (
            <motion.button key={entry.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              onClick={() => setReadingId(entry.id)}
              className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold truncate">{entry.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(entry.createdAt).toLocaleDateString()} · Edited {new Date(entry.updatedAt).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{entry.content}</p>
                </div>
                <div className="flex gap-1 ml-2 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); startEdit(entry); }} className="rounded-lg p-1.5 hover:bg-secondary">
                    <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteEntry(entry.id); toast.success("Entry deleted"); }} className="rounded-lg p-1.5 hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            </motion.button>
          )) : (
            <div className="flex flex-col items-center py-16 text-center">
              <p className="text-2xl mb-3">📝</p>
              <p className="text-sm font-medium">No journal entries yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start writing your spiritual reflections</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JournalPage;
