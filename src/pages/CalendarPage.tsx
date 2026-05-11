import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useActivities } from "@/lib/store";

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CalendarPage = () => {
  const navigate = useNavigate();
  const { activities } = useActivities();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const prevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); };
  const nextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); };

  // Find days with activities
  const getActiveDays = () => {
    const days = new Set<number>();
    activities.forEach((a) => {
      const start = new Date(a.startDate);
      const end = new Date(a.endDate || a.startDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === month && d.getFullYear() === year) {
          days.add(d.getDate());
        }
      }
    });
    return days;
  };

  const activeDays = getActiveDays();

  const getActivitiesForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return activities.filter((a) => {
      return a.startDate <= dateStr && (a.endDate || a.startDate) >= dateStr;
    });
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const dayActivities = selectedDay ? getActivitiesForDay(selectedDay) : [];

  const categoryIcons: Record<string, string> = {
    prayer: "🙏", "bible reading": "📖", fasting: "🍽️", worship: "🎵",
    meditation: "🧘", journaling: "📝", evangelism: "🌍",
  };

  return (
    <div className="min-h-screen">
      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="rounded-full border border-border bg-card p-2 transition-colors hover:bg-secondary">
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Spiritual Calendar</h1>
        </div>

        <div className="flex items-center justify-between mb-5">
          <button onClick={prevMonth} className="rounded-full border border-border bg-card p-2 transition-colors hover:bg-secondary">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-semibold">
            {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h2>
          <button onClick={nextMonth} className="rounded-full border border-border bg-card p-2 transition-colors hover:bg-secondary">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {daysOfWeek.map((d) => (
            <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1.5">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => (
            <button
              key={i}
              onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
              disabled={!day}
              className={`relative flex h-10 items-center justify-center rounded-xl text-sm transition-colors ${
                day === null
                  ? ""
                  : selectedDay === day
                  ? "bg-primary font-semibold text-primary-foreground"
                  : isToday(day)
                  ? "bg-primary/20 font-semibold text-primary"
                  : activeDays.has(day)
                  ? "bg-accent font-medium text-accent-foreground"
                  : "hover:bg-secondary"
              }`}
            >
              {day}
              {day && activeDays.has(day) && selectedDay !== day && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Selected Day Activities */}
        {selectedDay && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-3">
              {new Date(year, month, selectedDay).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h3>
            {dayActivities.length > 0 ? (
              <div className="space-y-2">
                {dayActivities.map((a) => (
                  <button key={a.id} onClick={() => navigate(`/activity/${a.id}`)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-accent">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-base">
                      {categoryIcons[a.category.toLowerCase()] || "💭"}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.category} · {a.duration} {a.durationUnit}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      a.status === "completed" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"
                    }`}>{a.status}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No activities on this day</p>
                <button onClick={() => navigate("/log-activity")} className="mt-2 text-sm font-medium text-primary">
                  Log an activity
                </button>
              </div>
            )}
          </div>
        )}

        {/* Today's Activities (when no day selected) */}
        {!selectedDay && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-3">Today's Activities</h3>
            {(() => {
              const todayActs = getActivitiesForDay(today.getDate());
              return todayActs.length > 0 ? (
                <div className="space-y-2">
                  {todayActs.map((a) => (
                    <button key={a.id} onClick={() => navigate(`/activity/${a.id}`)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left hover:bg-accent transition-colors">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-base">
                        {categoryIcons[a.category.toLowerCase()] || "💭"}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.duration} {a.durationUnit}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">No activities today</p>
                  <button onClick={() => navigate("/log-activity")} className="mt-2 text-sm font-medium text-primary">
                    Log your first activity
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarPage;
