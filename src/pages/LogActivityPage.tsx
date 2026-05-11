import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useActivities } from "@/lib/store";

const activityTypes = ["Prayer", "Bible Reading", "Fasting", "Worship", "Meditation", "Scripture Memorization", "Journaling", "Evangelism"];
const durationUnits = ["minutes", "hours", "days", "weeks", "months"] as const;

const LogActivityPage = () => {
  const navigate = useNavigate();
  const { addActivity } = useActivities();

  const [formData, setFormData] = useState({
    category: "Prayer",
    title: "",
    description: "",
    duration: "",
    durationUnit: "minutes" as typeof durationUnits[number],
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    isSingleDay: true,
    startTime: "",
    endTime: "",
    location: "",
    notes: "",
  });

  const handleSave = async () => {
    if (!formData.title) { toast.error("Please enter a title"); return; }
    if (!formData.duration) { toast.error("Please enter a duration"); return; }

    await addActivity({
      title: formData.title,
      category: formData.category,
      description: formData.description,
      duration: Number(formData.duration),
      durationUnit: formData.durationUnit,
      startDate: formData.startDate,
      endDate: formData.isSingleDay ? formData.startDate : formData.endDate,
      isSingleDay: formData.isSingleDay,
      startTime: formData.startTime,
      endTime: formData.endTime,
      location: formData.location,
      notes: formData.notes,
      visibility: "private",
    });

    toast.success("Activity logged successfully!");
    navigate(-1);
  };

  const inputClass = "mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none transition-colors focus:border-primary/30 focus:ring-2 focus:ring-primary/10";

  return (
    <div className="min-h-screen">
      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="rounded-full border border-border bg-card p-2 transition-colors hover:bg-secondary">
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Log Activity</h1>
        </div>

        <div className="space-y-5">
          {/* Activity Type */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Activity Type</label>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {activityTypes.map((type) => (
                <button key={type} onClick={() => setFormData({ ...formData, category: type })}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${formData.category === type ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-secondary"}`}>
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Title</label>
            <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Morning Prayer" className={inputClass} />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe this activity..." rows={2} className={`${inputClass} resize-none`} />
          </div>

          {/* Duration */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Duration</label>
            <div className="mt-1.5 flex gap-2">
              <input type="number" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="30" min="1" className="flex-1 rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none transition-colors focus:border-primary/30 focus:ring-2 focus:ring-primary/10" />
              <select value={formData.durationUnit} onChange={(e) => setFormData({ ...formData, durationUnit: e.target.value as typeof durationUnits[number] })}
                className="rounded-xl border border-input bg-card px-3 py-3 text-sm outline-none transition-colors focus:border-primary/30 focus:ring-2 focus:ring-primary/10">
                {durationUnits.map((u) => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">Date</label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={formData.isSingleDay} onChange={(e) => setFormData({ ...formData, isSingleDay: e.target.checked })} className="rounded border-border" />
                Single day
              </label>
            </div>
            <div className={`mt-1.5 grid gap-2 ${formData.isSingleDay ? "grid-cols-1" : "grid-cols-2"}`}>
              <div>
                {!formData.isSingleDay && <p className="text-[11px] text-muted-foreground mb-1">Start</p>}
                <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className={inputClass} />
              </div>
              {!formData.isSingleDay && (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">End</p>
                  <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className={inputClass} />
                </div>
              )}
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Start Time</label>
              <input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">End Time</label>
              <input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} className={inputClass} />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Location</label>
            <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Home, Church" className={inputClass} />
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Reflections, observations, prayer details..." rows={4} className={`${inputClass} resize-none`} />
          </div>

          <button onClick={handleSave} className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
            Save Activity
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogActivityPage;
