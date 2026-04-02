"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";

const ActiveSessionContext = createContext(undefined);

const STORAGE_KEY = "kkobi_session_id";
const INTERVAL_MS = 30_000;
const STALE_MS = 5 * 60 * 1000;

function getOrCreateSessionId() {
  if (typeof window === "undefined") return null;
  let id = window.localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `kkobi-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

function staleCutoffIso() {
  return new Date(Date.now() - STALE_MS).toISOString();
}

function deleteSessionKeepalive(sessionId) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !sessionId || typeof window === "undefined") return;
  const endpoint = `${url}/rest/v1/active_sessions?id=eq.${encodeURIComponent(sessionId)}`;
  try {
    fetch(endpoint, {
      method: "DELETE",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=minimal",
      },
      keepalive: true,
    });
  } catch {
    // ignore
  }
}

function useActiveSessionInternal() {
  const [count, setCount] = useState(null);
  const sessionIdRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const supabase = getSupabase();
    if (!supabase) return undefined;

    const sessionId = getOrCreateSessionId();
    if (!sessionId) return undefined;
    sessionIdRef.current = sessionId;

    let cancelled = false;

    const tick = async () => {
      const sid = sessionIdRef.current;
      if (!sid) return;

      const cutoff = staleCutoffIso();
      const nowIso = new Date().toISOString();

      try {
        await supabase.from("active_sessions").delete().lt("last_seen", cutoff);

        const { error: upsertError } = await supabase
          .from("active_sessions")
          .upsert({ id: sid, last_seen: nowIso }, { onConflict: "id" });

        if (upsertError) return;

        const { count: raw, error: countError } = await supabase
          .from("active_sessions")
          .select("*", { count: "exact", head: true })
          .gte("last_seen", cutoff);

        if (cancelled || countError) return;
        setCount(Math.max(1, raw ?? 1));
      } catch {
        // keep last count; first load may stay null
      }
    };

    void tick();
    const interval = setInterval(() => void tick(), INTERVAL_MS);

    const onBeforeUnload = () => {
      deleteSessionKeepalive(sessionIdRef.current);
    };

    const onPageHide = (e) => {
      if (e.persisted) return;
      deleteSessionKeepalive(sessionIdRef.current);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return { count };
}

/**
 * Wrap the app (e.g. in root layout) so session heartbeat runs on all routes.
 */
export function ActiveSessionProvider({ children }) {
  const value = useActiveSessionInternal();
  return <ActiveSessionContext.Provider value={value}>{children}</ActiveSessionContext.Provider>;
}

/**
 * @returns {{ count: number | null }}
 */
export function useActiveSession() {
  const ctx = useContext(ActiveSessionContext);
  if (ctx === undefined) {
    throw new Error("useActiveSession must be used within ActiveSessionProvider");
  }
  return ctx;
}
