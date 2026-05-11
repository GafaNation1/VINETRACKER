import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Types
export interface UserProfile {
  id: string;
  name: string;
  fullName: string;
  email: string;
  avatar: string;
  greeting: string;
  spiritualLevel: string;
  church: string;
  theme: "light" | "dark" | "midnight";
}

export interface Activity {
  id: string;
  userId: string;
  title: string;
  category: string;
  description: string;
  duration: number;
  durationUnit: "minutes" | "hours" | "days" | "weeks" | "months";
  startDate: string;
  endDate: string;
  isSingleDay: boolean;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  visibility: "private" | "group" | "invite";
  groupId?: string;
  inviteCode?: string;
  status: "ongoing" | "completed";
  createdAt: string;
}

export interface Streak {
  id: string;
  habit: string;
  icon: string;
  currentCount: number;
  longest: number;
  enabled: boolean;
  lastDate: string;
  targetActivity: string;
  goal: number;
}

export interface Group {
  id: string;
  name: string;
  type: string;
  description: string;
  visibility: "public" | "invite-only";
  inviteCode: string;
  ownerId: string;
  members: GroupMember[];
  activityTypes: string[];
  duration?: string;
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  username: string;
  role: "admin" | "co_leader" | "co-leader" | "member";
  joinedAt: string;
  leftAt?: string;
  status: "active" | "left";
  latestJoinAt?: string;
}

export interface Program {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  ownerId: string;
  visibility: "public" | "invite-only";
  inviteCode: string;
  participants: string[];
  progress: number;
  createdAt: string;
}

export interface Mentorship {
  id: string;
  name: string;
  mentorId: string;
  menteeIds: string[];
  type: "1-to-1" | "small-group" | "cohort";
  inviteCode: string;
  description: string;
  visibility: "public" | "invite-only";
  permissions: Record<string, any>;
  messages: MentorshipMessage[];
  createdAt: string;
}

export interface MentorshipMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type: "chat" | "feedback" | "reflection";
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  time: string;
  read: boolean;
  status?: "pending" | "joined" | "declined";
  actionType?: "join-group" | "join-program" | "join-mentorship" | "open-group" | "open-program" | "open-announcement" | "open-dm" | "open-activity";
  actionId?: string;
  actionCode?: string;
  groupId?: string;
  messageId?: string;
  conversationId?: string;
  programId?: string;
  activityId?: string;
}

export interface PrayerPoint {
  id: string;
  title: string;
  description: string;
  category: "personal" | "family" | "church" | "nation" | "other";
  status: "active" | "answered" | "completed";
  reflections: { id: string; text: string; date: string }[];
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// Helpers
function generateInviteCode(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Global event bus for cross-component data sync
const DATA_CHANGE_EVENT = "vine-data-change";
function notifyDataChange() {
  window.dispatchEvent(new Event(DATA_CHANGE_EVENT));
}
function useDataChangeListener(refetchFn: () => void) {
  useEffect(() => {
    window.addEventListener(DATA_CHANGE_EVENT, refetchFn);
    return () => window.removeEventListener(DATA_CHANGE_EVENT, refetchFn);
  }, [refetchFn]);
}

// Activity categories (moved from mockData)
export const activityCategories = [
  { id: "prayer", name: "Prayer", icon: "🙏" },
  { id: "bible", name: "Bible Reading", icon: "📖" },
  { id: "fasting", name: "Fasting", icon: "🍽️" },
  { id: "worship", name: "Worship", icon: "🎵" },
  { id: "meditation", name: "Meditation", icon: "🧘" },
  { id: "memorization", name: "Scripture Memorization", icon: "💭" },
  { id: "journaling", name: "Journaling", icon: "📝" },
  { id: "evangelism", name: "Evangelism", icon: "🌍" },
];

// ==================== PROFILE ====================
export function useUserProfile() {
  const [user, setUser] = useState<UserProfile>({
    id: "", name: "", fullName: "", email: "", avatar: "", greeting: "",
    spiritualLevel: "Growing Disciple", church: "", theme: "light",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const session = await getSession();
      if (!session) { setLoading(false); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (data) {
        const profile: UserProfile = {
          id: data.id,
          name: (data.full_name || "").split(" ")[0],
          fullName: data.full_name || "",
          email: data.email || session.user.email || "",
          avatar: data.avatar_url || "",
          greeting: data.greeting || "",
          spiritualLevel: data.spiritual_level || "Growing Disciple",
          church: data.church || "",
          theme: (data.theme || "light") as UserProfile["theme"],
        };
        setUser(profile);
        if (profile.theme === "dark" || profile.theme === "midnight") {
          document.documentElement.classList.add("dark");
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const updateUser = useCallback(async (updates: Partial<UserProfile>) => {
    setUser(prev => ({ ...prev, ...updates }));
    const session = await getSession();
    if (!session) return;
    const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.fullName !== undefined) { dbUpdates.full_name = updates.fullName; }
    if (updates.avatar !== undefined) dbUpdates.avatar_url = updates.avatar;
    if (updates.greeting !== undefined) dbUpdates.greeting = updates.greeting;
    if (updates.church !== undefined) dbUpdates.church = updates.church;
    if (updates.theme !== undefined) dbUpdates.theme = updates.theme;
    if (updates.spiritualLevel !== undefined) dbUpdates.spiritual_level = updates.spiritualLevel;
    await supabase.from("profiles").update(dbUpdates).eq("id", session.user.id);
    if (updates.theme) {
      document.documentElement.classList.remove("dark", "midnight");
      if (updates.theme === "dark" || updates.theme === "midnight") {
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  return { user, updateUser, loading };
}

// ==================== ACTIVITIES ====================
export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    const session = await getSession();
    if (!session) { setLoading(false); return; }
    setUserId(session.user.id);
    const { data } = await supabase.from("activities").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
    if (data) {
      const now = new Date();
      setActivities(data.map(r => {
        const status = r.status === "ongoing" && r.end_date && new Date(r.end_date) < now ? "completed" : (r.status || "ongoing");
        return {
          id: r.id, userId: r.user_id, title: r.title, category: r.category,
          description: r.description || "", duration: r.duration, durationUnit: (r.duration_unit || "minutes") as Activity["durationUnit"],
          startDate: r.start_date || "", endDate: r.end_date || "", isSingleDay: r.is_single_day ?? true,
          startTime: r.start_time || "", endTime: r.end_time || "", location: r.location || "",
          notes: r.notes || "", visibility: (r.visibility || "private") as Activity["visibility"],
          groupId: r.group_id || undefined, inviteCode: r.invite_code || undefined,
          status: status as Activity["status"], createdAt: r.created_at,
        };
      }));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);
  useDataChangeListener(fetchActivities);

  const addActivity = useCallback(async (activity: Omit<Activity, "id" | "createdAt" | "status" | "userId">) => {
    if (!userId) return null;
    const id = crypto.randomUUID();
    const inviteCode = activity.visibility === "invite" ? generateInviteCode("ACT") : "";
    const newActivity: Activity = {
      ...activity, id, userId, status: "ongoing", createdAt: new Date().toISOString(), inviteCode,
    };
    setActivities(prev => [newActivity, ...prev]);
    await supabase.from("activities").insert({
      id, user_id: userId, title: activity.title, category: activity.category,
      description: activity.description, duration: activity.duration, duration_unit: activity.durationUnit,
      start_date: activity.startDate, end_date: activity.endDate, is_single_day: activity.isSingleDay,
      start_time: activity.startTime, end_time: activity.endTime, location: activity.location,
      notes: activity.notes, visibility: activity.visibility, group_id: activity.groupId || "",
      invite_code: inviteCode, status: "ongoing",
    });
    notifyDataChange();
    return newActivity;
  }, [userId]);

  const deleteActivity = useCallback(async (id: string) => {
    setActivities(prev => prev.filter(a => a.id !== id));
    await supabase.from("activities").delete().eq("id", id);
    notifyDataChange();
  }, []);

  const updateActivity = useCallback(async (id: string, updates: Partial<Activity>) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    const dbUpdates: Record<string, any> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
    if (updates.durationUnit !== undefined) dbUpdates.duration_unit = updates.durationUnit;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
    if (updates.isSingleDay !== undefined) dbUpdates.is_single_day = updates.isSingleDay;
    if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime;
    if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.visibility !== undefined) dbUpdates.visibility = updates.visibility;
    await supabase.from("activities").update(dbUpdates).eq("id", id);
    notifyDataChange();
  }, []);

  return { activities, addActivity, deleteActivity, updateActivity, loading };
}

// ==================== STREAKS ====================
export function useStreaks() {
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchStreaks = useCallback(async () => {
    const session = await getSession();
    if (!session) { setLoading(false); return; }
    setUserId(session.user.id);
    const { data } = await (supabase.from("streaks") as any).select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
    if (data) {
      setStreaks(data.map((r: any) => ({
        id: r.id, habit: r.habit, icon: r.icon || "🙏",
        currentCount: r.current_count || 0, longest: r.longest || 0,
        enabled: r.enabled ?? true, lastDate: r.last_date || "",
        targetActivity: r.target_activity || "", goal: r.goal || 1,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStreaks(); }, [fetchStreaks]);
  useDataChangeListener(fetchStreaks);

  const addStreak = useCallback(async (data: { habit: string; icon: string; targetActivity: string; goal: number }) => {
    if (!userId) return;
    const id = crypto.randomUUID();
    const newStreak: Streak = { id, ...data, currentCount: 0, longest: 0, enabled: true, lastDate: "" };
    setStreaks(prev => [newStreak, ...prev]);
    await (supabase.from("streaks") as any).insert({
      id, user_id: userId, habit: data.habit, icon: data.icon,
      target_activity: data.targetActivity, goal: data.goal, enabled: true,
    });
    notifyDataChange();
  }, [userId]);

  const updateStreak = useCallback(async (id: string, updates: Partial<Streak>) => {
    setStreaks(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    const dbUpdates: Record<string, any> = {};
    if (updates.habit !== undefined) dbUpdates.habit = updates.habit;
    if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
    if (updates.targetActivity !== undefined) dbUpdates.target_activity = updates.targetActivity;
    if (updates.goal !== undefined) dbUpdates.goal = updates.goal;
    if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
    if (updates.currentCount !== undefined) dbUpdates.current_count = updates.currentCount;
    if (updates.longest !== undefined) dbUpdates.longest = updates.longest;
    if (updates.lastDate !== undefined) dbUpdates.last_date = updates.lastDate;
    await (supabase.from("streaks") as any).update(dbUpdates).eq("id", id);
    notifyDataChange();
  }, []);

  const deleteStreak = useCallback(async (id: string) => {
    setStreaks(prev => prev.filter(s => s.id !== id));
    await (supabase.from("streaks") as any).delete().eq("id", id);
    notifyDataChange();
  }, []);

  const toggleStreak = useCallback(async (id: string) => {
    const streak = streaks.find(s => s.id === id);
    if (!streak) return;
    const newEnabled = !streak.enabled;
    setStreaks(prev => prev.map(s => s.id === id ? { ...s, enabled: newEnabled } : s));
    await (supabase.from("streaks") as any).update({ enabled: newEnabled }).eq("id", id);
    notifyDataChange();
  }, [streaks]);

  return { streaks, addStreak, updateStreak, deleteStreak, toggleStreak, loading };
}

// ==================== GROUPS ====================
export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const mapGroup = (g: any, members: any[]): Group => ({
    id: g.id, name: g.name, type: g.type || "", description: g.description || "",
    visibility: (g.visibility || "public") as Group["visibility"], inviteCode: g.invite_code,
    ownerId: g.owner_id, activityTypes: (g.activity_types as string[]) || [],
    duration: g.duration || "", createdAt: g.created_at,
    members: members.filter(m => m.group_id === g.id).map(m => ({
      userId: m.user_id, username: m.username || "", role: (m.role || "member") as GroupMember["role"],
      joinedAt: m.joined_at, leftAt: m.left_at || undefined, status: (m.status || "active") as GroupMember["status"],
      latestJoinAt: m.latest_join_at || m.joined_at,
    })),
  });

  const fetchGroups = useCallback(async () => {
    const session = await getSession();
    if (!session) { setLoading(false); return; }
    const uid = session.user.id;
    setUserId(uid);
    const [gRes, mRes] = await Promise.all([
      supabase.from("groups").select("*"),
      supabase.from("group_members").select("*"),
    ]);
    const allGroups = gRes.data || [];
    const allMembers = mRes.data || [];
    const myGroupIds = new Set(allMembers.filter(m => m.user_id === uid && m.status === "active").map(m => m.group_id));
    const myGroups = allGroups.filter(g => myGroupIds.has(g.id)).map(g => mapGroup(g, allMembers));
    const pubGroups = allGroups.filter(g => g.visibility === "public" && !myGroupIds.has(g.id)).map(g => mapGroup(g, allMembers));
    setGroups(myGroups);
    setPublicGroups(pubGroups);
    setLoading(false);
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);
  useDataChangeListener(fetchGroups);

  const createGroup = useCallback(async (data: { name: string; type: string; description: string; visibility: "public" | "invite-only"; activityTypes: string[]; duration?: string }) => {
    if (!userId) return null;
    const id = crypto.randomUUID();
    const inviteCode = generateInviteCode("GRP");
    const session = await getSession();
    const userName = session?.user?.user_metadata?.full_name || "User";
    await supabase.from("groups").insert({
      id, name: data.name, type: data.type, description: data.description,
      visibility: data.visibility, invite_code: inviteCode, owner_id: userId,
      activity_types: data.activityTypes, duration: data.duration || "",
    });
    await supabase.from("group_members").insert({
      group_id: id, user_id: userId, role: "admin", username: userName.split(" ")[0], status: "active",
      latest_join_at: new Date().toISOString(),
    } as any);
    const newGroup: Group = {
      id, name: data.name, type: data.type, description: data.description,
      visibility: data.visibility, inviteCode, ownerId: userId,
      members: [{ userId, username: userName.split(" ")[0], role: "admin", joinedAt: new Date().toISOString(), status: "active" }],
      activityTypes: data.activityTypes, duration: data.duration, createdAt: new Date().toISOString(),
    };
    setGroups(prev => [...prev, newGroup]);
    return newGroup;
  }, [userId]);

  const deleteGroup = useCallback(async (id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    setPublicGroups(prev => prev.filter(g => g.id !== id));
    // Cascade delete is handled by a database trigger; this single delete removes everything.
    await supabase.from("groups").delete().eq("id", id);
    notifyDataChange();
  }, []);

  const joinGroupByCode = useCallback(async (code: string) => {
    if (!userId) return false;
    // Use SECURITY DEFINER RPC so users can resolve invite codes for groups they can't yet SELECT
    const { data: rows } = await (supabase as any).rpc("find_group_by_invite", { _code: code });
    const group = rows && rows[0];
    if (!group) return false;
    const session = await getSession();
    const userName = session?.user?.user_metadata?.full_name || "User";
    const nowIso = new Date().toISOString();

    // Check for an existing membership row (active or left)
    const { data: existing } = await (supabase as any)
      .from("group_members")
      .select("id, status")
      .eq("group_id", group.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing?.id) {
      // Re-activate; reset latest_join_at so previous chat/notes/notifications stay hidden
      await (supabase as any)
        .from("group_members")
        .update({ status: "active", left_at: null, latest_join_at: nowIso })
        .eq("id", existing.id);
    } else {
      await (supabase as any).from("group_members").insert({
        group_id: group.id, user_id: userId, role: "member",
        username: userName.split(" ")[0], status: "active",
        latest_join_at: nowIso,
      });
    }
    await fetchGroups();
    return true;
  }, [userId, fetchGroups]);

  const regenerateInviteCode = useCallback(async (id: string) => {
    const newCode = generateInviteCode("GRP");
    setGroups(prev => prev.map(g => g.id === id ? { ...g, inviteCode: newCode } : g));
    await supabase.from("groups").update({ invite_code: newCode }).eq("id", id);
    return newCode;
  }, []);

  const removeMember = useCallback(async (groupId: string, memberUserId: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? {
      ...g, members: g.members.map(m => m.userId === memberUserId ? { ...m, status: "left" as const, leftAt: new Date().toISOString() } : m)
    } : g));
    await supabase.from("group_members").update({ status: "left", left_at: new Date().toISOString() }).eq("group_id", groupId).eq("user_id", memberUserId);
  }, []);

  const promoteMember = useCallback(async (groupId: string, memberUserId: string, role: "co_leader" | "co-leader" | "member") => {
    // Normalize to underscore form (DB constraint accepts both, but we standardize)
    const dbRole = role === "co-leader" ? "co_leader" : role;
    setGroups(prev => prev.map(g => g.id === groupId ? {
      ...g, members: g.members.map(m => m.userId === memberUserId ? { ...m, role: dbRole as GroupMember["role"] } : m)
    } : g));
    await supabase.from("group_members").update({ role: dbRole }).eq("group_id", groupId).eq("user_id", memberUserId);
  }, []);

  const updateGroup = useCallback((id: string, updates: Partial<Group>) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  }, []);

  return { groups, publicGroups, createGroup, deleteGroup, updateGroup, regenerateInviteCode, joinGroupByCode, removeMember, promoteMember, loading };
}

// ==================== PROGRAMS ====================
export function usePrograms() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const mapProgram = (p: any, participantIds: string[]): Program => ({
    id: p.id, name: p.name, description: p.description || "", startDate: p.start_date || "",
    endDate: p.end_date || "", ownerId: p.owner_id, visibility: (p.visibility || "public") as Program["visibility"],
    inviteCode: p.invite_code, participants: participantIds, progress: p.progress || 0, createdAt: p.created_at,
  });

  const fetchPrograms = useCallback(async () => {
    const session = await getSession();
    if (!session) { setLoading(false); return; }
    setUserId(session.user.id);
    const [pRes, ppRes] = await Promise.all([
      supabase.from("programs").select("*"),
      supabase.from("program_participants").select("*"),
    ]);
    const allP = pRes.data || [];
    const allPP = ppRes.data || [];
    const mapped = allP.map(p => mapProgram(p, allPP.filter(pp => pp.program_id === p.id).map(pp => pp.user_id)));
    setAllPrograms(mapped);
    const myProgramIds = new Set(allPP.filter(pp => pp.user_id === session.user.id).map(pp => pp.program_id));
    setPrograms(mapped.filter(p => myProgramIds.has(p.id) || p.ownerId === session.user.id));
    setLoading(false);
  }, []);

  useEffect(() => { fetchPrograms(); }, [fetchPrograms]);
  useDataChangeListener(fetchPrograms);

  const createProgram = useCallback(async (data: { name: string; description: string; startDate: string; endDate: string; visibility: "public" | "invite-only" }) => {
    if (!userId) return null;
    const id = crypto.randomUUID();
    const inviteCode = generateInviteCode("PRG");
    await supabase.from("programs").insert({
      id, name: data.name, description: data.description, start_date: data.startDate,
      end_date: data.endDate, owner_id: userId, visibility: data.visibility, invite_code: inviteCode,
    });
    await supabase.from("program_participants").insert({ program_id: id, user_id: userId });
    const newProgram: Program = {
      id, ...data, ownerId: userId, inviteCode, participants: [userId], progress: 0, createdAt: new Date().toISOString(),
    };
    setPrograms(prev => [...prev, newProgram]);
    setAllPrograms(prev => [...prev, newProgram]);
    notifyDataChange();
    return newProgram;
  }, [userId]);

  const deleteProgram = useCallback(async (id: string) => {
    setPrograms(prev => prev.filter(p => p.id !== id));
    setAllPrograms(prev => prev.filter(p => p.id !== id));
    // Cascade delete handled by database trigger.
    await supabase.from("programs").delete().eq("id", id);
    notifyDataChange();
  }, []);

  const joinProgram = useCallback(async (id: string) => {
    if (!userId) return;
    await supabase.from("program_participants").insert({ program_id: id, user_id: userId });
    const update = (prev: Program[]) => prev.map(p => p.id === id ? { ...p, participants: [...p.participants, userId] } : p);
    setPrograms(update);
    setAllPrograms(update);
  }, [userId]);

  const joinByCode = useCallback(async (code: string) => {
    if (!userId) return false;
    const { data: rows } = await (supabase as any).rpc("find_program_by_invite", { _code: code });
    const program = rows && rows[0];
    if (!program) return false;
    await supabase.from("program_participants").insert({ program_id: program.id, user_id: userId });
    await fetchPrograms();
    return true;
  }, [userId, fetchPrograms]);

  return { programs, allPrograms, createProgram, deleteProgram, joinProgram, joinByCode, loading };
}

// ==================== MENTORSHIPS ====================
export function useMentorships() {
  const [mentorships, setMentorships] = useState<Mentorship[]>([]);
  const [publicMentorships, setPublicMentorships] = useState<Mentorship[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchMentorships = useCallback(async () => {
    const session = await getSession();
    if (!session) { setLoading(false); return; }
    setUserId(session.user.id);
    const [mRes, mmRes] = await Promise.all([
      supabase.from("mentorships").select("*"),
      supabase.from("mentorship_members").select("*"),
    ]);
    const allM = mRes.data || [];
    const allMM = mmRes.data || [];
    const myMembershipIds = new Set(allMM.filter(mm => mm.user_id === session.user.id).map(mm => mm.mentorship_id));
    const mapped: Mentorship[] = allM.map(m => ({
      id: m.id, name: m.name, mentorId: m.mentor_id, type: (m.type || "1-to-1") as Mentorship["type"],
      inviteCode: m.invite_code, description: (m as any).description || "", visibility: ((m as any).visibility || "invite-only") as Mentorship["visibility"],
      permissions: (m.permissions as any) || {}, createdAt: m.created_at,
      menteeIds: allMM.filter(mm => mm.mentorship_id === m.id).map(mm => mm.user_id),
      messages: [],
    }));
    setMentorships(mapped.filter(m => m.mentorId === session.user.id || myMembershipIds.has(m.id)));
    setPublicMentorships(mapped.filter(m => m.visibility === "public" && m.mentorId !== session.user.id && !myMembershipIds.has(m.id)));
    setLoading(false);
  }, []);

  useEffect(() => { fetchMentorships(); }, [fetchMentorships]);
  useDataChangeListener(fetchMentorships);

  const createMentorship = useCallback(async (data: { name: string; type: "1-to-1" | "small-group" | "cohort"; description?: string; visibility?: "public" | "invite-only" }) => {
    if (!userId) return null;
    const id = crypto.randomUUID();
    const inviteCode = generateInviteCode("MNT");
    await (supabase.from("mentorships") as any).insert({
      id, name: data.name, type: data.type, mentor_id: userId, invite_code: inviteCode,
      description: data.description || "", visibility: data.visibility || "invite-only",
    });
    await supabase.from("mentorship_members").insert({ mentorship_id: id, user_id: userId });
    const newM: Mentorship = {
      id, name: data.name, mentorId: userId, menteeIds: [], type: data.type,
      inviteCode, description: data.description || "", visibility: data.visibility || "invite-only",
      permissions: {}, messages: [], createdAt: new Date().toISOString(),
    };
    setMentorships(prev => [...prev, newM]);
    return newM;
  }, [userId]);

  const deleteMentorship = useCallback((id: string) => {
    setMentorships(prev => prev.filter(m => m.id !== id));
    supabase.from("mentorships").delete().eq("id", id);
  }, []);

  const joinByCode = useCallback(async (code: string) => {
    if (!userId) return false;
    const { data: mentorship } = await (supabase.from("mentorships") as any).select("*").eq("invite_code", code).single();
    if (!mentorship) return false;
    await supabase.from("mentorship_members").insert({ mentorship_id: mentorship.id, user_id: userId });
    // Refresh
    const newM: Mentorship = {
      id: mentorship.id, name: mentorship.name, mentorId: mentorship.mentor_id,
      menteeIds: [userId], type: mentorship.type, inviteCode: mentorship.invite_code,
      description: mentorship.description || "", visibility: mentorship.visibility || "invite-only",
      permissions: {}, messages: [], createdAt: mentorship.created_at,
    };
    setMentorships(prev => [...prev, newM]);
    return true;
  }, [userId]);

  const addMessage = useCallback((_mentorshipId: string, _message: Omit<MentorshipMessage, "id" | "createdAt">) => {
    // Simplified - would need a messages table for real persistence
  }, []);

  return { mentorships, publicMentorships, createMentorship, deleteMentorship, addMessage, joinByCode, loading };
}

// ==================== NOTIFICATIONS ====================
export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const session = await getSession();
    if (!session) { setLoading(false); return; }
    setUserId(session.user.id);
    const { data } = await supabase.from("notifications").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
    if (data) {
      setNotifications(data.map((n: any) => ({
        id: n.id, type: n.type, message: n.message, time: n.created_at,
        read: n.read ?? false, status: (n.status || undefined) as AppNotification["status"],
        actionType: (n.action_type || undefined) as AppNotification["actionType"],
        actionId: n.action_id || undefined, actionCode: n.action_code || undefined,
        groupId: n.group_id || undefined,
        messageId: n.message_id || undefined,
        conversationId: n.conversation_id || undefined,
        programId: n.program_id || undefined,
        activityId: n.activity_id || undefined,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useDataChangeListener(fetchNotifications);

  const addNotification = useCallback((notif: Omit<AppNotification, "id">) => {
    if (!userId) return;
    const id = crypto.randomUUID();
    setNotifications(prev => [{ ...notif, id }, ...prev]);
    supabase.from("notifications").insert({
      id, user_id: userId, type: notif.type, message: notif.message,
      read: false, action_type: notif.actionType || "", action_id: notif.actionId || "", action_code: notif.actionCode || "",
    });
  }, [userId]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    supabase.from("notifications").update({ read: true }).eq("id", id).then(() => notifyDataChange());
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (userId) supabase.from("notifications").update({ read: true }).eq("user_id", userId).then(() => notifyDataChange());
  }, [userId]);

  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    supabase.from("notifications").delete().eq("id", id).then(() => notifyDataChange());
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    if (userId) supabase.from("notifications").delete().eq("user_id", userId).then(() => notifyDataChange());
  }, [userId]);

  const updateNotificationStatus = useCallback((id: string, status: "joined" | "declined") => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, status, read: true } : n));
    supabase.from("notifications").update({ status, read: true }).eq("id", id).then(() => notifyDataChange());
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, addNotification, markAsRead, markAllRead, deleteNotification, clearAllNotifications, updateNotificationStatus, unreadCount };
}

// ==================== PRAYER POINTS ====================
export function usePrayerPoints() {
  const [prayers, setPrayers] = useState<PrayerPoint[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPrayers = useCallback(async () => {
    const session = await getSession();
    if (!session) { setLoading(false); return; }
    setUserId(session.user.id);
    const { data } = await supabase.from("prayer_points").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
    if (data) {
      setPrayers(data.map(r => ({
        id: r.id, title: r.title, description: r.description || "",
        category: (r.category || "personal") as PrayerPoint["category"],
        status: (r.status || "active") as PrayerPoint["status"],
        reflections: (r.reflections as any[]) || [], createdAt: r.created_at,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPrayers(); }, [fetchPrayers]);
  useDataChangeListener(fetchPrayers);

  const addPrayer = useCallback(async (data: { title: string; description: string; category: PrayerPoint["category"] }) => {
    if (!userId) return null;
    const id = crypto.randomUUID();
    const newPrayer: PrayerPoint = { id, ...data, status: "active", reflections: [], createdAt: new Date().toISOString() };
    setPrayers(prev => [newPrayer, ...prev]);
    await supabase.from("prayer_points").insert({
      id, user_id: userId, title: data.title, description: data.description, category: data.category, status: "active", reflections: [],
    });
    notifyDataChange();
    return newPrayer;
  }, [userId]);

  const updatePrayerStatus = useCallback((id: string, status: PrayerPoint["status"]) => {
    setPrayers(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    supabase.from("prayer_points").update({ status }).eq("id", id);
  }, []);

  const addReflection = useCallback((prayerId: string, text: string) => {
    const reflection = { id: crypto.randomUUID(), text, date: new Date().toISOString() };
    setPrayers(prev => {
      const updated = prev.map(p => p.id === prayerId ? { ...p, reflections: [...p.reflections, reflection] } : p);
      const prayer = updated.find(p => p.id === prayerId);
      if (prayer) supabase.from("prayer_points").update({ reflections: prayer.reflections as any }).eq("id", prayerId);
      return updated;
    });
  }, []);

  const deletePrayer = useCallback((id: string) => {
    setPrayers(prev => prev.filter(p => p.id !== id));
    supabase.from("prayer_points").delete().eq("id", id);
  }, []);

  return { prayers, addPrayer, updatePrayerStatus, addReflection, deletePrayer, loading };
}

// ==================== JOURNAL ====================
export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchJournal = useCallback(async () => {
    const session = await getSession();
    if (!session) { setLoading(false); return; }
    setUserId(session.user.id);
    const { data } = await supabase.from("journal_entries").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
    if (data) {
      setEntries(data.map(r => ({
        id: r.id, title: r.title, content: r.content || "", createdAt: r.created_at, updatedAt: r.updated_at,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchJournal(); }, [fetchJournal]);
  useDataChangeListener(fetchJournal);

  const addEntry = useCallback(async (data: { title: string; content: string }) => {
    if (!userId) return null;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newEntry: JournalEntry = { id, ...data, createdAt: now, updatedAt: now };
    setEntries(prev => [newEntry, ...prev]);
    await supabase.from("journal_entries").insert({ id, user_id: userId, title: data.title, content: data.content });
    notifyDataChange();
    return newEntry;
  }, [userId]);

  const updateEntry = useCallback(async (id: string, updates: { title?: string; content?: string }) => {
    const now = new Date().toISOString();
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates, updatedAt: now } : e));
    await supabase.from("journal_entries").update({ ...updates, updated_at: now }).eq("id", id);
    notifyDataChange();
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    await supabase.from("journal_entries").delete().eq("id", id);
    notifyDataChange();
  }, []);

  return { entries, addEntry, updateEntry, deleteEntry, loading };
}

// ==================== BIBLE VERSES ====================
const bibleVerses = [
  { text: "I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit.", ref: "John 15:5" },
  { text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you.", ref: "Jeremiah 29:11" },
  { text: "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you.", ref: "Joshua 1:9" },
  { text: "Trust in the Lord with all your heart and lean not on your own understanding.", ref: "Proverbs 3:5" },
  { text: "The Lord is my shepherd, I lack nothing.", ref: "Psalm 23:1" },
  { text: "I can do all this through him who gives me strength.", ref: "Philippians 4:13" },
  { text: "And we know that in all things God works for the good of those who love him.", ref: "Romans 8:28" },
  { text: "Come to me, all you who are weary and burdened, and I will give you rest.", ref: "Matthew 11:28" },
  { text: "The Lord is my light and my salvation—whom shall I fear?", ref: "Psalm 27:1" },
  { text: "But those who hope in the Lord will renew their strength.", ref: "Isaiah 40:31" },
];

export function getDailyVerses() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const morningIdx = (dayOfYear * 2) % bibleVerses.length;
  const eveningIdx = (dayOfYear * 2 + 1) % bibleVerses.length;
  const hour = new Date().getHours();
  return {
    morning: bibleVerses[morningIdx],
    evening: bibleVerses[eveningIdx],
    current: hour < 17 ? bibleVerses[morningIdx] : bibleVerses[eveningIdx],
    period: hour < 17 ? "Morning" : "Evening",
  };
}
