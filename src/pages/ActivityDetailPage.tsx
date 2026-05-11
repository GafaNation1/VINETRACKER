import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, MapPin, Calendar, FileText, Pencil, Save, X } from "lucide-react";
import { useActivities, activityCategories, type Activity } from "@/lib/store";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useState } from "react";
import { toast } from "sonner";

const tabs = ["History", "Analytics"];
const activityTypes = ["Prayer", "Bible Reading", "Fasting", "Worship", "Meditation", "Scripture Memorization", "Journaling", "Evangelism"];
const durationUnits = ["minutes", "hours", "days", "weeks", "months"] as const;

const categoryIcons: Record<string, string> = {
  prayer: "🙏", "bible reading": "📖", fasting: "🍽️", worship: "🎵",
  meditation: "🧘", "scripture memorization": "💭", journaling: "📝", evangelism: "🌍",
};

const ActivityDetailPage = () => {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const { activities, updateActivity } = useActivities();
  const [activeTab, setActiveTab] = useState("History");
  const [newNote, setNewNote] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Activity>>({});
  const [saving, setSaving] = useState(false);

  const category = activityCategories.find(c => c.id === categoryId);
  const singleActivity = !category ? activities.find(a => a.id === categoryId) : null;

  const startEdit = () => {
    if (!singleActivity) return;
    setDraft({
      title: singleActivity.title,
      category: singleActivity.category,
      status: singleActivity.status,
      description: singleActivity.description,
      duration: singleActivity.duration,
      durationUnit: singleActivity.durationUnit,
      startDate: singleActivity.startDate,
      endDate: singleActivity.endDate,
      isSingleDay: singleActivity.isSingleDay,
      startTime: singleActivity.startTime,
      endTime: singleActivity.endTime,
      location: singleActivity.location,
      notes: singleActivity.notes,
    });
    setIsEditing(true);
  };

  const saveEdit = async () => {
    if (!singleActivity) return;
    if (!draft.title?.trim()) { toast.error("Title is required"); return; }
    if (!draft.duration || Number(draft.duration) < 1) { toast.error("Enter a valid duration"); return; }
    setSaving(true);
    const patch: Partial<Activity> = {
      ...draft,
      duration: Number(draft.duration),
      endDate: draft.isSingleDay ? draft.startDate : draft.endDate,
    };
    await updateActivity(singleActivity.id, patch);
    setSaving(false);
    setIsEditing(false);
    toast.success("Activity updated");
  };

  const inputClass = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary/30";

  if (singleActivity) {
    if (isEditing) {
      return (
        <div className="min-h-screen">
          <div className="px-5 pt-14 pb-6">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setIsEditing(false)} className="rounded-full border border-border bg-card p-2 transition-colors hover:bg-secondary">
                <X className="h-[18px] w-[18px]" strokeWidth={1.7} />
              </button>
              <div className="flex-1">
                <h1 className="text-lg font-bold tracking-tight">Edit Activity</h1>
                <p className="text-xs text-muted-foreground">All fields are editable</p>
              </div>
              <button onClick={saveEdit} disabled={saving}
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Activity Type</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {activityTypes.map(t => (
                    <button key={t} onClick={() => setDraft(d => ({ ...d, category: t }))}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${draft.category === t ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <input type="text" value={draft.title || ""} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} className={`mt-1.5 ${inputClass}`} />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <div className="mt-1.5 flex gap-2">
                  {(["ongoing", "completed"] as const).map(s => (
                    <button key={s} onClick={() => setDraft(d => ({ ...d, status: s }))}
                      className={`flex-1 rounded-xl py-2 text-xs font-medium capitalize transition-all ${draft.status === s ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea value={draft.description || ""} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} rows={2} className={`mt-1.5 ${inputClass} resize-none`} />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Duration</label>
                <div className="mt-1.5 flex gap-2">
                  <input type="number" min="1" value={draft.duration ?? ""} onChange={e => setDraft(d => ({ ...d, duration: Number(e.target.value) }))} className={`flex-1 ${inputClass}`} />
                  <select value={draft.durationUnit} onChange={e => setDraft(d => ({ ...d, durationUnit: e.target.value as Activity["durationUnit"] }))}
                    className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none">
                    {durationUnits.map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Date</label>
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <input type="checkbox" checked={!!draft.isSingleDay} onChange={e => setDraft(d => ({ ...d, isSingleDay: e.target.checked }))} />
                    Single day
                  </label>
                </div>
                <div className={`mt-1.5 grid gap-2 ${draft.isSingleDay ? "grid-cols-1" : "grid-cols-2"}`}>
                  <input type="date" value={draft.startDate || ""} onChange={e => setDraft(d => ({ ...d, startDate: e.target.value }))} className={inputClass} />
                  {!draft.isSingleDay && (
                    <input type="date" value={draft.endDate || ""} onChange={e => setDraft(d => ({ ...d, endDate: e.target.value }))} className={inputClass} />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Start Time</label>
                  <input type="time" value={draft.startTime || ""} onChange={e => setDraft(d => ({ ...d, startTime: e.target.value }))} className={`mt-1.5 ${inputClass}`} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">End Time</label>
                  <input type="time" value={draft.endTime || ""} onChange={e => setDraft(d => ({ ...d, endTime: e.target.value }))} className={`mt-1.5 ${inputClass}`} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Location</label>
                <input type="text" value={draft.location || ""} onChange={e => setDraft(d => ({ ...d, location: e.target.value }))} className={`mt-1.5 ${inputClass}`} />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <textarea value={draft.notes || ""} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} rows={4} className={`mt-1.5 ${inputClass} resize-none`} />
              </div>

              <button onClick={saveEdit} disabled={saving}
                className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen">
        <div className="px-5 pt-14 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate(-1)} className="rounded-full border border-border bg-card p-2 transition-colors hover:bg-secondary">
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </button>
            <div className="flex-1"><h1 className="text-lg font-bold tracking-tight">{singleActivity.title}</h1><p className="text-xs text-muted-foreground">{singleActivity.category}</p></div>
            <button onClick={startEdit}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${singleActivity.status === "completed" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"}`}>{singleActivity.status}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-3"><Clock className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Duration</p><p className="text-sm font-medium">{singleActivity.duration} {singleActivity.durationUnit}</p></div></div>
              <div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Date</p><p className="text-sm font-medium">{singleActivity.startDate}{!singleActivity.isSingleDay && ` → ${singleActivity.endDate}`}</p></div></div>
              {singleActivity.startTime && <div className="flex items-center gap-3"><Clock className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Time</p><p className="text-sm font-medium">{singleActivity.startTime} - {singleActivity.endTime}</p></div></div>}
              {singleActivity.location && <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Location</p><p className="text-sm font-medium">{singleActivity.location}</p></div></div>}
            </div>
            {singleActivity.description && (
              <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground mb-1">Description</p><p className="text-sm leading-relaxed">{singleActivity.description}</p></div>
            )}
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2"><FileText className="h-4 w-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">Notes</p></div>
              {singleActivity.notes ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{singleActivity.notes}</p> : <p className="text-xs text-muted-foreground italic">No notes yet</p>}
              <div className="mt-3 flex gap-2">
                <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..."
                  className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary/30" />
                <button onClick={() => {
                  if (!newNote.trim()) return;
                  updateActivity(singleActivity.id, { notes: singleActivity.notes ? `${singleActivity.notes}\n${newNote}` : newNote });
                  setNewNote(""); toast.success("Note added");
                }} className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Add</button>
              </div>
            </div>
            {singleActivity.inviteCode && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">Invite Code</p>
                <p className="text-sm font-mono font-bold text-primary">{singleActivity.inviteCode}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!category) return <div className="p-8 text-center">Category not found</div>;

  const filtered = activities.filter(a => a.category.toLowerCase().includes(category.name.toLowerCase().split(" ")[0]));
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyData = weekDays.map((day, i) => {
    const dayActs = filtered.filter(a => new Date(a.createdAt).getDay() === (i + 1) % 7);
    return { day, count: dayActs.length, duration: dayActs.reduce((s, a) => s + a.duration, 0) };
  });

  return (
    <div className="min-h-screen">
      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="rounded-full border border-border bg-card p-2 transition-colors hover:bg-secondary">
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{category.icon}</span>
            <div><h1 className="text-xl font-bold tracking-tight">{category.name}</h1><p className="text-xs text-muted-foreground">{filtered.length} total entries</p></div>
          </div>
        </div>
        <div className="flex rounded-xl bg-secondary p-1 mb-5">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-200 ${activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{tab}</button>
          ))}
        </div>
        {activeTab === "History" && (
          <div className="space-y-2">
            {filtered.length > 0 ? filtered.map(a => (
              <button key={a.id} onClick={() => navigate(`/activity/${a.id}`)} className="w-full rounded-2xl border border-border bg-card p-4 text-left hover:bg-accent transition-colors">
                <div className="flex items-center justify-between"><p className="text-sm font-medium">{a.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.status === "completed" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"}`}>{a.status}</span></div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground"><span>{a.startDate}</span><span>·</span><span>{a.duration} {a.durationUnit}</span></div>
              </button>
            )) : (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-2xl">{category.icon}</div>
                <p className="mt-4 text-sm font-medium">No entries yet</p>
              </div>
            )}
            <button onClick={() => navigate("/log-activity")} className="w-full mt-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              Log {category.name}
            </button>
          </div>
        )}
        {activeTab === "Analytics" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: filtered.length, label: "Total" },
                { value: (filtered.length / 7).toFixed(1), label: "Avg/week" },
                { value: filtered.reduce((s, a) => s + a.duration, 0), label: "Total Dur." },
              ].map(stat => (
                <div key={stat.label} className="rounded-2xl border border-border bg-card p-3.5 text-center">
                  <p className="text-xl font-bold text-primary">{stat.value}</p><p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-4 text-sm font-semibold">Weekly Overview</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={weeklyData}>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis hide /><Tooltip />
                  <Bar dataKey="duration" fill="hsl(152, 38%, 30%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityDetailPage;
