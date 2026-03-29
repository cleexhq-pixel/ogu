"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { pageview, trackAppOpen, trackStartDailyPhrase } from "@/app/lib/gtag";
import Analytics from "@/app/components/Analytics";

const BRAND_PURPLE = "#6c2eff";
const BRAND_GOLD = "#ffd84d";
const LAVENDER_BG = "#EDE9FE";
const CARD_BORDER = "#DDD6FE";
const DIVIDER_COLOR = "#E4DDF7";

const GOLD_UNDERLINE = "border-b-[3px] pb-0.5";
const goldUnderlineStyle = { borderColor: BRAND_GOLD };

const HOME_JOURNEY_DAYS = [
  { day: 1, title: "My favorite", ko: "제 최애는 ___예요." },
  { day: 2, title: "I like this", ko: "저는 ___를 좋아해요." },
  { day: 3, title: "I'm learning", ko: "저는 한국어를 배우고 있어요." }
];

function readJourneyCurrentFromStorage() {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem("ogu_current_day");
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 4);
}

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const [language, setLanguage] = useState("en");
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [journeyCurrent, setJourneyCurrent] = useState(1);
  const activeUserIdRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    pageview(window.location.pathname + window.location.search);
    trackAppOpen();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const l = params.get("lang");
      if (l === "ko" || l === "en" || l === "id") setLanguage(l);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setJourneyCurrent(readJourneyCurrentFromStorage());
    sync();
    const onVis = () => {
      if (document.visibilityState === "visible") sync();
    };
    const onFocus = () => sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const visited = window.localStorage.getItem("ogu_visited");
    if (!visited) {
      const timer = setTimeout(() => {
        setShowOnboardingModal(true);
        window.localStorage.setItem("ogu_visited", "true");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    let id = null;
    if (typeof window !== "undefined") {
      id =
        window.localStorage.getItem("ogu_user_id") ||
        crypto.randomUUID?.() ||
        `ogu-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem("ogu_user_id", id);
    } else {
      id = crypto.randomUUID?.() ?? `ogu-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    activeUserIdRef.current = id;

    (async () => {
      await supabase.from("active_users").insert({
        id,
        status: "browsing",
        last_seen: new Date().toISOString()
      });
    })();

    const lastSeenInterval = setInterval(async () => {
      try {
        const userId = activeUserIdRef.current;
        if (!userId) return;
        await supabase
          .from("active_users")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", userId);
      } catch {
        // silent
      }
    }, 30000);

    return () => {
      clearInterval(lastSeenInterval);
      const toDelete = activeUserIdRef.current;
      if (toDelete) {
        supabase.from("active_users").delete().eq("id", toDelete).then(() => {});
        activeUserIdRef.current = null;
      }
    };
  }, []);

  const setLang = (l) => {
    setLanguage(l);
    if (typeof window === "undefined") return;
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("lang", l);
      window.history.replaceState({}, "", u.pathname + u.search);
    } catch {
      // ignore
    }
  };

  const goFirstLine = (category) => {
    trackStartDailyPhrase();
    const params = new URLSearchParams();
    params.set("lang", language);
    if (category === "idol" || category === "drama" || category === "trip") {
      params.set("category", category);
    }
    router.push(`/first-line?${params.toString()}`);
  };

  const goBrowseFirstLine = () => {
    const qs = new URLSearchParams();
    qs.set("lang", language);
    router.push(`/first-line?${qs.toString()}`);
  };

  const openActiveJourneyDay = () => {
    trackStartDailyPhrase();
    const params = new URLSearchParams();
    params.set("lang", language);
    router.push(`/first-line?${params.toString()}`);
  };

  const langPillBase = "rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors duration-200";

  return (
    <>
      <Analytics />
      <main className="min-h-screen px-4 py-8 font-jakarta sm:py-10" style={{ backgroundColor: LAVENDER_BG }}>
        <div className="mx-auto flex w-full max-w-[480px] flex-col gap-8 text-[#0F172A]">
          {showOnboardingModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 font-jakarta"
              style={{ backgroundColor: "rgba(15, 23, 42, 0.5)" }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="onboarding-modal-title"
            >
              <div className="w-full max-w-[360px] rounded-[24px] bg-white px-7 py-8 shadow-lg">
                <div
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-[28px] leading-none"
                  style={{ backgroundColor: LAVENDER_BG }}
                  aria-hidden
                >
                  🪄
                </div>
                <h2
                  id="onboarding-modal-title"
                  className="mt-5 text-center text-[22px] font-bold leading-snug text-[#0f172a]"
                >
                  Say your first{" "}
                  <span style={{ color: BRAND_PURPLE }}>Korean sentence</span> in 30 seconds.
                </h2>
                <div className="mt-3 space-y-0.5 text-center text-[14px] leading-relaxed text-[#6b7280]">
                  <p>Pick a topic and start speaking.</p>
                  <p>No sign-up needed.</p>
                </div>
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOnboardingModal(false);
                      goFirstLine("idol");
                    }}
                    className="w-full rounded-[14px] border-2 border-[#DDD6FE] bg-[#EDE9FE] px-4 py-3.5 text-center text-[14px] font-bold text-[#0f172a] transition hover:border-[#6c2eff] active:scale-[0.99]"
                  >
                    👑 My favorite idol
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOnboardingModal(false);
                      goFirstLine("drama");
                    }}
                    className="w-full rounded-[14px] border-2 border-[#DDD6FE] bg-[#EDE9FE] px-4 py-3.5 text-center text-[14px] font-bold text-[#0f172a] transition hover:border-[#6c2eff] active:scale-[0.99]"
                  >
                    🎬 K-drama line
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOnboardingModal(false);
                      goFirstLine("trip");
                    }}
                    className="w-full rounded-[14px] border-2 border-[#DDD6FE] bg-[#EDE9FE] px-4 py-3.5 text-center text-[14px] font-bold text-[#0f172a] transition hover:border-[#6c2eff] active:scale-[0.99]"
                  >
                    ✈️ Korea trip
                  </button>
                </div>
                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={() => setShowOnboardingModal(false)}
                    className="text-[14px] text-[#6b7280] transition hover:opacity-80"
                  >
                    or <span style={{ color: BRAND_PURPLE }}>browse first</span>
                  </button>
                </div>
                <p className="mt-3 text-center text-[11px] text-[#9ca3af]">
                  No account required · Free to try
                </p>
              </div>
            </div>
          )}

          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] text-lg leading-none"
                style={{ backgroundColor: BRAND_PURPLE }}
                aria-hidden
              >
                🪄
              </span>
              <span className="text-lg font-bold tracking-tight text-[#0F172A]">Kkobi</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.currentTarget.blur();
                  setLang("ko");
                }}
                className={langPillBase}
                style={
                  language === "ko"
                    ? { backgroundColor: BRAND_PURPLE, color: "#fff" }
                    : { backgroundColor: "transparent", color: "#64748B" }
                }
              >
                KO
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.currentTarget.blur();
                  setLang("en");
                }}
                className={langPillBase}
                style={
                  language === "en"
                    ? { backgroundColor: BRAND_PURPLE, color: "#fff" }
                    : { backgroundColor: "transparent", color: "#64748B" }
                }
              >
                EN
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.currentTarget.blur();
                  setLang("id");
                }}
                className={langPillBase}
                style={
                  language === "id"
                    ? { backgroundColor: BRAND_PURPLE, color: "#fff" }
                    : { backgroundColor: "transparent", color: "#64748B" }
                }
              >
                ID
              </button>
            </div>
          </header>

          <section>
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] sm:text-[11px]" style={{ color: BRAND_PURPLE }}>
              🪄 YOUR FIRST LINE
            </p>
            <div
              className="mt-4 rounded-[18px] border bg-white px-5 py-8 sm:px-7 sm:py-9"
              style={{ borderColor: CARD_BORDER, boxShadow: "0 10px 32px rgba(109, 40, 255, 0.06)" }}
            >
              <p className="font-korean text-center text-[1.35rem] font-bold leading-relaxed text-[#0F172A] sm:text-[1.5rem]">
                제 최애는{" "}
                <span className={GOLD_UNDERLINE} style={goldUnderlineStyle}>
                  ___
                </span>{" "}
                예요.
              </p>
              <p className="mt-5 text-center text-sm leading-relaxed text-[#94A3B8] sm:text-[15px]">
                My favorite is{" "}
                <span className={`font-jakarta ${GOLD_UNDERLINE}`} style={goldUnderlineStyle}>
                  ___
                </span>
                .
              </p>
              <button
                type="button"
                onClick={() => goFirstLine(null)}
                className="mt-8 w-full rounded-2xl py-4 text-[16px] font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
                style={{ backgroundColor: BRAND_PURPLE, boxShadow: "0 12px 28px rgba(108, 46, 255, 0.35)" }}
              >
                🗣️ Say it now
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <p
              className="text-center text-[9px] font-bold uppercase tracking-[0.16em]"
              style={{ color: BRAND_PURPLE }}
            >
              YOUR 3-DAY JOURNEY
            </p>
            <div className="flex flex-col gap-3">
              {HOME_JOURNEY_DAYS.map((row) => {
                const isDone = row.day < journeyCurrent;
                const isActive = row.day === journeyCurrent && journeyCurrent <= 3;
                const isLocked = !isDone && !isActive;
                const baseCard =
                  "flex w-full gap-3 rounded-xl border-2 bg-white p-4 text-left transition";
                const cardClass = isActive
                  ? `${baseCard} ring-0`
                  : `${baseCard} border-[#DDD6FE]`;
                const cardStyle = isActive
                  ? { borderColor: BRAND_PURPLE, boxShadow: "0 0 0 1px rgba(108,46,255,0.15)" }
                  : undefined;

                const inner = (
                  <>
                    <div className="flex shrink-0 flex-col items-center justify-start pt-0.5">
                      {isDone ? (
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ backgroundColor: BRAND_PURPLE }}
                          aria-hidden
                        >
                          ✓
                        </span>
                      ) : isActive ? (
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-[#0f172a]"
                          style={{ backgroundColor: BRAND_GOLD }}
                          aria-hidden
                        >
                          {row.day}
                        </span>
                      ) : (
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#d1d5db] bg-[#f3f4f6] text-sm font-bold text-[#9ca3af]"
                          aria-hidden
                        >
                          {row.day}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[15px] font-bold ${isLocked ? "text-[#9ca3af]" : "text-[#0f172a]"}`}
                      >
                        {row.title}
                      </p>
                      <p
                        className={`font-korean mt-1 text-sm font-semibold ${isLocked ? "text-[#c4c4c4]" : "text-[#334155]"}`}
                      >
                        {row.ko}
                      </p>
                      <p
                        className={`mt-2 text-[11px] font-bold uppercase tracking-wide ${
                          isDone
                            ? "text-[#6c2eff]"
                            : isActive
                              ? "text-[#6c2eff]"
                              : "text-[#9ca3af]"
                        }`}
                      >
                        {isDone ? "Done!" : isActive ? "Today" : "Locked"}
                      </p>
                    </div>
                  </>
                );

                if (isActive) {
                  return (
                    <button
                      key={row.day}
                      type="button"
                      onClick={openActiveJourneyDay}
                      className={cardClass}
                      style={cardStyle}
                    >
                      {inner}
                    </button>
                  );
                }

                return (
                  <div
                    key={row.day}
                    className={cardClass}
                    style={cardStyle}
                    aria-disabled={isLocked}
                  >
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="h-px w-full" style={{ backgroundColor: DIVIDER_COLOR }} aria-hidden />

          <section className="space-y-4">
            <h2 className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8] sm:text-[11px]">
              WHAT&apos;S YOUR VIBE TODAY?
            </h2>
            <div className="flex gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => goFirstLine("idol")}
                className="min-w-0 flex-1 rounded-[14px] border bg-white px-2 py-3.5 text-center text-[11px] font-semibold leading-tight text-[#334155] transition hover:bg-[#FAFAFC] sm:px-3 sm:text-xs"
                style={{ borderColor: CARD_BORDER }}
              >
                👑 My favorite idol
              </button>
              <button
                type="button"
                onClick={() => goFirstLine("drama")}
                className="min-w-0 flex-1 rounded-[14px] border bg-white px-2 py-3.5 text-center text-[11px] font-semibold leading-tight text-[#334155] transition hover:bg-[#FAFAFC] sm:px-3 sm:text-xs"
                style={{ borderColor: CARD_BORDER }}
              >
                🎬 K-drama line
              </button>
              <button
                type="button"
                onClick={() => goFirstLine("trip")}
                className="min-w-0 flex-1 rounded-[14px] border bg-white px-2 py-3.5 text-center text-[11px] font-semibold leading-tight text-[#334155] transition hover:bg-[#FAFAFC] sm:px-3 sm:text-xs"
                style={{ borderColor: CARD_BORDER }}
              >
                ✈️ Korea trip
              </button>
            </div>
          </section>

          <footer className="pb-4 pt-2 text-center">
            <button
              type="button"
              onClick={goBrowseFirstLine}
              className="text-[13px] font-semibold transition hover:opacity-80"
              style={{ color: BRAND_PURPLE }}
            >
              Browse all missions
            </button>
          </footer>
        </div>
      </main>
    </>
  );
}
