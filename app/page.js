"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { pageview, trackAppOpen, trackStartDailyPhrase } from "@/app/lib/gtag";
import Analytics from "@/app/components/Analytics";
import {
  isValidLang,
  LANG_CODES,
  normalizeLang,
  OGU_LANG_KEY,
  resolveLangFromUrlAndStorage,
  tx
} from "@/app/lib/i18n";
import {
  getJourneyRow,
  getJourneyWindowDays,
  JOURNEY_DONE_MARKER,
  MAX_JOURNEY_DAY
} from "@/lib/journey-data";

const BRAND_PURPLE = "#6c2eff";
const BRAND_GOLD = "#ffd84d";
const LAVENDER_BG = "#EDE9FE";
const CARD_BORDER = "#DDD6FE";
const DIVIDER_COLOR = "#E4DDF7";

const GOLD_UNDERLINE = "border-b-[3px] pb-0.5";
const goldUnderlineStyle = { borderColor: BRAND_GOLD };

const HERO_J_EN_KEYS = /** @type {const} */ (["j1_en", "j2_en", "j3_en"]);

/** @param {string} L normalized lang @param {number} day 1…30 */
function heroJourneyEnglish(L, day) {
  if (day <= 3) return tx(L, HERO_J_EN_KEYS[day - 1]);
  return getJourneyRow(day)?.en ?? "";
}

/** Renders Korean line; gold-underlines `___` when present. */
function HeroKoreanLine({ ko }) {
  if (!ko.includes("___")) {
    return <>{ko}</>;
  }
  const parts = ko.split("___");
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 ? (
            <span className={GOLD_UNDERLINE} style={goldUnderlineStyle}>
              ___
            </span>
          ) : null}
        </span>
      ))}
    </>
  );
}

function readJourneyCurrentFromStorage() {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem("ogu_current_day");
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, JOURNEY_DONE_MARKER);
}

/** @param {string} L normalized lang */
function homeJourneyCardTitle(L, day) {
  if (day === JOURNEY_DONE_MARKER) return tx(L, "home_journeyMoreSoon");
  if (day <= 3) {
    const keys = ["home_journeyDay1Title", "home_journeyDay2Title", "home_journeyDay3Title"];
    return tx(L, keys[day - 1]);
  }
  return getJourneyRow(day)?.homeTitle ?? `Day ${day}`;
}

function homeJourneyCardKo(day) {
  if (day === JOURNEY_DONE_MARKER) return "···";
  return getJourneyRow(day)?.homeKo ?? "";
}

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const [language, setLanguage] = useState("en");
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [journeyCurrent, setJourneyCurrent] = useState(1);
  const [authUser, setAuthUser] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileAvatarBroken, setProfileAvatarBroken] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const activeUserIdRef = useRef(null);
  const langReady = useRef(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    pageview(window.location.pathname + window.location.search);
    trackAppOpen();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || langReady.current) return;
    langReady.current = true;
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get("lang");
    const stored = window.localStorage.getItem(OGU_LANG_KEY);
    const lang = resolveLangFromUrlAndStorage(urlLang, stored);
    setLanguage(lang);
    window.localStorage.setItem(OGU_LANG_KEY, lang);
    const u = new URL(window.location.href);
    if (!isValidLang(urlLang) || u.searchParams.get("lang") !== lang) {
      u.searchParams.set("lang", lang);
      window.history.replaceState({}, "", u.pathname + u.search);
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
    const supabase = getSupabase();
    if (!supabase) return undefined;
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (!error) setAuthUser(user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setProfileAvatarBroken(false);
  }, [authUser?.id]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const close = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [profileMenuOpen]);

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

  const setLang = (code) => {
    const lang = normalizeLang(code);
    setLanguage(lang);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(OGU_LANG_KEY, lang);
    const p = new URLSearchParams(window.location.search);
    p.set("lang", lang);
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
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

  /** Hero CTA: journey days use idol category to match /first-line journey flow. */
  const goHeroSayItNow = () => {
    if (journeyCurrent >= JOURNEY_DONE_MARKER) return;
    trackStartDailyPhrase();
    const params = new URLSearchParams();
    params.set("lang", language);
    if (journeyCurrent >= 1 && journeyCurrent <= MAX_JOURNEY_DAY) {
      params.set("category", "idol");
    }
    router.push(`/first-line?${params.toString()}`);
  };

  const langPillBase =
    "rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors duration-200 sm:px-3 sm:text-[12px]";
  const L = normalizeLang(language);

  const heroJourneyComplete = journeyCurrent >= JOURNEY_DONE_MARKER;
  const heroDay =
    !heroJourneyComplete && journeyCurrent >= 1 && journeyCurrent <= MAX_JOURNEY_DAY ? journeyCurrent : null;
  const heroRow = heroDay != null ? getJourneyRow(heroDay) : null;
  const heroLineLabel = heroJourneyComplete
    ? tx(L, "home_journeyCompleteBadge")
    : journeyCurrent === 1
      ? tx(L, "home_yourFirstLine")
      : tx(L, "home_todaysLine");

  const showSignInBanner = !authUser && journeyCurrent >= 3;

  const profileAvatarUrl =
    authUser?.user_metadata?.avatar_url || authUser?.user_metadata?.picture || null;
  const profileLetter =
    authUser?.email?.[0]?.toUpperCase() ||
    authUser?.user_metadata?.full_name?.[0]?.toUpperCase() ||
    authUser?.user_metadata?.name?.[0]?.toUpperCase() ||
    "?";
  const profileDisplayLine =
    authUser?.user_metadata?.full_name ||
    authUser?.user_metadata?.name ||
    authUser?.email ||
    "";

  const signOut = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfileMenuOpen(false);
    if (typeof window !== "undefined") window.location.reload();
  };

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoginError("Unable to connect. Try again later.");
      return;
    }
    setLoginBusy(true);
    setLoginError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://talk.kkobi.app/auth/callback"
      }
    });
    setLoginBusy(false);
    if (error) setLoginError(error.message);
  }, []);

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
                  {tx(L, "modal_headlineBefore")}
                  <span style={{ color: BRAND_PURPLE }}>{tx(L, "modal_headlineAccent")}</span>
                  {tx(L, "modal_headlineAfter")}
                </h2>
                <div className="mt-3 space-y-0.5 text-center text-[14px] leading-relaxed text-[#6b7280]">
                  <p>{tx(L, "modal_pickTopic")}</p>
                  <p>{tx(L, "modal_noSignup")}</p>
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
                    {tx(L, "cat_idol_card")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOnboardingModal(false);
                      goFirstLine("drama");
                    }}
                    className="w-full rounded-[14px] border-2 border-[#DDD6FE] bg-[#EDE9FE] px-4 py-3.5 text-center text-[14px] font-bold text-[#0f172a] transition hover:border-[#6c2eff] active:scale-[0.99]"
                  >
                    {tx(L, "cat_drama_card")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOnboardingModal(false);
                      goFirstLine("trip");
                    }}
                    className="w-full rounded-[14px] border-2 border-[#DDD6FE] bg-[#EDE9FE] px-4 py-3.5 text-center text-[14px] font-bold text-[#0f172a] transition hover:border-[#6c2eff] active:scale-[0.99]"
                  >
                    {tx(L, "cat_trip_card")}
                  </button>
                </div>
                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={() => setShowOnboardingModal(false)}
                    className="text-[14px] text-[#6b7280] transition hover:opacity-80"
                  >
                    {tx(L, "modal_browseBefore")}
                    <span style={{ color: BRAND_PURPLE }}>{tx(L, "modal_browseAccent")}</span>
                  </button>
                </div>
                <p className="mt-3 text-center text-[11px] text-[#9ca3af]">{tx(L, "modal_footer")}</p>
              </div>
            </div>
          )}

          <header className="flex flex-wrap items-center justify-between gap-3">
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
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              {!authUser ? (
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <button
                    type="button"
                    onClick={() => void signInWithGoogle()}
                    disabled={loginBusy}
                    className="shrink-0 rounded-[20px] border-2 bg-white px-3 py-1.5 text-[11px] font-semibold transition hover:bg-[#FAF8FF] disabled:opacity-50 sm:text-[12px]"
                    style={{ borderColor: BRAND_PURPLE, color: BRAND_PURPLE }}
                  >
                    {tx(L, "home_logIn")}
                  </button>
                  {loginError ? (
                    <p className="max-w-[140px] text-right text-[10px] text-red-600">{loginError}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="flex max-w-[200px] shrink-0 flex-wrap justify-end gap-1 sm:max-w-none">
                {LANG_CODES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    className={langPillBase}
                    style={
                      language === code
                        ? { backgroundColor: BRAND_PURPLE, color: "#fff" }
                        : { backgroundColor: "transparent", color: "#64748B" }
                    }
                  >
                    {code.toUpperCase()}
                  </button>
                ))}
              </div>
              {authUser ? (
                <div className="relative shrink-0" ref={profileMenuRef}>
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((o) => !o)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white shadow-sm"
                    style={{
                      backgroundColor: BRAND_PURPLE
                    }}
                    aria-expanded={profileMenuOpen}
                    aria-haspopup="true"
                    aria-label={profileDisplayLine || "Profile"}
                    title={profileDisplayLine || undefined}
                  >
                    {profileAvatarUrl && !profileAvatarBroken ? (
                      <img
                        src={profileAvatarUrl}
                        alt=""
                        width={32}
                        height={32}
                        className="h-full w-full object-cover"
                        onError={() => setProfileAvatarBroken(true)}
                      />
                    ) : (
                      profileLetter
                    )}
                  </button>
                  {profileMenuOpen ? (
                    <div
                      className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-[12px] border bg-white py-1 shadow-lg"
                      style={{ borderColor: "#e5e7eb" }}
                      role="menu"
                    >
                      {profileDisplayLine ? (
                        <>
                          <p className="truncate px-3 py-2 text-left text-xs text-[#64748B]">{profileDisplayLine}</p>
                          <div className="mx-3 h-px bg-[#e5e7eb]" aria-hidden />
                        </>
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void signOut()}
                        className="w-full px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-[#f8fafc]"
                        style={{ color: "#ef4444" }}
                      >
                        {tx(L, "home_logOut")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </header>

          <section>
            <p
              className="text-center text-[10px] font-bold uppercase tracking-[0.2em] sm:text-[11px]"
              style={{ color: BRAND_PURPLE }}
            >
              {heroLineLabel}
            </p>
            <div
              className="mt-4 rounded-[18px] border bg-white px-5 py-8 sm:px-7 sm:py-9"
              style={{ borderColor: CARD_BORDER, boxShadow: "0 10px 32px rgba(109, 40, 255, 0.06)" }}
            >
              {heroJourneyComplete ? (
                <>
                  <p className="font-korean text-center text-[1.35rem] font-bold leading-relaxed text-[#0F172A] sm:text-[1.5rem]">
                    {tx(L, "home_journeyCompleteMessage")}
                  </p>
                  <button
                    type="button"
                    onClick={goBrowseFirstLine}
                    className="mt-8 w-full rounded-2xl py-4 text-[16px] font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
                    style={{ backgroundColor: BRAND_PURPLE, boxShadow: "0 12px 28px rgba(108, 46, 255, 0.35)" }}
                  >
                    {tx(L, "home_browseMissions")}
                  </button>
                </>
              ) : heroRow ? (
                <>
                  <p className="font-korean text-center text-[1.35rem] font-bold leading-relaxed text-[#0F172A] sm:text-[1.5rem]">
                    <HeroKoreanLine ko={heroRow.ko} />
                  </p>
                  <p className="mt-5 text-center text-sm leading-relaxed text-[#94A3B8] sm:text-[15px]">
                    {heroJourneyEnglish(L, heroDay)}
                  </p>
                  <button
                    type="button"
                    onClick={goHeroSayItNow}
                    className="mt-8 w-full rounded-2xl py-4 text-[16px] font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
                    style={{ backgroundColor: BRAND_PURPLE, boxShadow: "0 12px 28px rgba(108, 46, 255, 0.35)" }}
                  >
                    {tx(L, "home_sayItNow")}
                  </button>
                </>
              ) : null}
            </div>
          </section>

          {showSignInBanner ? (
            <div
              className="rounded-[14px] border-2 px-4 py-4 sm:px-5 sm:py-5"
              style={{ backgroundColor: "#EDE9FE", borderColor: CARD_BORDER }}
            >
              <p className="text-center text-[15px] font-bold leading-snug text-[#0f172a] sm:text-base">
                {tx(L, "home_signInBannerTitle")}
              </p>
              <p className="mt-2 text-center text-[13px] leading-relaxed text-[#64748B] sm:text-[14px]">
                {tx(L, "home_signInBannerSub")}
              </p>
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                disabled={loginBusy}
                className="mt-4 w-full rounded-xl py-3.5 text-[14px] font-bold text-white transition hover:brightness-110 disabled:opacity-50 active:scale-[0.99]"
                style={{ backgroundColor: BRAND_PURPLE, boxShadow: "0 8px 20px rgba(108, 46, 255, 0.25)" }}
              >
                {tx(L, "home_signInWithGoogle")}
              </button>
            </div>
          ) : null}

          <section className="space-y-3">
            <p
              className="text-center text-[9px] font-bold uppercase tracking-[0.16em]"
              style={{ color: BRAND_PURPLE }}
            >
              {journeyCurrent >= 4 ? tx(L, "home_speakingJourney") : tx(L, "home_journeyTitle")}
            </p>
            <div className="flex flex-col gap-3">
              {getJourneyWindowDays(journeyCurrent).map((d) => {
                const isPlaceholder = d === JOURNEY_DONE_MARKER;
                const isDone =
                  (!isPlaceholder && d < journeyCurrent) ||
                  (journeyCurrent >= JOURNEY_DONE_MARKER && !isPlaceholder);
                const isActive =
                  !isPlaceholder && d === journeyCurrent && journeyCurrent <= MAX_JOURNEY_DAY;
                const isLocked = !isDone && !isActive;
                const baseCard =
                  "flex w-full gap-3 rounded-xl border-2 bg-white p-4 text-left transition";
                const cardClass = isActive ? `${baseCard} ring-0` : `${baseCard} border-[#DDD6FE]`;
                const cardStyle = isActive
                  ? { borderColor: BRAND_PURPLE, boxShadow: "0 0 0 1px rgba(108,46,255,0.15)" }
                  : undefined;
                const title = homeJourneyCardTitle(L, d);
                const koLine = homeJourneyCardKo(d);

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
                          {d}
                        </span>
                      ) : (
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#d1d5db] bg-[#f3f4f6] text-sm font-bold text-[#9ca3af]"
                          aria-hidden
                        >
                          {isPlaceholder ? "…" : d}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[15px] font-bold ${isLocked ? "text-[#9ca3af]" : "text-[#0f172a]"}`}
                      >
                        {title}
                      </p>
                      <p
                        className={`font-korean mt-1 text-sm font-semibold ${isLocked ? "text-[#c4c4c4]" : "text-[#334155]"}`}
                      >
                        {koLine}
                      </p>
                      <p
                        className={`mt-2 text-[11px] font-bold uppercase tracking-wide ${
                          isDone || isActive ? "text-[#6c2eff]" : "text-[#9ca3af]"
                        }`}
                      >
                        {isDone ? tx(L, "home_done") : isActive ? tx(L, "home_today") : tx(L, "home_locked")}
                      </p>
                    </div>
                  </>
                );

                if (isActive) {
                  return (
                    <button
                      key={d}
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
                  <div key={d} className={cardClass} style={cardStyle} aria-disabled={isLocked}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="h-px w-full" style={{ backgroundColor: DIVIDER_COLOR }} aria-hidden />

          <section className="space-y-4">
            <h2 className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8] sm:text-[11px]">
              {tx(L, "home_vibeTitle")}
            </h2>
            <div className="flex gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => goFirstLine("idol")}
                className="min-w-0 flex-1 rounded-[14px] border bg-white px-2 py-3.5 text-center text-[11px] font-semibold leading-tight text-[#334155] transition hover:bg-[#FAFAFC] sm:px-3 sm:text-xs"
                style={{ borderColor: CARD_BORDER }}
              >
                {tx(L, "home_vibeIdol")}
              </button>
              <button
                type="button"
                onClick={() => goFirstLine("drama")}
                className="min-w-0 flex-1 rounded-[14px] border bg-white px-2 py-3.5 text-center text-[11px] font-semibold leading-tight text-[#334155] transition hover:bg-[#FAFAFC] sm:px-3 sm:text-xs"
                style={{ borderColor: CARD_BORDER }}
              >
                {tx(L, "home_vibeDrama")}
              </button>
              <button
                type="button"
                onClick={() => goFirstLine("trip")}
                className="min-w-0 flex-1 rounded-[14px] border bg-white px-2 py-3.5 text-center text-[11px] font-semibold leading-tight text-[#334155] transition hover:bg-[#FAFAFC] sm:px-3 sm:text-xs"
                style={{ borderColor: CARD_BORDER }}
              >
                {tx(L, "home_vibeTrip")}
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
              {tx(L, "home_browseMissions")}
            </button>
          </footer>
        </div>
      </main>
    </>
  );
}
