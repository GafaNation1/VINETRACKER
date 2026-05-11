import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X, Check, Star, Trash2, MessageCircle } from "lucide-react";
import { usePrayerPoints } from "@/lib/store";
import { toast } from "sonner";
import { motion } from "framer-motion";

const categories = ["personal", "family", "church", "nation", "other"] as const;

const PrayerPage = () => {
  const navigate = useNavigate();
  const { prayers, addPrayer, updatePrayerStatus, addReflection, deletePrayer } = usePrayerPoints();
  const [showCreate, setShowCreate] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "answered">("all");
  const [selectedPrayer, setSelectedPrayer] = useState<string | null>(null);
  const [reflectionText, setReflectionText] = useState("");
  const [createData, setCreateData] = useState({ title: "", description: "", category: "personal" as typeof categories[number] });

  const handleCreate = () => {
    if (!createData.title) { toast.error("Enter a title"); return; }
    addPrayer(createData);
    toast.success("Prayer point added!");
    setShowCreate(false);
    setCreateData({ title: "", description: "", category: "personal" });
  };

  const handleAddReflection = (prayerId: string) => {
    if (!reflectionText.trim()) return;
    addReflection(prayerId, reflectionText);
    setReflectionText("");
    toast.success("Reflection added");
  };

  const filtered = prayers.filter((p) => {
    if (activeFilter === "active") return p.status === "active";
    if (activeFilter === "answered") return p.status === "answered";
    return true;
  });

  const selected = selectedPrayer ? prayers.find((p) => p.id === selectedPrayer) : null;

  const inputClass = "mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10";

  // Detail view
  if (selected) {
    return (
      <div className="min-h-screen">
        <div className="px-5 pt-14 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setSelectedPrayer(null)} className="rounded-full border border-border bg-card p-2 hover:bg-secondary transition-colors">
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold tracking-tight">{selected.title}</h1>
              <p className="text-xs text-muted-foreground capitalize">{selected.category} · {selected.status}</p>
            </div>
            <div className="flex gap-1">
              {selected.status === "active" && (
                <button onClick={() => { updatePrayerStatus(selected.id, "answered"); toast.success("Marked as answered! 🙏"); }}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                  <Star className="h-3 w-3 inline mr-1" />Answered
                </button>
              )}
            </div>
          </div>

          {selected.description && (
            <div className="rounded-2xl border border-border bg-card p-4 mb-4">
              <p className="text-sm leading-relaxed">{selected.description}</p>
            </div>
          )}

          {/* Reflections */}
          <h3 className="text-sm font-semibold mb-3">Reflections</h3>
          <div className="space-y-2 mb-4">
            {selected.reflections.length > 0 ? selected.reflections.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-3">
                <p className="text-sm">{r.text}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(r.date).toLocaleDateString()}</p>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground text-center py-4">No reflections yet</p>
            )}
          </div>

          <div className="flex gap-2">
            <input type="text" value={reflectionText} onChange={(e) => setReflectionText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddReflection(selected.id)}
              placeholder="Add a reflection..." className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary/30" />
            <button onClick={() => handleAddReflection(selected.id)} className="rounded-xl bg-primary px-4 py-2.5 text-primary-foreground">
              <MessageCircle className="h-4 w-4" />
            </button>
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
            <h1 className="text-xl font-bold tracking-tight">Add Prayer Point</h1>
          </div>
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Title</label>
              <input type="text" value={createData.title} onChange={(e) => setCreateData({ ...createData, title: e.target.value })}
                placeholder="e.g., Healing for my family" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <textarea value={createData.description} onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                placeholder="Details about this prayer point..." rows={4} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Category</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button key={c} onClick={() => setCreateData({ ...createData, category: c })}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-all ${
                      createData.category === c ? "bg-primary text-primary-foreground" : "border border-border bg-card"
                    }`}>{c}</button>
                ))}
              </div>
            </div>
            <button onClick={handleCreate} className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              Add Prayer Point
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="rounded-full border border-border bg-card p-2 hover:bg-secondary transition-colors">
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </button>
            <h1 className="text-xl font-bold tracking-tight">Prayer</h1>
          </div>
          <button onClick={() => setShowCreate(true)} className="rounded-full border border-border bg-card p-2 hover:bg-secondary transition-colors">
            <Plus className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 mb-4">
          {(["all", "active", "answered"] as const).map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-all ${
                activeFilter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              }`}>{f}</button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.length > 0 ? filtered.map((prayer, i) => (
            <motion.button key={prayer.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              onClick={() => setSelectedPrayer(prayer.id)}
              className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">{prayer.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{prayer.category} · {prayer.reflections.length} reflections</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    prayer.status === "answered" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"
                  }`}>{prayer.status === "answered" ? "Answered ✓" : "Active"}</span>
                  <button onClick={(e) => { e.stopPropagation(); deletePrayer(prayer.id); toast.success("Deleted"); }}
                    className="rounded-lg p-1 hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                </div>
              </div>
            </motion.button>
          )) : (
            <div className="flex flex-col items-center py-16 text-center">
              <p className="text-2xl mb-3">🙏</p>
              <p className="text-sm font-medium">No prayer points yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first prayer point to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrayerPage;
