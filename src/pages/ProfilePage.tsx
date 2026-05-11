import { useUserProfile, useGroups, usePrograms } from "@/lib/store";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Book, Calendar, Heart, LogOut, Bell, ChevronRight, Camera, Sun, Moon, BarChart3, Trash2, Edit, X, Settings } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useRef, useState } from "react";

const deleteReasons = ["I no longer need the app", "I prefer another tool", "Privacy concerns", "Other"];

const ProfilePage = () => {
  const navigate = useNavigate();
  const { signOut, user: authUser } = useAuth();
  const { user, updateUser } = useUserProfile();
  // Streaks UI removed
  const { groups } = useGroups();
  const { programs } = usePrograms();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  // streak form state removed
  const [editingTitle, setEditingTitle] = useState(false);

  const uid = authUser?.id || "";
  const hasResources = groups.some(g => g.ownerId === uid) || programs.some(p => p.ownerId === uid);
  const displayName = user.fullName || authUser?.user_metadata?.full_name || "User";
  const displayEmail = user.email || authUser?.email || "";

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Create canvas for cropping/resizing
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = Math.min(img.width, img.height);
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256);
        const croppedUrl = canvas.toDataURL("image/jpeg", 0.85);
        updateUser({ avatar: croppedUrl });
        toast.success("Photo updated!");
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSignOut = async () => { await signOut(); toast.success("Signed out"); navigate("/login"); };
  const handleDeleteAccount = () => {
    if (deleteConfirmText !== "DELETE") { toast.error('Type "DELETE" to confirm'); return; }
    toast.success("Account deleted. God bless you.");
    signOut(); navigate("/login");
  };

  // streak handlers removed

  return (
    <div className="min-h-screen pb-24">
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-6 space-y-4">
            <h2 className="text-lg font-bold text-center">Delete Account</h2>
            <p className="text-sm text-muted-foreground text-center">This action cannot be undone.</p>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Why are you leaving?</label>
              <div className="mt-2 space-y-1.5">
                {deleteReasons.map(r => (
                  <button key={r} onClick={() => setDeleteReason(r)}
                    className={`w-full rounded-xl py-2.5 px-3 text-sm text-left transition-all ${deleteReason === r ? "bg-destructive/10 text-destructive border border-destructive/20" : "border border-border hover:bg-secondary"}`}>{r}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Type "DELETE" to confirm</label>
              <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE" className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-destructive/30" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteDialog(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={handleDeleteAccount} className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 pt-14 pb-6 text-center">
        <div className="relative mx-auto w-fit">
          <Avatar className="h-20 w-20 border-2 border-primary/20">
            {user.avatar ? <AvatarImage src={user.avatar} alt={displayName} /> : null}
            <AvatarFallback className="bg-accent text-accent-foreground text-2xl font-bold">
              {displayName.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
            <Camera className="h-3.5 w-3.5" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight">{displayName}</h1>
        <p className="text-sm text-muted-foreground">{displayEmail}</p>
        <p className="text-xs text-muted-foreground">{user.church}</p>

        {/* Editable spiritual level title */}
        {editingTitle ? (
          <div className="mt-2 flex items-center justify-center gap-2">
            <input type="text" value={user.spiritualLevel}
              onChange={e => updateUser({ spiritualLevel: e.target.value })}
              onKeyDown={e => e.key === "Enter" && setEditingTitle(false)}
              className="rounded-full border border-primary/30 bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground outline-none text-center w-48" autoFocus />
            <button onClick={() => setEditingTitle(false)} className="text-primary"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => setEditingTitle(true)} className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground hover:bg-accent/80 transition-colors">
            {user.spiritualLevel}
            <Edit className="h-2.5 w-2.5 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="px-5 space-y-5">
        {/* Spiritual Streaks section removed */}

        {/* Theme */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Theme</h3>
          <div className="flex gap-2">
            {[{ value: "light" as const, label: "Light", icon: Sun }, { value: "dark" as const, label: "Dark", icon: Moon }].map(t => (
              <button key={t.value} onClick={() => updateUser({ theme: t.value })}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-medium transition-all ${user.theme === t.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                <t.icon className="h-3.5 w-3.5" />{t.label}
              </button>
            ))}
          </div>
        </div>

        {hasResources && (
          <button onClick={() => navigate("/dashboard")} className="flex w-full items-center gap-3 rounded-2xl border border-primary/15 bg-accent p-4 text-left transition-colors hover:bg-accent/80">
            <BarChart3 className="h-5 w-5 text-primary" />
            <div className="flex-1"><p className="text-sm font-semibold">Creator Dashboard</p><p className="text-[10px] text-muted-foreground">Manage groups, programs & analytics</p></div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {[
            { icon: Calendar, label: "Spiritual Calendar", to: "/calendar" },
            { icon: Heart, label: "Prayer", to: "/prayer" },
            { icon: Book, label: "Bible", to: "/bible" },
            { icon: Bell, label: "Notifications", to: "/notifications" },
            { icon: Settings, label: "Settings", to: "/settings" },
          ].map((item, i, arr) => (
            <button key={item.label} onClick={() => navigate(item.to)}
              className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent ${i < arr.length - 1 ? "border-b border-border" : ""}`}>
              <item.icon className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.7} />
              <span className="flex-1 text-sm font-medium">{item.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Account</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Display Name</label>
              <input type="text" value={user.fullName} onChange={e => updateUser({ fullName: e.target.value, name: e.target.value.split(" ")[0] })}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary/30" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <input type="email" value={displayEmail} disabled className="mt-1 w-full rounded-xl border border-input bg-muted px-3 py-2 text-sm text-muted-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Custom Greeting</label>
              <input type="text" value={user.greeting} onChange={e => updateUser({ greeting: e.target.value })}
                placeholder="e.g., Blessed morning" className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary/30" />
            </div>
          </div>
        </div>

        <button onClick={handleSignOut} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/15 bg-card py-3.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5">
          <LogOut className="h-4 w-4" />Sign Out
        </button>
        <button onClick={() => setShowDeleteDialog(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs text-muted-foreground hover:text-destructive transition-colors mb-4">
          <Trash2 className="h-3.5 w-3.5" />Delete Account
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
