"use client";

import { useState, useEffect } from "react";
import { getSessionsRemaining } from "@/lib/freeLimit";
import { getSupabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";

const LANG_KEY = "ogu_lang";
const VOICE_KEY = "kkobi_voice_gender";
const SCENARIO_ID = "compliment";
const DURATIONS = [30, 60, 90];
const DEFAULT_DURATION = 60;

const COPY = {
  en: {
    hero_1: "Practice your",
    hero_2: "fancall.",
    sub: "Pick how long you want to talk.\nWe'll be there the whole time.",
    duration_label: "Call length",
    duration_unit: "sec",
    cta: "Start rehearsal",
    free_prefix: "Free ·",
    sessions_unlimited: "Unlimited",
    sessions_loading: "…",
    sessions_left: (n) => `${n} session${n !== 1 ? "s" : ""} left today`,
    guest_sessions: "1 session today",
  },
  ko: {
    hero_1: "팬콜을",
    hero_2: "연습해요.",
    sub: "몇 초 동안 통화할지 골라주세요.\n그 순간 내내 함께할게요.",
    duration_label: "통화 시간",
    duration_unit: "초",
    cta: "리허설 시작하기",
    free_prefix: "무료 ·",
    sessions_unlimited: "무제한",
    sessions_loading: "…",
    sessions_left: (n) => `오늘 ${n}회 남음`,
    guest_sessions: "오늘 1회",
  },
  id: {
    hero_1: "Latihan panggilan",
    hero_2: "video-mu.",
    sub: "Pilih berapa lama kamu ingin bicara.\nKami akan menemanimu sepanjang waktu.",
    duration_label: "Durasi panggilan",
    duration_unit: "detik",
    cta: "Mulai latihan",
    free_prefix: "Gratis ·",
    sessions_unlimited: "Tanpa batas",
    sessions_loading: "…",
    sessions_left: (n) => `Sisa ${n} sesi hari ini`,
    guest_sessions: "1 sesi hari ini",
  },
  pt: {
    hero_1: "Pratique sua",
    hero_2: "fancall.",
    sub: "Escolha por quanto tempo quer falar.\nVamos estar com você o tempo todo.",
    duration_label: "Duração da chamada",
    duration_unit: "seg",
    cta: "Começar o ensaio",
    free_prefix: "Grátis ·",
    sessions_unlimited: "Ilimitado",
    sessions_loading: "…",
    sessions_left: (n) => `${n} sessões restantes hoje`,
    guest_sessions: "1 sessão hoje",
  },
  fr: {
    hero_1: "Entraînez votre",
    hero_2: "fancall.",
    sub: "Choisissez la durée de votre appel.\nOn sera là du début à la fin.",
    duration_label: "Durée de l'appel",
    duration_unit: "sec",
    cta: "Commencer la répétition",
    free_prefix: "Gratuit ·",
    sessions_unlimited: "Illimité",
    sessions_loading: "…",
    sessions_left: (n) => `${n} sessions restantes aujourd'hui`,
    guest_sessions: "1 session aujourd'hui",
  },
};

export default function EntryPage() {
  const [lang, setLang] = useState("en");
  const [user, setUser] = useState(null);
  const [isPaid, setIsPaid] = useState(false);
  const [sessionsLeft, setSessionsLeft] = useState(null);
  const [voiceGender, setVoiceGender] = useState("FEMALE");
  const [idolName, setIdolName] = useState("");
  const [duration, setDuration] = useState(DEFAULT_DURATION);

  useEffect(() => {
    const savedLang = localStorage.getItem(LANG_KEY) || "en";
    setLang(savedLang);
    const savedGender = localStorage.getItem(VOICE_KEY) || "FEMALE";
    setVoiceGender(savedGender);
    const savedIdol = localStorage.getItem("kkobi_idol_name");
    if (savedIdol && savedIdol !== "IDOL") {
      setIdolName(savedIdol);
    }

    const supabase = getSupabase();

    const readPaid = () => {
      const tier = localStorage.getItem("kkobi_pass_tier");
      const expires = localStorage.getItem("kkobi_pass_expires");
      return Boolean(
        tier === "prep_pass" &&
          expires &&
          new Date(expires) > new Date(),
      );
    };

    function applyDerived(maybeUser) {
      const paid = readPaid();
      setIsPaid(paid);
      setSessionsLeft(getSessionsRemaining(maybeUser?.id ?? null, paid));
    }

    async function init() {
      let currentUser = null;
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        currentUser = session?.user ?? null;
        setUser(currentUser);
      }
      applyDerived(currentUser);
    }

    void init();

    let authSubscription = null;
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          const u = session?.user ?? null;
          setUser(u);
          applyDerived(u);
        },
      );
      authSubscription = data?.subscription ?? null;
    }

    return () => authSubscription?.unsubscribe?.();
  }, []);

  const t = COPY[lang] || COPY.en;

  function handleStart() {
    if (!isPaid && sessionsLeft !== null && sessionsLeft <= 0) {
      window.location.href = `/my-90-seconds/paywall?scenario=${SCENARIO_ID}`;
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(VOICE_KEY, voiceGender);
      const finalIdolName = idolName.trim().toUpperCase() || "IDOL";
      localStorage.setItem("kkobi_idol_name", finalIdolName);
    }
    trackEvent("m90s_scenario_selected", {
      scenario: SCENARIO_ID,
      user_type: user ? "member" : "guest",
      is_paid: isPaid,
    });
    window.location.href = `/my-90-seconds/prep?scenario=${SCENARIO_ID}&duration=${duration}`;
  }

  return (
    <div style={{
      background: "#0E0E0F",
      minHeight: "100vh",
      maxWidth: 390,
      margin: "0 auto",
      fontFamily: "'Inter', sans-serif",
      color: "#F2F0F4",
      padding: "24px 22px 48px",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* 상단 로고 — 홈과 동일 */}
      <div style={{
        display: "flex", alignItems: "center",
        gap: 6, marginBottom: 32,
      }}>
        <span style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: 15, fontWeight: 800,
          letterSpacing: "-0.02em", color: "#F2F0F4",
        }}>
          My90Seconds
        </span>
      </div>

      {/* 메인 카피 */}
      <h1 style={{
        fontFamily: "'Manrope', sans-serif",
        fontSize: 22, fontWeight: 800,
        letterSpacing: "-0.01em",
        lineHeight: 1.1, marginBottom: 12,
      }}>
        {t.hero_1}<br />
        <span style={{ color: "#FFD84D" }}>
          {t.hero_2}
        </span>
      </h1>

      {/* 서브 카피 */}
      <p style={{
        fontSize: 13, fontWeight: 500, color: "#B0AEB8",
        lineHeight: 1.65, marginBottom: 28,
        whiteSpace: "pre-line",
      }}>
        {t.sub}
      </p>

      {/* Duration 선택 */}
      <p style={{
        fontSize: "9px",
        color: "#FFD84D",
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        margin: "0 0 10px",
        fontFamily: "'Manrope', sans-serif",
      }}>
        {t.duration_label}
      </p>
      <div style={{
        display: "flex",
        gap: 8,
        marginBottom: 24,
      }}>
        {DURATIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDuration(d)}
            style={{
              flex: 1,
              position: "relative",
              background: duration === d ? "#FFD84D" : "rgba(255,255,255,0.03)",
              border: duration === d
                ? "none"
                : "0.5px solid rgba(255,255,255,0.1)",
              borderRadius: 14,
              padding: "18px 8px",
              cursor: "pointer",
              textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            <div style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: 22,
              fontWeight: 800,
              color: duration === d ? "#0E0E0F" : "#F2F0F4",
            }}>
              {d}
            </div>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              marginTop: 2,
              color: duration === d ? "rgba(14,14,15,0.6)" : "#7A7882",
            }}>
              {t.duration_unit}
            </div>
            {duration === d && (
              <span style={{
                position: "absolute",
                top: 6,
                right: 8,
                fontSize: 11,
                fontWeight: 800,
                color: "#0E0E0F",
              }}>
                ✓
              </span>
            )}
          </button>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={handleStart}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "14px 24px",
          borderRadius: 9999,
          background: "#FFD84D",
          border: "none",
          cursor: "pointer",
          marginBottom: 10,
        }}
      >
        <span style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: 11, fontWeight: 700,
          color: "#0E0E0F",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}>
          {t.cta}
        </span>
      </button>

      {/* 횟수 표시 */}
      <p style={{
        fontSize: "10px",
        fontWeight: 500,
        color: "rgba(255,255,255,0.25)",
        letterSpacing: "0.08em",
        textAlign: "center",
        marginTop: "8px",
      }}>
        {user ? (
          <>
            {t.free_prefix}{" "}
            <span style={{ color: "#FFD84D" }}>
              {isPaid
                ? t.sessions_unlimited
                : sessionsLeft === null
                  ? t.sessions_loading
                  : t.sessions_left(sessionsLeft)}
            </span>
          </>
        ) : (
          <>
            {t.free_prefix}{" "}
            <span style={{ color: "#FFD84D" }}>{t.guest_sessions}</span>
          </>
        )}
      </p>
    </div>
  );
}
