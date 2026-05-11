export const currentUser = {
  id: "1",
  name: "David",
  fullName: "David Okonkwo",
  email: "david@example.com",
  avatar: "",
  spiritualLevel: "Growing Disciple",
  church: "Grace Community Church",
  joinedDate: "2024-06-15",
};

export const todaysGoals = [
  { id: "1", habit: "Prayer", icon: "🙏", goal: "1 hour", progress: 30, target: 60, unit: "min" },
  { id: "2", habit: "Bible Reading", icon: "📖", goal: "5 chapters", progress: 2, target: 5, unit: "chapters" },
  { id: "3", habit: "Fasting", icon: "🍽️", goal: "Wednesday fast", progress: 0, target: 1, unit: "day", status: "upcoming" },
  { id: "4", habit: "Journaling", icon: "📝", goal: "1 entry", progress: 1, target: 1, unit: "entry" },
];

export const streaks = [
  { habit: "Prayer", current: 14, longest: 21, icon: "🙏" },
  { habit: "Bible Reading", current: 10, longest: 30, icon: "📖" },
  { habit: "Fasting", current: 3, longest: 8, icon: "🍽️" },
];

export const recentActivities = [
  { id: "1", title: "Morning Prayer", type: "Prayer", duration: "45 min", time: "6:00 AM", date: "Today" },
  { id: "2", title: "John Chapter 3", type: "Bible Reading", duration: "20 min", time: "7:00 AM", date: "Today" },
  { id: "3", title: "Gratitude Journal Entry", type: "Journaling", duration: "10 min", time: "8:30 AM", date: "Today" },
  { id: "4", title: "Evening Prayer", type: "Prayer", duration: "30 min", time: "9:00 PM", date: "Yesterday" },
  { id: "5", title: "Psalm 23 Memorization", type: "Scripture Memorization", duration: "15 min", time: "7:30 AM", date: "Yesterday" },
];

export const upcomingActivities = [
  { id: "1", title: "Fellowship Meeting", time: "6:00 PM", type: "Group" },
  { id: "2", title: "Evening Prayer", time: "8:00 PM", type: "Prayer" },
  { id: "3", title: "Bible Study Group", time: "Tomorrow 5:00 PM", type: "Bible Reading" },
];

export const activityCategories = [
  { id: "prayer", name: "Prayer", icon: "🙏", color: "vine", count: 45 },
  { id: "bible", name: "Bible Reading", icon: "📖", color: "gold", count: 32 },
  { id: "fasting", name: "Fasting", icon: "🍽️", color: "earth", count: 8 },
  { id: "worship", name: "Worship", icon: "🎵", color: "vine", count: 12 },
  { id: "meditation", name: "Meditation", icon: "🧘", color: "gold", count: 15 },
  { id: "memorization", name: "Scripture Memorization", icon: "💭", color: "vine", count: 6 },
  { id: "journaling", name: "Journaling", icon: "📝", color: "earth", count: 20 },
  { id: "evangelism", name: "Evangelism", icon: "🌍", color: "gold", count: 3 },
];

export const groups = [
  { id: "1", name: "Campus Fellowship", type: "Fellowship", members: 24, role: "Member", lastActive: "2 hours ago" },
  { id: "2", name: "Discipleship Group", type: "Discipleship", members: 8, role: "Leader", lastActive: "1 hour ago" },
  { id: "3", name: "Family Prayer Group", type: "Prayer", members: 5, role: "Member", lastActive: "Today" },
];

export const programs = [
  { id: "1", name: "21-Day Prayer Challenge", description: "Commit to 21 days of focused prayer", startDate: "2026-03-01", endDate: "2026-03-21", progress: 42, participants: 156, joined: true },
  { id: "2", name: "Bible in One Year", description: "Read through the entire Bible in 365 days", startDate: "2026-01-01", endDate: "2026-12-31", progress: 18, participants: 420, joined: true },
  { id: "3", name: "40-Day Fasting Program", description: "A structured 40-day fasting journey", startDate: "2026-03-15", endDate: "2026-04-23", progress: 0, participants: 89, joined: false },
  { id: "4", name: "7-Day Revival Prayer", description: "Intensive 7-day corporate prayer", startDate: "2026-04-01", endDate: "2026-04-07", progress: 0, participants: 210, joined: false },
];

export const prayerRequests = [
  { id: "1", title: "Healing for my mother", category: "Health", status: "active", date: "2026-03-08", updates: 3 },
  { id: "2", title: "Guidance for career decision", category: "Guidance", status: "active", date: "2026-03-05", updates: 1 },
  { id: "3", title: "Family salvation", category: "Salvation", status: "active", date: "2026-02-20", updates: 5 },
  { id: "4", title: "Job interview success", category: "Career", status: "answered", date: "2026-02-10", updates: 2 },
];

export const weeklyStats = [
  { day: "Mon", prayer: 45, bible: 30, fasting: 0 },
  { day: "Tue", prayer: 60, bible: 25, fasting: 0 },
  { day: "Wed", prayer: 50, bible: 40, fasting: 1 },
  { day: "Thu", prayer: 30, bible: 20, fasting: 0 },
  { day: "Fri", prayer: 55, bible: 35, fasting: 0 },
  { day: "Sat", prayer: 75, bible: 45, fasting: 0 },
  { day: "Sun", prayer: 90, bible: 50, fasting: 0 },
];

export const notifications = [
  { id: "1", type: "reminder", message: "Time for evening prayer", time: "5 min ago", read: false },
  { id: "2", type: "group", message: "New announcement in Campus Fellowship", time: "1 hour ago", read: false },
  { id: "3", type: "program", message: "Day 9 of 21-Day Prayer Challenge", time: "3 hours ago", read: true },
  { id: "4", type: "prayer", message: "Someone prayed for your request", time: "Yesterday", read: true },
];
