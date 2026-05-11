import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, ChevronRight, Trash2, ChevronDown } from "lucide-react";
import { useActivities, activityCategories, type Activity } from "@/lib/store";
import { toast } from "sonner";
import { useState, useMemo } from "react";

const categoryIcons: Record<string, string> = {
  prayer: "🙏", "bible reading": "📖", fasting: "🍽️", worship: "🎵",
  meditation: "🧘", "scripture memorization": "💭", journaling: "📝", evangelism: "🌍",
};

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

// Returns the ISO week-of-month number (1-5) for a date
function weekOfMonth(date: Date): number {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // shift so Monday = 0
  return Math.floor((date.getDate() + offset - 1) / 7) + 1;
}

function getCompletionDate(a: Activity): Date {
  // Prefer endDate when present; otherwise fall back to createdAt
  const raw = a.endDate || a.createdAt;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date(a.createdAt) : d;
}

const ActivitiesPage = () => {
  const navigate = useNavigate();
  const { activities, deleteActivity } = useActivities();
  const [tab, setTab] = useState<"all" | "ongoing" | "completed">("all");
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});

  const getCategoryCount = (name: string) =>
    activities.filter(a => a.category.toLowerCase().includes(name.toLowerCase().split(" ")[0])).length;

  const filteredActivities = activities.filter(a => {
    if (tab === "ongoing") return a.status === "ongoing";
    if (tab === "completed") return a.status === "completed";
    return true;
  });

  // Group completed activities by Year-Month → Week-of-month
  const completedGrouped = useMemo(() => {
    if (tab !== "completed") return [];
    const map = new Map<string, { year: number; month: number; weeks: Map<number, Activity[]> }>();
    for (const a of filteredActivities) {
      const d = getCompletionDate(a);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map.has(key)) map.set(key, { year: d.getFullYear(), month: d.getMonth(), weeks: new Map() });
      const entry = map.get(key)!;
      const w = weekOfMonth(d);
      if (!entry.weeks.has(w)) entry.weeks.set(w, []);
      entry.weeks.get(w)!.push(a);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].year - a[1].year || b[1].month - a[1].month)
      .map(([key, val]) => ({
        key,
        label: `${MONTHS[val.month]} ${val.year}`,
        count: Array.from(val.weeks.values()).reduce((s, arr) => s + arr.length, 0),
        weeks: Array.from(val.weeks.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([wk, items]) => ({ wk, items })),
      }));
  }, [filteredActivities, tab]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteActivity(id);
    toast.success("Activity deleted");
  };

  const toggleMonth = (key: string) => setOpenMonths(prev => ({ ...prev, [key]: !prev[key] }));

  const renderActivityRow = (a: Activity) => (
    <button key={a.id} onClick={() => navigate(`/activity/${a.id}`)}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-accent">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-lg">{categoryIcons[a.category.toLowerCase()] || "💭"}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{a.title}</p>
        <p className="text-xs text-muted-foreground">{a.category} · {a.duration} {a.durationUnit} · {a.startDate}</p>
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 ${a.status === "completed" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"}`}>{a.status}</span>
      <button onClick={e => handleDelete(e, a.id)} className="rounded-lg p-1.5 hover:bg-destructive/10 transition-colors flex-shrink-0">
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
      </button>
    </button>
  );

  return (
    <div className="min-h-screen">
      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Activities</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track your spiritual disciplines</p>
          </div>
          <button onClick={() => navigate("/log-activity")}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <Plus className="h-4 w-4" />Create Activity
          </button>
        </div>

        <div className="mt-6 space-y-2">
          {activityCategories.map((cat, i) => (
            <motion.button key={cat.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }} onClick={() => navigate(`/activities/${cat.id}`)}
              className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-xl">{cat.icon}</div>
              <div className="flex-1"><p className="text-sm font-semibold">{cat.name}</p><p className="text-xs text-muted-foreground">{getCategoryCount(cat.name)} entries</p></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </motion.button>
          ))}
        </div>

        <div className="mt-8 flex rounded-xl bg-secondary p-1 mb-4">
          {(["all", "ongoing", "completed"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium capitalize transition-all duration-200 ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{t}</button>
          ))}
        </div>

        {tab === "completed" ? (
          <div className="space-y-3">
            {completedGrouped.length > 0 ? completedGrouped.map(group => {
              const isOpen = openMonths[group.key] ?? false;
              return (
                <div key={group.key} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <button onClick={() => toggleMonth(group.key)}
                    className="flex w-full items-center justify-between px-4 py-3 hover:bg-accent transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{group.label}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{group.count}</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-border px-3 py-3 space-y-3 bg-background/40">
                      {group.weeks.map(({ wk, items }) => (
                        <div key={wk}>
                          <p className="px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Week {wk} · {items.length} {items.length === 1 ? "entry" : "entries"}</p>
                          <div className="space-y-2">
                            {items.map(renderActivityRow)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="flex flex-col items-center py-8 text-center">
                <p className="text-sm text-muted-foreground">No completed activities yet</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredActivities.length > 0 ? filteredActivities.map(renderActivityRow) : (
              <div className="flex flex-col items-center py-8 text-center">
                <p className="text-sm text-muted-foreground">No {tab === "all" ? "" : tab} activities</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivitiesPage;
