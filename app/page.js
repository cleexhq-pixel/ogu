"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { pageview, trackAppOpen, trackStartDailyPhrase } from "@/app/lib/gtag";
import Analytics from "@/app/components/Analytics";
import OnboardingModal from "@/app/components/OnboardingModal";
import {
  isValidLang,
  LANG_CODES,
  normalizeLang,
  OGU_LANG_KEY,
  resolveLangFromUrlAndStorage,
  tx
} from "@/app/lib/i18n";
import { getJourneyRow, JOURNEY_DONE_MARKER, MAX_JOURNEY_DAY, normalizeVibe, OGU_VIBE_KEY } from "@/lib/journey-data";
import { useActiveSession } from "@/hooks/useActiveSession";

const HERO_UNDERLINE = "border-b-[3px] pb-0.5";
const heroUnderlineStyle = { borderColor: "rgba(255,255,255,0.65)" };

const LANG_FLAG = /** @type {const} */ ({
  en: "🇬🇧",
  id: "🇮🇩",
  fr: "🇫🇷",
  pt: "🇵🇹"
});

/** @param {number} day @param {'idol'|'drama'|'trip'} vibe */
function journeyHomeTitleI18nKey(day, vibe) {
  const v = normalizeVibe(vibe);
  if (day >= 1 && day <= 3) {
    const s = v === "idol" ? "i" : v === "drama" ? "d" : "t";
    return `journey_ht_${day}_${s}`;
  }
  return `journey_ht_${day}`;
}

/** @param {number} day @param {'idol'|'drama'|'trip'} vibe */
function journeyHeroEnI18nKey(day, vibe) {
  const v = normalizeVibe(vibe);
  if (day >= 1 && day <= 3) {
    const s = v === "idol" ? "i" : v === "drama" ? "d" : "t";
    return `journey_en_${day}_${s}`;
  }
  return `journey_en_${day}`;
}

/** @param {import("@/app/lib/i18n").UILang} L @param {number} day @param {'idol'|'drama'|'trip'} vibe */
function translatedJourneyHomeTitle(L, day, vibe) {
  if (day === JOURNEY_DONE_MARKER) return tx(L, "home_journeyMoreSoon");
  return tx(L, journeyHomeTitleI18nKey(day, vibe));
}

/** @param {import("@/app/lib/i18n").UILang} L @param {number} day @param {'idol'|'drama'|'trip'} vibe */
function translatedHeroCompanion(L, day, vibe) {
  return tx(L, journeyHeroEnI18nKey(day, vibe));
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
            <span className={HERO_UNDERLINE} style={heroUnderlineStyle}>
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

function homeJourneyCardKo(day, vibe) {
  if (day === JOURNEY_DONE_MARKER) return "···";
  return getJourneyRow(day, vibe)?.homeKo ?? "";
}

/** Sliding window: previous + current + next two days (max 30); journey complete shows days 27–30. */
function getHomeJourneyStripDays(journeyCurrent) {
  if (journeyCurrent >= JOURNEY_DONE_MARKER) {
    return [27, 28, 29, 30];
  }
  return [journeyCurrent - 1, journeyCurrent, journeyCurrent + 1, journeyCurrent + 2].filter(
    (d) => d >= 1 && d <= MAX_JOURNEY_DAY
  );
}

function JourneyCheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
      <path
        d="M3 6.5l2.5 2.5 4.5-4.5"
        stroke="#22c55e"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function JourneyArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 7h8M8 4l3 3-3 3"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ACTIVE_SESSION_FLAGS = /** @type {const} */ (["🇵🇭", "🇫🇷", "🇧🇷", "🇮🇩", "🇺🇸", "🇰🇷"]);

/** @param {import("@/app/lib/i18n").UILang} lang @param {number} n */
function getActiveSessionBannerParts(lang, n) {
  switch (lang) {
    case "id":
      return { before: "", count: n, after: " orang sedang berbicara bahasa Korea" };
    case "fr":
      return { before: "", count: n, after: " personnes parlent coréen en ce moment" };
    case "pt":
      return { before: "", count: n, after: " pessoas falando coreano agora" };
    default:
      return { before: "", count: n, after: " speaking right now" };
  }
}

export default function HomePage() {
  const { count: activeSessionCount } = useActiveSession();
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
  const langMenuRef = useRef(null);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState("idol");

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
    const sync = () => {
      setJourneyCurrent(readJourneyCurrentFromStorage());
      setSelectedVibe(normalizeVibe(window.localStorage.getItem(OGU_VIBE_KEY)));
      const params = new URLSearchParams(window.location.search);
      const urlLang = params.get("lang");
      const stored = window.localStorage.getItem(OGU_LANG_KEY);
      setLanguage(resolveLangFromUrlAndStorage(urlLang, stored));
    };
    sync();
    const onVis = () => {
      if (document.visibilityState === "visible") sync();
    };
    const onFocus = () => sync();
    const onPageShow = (/** @type {PageTransitionEvent} */ e) => {
      if (e.persisted) sync();
    };
    window.addEventListener("storage", sync);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
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
    if (!langMenuOpen) return;
    const close = (e) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [langMenuOpen]);

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
    if (typeof window === "undefined" || !showOnboardingModal) return;
    const v = normalizeVibe(window.localStorage.getItem(OGU_VIBE_KEY));
    setSelectedVibe(v);
  }, [showOnboardingModal]);

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

  const handleVibeSelect = useCallback((cat) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(OGU_VIBE_KEY, cat);
    }
    setSelectedVibe(normalizeVibe(cat));
  }, []);

  const goFirstLine = useCallback(
    (category) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(OGU_VIBE_KEY, category);
      }
      setSelectedVibe(normalizeVibe(category));
      trackStartDailyPhrase();
      const params = new URLSearchParams();
      params.set("lang", language);
      if (category === "idol" || category === "drama" || category === "trip") {
        params.set("category", category);
      }
      router.push(`/first-line?${params.toString()}`);
    },
    [language, router]
  );

  const goBrowseFirstLine = () => {
    const qs = new URLSearchParams();
    qs.set("lang", language);
    router.push(`/first-line?${qs.toString()}`);
  };

  const openActiveJourneyDay = () => {
    trackStartDailyPhrase();
    const params = new URLSearchParams();
    params.set("lang", language);
    params.set("category", selectedVibe);
    router.push(`/first-line?${params.toString()}`);
  };

  /** Hero CTA: journey days use current mood track for /first-line. */
  const goHeroSayItNow = () => {
    if (journeyCurrent >= JOURNEY_DONE_MARKER) return;
    trackStartDailyPhrase();
    const params = new URLSearchParams();
    params.set("lang", language);
    if (journeyCurrent >= 1 && journeyCurrent <= MAX_JOURNEY_DAY) {
      params.set("category", selectedVibe);
    }
    router.push(`/first-line?${params.toString()}`);
  };

  const L = normalizeLang(language);
  const activeUsersBannerText =
    activeSessionCount != null ? tx(L, "active_users", { n: activeSessionCount }) : null;

  const heroJourneyComplete = journeyCurrent >= JOURNEY_DONE_MARKER;
  const heroDay =
    !heroJourneyComplete && journeyCurrent >= 1 && journeyCurrent <= MAX_JOURNEY_DAY ? journeyCurrent : null;
  const heroRow = heroDay != null ? getJourneyRow(heroDay, selectedVibe) : null;
  const heroLineLabel = heroJourneyComplete
    ? tx(L, "home_journeyCompleteBadge")
    : tx(L, "today_line", { n: journeyCurrent });

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

  const vibeStripEmoji = (label) =>
    String(label || "")
      .replace(/^(👑|🎬|✈️)\s*/u, "")
      .trim();

  return (
    <>
      {/* ── My 90 Seconds Hero ── */}
      <div style={{
        background: "linear-gradient(160deg, #0E0E0F 0%, #1a0a1a 100%)",
        padding: "36px 20px 28px",
        position: "relative",
        overflow: "hidden",
        marginBottom: 0,
      }}>

        {/* Spotlight 배경 */}
        <div style={{
          position: "absolute",
          width: 260, height: 260,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(158,143,253,0.12) 0%, transparent 70%)",
          top: -80, right: -60,
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute",
          width: 180, height: 180,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,138,169,0.08) 0%, transparent 70%)",
          bottom: -40, left: -40,
          pointerEvents: "none",
        }} />

        {/* Eyebrow */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(0,227,253,0.1)",
          borderRadius: 9999, padding: "4px 12px",
          marginBottom: 14,
          position: "relative", zIndex: 1,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "#00E3FD",
          }} />
          <span style={{
            fontSize: 9, fontWeight: 600,
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: "#00E3FD",
            fontFamily: "'Inter', sans-serif",
          }}>
            New — My 90 Seconds
          </span>
        </div>

        {/* 헤드라인 */}
        <h2 style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: 24, fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "#F2F0F4",
          lineHeight: 1.2,
          marginBottom: 8,
          position: "relative", zIndex: 1,
        }}>
          팬싸 90초,<br />
          <span style={{
            background: "linear-gradient(135deg, #FF8AA9, #FF719B)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            AI로 미리 연습하세요
          </span>
        </h2>

        {/* 서브카피 */}
        <p style={{
          fontSize: 13, color: "#9E9BA4",
          marginBottom: 20, lineHeight: 1.6,
          position: "relative", zIndex: 1,
        }}>
          $500짜리 90초를 망치지 마세요.<br />
          아이돌 AI와 실전처럼 연습해요.
        </p>

        {/* 시나리오 미리보기 태그 */}
        <div style={{
          display: "flex", gap: 6, flexWrap: "wrap",
          marginBottom: 20,
          position: "relative", zIndex: 1,
        }}>
          {["💝 칭찬", "🎂 생일", "🎮 게임", "🎤 멘트요청", "💗 고백"].map((tag) => (
            <span key={tag} style={{
              padding: "4px 10px", borderRadius: 9999,
              background: "rgba(255,255,255,0.06)",
              fontSize: 11, color: "#9E9BA4",
              fontFamily: "'Inter', sans-serif",
            }}>
              {tag}
            </span>
          ))}
        </div>

        {/* CTA 버튼 */}
        <div style={{
          display: "flex", gap: 8,
          position: "relative", zIndex: 1,
        }}>
          <Link href="/my-90-seconds" style={{
            flex: 2,
            padding: "15px 0",
            borderRadius: 9999,
            background: "linear-gradient(135deg, #FF8AA9, #FF719B)",
            color: "#fff",
            fontFamily: "'Manrope', sans-serif",
            fontSize: 13, fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            textDecoration: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            textAlign: "center",
          }}>
            🎤 90초 연습 시작
          </Link>
          <Link href="/my-90-seconds" style={{
            flex: 1,
            padding: "15px 0",
            borderRadius: 9999,
            background: "transparent",
            border: "1.5px solid rgba(255,255,255,0.15)",
            color: "#9E9BA4",
            fontFamily: "'Manrope', sans-serif",
            fontSize: 12, fontWeight: 600,
            textDecoration: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            textAlign: "center",
          }}>
            더 알아보기
          </Link>
        </div>

        {/* 무료 안내 */}
        <p style={{
          fontSize: 11, color: "#5C5A62",
          textAlign: "center", marginTop: 12,
          position: "relative", zIndex: 1,
          fontFamily: "'Inter', sans-serif",
        }}>
          무료 · 하루 1회 · 계정 불필요
        </p>
      </div>
      {/* ── /My 90 Seconds Hero ── */}
      <Analytics />
      <OnboardingModal
        open={showOnboardingModal}
        onRequestClose={() => setShowOnboardingModal(false)}
        onProceedToFlow={goFirstLine}
        onBrowseFirst={() => {
          setShowOnboardingModal(false);
          goBrowseFirstLine();
        }}
        language={language}
      />

      <main
        className={`min-h-screen bg-[var(--surface)] pt-0 font-jakarta text-[var(--on-surface)] ${
          activeSessionCount != null ? "pb-0" : "pb-14"
        }`}
      >
        <header
          className="sticky top-0 z-40 border-b border-transparent backdrop-blur-[20px]"
          style={{ backgroundColor: "rgba(249, 249, 251, 0.85)" }}
        >
          <div className="mx-auto flex w-full max-w-[480px] flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="text-xl leading-none" aria-hidden>
                🪄
              </span>
              <span className="text-lg font-bold tracking-tight text-[var(--on-surface)]">꼬비</span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              {!authUser ? (
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <button
                    type="button"
                    onClick={() => void signInWithGoogle()}
                    disabled={loginBusy}
                    className="shrink-0 rounded-[20px] bg-[var(--on-surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--surface-lowest)] transition hover:opacity-90 disabled:opacity-50 sm:text-[12px]"
                  >
                    {tx(L, "home_logIn")}
                  </button>
                  {loginError ? (
                    <p className="max-w-[140px] text-right text-[10px] text-red-600">{loginError}</p>
                  ) : null}
                </div>
              ) : null}
              {pathname !== "/first-line" && pathname !== "/mission" ? (
                <div className="relative shrink-0" ref={langMenuRef}>
                  <button
                    type="button"
                    onClick={() => setLangMenuOpen((o) => !o)}
                    className="flex items-center gap-1.5 rounded-[20px] bg-[var(--surface-lowest)] py-[7px] pl-[13px] pr-[11px] text-[12px] font-bold text-[var(--on-surface)]"
                    style={{ boxShadow: "var(--shadow-lang-pill)" }}
                    aria-expanded={langMenuOpen}
                    aria-haspopup="listbox"
                  >
                    <span aria-hidden>{LANG_FLAG[normalizeLang(language)] ?? "🌐"}</span>
                    <span>{language.toUpperCase()}</span>
                    <span className="text-[10px] opacity-60" aria-hidden>
                      ▾
                    </span>
                  </button>
                  {langMenuOpen ? (
                    <ul
                      className="absolute right-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-[16px] bg-[var(--surface-lowest)] py-1 shadow-lg"
                      style={{ boxShadow: "var(--shadow-card)" }}
                      role="listbox"
                    >
                      {LANG_CODES.map((code) => (
                        <li key={code} role="option" aria-selected={language === code}>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-low)]"
                            onClick={() => {
                              setLang(code);
                              setLangMenuOpen(false);
                            }}
                          >
                            <span aria-hidden>{LANG_FLAG[code]}</span>
                            {code.toUpperCase()}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {authUser ? (
                <div className="relative shrink-0" ref={profileMenuRef}>
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((o) => !o)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
                    style={{
                      background: "linear-gradient(135deg, #2a14b4, #4338ca)",
                      boxShadow: "var(--shadow-active)"
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
                        width={36}
                        height={36}
                        className="h-full w-full object-cover"
                        onError={() => setProfileAvatarBroken(true)}
                      />
                    ) : (
                      profileLetter
                    )}
                  </button>
                  {profileMenuOpen ? (
                    <div
                      className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-[16px] bg-[var(--surface-lowest)] py-1"
                      style={{ border: "1px solid var(--ghost-border)", boxShadow: "var(--shadow-card)" }}
                      role="menu"
                    >
                      {profileDisplayLine ? (
                        <>
                          <p className="truncate px-3 py-2 text-left text-xs text-[var(--on-surface-variant)]">
                            {profileDisplayLine}
                          </p>
                          <div className="mx-3 h-px bg-[var(--surface-low)]" aria-hidden />
                        </>
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void signOut()}
                        className="w-full px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-[var(--surface-low)]"
                      >
                        {tx(L, "home_logOut")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div
          className={`mx-auto w-full max-w-[480px] px-6 ${activeSessionCount == null ? "pb-8" : ""}`}
        >
          <section className="mb-12 mt-8">
            <p className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">
              {heroLineLabel}
            </p>
            <div
              className="relative mt-4 overflow-hidden rounded-[48px] px-6 py-10"
              style={{
                background: "linear-gradient(135deg, #2a14b4, #4338ca)",
                boxShadow: "var(--shadow-card)"
              }}
            >
              <div
                className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/12"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-white/[0.08]"
                aria-hidden
              />
              <div className="relative">
                {heroJourneyComplete ? (
                  <>
                    <p className="font-korean text-center text-[32px] font-extrabold leading-[1.25] tracking-[-0.6px] text-white sm:text-[34px]">
                      {tx(L, "home_journeyCompleteMessage")}
                    </p>
                    <button
                      type="button"
                      onClick={goBrowseFirstLine}
                      className="mt-10 w-full rounded-[24px] bg-white py-[14px] text-[15px] font-bold text-[#2a14b4] transition hover:brightness-95 active:scale-[0.99]"
                      style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
                    >
                      {tx(L, "home_browseMissions")}
                    </button>
                  </>
                ) : heroRow ? (
                  <>
                    <p className="font-korean text-center text-[32px] font-extrabold leading-[1.25] tracking-[-0.6px] text-white sm:text-[34px]">
                      <HeroKoreanLine ko={heroRow.ko} />
                    </p>
                    <p className="mt-2 text-center text-[15px] font-light italic leading-relaxed text-white/90">
                      {translatedHeroCompanion(L, heroDay, selectedVibe)}
                    </p>
                    <div className="mt-8 flex items-end justify-between gap-4">
                      <button
                        type="button"
                        onClick={goHeroSayItNow}
                        className="rounded-[24px] bg-white px-[22px] py-[14px] text-[15px] font-bold text-[#2a14b4] transition hover:brightness-95 active:scale-[0.99]"
                      >
                        {tx(L, "home_sayItNow")}
                      </button>
                      {heroDay != null ? (
                        <span
                          className="select-none font-extrabold leading-none text-white/25"
                          style={{ fontSize: "clamp(3rem, 18vw, 5rem)" }}
                          aria-hidden
                        >
                          {heroDay}
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">
              {tx(L, "vibe_today")}
            </h2>
            <div className="mt-4 grid grid-cols-3 gap-[10px]">
              {[
                { cat: "idol", title: "vibe_idol_title", sub: "vibe_idol_sub" },
                { cat: "drama", title: "vibe_drama_title", sub: "vibe_drama_sub" },
                { cat: "trip", title: "vibe_trip_title", sub: "vibe_trip_sub" }
              ].map(({ cat, title, sub }) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleVibeSelect(cat)}
                  className={`flex flex-col items-center rounded-[32px] px-3 pb-[18px] pt-5 text-center transition hover:brightness-[0.99] active:scale-[0.99] ${
                    selectedVibe === cat
                      ? "border-2 border-[#2a14b4] bg-[#edeafd]"
                      : "border-2 border-transparent bg-[var(--surface-lowest)]"
                  }`}
                  style={selectedVibe === cat ? undefined : { boxShadow: "var(--shadow-card)" }}
                >
                  <span className="text-[26px] leading-none" aria-hidden>
                    {cat === "idol" ? "👑" : cat === "drama" ? "🎬" : "✈️"}
                  </span>
                  <span className="mt-2 text-[11px] font-semibold leading-tight text-[var(--on-surface)]">
                    {vibeStripEmoji(tx(L, title))}
                  </span>
                  <span className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-[var(--on-surface-variant)]">
                    {tx(L, sub)}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mb-12">
            <p className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">
              {journeyCurrent >= 4 ? tx(L, "speaking_journey") : tx(L, "journey_three_day")}
            </p>
            <div className="mt-4 flex max-w-[480px] flex-col gap-2 font-jakarta">
              {getHomeJourneyStripDays(journeyCurrent).map((d) => {
                const phraseTitle = translatedJourneyHomeTitle(L, d, selectedVibe);
                const phraseKo = homeJourneyCardKo(d, selectedVibe);
                const journeyComplete = journeyCurrent >= JOURNEY_DONE_MARKER;
                const isDone = journeyComplete || d < journeyCurrent;
                const isToday = !journeyComplete && d === journeyCurrent && journeyCurrent <= MAX_JOURNEY_DAY;
                const isFuture = !isDone && !isToday;

                if (isToday) {
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={openActiveJourneyDay}
                      className="w-full text-left transition hover:brightness-[1.03] active:scale-[0.99]"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "16px",
                        background: "linear-gradient(135deg, #2a14b4, #4338ca)",
                        borderRadius: "20px",
                        boxShadow: "0 8px 24px rgba(42,20,180,0.28)",
                        cursor: "pointer",
                        border: "none"
                      }}
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "14px",
                          fontWeight: 800,
                          color: "white",
                          flexShrink: 0
                        }}
                        aria-hidden
                      >
                        {d}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: "rgba(255,255,255,0.7)",
                            marginBottom: "3px"
                          }}
                        >
                          {tx(L, "home_journey_today_tap")}
                        </div>
                        <div
                          style={{
                            fontSize: "15px",
                            fontWeight: 800,
                            color: "white",
                            marginBottom: "2px",
                            wordBreak: "keep-all"
                          }}
                        >
                          {phraseTitle}
                        </div>
                        <div
                          className="font-korean"
                          style={{
                            fontSize: "12px",
                            color: "rgba(255,255,255,0.7)",
                            wordBreak: "keep-all"
                          }}
                        >
                          {phraseKo}
                        </div>
                      </div>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}
                        aria-hidden
                      >
                        <JourneyArrowIcon />
                      </div>
                    </button>
                  );
                }

                if (isDone) {
                  return (
                    <div
                      key={d}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 14px",
                        background: "#ffffff",
                        borderRadius: "16px",
                        opacity: 0.7
                      }}
                    >
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          background: "#dcfce7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}
                        aria-hidden
                      >
                        <JourneyCheckIcon />
                      </div>
                      <div className="min-w-0">
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#6b6f72",
                            marginBottom: "1px"
                          }}
                        >
                          {tx(L, "day_done", { n: d })}
                        </div>
                        <div
                          className="font-korean"
                          style={{
                            fontSize: "11px",
                            color: "#9ca3af",
                            wordBreak: "keep-all"
                          }}
                        >
                          {phraseKo}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={d}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      background: "#ffffff",
                      borderRadius: "14px",
                      opacity: 0.45,
                      cursor: "default"
                    }}
                    aria-disabled
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "#f3f3f5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#9ca3af",
                        flexShrink: 0
                      }}
                      aria-hidden
                    >
                      {d}
                    </div>
                    <div className="min-w-0">
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#9ca3af",
                          marginBottom: "1px"
                        }}
                      >
                        {phraseTitle}
                      </div>
                      <div
                        className="font-korean"
                        style={{
                          fontSize: "11px",
                          color: "#c4c4c4",
                          wordBreak: "keep-all"
                        }}
                      >
                        {phraseKo}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {showSignInBanner ? (
            <div className="mb-12 rounded-[32px] bg-[var(--surface-low)] px-6 py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 gap-3">
                  <span className="text-2xl shrink-0" aria-hidden>
                    🪄
                  </span>
                  <div>
                    <p className="text-[15px] font-bold leading-snug text-[var(--on-surface)]">
                      {tx(L, "nudge_title")}
                    </p>
                    <p className="mt-1 text-[14px] leading-relaxed text-[var(--on-surface-variant)]">
                      {tx(L, "nudge_sub")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  disabled={loginBusy}
                  className="shrink-0 rounded-[20px] bg-[var(--on-surface)] px-5 py-3 text-[14px] font-bold text-[var(--surface-lowest)] transition hover:opacity-90 disabled:opacity-50"
                >
                  {tx(L, "sign_in")}
                </button>
              </div>
            </div>
          ) : null}

        </div>

        {activeSessionCount != null ? (
          <div className="w-full min-[480px]:mx-auto min-[480px]:mb-6 min-[480px]:max-w-[480px]">
            <div
              className="flex w-full items-center justify-between px-6 py-[14px] font-jakarta min-[480px]:rounded-[24px]"
              style={{
                background: "linear-gradient(135deg, #2a14b4, #4338ca)",
                paddingBottom: "max(14px, env(safe-area-inset-bottom, 0px))"
              }}
              role="status"
              aria-live="polite"
            >
            <div className="flex min-w-0 flex-1 items-center gap-[10px]">
              <span className="relative inline-flex h-2 w-2 shrink-0 items-center justify-center" aria-hidden>
                <span className="pointer-events-none absolute inset-[-3px] rounded-full bg-[rgba(34,197,94,0.3)] animate-kkobi-active-users-pulse" />
                <span className="relative z-[1] h-2 w-2 rounded-full bg-[#22c55e]" />
              </span>
              <p className="min-w-0 text-[13px] font-semibold leading-snug text-[rgba(255,255,255,0.9)]">
                {activeUsersBannerText}
              </p>
            </div>
            <div className="flex shrink-0 items-center">
              {Array.from({ length: Math.min(3, activeSessionCount) }, (_, i) => (
                <span
                  key={i}
                  className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.15)] text-[12px] leading-none"
                  style={{ marginLeft: i === 0 ? 0 : -8 }}
                  aria-hidden
                >
                  {ACTIVE_SESSION_FLAGS[i % ACTIVE_SESSION_FLAGS.length]}
                </span>
              ))}
              {activeSessionCount > 3 ? (
                <span
                  className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.2)] text-[9px] font-bold leading-none text-white"
                  style={{ marginLeft: -8 }}
                  aria-hidden
                >
                  +{activeSessionCount - 3}
                </span>
              ) : null}
            </div>
          </div>
          </div>
        ) : null}
      </main>
    </>
  );
}
