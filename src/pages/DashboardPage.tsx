import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, BookOpen, TrendingUp, Clock, BookOpenCheck, Utensils } from "lucide-react";
import { useGroups, usePrograms, useActivities } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, CartesianGrid } from "recharts";
import { useState, useMemo } from "react";
import { Progress } from "@/components/ui/progress";

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { groups } = useGroups();
  const { programs } = usePrograms();
  const { activities } = useActivities();
  const [tab, setTab] = useState<"overview" | "analytics">("overview");

  const uid = user?.id || "";
  const myGroups = groups.filter(g => g.ownerId === uid);
  const myPrograms = programs.filter(p => p.ownerId === uid);
  const totalMembers = myGroups.reduce((sum, g) => sum + g.members.filter(m => m.status === "active").length, 0);
  const totalParticipants = myPrograms.reduce((sum, p) => sum + p.participants.length, 0);

  const analytics = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const monthActs = activities.filter(a => { const d = new Date(a.createdAt); return d.getMonth() === thisMonth && d.getFullYear() === thisYear; });
    const prayerMinutes = monthActs.filter(a => a.category.toLowerCase() === "prayer").reduce((sum, a) => {
      const mult: Record<string, number> = { minutes: 1, hours: 60, days: 1440 };
      return sum + a.duration * (mult[a.durationUnit] || 1);
    }, 0);
    const bibleCount = monthActs.filter(a => a.category.toLowerCase().includes("bible")).length;
    const fastingActs = activities.filter(a => a.category.toLowerCase() === "fasting");
    const completedFasts = fastingActs.filter(a => a.status === "completed").length;
    const fastingRate = fastingActs.length > 0 ? Math.round((completedFasts / fastingActs.length) * 100) : 0;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      const count = activities.filter(a => { const c = new Date(a.createdAt); return c.getMonth() === d.getMonth() && c.getFullYear() === d.getFullYear(); }).length;
      monthlyTrend.push({ month: monthNames[d.getMonth()], activities: count });
    }

    // Hourly trend from real data
    const hourlyMap: Record<number, number> = {};
    activities.forEach(a => {
      if (a.startTime) {
        const hour = parseInt(a.startTime.split(":")[0]);
        if (!isNaN(hour)) hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
      }
    });
    const hourlyTrend = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, activities: hourlyMap[h] || 0 }));

    // Daily trend (last 7 days) from real data
    const dailyTrend = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const count = activities.filter(a => {
        const c = new Date(a.createdAt);
        return c.toDateString() === d.toDateString();
      }).length;
      dailyTrend.push({ day: dayNames[d.getDay()], activities: count });
    }

    // Weekly trend (last 4 weeks) from real data
    const weeklyTrend = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7 + weekStart.getDay()));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const count = activities.filter(a => {
        const c = new Date(a.createdAt);
        return c >= weekStart && c < weekEnd;
      }).length;
      weeklyTrend.push({ week: `W${4 - i}`, activities: count });
    }

    return {
      prayerHours: Math.round((prayerMinutes / 60) * 10) / 10, bibleCount, fastingRate,
      monthlyTrend, hourlyTrend, dailyTrend, weeklyTrend,
      ongoing: activities.filter(a => a.status === "ongoing").length,
      completed: activities.filter(a => a.status === "completed").length,
    };
  }, [activities]);

  return (
    <div className="min-h-screen pb-24">
      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/profile")} className="rounded-full border border-border bg-card p-2 hover:bg-secondary transition-colors"><ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} /></button>
          <h1 className="text-xl font-bold tracking-tight">Creator Dashboard</h1>
        </div>

        <div className="flex gap-1 rounded-xl bg-secondary p-1 mb-6">
          {(["overview", "analytics"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all capitalize ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{t}</button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Users, label: "Groups", value: myGroups.length, sub: `${totalMembers} members` },
                { icon: BookOpen, label: "Programs", value: myPrograms.length, sub: `${totalParticipants} participants` },
                { icon: TrendingUp, label: "Total Reach", value: totalMembers + totalParticipants, sub: "people" },
                { icon: Clock, label: "Activities", value: activities.length, sub: `${analytics.completed} completed` },
              ].map(card => (
                <div key={card.label} className="rounded-2xl border border-border bg-card p-4">
                  <card.icon className="h-5 w-5 text-primary mb-2" />
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-[10px] text-muted-foreground">{card.sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "analytics" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-border bg-card p-3 text-center"><Clock className="h-5 w-5 text-primary mx-auto mb-1" /><p className="text-xl font-bold">{analytics.prayerHours}</p><p className="text-[10px] text-muted-foreground">Prayer Hours</p></div>
              <div className="rounded-2xl border border-border bg-card p-3 text-center"><BookOpenCheck className="h-5 w-5 text-primary mx-auto mb-1" /><p className="text-xl font-bold">{analytics.bibleCount}</p><p className="text-[10px] text-muted-foreground">Bible Sessions</p></div>
              <div className="rounded-2xl border border-border bg-card p-3 text-center"><Utensils className="h-5 w-5 text-primary mx-auto mb-1" /><p className="text-xl font-bold">{analytics.fastingRate}%</p><p className="text-[10px] text-muted-foreground">Fasting Rate</p></div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-3">Activity Status</p>
              <div className="space-y-3">
                <div><div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Ongoing</span><span className="font-medium">{analytics.ongoing}</span></div>
                  <Progress value={activities.length > 0 ? (analytics.ongoing / activities.length) * 100 : 0} className="h-2" /></div>
                <div><div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Completed</span><span className="font-medium">{analytics.completed}</span></div>
                  <Progress value={activities.length > 0 ? (analytics.completed / activities.length) * 100 : 0} className="h-2" /></div>
              </div>
            </div>

            {/* Hourly Trend */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-4">Hourly Activity Pattern</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={analytics.hourlyTrend}>
                  <XAxis dataKey="hour" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} interval={3} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: "12px" }} />
                  <Bar dataKey="activities" fill="hsl(152, 38%, 30%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Trend */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-4">Daily Trend (Last 7 Days)</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={analytics.dailyTrend}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: "12px" }} />
                  <Bar dataKey="activities" fill="hsl(152, 30%, 42%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Weekly Trend */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-4">Weekly Trend</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={analytics.weeklyTrend}>
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: "12px" }} />
                  <Bar dataKey="activities" fill="hsl(40, 60%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Trend */}
            {analytics.monthlyTrend.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-semibold mb-4">Monthly Trend</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={analytics.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={25} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: "12px" }} />
                    <Line type="monotone" dataKey="activities" stroke="hsl(152, 38%, 30%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(152, 38%, 30%)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
