import { useNavigate } from "react-router-dom";
import { Bell, ChevronRight, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { useUserProfile, useActivities, useNotifications, getDailyVerses } from "@/lib/store";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";

const categoryIcons: Record<string, string> = {
  prayer: "🙏", "bible reading": "📖", fasting: "🍽️", worship: "🎵",
  meditation: "🧘", "scripture memorization": "💭", journaling: "📝", evangelism: "🌍",
};

function classifyActivity(a: { duration: number; durationUnit: string; startDate: string; endDate: string; isSingleDay: boolean }): "daily" | "weekly" | "monthly" {
  if (a.isSingleDay || a.durationUnit === "minutes" || a.durationUnit === "hours") return "daily";
  if (a.startDate && a.endDate) {
    const days = Math.ceil((new Date(a.endDate).getTime() - new Date(a.startDate).getTime()) / 86400000);
    if (days <= 7) return "daily";
    if (days <= 28) return "weekly";
    return "monthly";
  }
  if (a.durationUnit === "days") {
    if (a.duration <= 7) return "daily";
    if (a.duration <= 28) return "weekly";
    return "monthly";
  }
  if (a.durationUnit === "weeks") {
    if (a.duration <= 4) return "weekly";
    return "monthly";
  }
  if (a.durationUnit === "months") return "monthly";
  return "daily";
}

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useUserProfile();
  const { user: authUser } = useAuth();
  const { activities } = useActivities();
  const { unreadCount } = useNotifications();
  const verses = getDailyVerses();

  const hour = new Date().getHours();
  const greeting = user.greeting || (hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening");
  const displayName = user.fullName || authUser?.user_metadata?.full_name || "Friend";

  const [goalFilter, setGoalFilter] = useState<"daily" | "weekly" | "monthly">("daily");
  const [showAllGoals, setShowAllGoals] = useState(false);

  // Only show non-completed activities in goals
  const filteredGoals = useMemo(() => {
    return activities
      .filter(a => a.status !== "completed")
      .filter(a => classifyActivity(a) === goalFilter);
  }, [activities, goalFilter]);

  const visibleGoals = showAllGoals ? filteredGoals : filteredGoals.slice(0, 4);
  const hasMoreGoals = filteredGoals.length > 4;

  const recentActs = activities.slice(0, 5);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-5 pt-14 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/profile")} className="flex-shrink-0">
              <Avatar className="h-11 w-11 border-2 border-primary/20">
                {user.avatar ? <AvatarImage src={user.avatar} alt={displayName} /> : null}
                <AvatarFallback className="bg-accent text-accent-foreground font-bold text-sm">
                  {displayName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            </button>
            <div>
              <p className="text-sm text-muted-foreground">{greeting}</p>
              <h1 className="text-xl font-bold tracking-tight">{displayName}</h1>
            </div>
          </div>
          <button onClick={() => navigate("/notifications")} className="relative rounded-full border border-border bg-card p-2.5 transition-colors hover:bg-secondary">
            <Bell className="h-[18px] w-[18px] text-foreground" strokeWidth={1.7} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">{unreadCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Daily Verse */}
      <div className="px-5 mt-4">
        <div className="rounded-2xl border border-primary/10 bg-accent p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground/60">{verses.period} Verse</p>
          <p className="mt-2 text-sm italic leading-relaxed text-accent-foreground">"{verses.current.text}"</p>
          <p className="mt-2 text-xs font-semibold text-accent-foreground/70">— {verses.current.ref}</p>
        </div>
      </div>

      <div className="px-5 mt-6 space-y-8 pb-6">
        {/* Goals (from activities - only non-completed) */}
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.35 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Goals</h2>
            <button onClick={() => navigate("/activities")} className="text-sm font-medium text-primary">View All</button>
          </div>
          <div className="flex gap-1.5 mb-4">
            {(["daily", "weekly", "monthly"] as const).map(f => (
              <button key={f} onClick={() => { setGoalFilter(f); setShowAllGoals(false); }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${goalFilter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {visibleGoals.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {visibleGoals.map(activity => (
                  <button key={activity.id} onClick={() => navigate(`/activity/${activity.id}`)}
                    className="rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-accent">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{categoryIcons[activity.category.toLowerCase()] || "💭"}</span>
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold bg-accent text-accent-foreground">
                        {activity.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">{activity.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{activity.duration} {activity.durationUnit}</p>
                  </button>
                ))}
              </div>
              {hasMoreGoals && (
                <button onClick={() => setShowAllGoals(!showAllGoals)}
                  className="mt-3 w-full flex items-center justify-center gap-1 rounded-xl border border-border bg-card py-2.5 text-xs font-medium text-primary transition-colors hover:bg-accent">
                  {showAllGoals ? "Show Less" : `Show More (${filteredGoals.length - 4} more)`}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllGoals ? "rotate-180" : ""}`} />
                </button>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">No {goalFilter} activities yet</p>
              <button onClick={() => navigate("/log-activity")} className="mt-2 text-sm font-medium text-primary">Log an activity</button>
            </div>
          )}
        </motion.section>

        {/* Streaks section removed */}

        {/* Quick Actions - only 3: Prayer, Bible Study, Journal */}
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.35 }}>
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: "🙏", label: "Prayer", to: "/prayer" },
              { icon: "📖", label: "Bible Study", to: "/bible" },
              { icon: "📝", label: "Journal", to: "/journal" },
            ].map(action => (
              <button key={action.label} onClick={() => navigate(action.to)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-primary/20 hover:bg-accent">
                <span className="text-2xl">{action.icon}</span>
                <span className="text-[11px] font-medium text-muted-foreground">{action.label}</span>
              </button>
            ))}
          </div>
        </motion.section>

        {/* Recent Activities (max 5) */}
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.35 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Activities</h2>
          </div>
          {recentActs.length > 0 ? (
            <>
              <div className="space-y-2">
                {recentActs.map(activity => (
                  <button key={activity.id} onClick={() => navigate(`/activity/${activity.id}`)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-accent">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-lg">
                      {categoryIcons[activity.category.toLowerCase()] || "💭"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.duration} {activity.durationUnit}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${activity.status === "completed" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"}`}>
                      {activity.status}
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={() => navigate("/activities")}
                className="mt-3 w-full rounded-xl border border-border bg-card py-3 text-sm font-medium text-primary transition-colors hover:bg-accent">
                View More <ChevronRight className="inline h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">No activities logged yet</p>
              <button onClick={() => navigate("/log-activity")} className="mt-2 text-sm font-medium text-primary">Log your first activity</button>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
};

export default HomePage;
