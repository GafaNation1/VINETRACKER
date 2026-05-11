// Tracks groups/programs that were deleted while the current user was a member.
// Used by GroupsPage / ProgramsPage to show a "Deleted" frozen card.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DeletedEntity {
  id: string;
  name: string;
  deleted_at: string;
}

export function useDeletedGroups() {
  const { user } = useAuth();
  const [items, setItems] = useState<DeletedEntity[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await (supabase.from("deleted_groups") as any)
      .select("id, name, deleted_at")
      .order("deleted_at", { ascending: false });
    if (data) setItems(data);
  }, [user?.id]);

  useEffect(() => {
    load();
    if (!user?.id) return;
    const ch = supabase.channel("deleted-groups-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "deleted_groups" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, user?.id]);

  const dismiss = useCallback(async (id: string) => {
    setItems(prev => prev.filter(d => d.id !== id));
    // Locally remember dismissed deletions so they don't reappear on refresh
    try {
      const k = "vine:dismissed-deleted-groups";
      const arr: string[] = JSON.parse(localStorage.getItem(k) || "[]");
      if (!arr.includes(id)) localStorage.setItem(k, JSON.stringify([...arr, id]));
    } catch { /* ignore */ }
  }, []);

  // Filter dismissed
  const visible = items.filter(d => {
    try {
      const arr: string[] = JSON.parse(localStorage.getItem("vine:dismissed-deleted-groups") || "[]");
      return !arr.includes(d.id);
    } catch { return true; }
  });

  return { deleted: visible, dismiss, reload: load };
}

export function useDeletedPrograms() {
  const { user } = useAuth();
  const [items, setItems] = useState<DeletedEntity[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await (supabase.from("deleted_programs") as any)
      .select("id, name, deleted_at")
      .order("deleted_at", { ascending: false });
    if (data) setItems(data);
  }, [user?.id]);

  useEffect(() => {
    load();
    if (!user?.id) return;
    const ch = supabase.channel("deleted-programs-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "deleted_programs" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, user?.id]);

  const dismiss = useCallback(async (id: string) => {
    setItems(prev => prev.filter(d => d.id !== id));
    try {
      const k = "vine:dismissed-deleted-programs";
      const arr: string[] = JSON.parse(localStorage.getItem(k) || "[]");
      if (!arr.includes(id)) localStorage.setItem(k, JSON.stringify([...arr, id]));
    } catch { /* ignore */ }
  }, []);

  const visible = items.filter(d => {
    try {
      const arr: string[] = JSON.parse(localStorage.getItem("vine:dismissed-deleted-programs") || "[]");
      return !arr.includes(d.id);
    } catch { return true; }
  });

  return { deleted: visible, dismiss, reload: load };
}
