import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Trash2, X } from "lucide-react";
import { useNotifications, useGroups, usePrograms } from "@/lib/store";
import { toast } from "sonner";

const iconMap: Record<string, string> = {
  reminder: "⏰",
  group: "👥",
  dm: "✉️",
  program: "📋",
  announcement: "📢",
  prayer: "🙏",
  "invite-group": "📨",
  "invite-program": "📨",
  "invite-mentorship": "📨",
  feedback: "💬",
  welcome: "🌿",
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { notifications, markAsRead, markAllRead, deleteNotification, clearAllNotifications, updateNotificationStatus } = useNotifications();
  const { joinGroupByCode } = useGroups();
  const { joinByCode } = usePrograms();

  const handleJoin = (notif: typeof notifications[0]) => {
    if (notif.actionType === "join-group" && notif.actionCode) {
      joinGroupByCode(notif.actionCode);
      toast.success("Joined group!");
    } else if (notif.actionType === "join-program" && notif.actionCode) {
      joinByCode(notif.actionCode);
      toast.success("Joined program!");
    }
    updateNotificationStatus(notif.id, "joined");
  };

  const handleDecline = (notif: typeof notifications[0]) => {
    updateNotificationStatus(notif.id, "declined");
    toast.info("Invitation declined");
  };

  const handleOpen = (notif: typeof notifications[0]) => {
    if (!notif.read) markAsRead(notif.id);
    // Stash a deep-link target so target pages can auto-open the right item.
    try {
      const target: Record<string, string | undefined> = {
        groupId: notif.groupId,
        messageId: notif.messageId,
        conversationId: notif.conversationId,
        programId: notif.programId,
        activityId: notif.activityId,
        actionType: notif.actionType,
      };
      sessionStorage.setItem("vine:deepLink", JSON.stringify(target));
    } catch { /* ignore */ }

    if (notif.actionType === "open-group") navigate("/groups");
    else if (notif.actionType === "open-dm") navigate("/groups");
    else if (notif.actionType === "open-program") navigate("/programs");
    else if (notif.actionType === "open-activity" && notif.activityId) navigate(`/activity/${notif.activityId}`);
    else if (notif.actionType === "open-announcement") navigate("/settings", { state: { section: "announcements" } });
  };

  const formatTime = (time: string) => {
    try {
      const date = new Date(time);
      if (isNaN(date.getTime())) return time;
      const diff = Date.now() - date.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins} min ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return date.toLocaleDateString();
    } catch { return time; }
  };

  return (
    <div className="min-h-screen">
      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="rounded-full border border-border bg-card p-2 transition-colors hover:bg-secondary">
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </button>
          <h1 className="text-xl font-bold tracking-tight flex-1">Notifications</h1>
          <div className="flex gap-2">
            <button onClick={markAllRead} className="text-xs font-medium text-primary">Mark all read</button>
            {notifications.length > 0 && (
              <button onClick={() => { clearAllNotifications(); toast.success("All cleared"); }} className="text-xs font-medium text-destructive">Clear all</button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {notifications.length > 0 ? notifications.map((notif) => {
            const isOpenable = notif.actionType?.startsWith("open-");
            return (
              <div key={notif.id}
                className={`rounded-2xl border p-4 transition-colors ${notif.read ? "border-border bg-card" : "border-primary/15 bg-accent"}`}>
                <div className="flex items-start gap-3">
                  <div
                    onClick={isOpenable ? () => handleOpen(notif) : undefined}
                    className={`flex flex-1 items-start gap-3 ${isOpenable ? "cursor-pointer" : ""}`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-base flex-shrink-0">
                      {iconMap[notif.type] || "🔔"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${notif.read ? "" : "font-semibold"}`}>{notif.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatTime(notif.time)}</p>

                      {notif.status === "joined" && (
                        <span className="mt-1.5 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">Joined ✓</span>
                      )}
                      {notif.status === "declined" && (
                        <span className="mt-1.5 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Declined</span>
                      )}

                      {notif.actionType?.startsWith("join-") && !notif.status && (
                        <div className="mt-2 flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); handleJoin(notif); }}
                            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                            <Check className="h-3 w-3" /> Join
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDecline(notif); }}
                            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary">
                            <X className="h-3 w-3" /> Decline
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!notif.read && !notif.actionType?.startsWith("join-") && (
                      <button onClick={() => markAsRead(notif.id)} className="rounded-lg p-1.5 hover:bg-secondary" aria-label="Mark as read">
                        <span className="h-2 w-2 rounded-full bg-primary block" />
                      </button>
                    )}
                    <button onClick={() => { deleteNotification(notif.id); toast.success("Deleted"); }}
                      className="rounded-lg p-1.5 hover:bg-destructive/10 transition-colors" aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="flex flex-col items-center py-16 text-center">
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
