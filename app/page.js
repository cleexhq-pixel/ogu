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
  MAX_JOURNEY_DAY,
  normalizeVibe,
  OGU_VIBE_KEY
} from "@/lib/journey-data";
import { useActiveSession } from "@/hooks/useActiveSession";

const HERO_UNDERLINE = "border-b-[3px] pb-0.5";
const heroUnderlineStyle = { borderColor: "rgba(255,255,255,0.65)" };

const LANG_FLAG = /** @type {const} */ ({
  ko: "🇰🇷",
  en: "🇬🇧",
  id: "🇮🇩",
  fr: "🇫🇷",
  pt: "🇵🇹"
});

function ArrowCircleIcon() {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg leading-none text-white"
      style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
      aria-hidden
    >
      →
    </span>
  );
}

/** @param {string} _L normalized lang @param {number} day 1…30 @param {'idol'|'drama'|'trip'} vibe */
function heroJourneyEnglish(_L, day, vibe) {
  return getJourneyRow(day, vibe)?.en ?? "";
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

/** @param {string} L normalized lang @param {'idol'|'drama'|'trip'} vibe */
function homeJourneyCardTitle(L, day, vibe) {
  if (day === JOURNEY_DONE_MARKER) return tx(L, "home_journeyMoreSoon");
  return getJourneyRow(day, vibe)?.homeTitle ?? `Day ${day}`;
}

function homeJourneyCardKo(day, vibe) {
  if (day === JOURNEY_DONE_MARKER) return "···";
  return getJourneyRow(day, vibe)?.homeKo ?? "";
}

const ACTIVE_SESSION_FLAGS = /** @type {const} */ (["🇵🇭", "🇫🇷", "🇧🇷", "🇮🇩", "🇺🇸", "🇰🇷"]);

/** @param {import("@/app/lib/i18n").UILang} lang @param {number} n */
function getActiveSessionBannerParts(lang, n) {
  switch (lang) {
    case "ko":
      return { before: "지금 ", count: n, after: "명이 한국어 말하는 중" };
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
  const [onboardingVibe, setOnboardingVibe] = useState("idol");

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
    };
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
    setOnboardingVibe(v);
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

  const goFirstLine = (category) => {
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
  const activeSessionBannerParts =
    activeSessionCount != null ? getActiveSessionBannerParts(L, activeSessionCount) : null;

  const heroJourneyComplete = journeyCurrent >= JOURNEY_DONE_MARKER;
  const heroDay =
    !heroJourneyComplete && journeyCurrent >= 1 && journeyCurrent <= MAX_JOURNEY_DAY ? journeyCurrent : null;
  const heroRow = heroDay != null ? getJourneyRow(heroDay, selectedVibe) : null;
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

  const vibeStripEmoji = (label) =>
    String(label || "")
      .replace(/^(👑|🎬|✈️)\s*/u, "")
      .trim();

  return (
    <>
      <Analytics />
      {showOnboardingModal && (
        <div
          className="fixed inset-0 z-50 flex font-jakarta max-[479px]:h-[100dvh] max-[479px]:min-h-0 max-[479px]:flex-col max-[479px]:bg-[var(--surface-lowest)] min-[480px]:min-h-screen min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-center min-[480px]:bg-[#f3f3f5]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-modal-title"
        >
          <div
            className="mx-auto flex w-full max-w-[480px] flex-1 flex-col min-h-0 justify-between px-6 pt-9 pb-8 min-[480px]:mt-[60px] min-[480px]:max-h-[calc(100vh-80px)] min-[480px]:flex-none min-[480px]:overflow-y-auto min-[480px]:rounded-[32px] min-[480px]:bg-[#ffffff] min-[480px]:px-10 min-[480px]:pt-12 min-[480px]:pb-10 min-[480px]:shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
          >
          <div className="flex min-h-0 flex-1 flex-col min-[480px]:flex-none">
            <p className="mb-5 inline-flex max-w-full rounded-[20px] bg-[var(--surface-low)] px-[14px] py-[7px] text-[11px] font-bold text-[var(--on-surface-variant)]">
              🪄 Speak 한국어 from Day 1
            </p>
            <h2
              id="onboarding-modal-title"
              className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.8px] text-[var(--on-surface)] min-[480px]:text-[36px]"
            >
              <span className="block">{tx(L, "modal_headlineBefore").trim()}</span>
              <span className="block">{tx(L, "modal_headlineAccent")}</span>
              <span className="block">
                {L === "en" ? (
                  <>
                    <span className="text-[var(--on-surface)]">in </span>
                    <span className="font-light italic text-[var(--primary)]">30 seconds.</span>
                  </>
                ) : (
                  <span
                    className={
                      L === "ko"
                        ? "text-[var(--on-surface)]"
                        : "font-light italic text-[var(--primary)]"
                    }
                  >
                    {tx(L, "modal_headlineAfter").trim()}
                  </span>
                )}
              </span>
            </h2>
            <div className="mb-5 mt-4 space-y-1 text-[15px] leading-[1.65] text-[var(--on-surface-variant)]">
              <p className="block">{tx(L, "modal_pickTopic")}</p>
              <p className="block">{tx(L, "modal_noSignup")}</p>
            </div>
            <p
              className="mb-2.5 mt-0 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--on-surface-variant)]"
              style={{ letterSpacing: "0.12em" }}
            >
              {tx(L, "home_vibeTitle")}
            </p>
            <div className="flex min-h-0 w-full max-w-full flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden min-[480px]:flex-none min-[480px]:overflow-visible">
              {[
                { cat: "idol", key: "cat_idol_card", sub: "cat_idol_sub" },
                { cat: "drama", key: "cat_drama_card", sub: "cat_drama_sub" },
                { cat: "trip", key: "cat_trip_card", sub: "cat_trip_sub" }
              ].map(({ cat, key, sub }) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem(OGU_VIBE_KEY, cat);
                    }
                    setOnboardingVibe(cat);
                    setSelectedVibe(normalizeVibe(cat));
                  }}
                  className={`group flex w-full max-w-full shrink-0 items-center gap-3 rounded-[32px] border-2 border-solid px-4 py-3 text-left transition ${
                    onboardingVibe === cat
                      ? "border-[#2a14b4] bg-[#edeafd]"
                      : "border-transparent bg-[var(--surface-low)] hover:border-[rgba(42,20,180,0.2)] hover:bg-[#edeafd]"
                  }`}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[var(--surface-lowest)] text-[18px] leading-none"
                    aria-hidden
                  >
                    {cat === "idol" ? "👑" : cat === "drama" ? "🎬" : "✈️"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold text-[var(--on-surface)]">{tx(L, key)}</span>
                    <span className="mt-0.5 block text-[12px] text-[var(--on-surface-variant)]">{tx(L, sub)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="w-full max-w-full shrink-0 space-y-4 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowOnboardingModal(false);
                goFirstLine(onboardingVibe);
              }}
              className="flex min-h-[56px] w-full max-w-full items-center justify-between gap-3 rounded-[24px] px-6 py-[14px] text-[15px] font-bold text-white transition hover:brightness-105 active:scale-[0.99]"
              style={{
                background: "linear-gradient(135deg, #2a14b4, #4338ca)",
                boxShadow: "var(--shadow-active)"
              }}
            >
              <span>{tx(L, "home_sayItNow")}</span>
              <ArrowCircleIcon />
            </button>
            <button
              type="button"
              onClick={() => setShowOnboardingModal(false)}
              className="w-full max-w-full text-center text-[13px] text-[var(--on-surface-variant)] underline underline-offset-2 transition hover:opacity-80"
            >
              {tx(L, "modal_browseBefore")}
              {tx(L, "modal_browseAccent")}
            </button>
            <p className="text-center text-[11px] opacity-50 text-[var(--on-surface)]">{tx(L, "modal_footer")}</p>
          </div>
          </div>
        </div>
      )}

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
                      {heroJourneyEnglish(L, heroDay, selectedVibe)}
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
              {tx(L, "home_vibeTitle")}
            </h2>
            <div className="mt-4 grid grid-cols-3 gap-[10px]">
              {[
                { cat: "idol", label: "home_vibeIdol", sub: "cat_idol_sub" },
                { cat: "drama", label: "home_vibeDrama", sub: "cat_drama_sub" },
                { cat: "trip", label: "home_vibeTrip", sub: "cat_trip_sub" }
              ].map(({ cat, label, sub }) => (
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
                    {vibeStripEmoji(tx(L, label))}
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
              {journeyCurrent >= 4 ? tx(L, "home_speakingJourney") : tx(L, "home_journeyTitle")}
            </p>
            <div className="mt-4 rounded-[32px] bg-[var(--surface-low)] px-4 py-2">
              {getJourneyWindowDays(journeyCurrent).map((d) => {
                const isPlaceholder = d === JOURNEY_DONE_MARKER;
                const isDone =
                  (!isPlaceholder && d < journeyCurrent) ||
                  (journeyCurrent >= JOURNEY_DONE_MARKER && !isPlaceholder);
                const isActive =
                  !isPlaceholder && d === journeyCurrent && journeyCurrent <= MAX_JOURNEY_DAY;
                const isLocked = !isDone && !isActive;
                const title = homeJourneyCardTitle(L, d, selectedVibe);
                const koLine = homeJourneyCardKo(d, selectedVibe);

                const row = (
                  <div className="flex gap-3 py-[14px]">
                    <div className="flex shrink-0 flex-col items-center justify-start pt-0.5">
                      {isDone ? (
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-[#2a14b4]"
                          style={{
                            backgroundColor: "var(--surface-lowest)",
                            boxShadow: "var(--shadow-card)"
                          }}
                          aria-hidden
                        >
                          ✓
                        </span>
                      ) : isActive ? (
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-white"
                          style={{
                            background: "linear-gradient(135deg, #2a14b4, #4338ca)",
                            boxShadow: "var(--shadow-active)"
                          }}
                          aria-hidden
                        >
                          {d}
                        </span>
                      ) : (
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-low)] text-sm font-semibold text-[var(--on-surface-variant)]"
                          aria-hidden
                        >
                          {isPlaceholder ? "…" : d}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`text-[15px] font-semibold ${
                            isLocked ? "font-normal text-[var(--on-surface-variant)]" : "text-[var(--on-surface)]"
                          }`}
                        >
                          {title}
                        </p>
                        {isActive ? (
                          <span className="rounded-[20px] bg-[#2a14b4] px-[9px] py-[3px] text-[9px] font-bold uppercase tracking-wide text-white">
                            {tx(L, "home_today")}
                          </span>
                        ) : null}
                      </div>
                      <p
                        className={`font-korean mt-1 text-[15px] leading-snug ${
                          isLocked ? "font-normal text-[var(--on-surface-variant)]" : "font-semibold text-[var(--on-surface)]"
                        }`}
                      >
                        {koLine}
                      </p>
                    </div>
                  </div>
                );

                if (isActive) {
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={openActiveJourneyDay}
                      className="block w-full text-left transition hover:opacity-95"
                    >
                      {row}
                    </button>
                  );
                }

                return (
                  <div key={`${d}-${selectedVibe}`} className={isLocked ? "opacity-90" : ""} aria-disabled={isLocked}>
                    {row}
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
                      {tx(L, "home_signInBannerTitle")}
                    </p>
                    <p className="mt-1 text-[14px] leading-relaxed text-[var(--on-surface-variant)]">
                      {tx(L, "home_signInBannerSub")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  disabled={loginBusy}
                  className="shrink-0 rounded-[20px] bg-[var(--on-surface)] px-5 py-3 text-[14px] font-bold text-[var(--surface-lowest)] transition hover:opacity-90 disabled:opacity-50"
                >
                  {tx(L, "home_signInWithGoogle")}
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
                {activeSessionBannerParts ? (
                  <>
                    {activeSessionBannerParts.before ? (
                      <span>{activeSessionBannerParts.before}</span>
                    ) : null}
                    <span className="font-extrabold text-white">{activeSessionBannerParts.count}</span>
                    <span>{activeSessionBannerParts.after}</span>
                  </>
                ) : null}
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
