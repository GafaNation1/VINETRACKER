import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft, ChevronRight, Megaphone, HelpCircle, Shield, FileText, Database,
  Bell, UserCog, Lock, BookOpen, Plus, Trash2, X, Check, MessageSquare, Mail, Bug,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  isPushSupported, requestPushPermission, subscribeToPush, unsubscribeFromPush,
} from "@/lib/pushNotifications";
import { motion } from "framer-motion";

// ---------- TYPES ----------
interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  author_id: string;
}

interface NotifPrefs {
  group_chat: boolean;
  program_updates: boolean;
  activity_reminders: boolean;
  announcements: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  group_chat: true,
  program_updates: true,
  activity_reminders: true,
  announcements: true,
};

// ---------- STATIC CONTENT ----------
const FAQ_ITEMS = [
  { q: "How does spiritual progress work?", a: "Your Spiritual Growth Score is calculated from a weighted blend of prayer, Bible study, fasting, completed activities, and journal reflections over the last 30 days. It updates automatically as you log activities." },
  { q: "How are activities tracked?", a: "When you log an activity, it appears under Daily, Weekly, or Monthly goals based on its duration. Completed activities move automatically to the Completed section." },
  { q: "How do groups function?", a: "Groups allow members to share a real-time chat, view a shared description, and keep their own private notes. Group admins can moderate, edit the description, and delete the group." },
  { q: "How do programs function?", a: "Programs are time-bound discipleship plans. Progress is calculated from start and end dates. The owner can broadcast teaching messages and post notes; participants read along." },
  { q: "How do notifications work?", a: "Notifications appear in the in-app Notification Center and, when enabled, as device push notifications. You control them in Settings → Notification Settings." },
  { q: "How does offline mode work?", a: "Bible chapters you've opened are cached locally for offline reading. Activities and journal entries you create offline are queued and synced automatically when you reconnect." },
];

const PRIVACY = `Vine Tracker is committed to protecting your privacy. We collect only the information needed to provide you a personalized spiritual growth experience: your name, email, profile photo, the activities you log, your prayers, journal entries, group memberships, and program participation.

Your data is stored securely on encrypted servers. Personal logs, prayers, journals, and notes are private to you and never shown to other users unless you explicitly share them through a group or program.

We do not sell your data. We do not share it with advertisers. Aggregated, anonymized usage statistics may be used to improve the platform.`;

const PERSONAL_DATA = `Your personal data is used strictly to support your spiritual growth journey:
• Profile data (name, photo, title) — to personalize your experience
• Activity logs — to compute streaks, growth scores, and analytics
• Engagement data — to remind you of upcoming activities and inform your dashboard
• Group/program memberships — to deliver relevant chat messages and updates

You can edit your profile information at any time from Settings → Account Management.`;

const SECURITY = `We protect your account with industry-standard practices:
• Secure authentication using Supabase Auth (with optional Google sign-in)
• All communication between your device and our servers is encrypted (HTTPS/TLS)
• Database access is governed by Row Level Security so users can only see their own private data
• Passwords are never stored in plain text
• We recommend enabling device biometric lock for an extra layer of safety`;

const TERMS = `By using Vine Tracker you agree to:
• Treat all members with kindness and respect — this is a faith community, not a debate forum
• Refrain from sharing phone numbers, email addresses, or external links inside groups and programs (these are auto-filtered)
• Avoid posting content that is hateful, sexually explicit, illegal, or unrelated to spiritual growth
• Respect the moderation decisions of group admins and program owners
• Use the platform for personal spiritual discipline tracking and authentic community

Violations may result in content removal, group removal, or account suspension.`;

// ---------- COMPONENT ----------
const SettingsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, signOut } = useAuth();
  const uid = authUser?.id || "";

  const initialSection =
    (location.state as { section?: string } | null)?.section || "menu";
  const [section, setSection] = useState<string>(initialSection);
  const [isAdmin, setIsAdmin] = useState(false);

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", content: "" });

  // Notification prefs state
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [pushEnabled, setPushEnabled] = useState(false);

  // Account
  const [displayName, setDisplayName] = useState(authUser?.user_metadata?.full_name || "");

  // FAQ open
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Contact & Support form
  const [supportKind, setSupportKind] = useState<"feedback" | "bug">("feedback");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSubmitting, setSupportSubmitting] = useState(false);

  const submitSupport = async () => {
    if (!uid) { toast.error("You must be signed in"); return; }
    if (!supportMessage.trim()) { toast.error("Please write a message"); return; }
    setSupportSubmitting(true);
    const { error } = await (supabase.from("feedback") as any).insert({
      user_id: uid,
      category: supportKind,
      kind: supportKind,
      subject: supportSubject.trim().slice(0, 200),
      message: supportMessage.trim().slice(0, 5000),
    });
    setSupportSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(supportKind === "bug" ? "Bug report sent. Thank you!" : "Feedback sent. Thank you!");
    setSupportSubject("");
    setSupportMessage("");
  };

  // ---- LOADERS ----
  const loadAdmin = useCallback(async () => {
    if (!uid) return;
    const { data } = await (supabase.from("user_roles") as any)
      .select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
    setIsAdmin(!!data);
  }, [uid]);

  const loadAnnouncements = useCallback(async () => {
    const { data } = await (supabase.from("announcements") as any)
      .select("*").order("created_at", { ascending: false });
    if (data) setAnnouncements(data);
  }, []);

  const loadPrefs = useCallback(async () => {
    if (!uid) return;
    const { data } = await (supabase.from("notification_preferences") as any)
      .select("*").eq("user_id", uid).maybeSingle();
    if (data) {
      setPrefs({
        group_chat: data.group_chat,
        program_updates: data.program_updates,
        activity_reminders: data.activity_reminders,
        announcements: data.announcements,
      });
    }
  }, [uid]);

  const loadPushState = useCallback(async () => {
    if (!(await isPushSupported())) { setPushEnabled(false); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushEnabled(!!sub);
    } catch { setPushEnabled(false); }
  }, []);

  useEffect(() => {
    loadAdmin();
    loadAnnouncements();
    loadPrefs();
    loadPushState();
    // realtime for announcements
    const channel = supabase.channel("announcements-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => loadAnnouncements())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadAdmin, loadAnnouncements, loadPrefs, loadPushState]);

  // ---- HANDLERS ----
  const togglePref = async (key: keyof NotifPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    if (uid) {
      await (supabase.from("notification_preferences") as any).upsert(
        { user_id: uid, ...next, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    }
  };

  const togglePush = async () => {
    if (!uid) return;
    if (pushEnabled) {
      await unsubscribeFromPush();
      setPushEnabled(false);
      toast.success("Push notifications disabled");
      return;
    }
    const perm = await requestPushPermission();
    if (perm !== "granted") {
      toast.error("Notification permission denied");
      return;
    }
    const ok = await subscribeToPush(uid);
    if (ok) {
      setPushEnabled(true);
      toast.success("Push notifications enabled");
    } else {
      toast.error("Push notifications aren't supported in this preview. Open the published app on your device to enable.");
    }
  };

  const publishAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      toast.error("Add a title and message"); return;
    }
    const { error } = await (supabase.from("announcements") as any).insert({
      title: newAnnouncement.title.trim(),
      content: newAnnouncement.content.trim(),
      author_id: uid,
    });
    if (error) { toast.error(error.message); return; }
    setNewAnnouncement({ title: "", content: "" });
    setShowCreateAnnouncement(false);
    toast.success("Announcement published");
    loadAnnouncements();
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await (supabase.from("announcements") as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    loadAnnouncements();
  };

  const updateName = async () => {
    if (!uid) return;
    await supabase.from("profiles").update({ full_name: displayName }).eq("id", uid);
    toast.success("Name updated");
  };

  const clearCache = async () => {
    try {
      // Clear Bible chapter cache (IndexedDB)
      indexedDB.deleteDatabase("vine-tracker-offline");
      // Clear cached SW
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      toast.success("Local cache cleared");
    } catch {
      toast.error("Could not clear cache");
    }
  };

  // ---------- RENDER ----------
  const goBack = () => {
    if (section === "menu") navigate("/profile");
    else setSection("menu");
  };

  const sectionTitle: Record<string, string> = {
    menu: "Settings",
    account: "Account Management",
    notifications: "Notification Settings",
    storage: "Data & Storage",
    announcements: "Platform Announcements",
    support: "Contact & Support",
    faq: "Frequently Asked Questions",
    privacy: "Privacy Policy",
    personal: "Personal Data Usage",
    security: "Security Information",
    terms: "Terms of Use",
  };

  const menuItems: { key: string; icon: typeof UserCog; label: string; sub: string }[] = [
    { key: "account", icon: UserCog, label: "Account Management", sub: "Update your name and login info" },
    { key: "notifications", icon: Bell, label: "Notification Settings", sub: "Control reminders and alerts" },
    { key: "storage", icon: Database, label: "Data & Storage", sub: "Manage offline cache" },
    { key: "announcements", icon: Megaphone, label: "Platform Announcements", sub: `${announcements.length} updates` },
    { key: "support", icon: MessageSquare, label: "Contact & Support", sub: "Send feedback or report a bug" },
    { key: "faq", icon: HelpCircle, label: "FAQ", sub: "Common questions" },
    { key: "privacy", icon: Lock, label: "Privacy Policy", sub: "How we handle your data" },
    { key: "personal", icon: BookOpen, label: "Personal Data Usage", sub: "What we collect and why" },
    { key: "security", icon: Shield, label: "Security Information", sub: "How we protect you" },
    { key: "terms", icon: FileText, label: "Terms of Use", sub: "Community guidelines" },
  ];

  return (
    <div className="min-h-screen pb-24">
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="rounded-full border border-border bg-card p-2 hover:bg-secondary transition-colors">
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </button>
          <h1 className="text-xl font-bold tracking-tight">{sectionTitle[section]}</h1>
        </div>
      </div>

      <div className="px-5 space-y-3">
        {section === "menu" && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {menuItems.map((m, i, arr) => (
              <button key={m.key} onClick={() => setSection(m.key)}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent ${i < arr.length - 1 ? "border-b border-border" : ""}`}>
                <m.icon className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.7} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{m.sub}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {section === "account" && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">Display Name</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary/30" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <input type="email" value={authUser?.email || ""} disabled
                className="mt-1 w-full rounded-xl border border-input bg-muted px-3 py-2 text-sm text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground mt-1">Email is linked to your sign-in provider and can't be changed here.</p>
            </div>
            <button onClick={updateName} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">Save Changes</button>
            <button onClick={async () => { await signOut(); navigate("/login"); }}
              className="w-full rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary">Sign Out</button>
          </div>
        )}

        {section === "notifications" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Push Notifications</p>
                  <p className="text-[11px] text-muted-foreground">Receive alerts on this device when the app is closed</p>
                </div>
                <button onClick={togglePush}
                  className={`relative h-6 w-11 rounded-full transition-colors ${pushEnabled ? "bg-primary" : "bg-secondary"}`}>
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${pushEnabled ? "translate-x-5" : ""}`} />
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notify me about</p>
              {([
                { key: "group_chat" as const, label: "New group messages" },
                { key: "program_updates" as const, label: "Program announcements" },
                { key: "activity_reminders" as const, label: "Activity reminders" },
                { key: "announcements" as const, label: "Platform announcements" },
              ]).map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <span className="text-sm">{item.label}</span>
                  <button onClick={() => togglePref(item.key)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${prefs[item.key] ? "bg-primary" : "bg-secondary"}`}>
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${prefs[item.key] ? "translate-x-5" : ""}`} />
                  </button>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground pt-2">These preferences apply across all devices where you're signed in.</p>
            </div>
          </div>
        )}

        {section === "storage" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
              <p className="text-sm font-semibold">Local storage</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Vine Tracker keeps a small offline cache so you can read previously-opened Bible chapters without internet.
                Activities and journal entries you create offline are queued locally and sync when you reconnect.
              </p>
            </div>
            <button onClick={clearCache}
              className="w-full rounded-xl border border-destructive/15 bg-card py-3 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors">
              Clear local cache
            </button>
          </div>
        )}

        {section === "announcements" && (
          <div className="space-y-3">
            {isAdmin && (
              <div className="rounded-2xl border border-primary/15 bg-accent p-4">
                {showCreateAnnouncement ? (
                  <div className="space-y-2">
                    <input type="text" value={newAnnouncement.title}
                      onChange={e => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                      placeholder="Announcement title"
                      className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none" />
                    <textarea value={newAnnouncement.content}
                      onChange={e => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                      placeholder="Write your announcement..." rows={4}
                      className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => setShowCreateAnnouncement(false)}
                        className="flex-1 rounded-xl border border-border py-2 text-xs font-medium">Cancel</button>
                      <button onClick={publishAnnouncement}
                        className="flex-1 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground">Publish</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowCreateAnnouncement(true)}
                    className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-primary">
                    <Plus className="h-4 w-4" /> New announcement
                  </button>
                )}
              </div>
            )}
            {announcements.length > 0 ? announcements.map(a => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => deleteAnnouncement(a.id)} className="rounded-lg p-1 hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  )}
                </div>
                <p className="text-sm mt-2 whitespace-pre-wrap leading-relaxed text-foreground/90">{a.content}</p>
              </motion.div>
            )) : (
              <div className="rounded-2xl border border-border bg-card p-6 text-center">
                <Megaphone className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No announcements yet</p>
              </div>
            )}
          </div>
        )}

        {section === "support" && (
          <div className="space-y-3">
            <a href="mailto:vinetrackerofficial@gmail.com"
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-accent transition-colors">
              <Mail className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Email us</p>
                <p className="text-[11px] text-muted-foreground truncate">vinetrackerofficial@gmail.com</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </a>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex gap-2">
                <button onClick={() => setSupportKind("feedback")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${supportKind === "feedback" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  <MessageSquare className="h-3.5 w-3.5" /> Feedback
                </button>
                <button onClick={() => setSupportKind("bug")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${supportKind === "bug" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  <Bug className="h-3.5 w-3.5" /> Bug report
                </button>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Subject (optional)</label>
                <input type="text" value={supportSubject} onChange={e => setSupportSubject(e.target.value)} maxLength={200}
                  placeholder={supportKind === "bug" ? "What broke?" : "Brief summary"}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary/30" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Message</label>
                <textarea value={supportMessage} onChange={e => setSupportMessage(e.target.value)} rows={5} maxLength={5000}
                  placeholder={supportKind === "bug" ? "Steps to reproduce, what you expected, what happened…" : "Tell us what you think…"}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none resize-none focus:border-primary/30" />
              </div>
              <button onClick={submitSupport} disabled={supportSubmitting}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {supportSubmitting ? "Sending…" : supportKind === "bug" ? "Send bug report" : "Send feedback"}
              </button>
              <p className="text-[10px] text-muted-foreground text-center">We read every message. Replies (if needed) come from vinetrackerofficial@gmail.com.</p>
            </div>
          </div>
        )}

        {section === "faq" && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className={i < FAQ_ITEMS.length - 1 ? "border-b border-border" : ""}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-accent">
                  <span className="text-sm font-medium">{item.q}</span>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${openFaq === i ? "rotate-90" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{item.a}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {section === "privacy" && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">{PRIVACY}</p>
          </div>
        )}
        {section === "personal" && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">{PERSONAL_DATA}</p>
          </div>
        )}
        {section === "security" && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">{SECURITY}</p>
          </div>
        )}
        {section === "terms" && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">{TERMS}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
