"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { pageview, trackAppOpen, trackStartDailyPhrase } from "@/app/lib/gtag";
import Analytics from "@/app/components/Analytics";
import { FIRST_LINE_PHRASES } from "@/app/data/first_line_phrases";

const BRAND_PURPLE = "#6c2eff";

function firstLineIndexForToday() {
  const d = new Date();
  return d.getDate() % FIRST_LINE_PHRASES.length;
}

export default function HomePage() {
  const router = useRouter();
  const [language, setLanguage] = useState("en");
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const activeUserIdRef = useRef(null);

  const phraseIndex = firstLineIndexForToday();
  const line = FIRST_LINE_PHRASES[phraseIndex];
  const translation = language === "ko" ? line.en : language === "id" ? line.id : line.en;

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

  const handleSayItNow = () => {
    goFirstLine(null);
  };

  const goMissionList = () => {
    const qs = new URLSearchParams();
    qs.set("lang", language);
    router.push(`/mission?${qs.toString()}`);
  };

  const t = {
    mainLabel:
      language === "ko"
        ? "🪄 첫 문장 말하기"
        : language === "id"
        ? "🪄 Kalimat Pertamamu"
        : "🪄 Your First Line",
    sayItNow:
      language === "ko" ? "지금 말해보기 →" : language === "id" ? "Ucapkan sekarang →" : "Say it now →",
    vibeTitle:
      language === "ko"
        ? "오늘 무드는 뭐예요?"
        : language === "id"
        ? "Suasana hari ini?"
        : "What's your vibe today?",
    vibeIdol:
      language === "ko" ? "👑 내 최애 이야기" : language === "id" ? "👑 Idol favoritku" : "👑 My favorite idol",
    vibeDrama:
      language === "ko" ? "🎬 드라마 한 마디" : language === "id" ? "🎬 Dialog K-drama" : "🎬 K-drama line",
    vibeTrip:
      language === "ko" ? "✈️ 한국 여행 상황" : language === "id" ? "✈️ Trip ke Korea" : "✈️ Korea trip",
    browse:
      language === "ko"
        ? "전체 미션 둘러보기 →"
        : language === "id"
        ? "Lihat semua misi →"
        : "Browse all missions →",
    onboardingTitle:
      language === "ko"
        ? "꼬비와 첫 한국어 문장을 말해보세요"
        : language === "id"
        ? "Ucapkan kalimat Korea pertamamu dengan Kkobi"
        : "Say your first Korean line with Kkobi",
    onboardingDesc:
      language === "ko"
        ? "회원가입 없이, 지금 바로."
        : language === "id"
        ? "Tanpa daftar — langsung mulai."
        : "No sign-up — start right away.",
    onboardingStart:
      language === "ko" ? "지금 말해보기 →" : language === "id" ? "Ucapkan sekarang →" : "Say it now →",
    onboardingBrowse:
      language === "ko" ? "닫기" : language === "id" ? "Tutup" : "Close"
  };

  const langBtn =
    "rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-200 sm:px-3 sm:text-[12px]";

  return (
    <>
      <Analytics />
      <main
        className="min-h-screen px-4 py-8 text-[#0F172A] sm:py-12"
        style={{ backgroundColor: "#f7f6f2" }}
      >
        <div className="mx-auto flex max-w-lg flex-col gap-10 font-jakarta">
          {showOnboardingModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
              role="dialog"
              aria-modal="true"
            >
              <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-[0_24px_64px_rgba(0,0,0,0.12)]">
                <p className="text-center text-4xl" aria-hidden>
                  🪄
                </p>
                <h2 className="mt-4 text-center text-lg font-bold leading-snug text-[#0F172A]">{t.onboardingTitle}</h2>
                <p className="mt-2 text-center text-sm text-[#64748B]">{t.onboardingDesc}</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowOnboardingModal(false);
                    goFirstLine(null);
                  }}
                  className="mt-6 w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_32px_rgba(108,46,255,0.35)] transition hover:opacity-95 active:scale-[0.99]"
                  style={{ backgroundColor: BRAND_PURPLE }}
                >
                  {t.onboardingStart}
                </button>
                <button
                  type="button"
                  onClick={() => setShowOnboardingModal(false)}
                  className="mt-3 w-full text-center text-xs font-medium text-[#94A3B8] hover:text-[#64748B]"
                >
                  {t.onboardingBrowse}
                </button>
              </div>
            </div>
          )}

          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                🪄
              </span>
              <span className="text-lg font-bold tracking-tight text-[#0F172A]">Kkobi</span>
            </div>
            <div className="inline-flex rounded-full border border-[#E8E6E0] bg-white p-1 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.currentTarget.blur();
                  setLang("ko");
                }}
                className={`${langBtn} ${
                  language === "ko" ? "text-white shadow-sm" : "bg-white text-[#64748B] hover:bg-[#F4F3EF]"
                }`}
                style={language === "ko" ? { backgroundColor: BRAND_PURPLE } : undefined}
              >
                🇰🇷 한국어
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.currentTarget.blur();
                  setLang("en");
                }}
                className={`${langBtn} ${
                  language === "en" ? "text-white shadow-sm" : "bg-white text-[#64748B] hover:bg-[#F4F3EF]"
                }`}
                style={language === "en" ? { backgroundColor: BRAND_PURPLE } : undefined}
              >
                🇺🇸 English
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.currentTarget.blur();
                  setLang("id");
                }}
                className={`${langBtn} ${
                  language === "id" ? "text-white shadow-sm" : "bg-white text-[#64748B] hover:bg-[#F4F3EF]"
                }`}
                style={language === "id" ? { backgroundColor: BRAND_PURPLE } : undefined}
              >
                🇮🇩 Indonesia
              </button>
            </div>
          </header>

          <section className="flex flex-1 flex-col justify-center">
            <div
              className="rounded-[28px] bg-white px-6 py-10 shadow-[0_20px_48px_rgba(15,23,42,0.08)] sm:px-10 sm:py-12"
              style={{ boxShadow: "0 20px 48px rgba(15,23,42,0.08), 0 1px 0 rgba(255,255,255,0.8) inset" }}
            >
              <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-[#6c2eff] sm:text-xs">
                {t.mainLabel}
              </p>
              <p className="font-korean mt-8 text-center text-2xl font-bold leading-relaxed text-[#0F172A] sm:text-[1.65rem]">
                {line.ko}
              </p>
              <p className="mt-4 text-center text-base italic leading-relaxed text-[#64748B] sm:text-lg">{translation}</p>
              <button
                type="button"
                onClick={handleSayItNow}
                className="mt-10 w-full rounded-2xl py-4 text-[17px] font-bold text-white shadow-[0_16px_40px_rgba(108,46,255,0.4)] transition hover:brightness-110 active:scale-[0.98] sm:py-5 sm:text-lg"
                style={{ backgroundColor: BRAND_PURPLE }}
              >
                {t.sayItNow}
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-center text-[13px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">
              {t.vibeTitle}
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button
                type="button"
                onClick={() => goFirstLine("idol")}
                className="flex-1 rounded-2xl border border-[#E8E6E0] bg-white px-3 py-3 text-center text-[12px] font-semibold leading-tight text-[#334155] shadow-sm transition hover:border-[#d4d0c8] hover:bg-[#FAFAF8] sm:text-[13px]"
              >
                {t.vibeIdol}
              </button>
              <button
                type="button"
                onClick={() => goFirstLine("drama")}
                className="flex-1 rounded-2xl border border-[#E8E6E0] bg-white px-3 py-3 text-center text-[12px] font-semibold leading-tight text-[#334155] shadow-sm transition hover:border-[#d4d0c8] hover:bg-[#FAFAF8] sm:text-[13px]"
              >
                {t.vibeDrama}
              </button>
              <button
                type="button"
                onClick={() => goFirstLine("trip")}
                className="flex-1 rounded-2xl border border-[#E8E6E0] bg-white px-3 py-3 text-center text-[12px] font-semibold leading-tight text-[#334155] shadow-sm transition hover:border-[#d4d0c8] hover:bg-[#FAFAF8] sm:text-[13px]"
              >
                {t.vibeTrip}
              </button>
            </div>
          </section>

          <footer className="pb-6 pt-2 text-center">
            <button
              type="button"
              onClick={goMissionList}
              className="text-[11px] font-medium text-[#94A3B8] transition hover:text-[#64748B]"
            >
              {t.browse}
            </button>
          </footer>
        </div>
      </main>
    </>
  );
}
