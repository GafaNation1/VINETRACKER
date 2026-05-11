// Landing page for shared invite links of the form /invite/:kind/:code
// Looks up the entity by code (via secure RPC) and lets the signed-in user join.
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGroups, usePrograms } from "@/lib/store";
import { Loader2, ArrowLeft, Users } from "lucide-react";
import { toast } from "sonner";

const InviteAcceptPage = () => {
  const { kind, code } = useParams<{ kind: string; code: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { joinGroupByCode } = useGroups();
  const { joinByCode } = usePrograms();

  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState<{ id: string; name: string; description: string; visibility: string } | null>(null);
  const [error, setError] = useState<string>("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Save the invite for after login
      try { sessionStorage.setItem("vine:pendingInvite", `/invite/${kind}/${code}`); } catch { /* ignore */ }
      navigate("/login", { replace: true });
      return;
    }
    if (!code || !kind) { setError("Invalid invite link"); setLoading(false); return; }

    (async () => {
      const fn = kind === "program"
        ? "find_program_by_invite"
        : kind === "mentorship"
        ? "find_mentorship_by_invite"
        : "find_group_by_invite";
      const { data, error } = await (supabase as any).rpc(fn, { _code: code });
      if (error || !data || data.length === 0) {
        setError("This invite link is invalid or has expired.");
      } else {
        setEntity(data[0]);
      }
      setLoading(false);
    })();
  }, [authLoading, user, kind, code, navigate]);

  const handleJoin = async () => {
    if (!entity || !code) return;
    setJoining(true);
    let ok = false;
    if (kind === "program") ok = await joinByCode(code);
    else ok = await joinGroupByCode(code);
    setJoining(false);
    if (ok) {
      toast.success(`Joined ${entity.name}!`);
      navigate(kind === "program" ? "/programs" : "/groups", { replace: true });
    } else {
      toast.error("Could not join. You may already be a member.");
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-5 pt-14 pb-24">
      <button onClick={() => navigate("/")} className="rounded-full border border-border bg-card p-2 mb-6 hover:bg-secondary">
        <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
      </button>

      {error ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm font-semibold mb-1">Invite unavailable</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <button onClick={() => navigate("/")} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Go home</button>
        </div>
      ) : entity ? (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{kind} invite</p>
              <h1 className="text-lg font-bold truncate">{entity.name}</h1>
            </div>
          </div>
          {entity.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{entity.description}</p>
          )}
          <button onClick={handleJoin} disabled={joining}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
            {joining ? "Joining…" : `Join ${kind}`}
          </button>
          <button onClick={() => navigate("/")}
            className="w-full rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary">
            Not now
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default InviteAcceptPage;
