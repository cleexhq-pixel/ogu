"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getSessionsRemaining } from "@/lib/freeLimit";
import { getSupabase } from "@/lib/supabase";
import { calculateDday, formatDday } from "@/src/lib/dday";

const LANG_KEY = "ogu_lang";
const VOICE_KEY = "kkobi_voice_gender";
const FANSIGN_DATE_KEY = "kkobi_m90s_fansign_date";

const COPY = {
  en: {
    eyebrow: "Fansign Video Call Prep",
    hero_1: "What do you",
    hero_2: "want to say?",
    sub: "Pick the moment that matters.\nWe'll prepare every word with you.",
    cta_placeholder: "Choose a moment first",
    cta_ready: (s) => `Prepare for ${s}`,
    free_badge: (n) => `Free · ${n} sessions left today`,
    limit_title: "All done for today!",
    limit_desc: "Come back tomorrow for 3 more sessions 🌙",
    scenarios: [
      "Compliment", "Birthday", "Game",
      "Request", "Ask", "Confession"
    ],
    voice_label: "Idol's voice",
    voice_desc: "Your idol will speak during the 90-second simulation",
    voice_female: "Female",
    voice_male: "Male",
    fansign_date_label: "Fansign date",
    fansign_date_optional: "Optional",
    fansign_date_hint:
      "Stronger coaching when we know your date",
    fansign_date_placeholder: "YYYY-MM-DD",
    dday_label_format: "D-{n}",
  },
  ko: {
    eyebrow: "영통 팬싸인회 준비 서비스",
    hero_1: "무엇을",
    hero_2: "말하고 싶나요?",
    sub: "마음 가는 걸 고르세요.\n한 마디 한 마디 함께 준비할게요.",
    cta_placeholder: "먼저 순간을 골라주세요",
    cta_ready: (s) => `${s} 준비하기`,
    free_badge: (n) => `무료 · 오늘 ${n}회 남음`,
    limit_title: "오늘 연습을 다 했어요!",
    limit_desc: "내일 다시 3회 충전돼요 🌙",
    scenarios: [
      "칭찬하기", "생일 축하", "게임하기",
      "멘트 요청", "질문하기", "사랑 고백"
    ],
    voice_label: "아이돌 목소리",
    voice_desc: "90초 시뮬레이션에서 아이돌이 이 목소리로 말해요",
    voice_female: "여성",
    voice_male: "남성",
    fansign_date_label: "팬싸 날짜",
    fansign_date_optional: "선택",
    fansign_date_hint:
      "날짜를 알려주면 더 강력한 코칭을 받을 수 있어요",
    fansign_date_placeholder: "YYYY-MM-DD",
    dday_label_format: "D-{n}",
  },
  id: {
    eyebrow: "Persiapan Video Call Fansign",
    hero_1: "Apa yang ingin",
    hero_2: "kamu ucapkan?",
    sub: "Pilih momen yang paling berarti.\nKami siapkan setiap kata bersamamu.",
    cta_placeholder: "Pilih momen dulu",
    cta_ready: (s) => `Siapkan ${s}`,
    free_badge: (n) => `Gratis · Sisa ${n} sesi hari ini`,
    limit_title: "Sesi hari ini sudah habis!",
    limit_desc: "Kembali besok untuk 3 sesi lagi 🌙",
    scenarios: [
      "Pujian", "Ulang Tahun", "Game",
      "Permintaan", "Tanya", "Pengakuan"
    ],
    voice_label: "Suara idol",
    voice_desc: "Idolmu akan berbicara dengan suara ini saat simulasi",
    voice_female: "Perempuan",
    voice_male: "Laki-laki",
    fansign_date_label: "Tanggal fansign",
    fansign_date_optional: "Opsional",
    fansign_date_hint:
      "Coaching-nya makin mantap kalau kami tahu tanggalnya",
    fansign_date_placeholder: "YYYY-MM-DD",
    dday_label_format: "D-{n}",
  },
  pt: {
    eyebrow: "Preparação para Fansign",
    hero_1: "O que você quer",
    hero_2: "dizer?",
    sub: "Escolha o momento que importa.\nVamos preparar cada palavra com você.",
    cta_placeholder: "Escolha um momento primeiro",
    cta_ready: (s) => `Preparar ${s}`,
    free_badge: (n) => `Grátis · ${n} sessões restantes hoje`,
    limit_title: "Sessões de hoje esgotadas!",
    limit_desc: "Volte amanhã para mais 3 sessões 🌙",
    scenarios: [
      "Elogio", "Aniversário", "Jogo",
      "Pedido", "Pergunta", "Confissão"
    ],
    voice_label: "Voz do idol",
    voice_desc: "Seu idol vai falar durante a simulação de 90 segundos",
    voice_female: "Feminino",
    voice_male: "Masculino",
    fansign_date_label: "Data do fansign",
    fansign_date_optional: "Opcional",
    fansign_date_hint:
      "O coaching fica mais forte quando a gente sabe a data",
    fansign_date_placeholder: "YYYY-MM-DD",
    dday_label_format: "D-{n}",
  },
  fr: {
    eyebrow: "Préparation Appel Vidéo Fansign",
    hero_1: "Que voulez-vous",
    hero_2: "dire?",
    sub: "Choisissez le moment qui compte.\nNous préparerons chaque mot avec vous.",
    cta_placeholder: "Choisissez un moment d'abord",
    cta_ready: (s) => `Préparer ${s}`,
    free_badge: (n) => `Gratuit · ${n} sessions restantes`,
    limit_title: "Sessions du jour épuisées!",
    limit_desc: "Revenez demain pour 3 nouvelles sessions 🌙",
    scenarios: [
      "Compliment", "Anniversaire", "Jeu",
      "Demande", "Question", "Confession"
    ],
    voice_label: "Voix de l'idol",
    voice_desc: "Votre idol parlera pendant la simulation de 90 secondes",
    voice_female: "Féminin",
    voice_male: "Masculin",
    fansign_date_label: "Date du fansign",
    fansign_date_optional: "Optionnel",
    fansign_date_hint:
      "Un coaching encore plus solide si on connaît ta date",
    fansign_date_placeholder: "YYYY-MM-DD",
    dday_label_format: "D-{n}",
  },
};

const SCENARIO_IDS = [
  "compliment", "birthday", "game",
  "request", "question", "confession"
];

const EMOJIS = ["💝", "🎂", "🎮", "🎤", "💬", "💗"];

function ScenarioPageInner() {
  const searchParams = useSearchParams();
  const preSelected = searchParams.get("scenario");

  const [selected, setSelected] = useState(preSelected || null);
  const [lang, setLang] = useState("en");
  const [user, setUser] = useState(null);
  const [isPaid, setIsPaid] = useState(false);
  const [sessionsLeft, setSessionsLeft] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [voiceGender, setVoiceGender] = useState("FEMALE");
  const [idolName, setIdolName] = useState("");
  const [fansignDate, setFansignDate] = useState("");

  useEffect(() => {
    const savedLang = localStorage.getItem(LANG_KEY) || "en";
    setLang(savedLang);
    const savedGender = localStorage.getItem(VOICE_KEY) || "FEMALE";
    setVoiceGender(savedGender);
    const savedIdol = localStorage.getItem("kkobi_idol_name");
    if (savedIdol && savedIdol !== "IDOL") {
      setIdolName(savedIdol);
    }
    const savedFansign = localStorage.getItem(FANSIGN_DATE_KEY);
    if (savedFansign && /^\d{4}-\d{2}-\d{2}$/.test(savedFansign.trim())) {
      setFansignDate(savedFansign.trim());
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

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("code")) {
        setTimeout(() => {
          void (async () => {
            let currentUser = null;
            if (supabase) {
              const {
                data: { session },
              } = await supabase.auth.getSession();
              currentUser = session?.user ?? null;
              setUser(currentUser);
            }
            applyDerived(currentUser);
            window.history.replaceState({}, "", window.location.pathname);
          })();
        }, 500);
      }
    }

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
  const selectedIndex = SCENARIO_IDS.indexOf(selected);
  const selectedLabel = selectedIndex >= 0 ? t.scenarios[selectedIndex] : null;

  function isLocked(index) {
    if (user) return false;
    return index !== 0;
  }

  async function continueWithGoogle() {
    if (typeof window === "undefined") return;
    const supabase = getSupabase();
    if (!supabase) return;
    const next = encodeURIComponent("/my-90-seconds");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
      },
    });
  }

  function handleStart() {
    if (!selected) return;
    const idx = SCENARIO_IDS.indexOf(selected);
    if (idx < 0) return;

    if (isLocked(idx)) {
      setShowLoginModal(true);
      return;
    }

    if (!isPaid && sessionsLeft !== null && sessionsLeft <= 0) {
      window.location.href = `/my-90-seconds/paywall?scenario=${encodeURIComponent(
        selected,
      )}`;
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(VOICE_KEY, voiceGender);
      const finalIdolName = idolName.trim().toUpperCase() || "IDOL";
      localStorage.setItem("kkobi_idol_name", finalIdolName);
    }
    window.location.href = `/my-90-seconds/prep?scenario=${selected}`;
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

      {/* Spotlight */}
      <div style={{
        position: "absolute",
        width: 280, height: 280,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(158,143,253,0.12) 0%, transparent 70%)",
        top: -60, right: -60,
        pointerEvents: "none",
      }} />

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
          My<span style={{
            background: "linear-gradient(135deg, #FF8AA9, #FF719B)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>90</span>Seconds
        </span>
      </div>

      {/* 메인 카피 */}
      <h1 style={{
        fontFamily: "'Manrope', sans-serif",
        fontSize: 32, fontWeight: 800,
        letterSpacing: "-0.03em",
        lineHeight: 1.1, marginBottom: 12,
      }}>
        {t.hero_1}<br />
        <span style={{
          background: "linear-gradient(135deg, #FF8AA9, #FF719B)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          {t.hero_2}
        </span>
      </h1>

      {/* 서브 카피 */}
      <p style={{
        fontSize: 14, color: "#9E9BA4",
        lineHeight: 1.65, marginBottom: 28,
        whiteSpace: "pre-line",
      }}>
        {t.sub}
      </p>

      {/* 시나리오 그리드 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8, marginBottom: 8,
      }}>
        {SCENARIO_IDS.map((id, i) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              if (isLocked(i)) {
                setShowLoginModal(true);
                return;
              }
              setSelected(id);
            }}
            style={{
              background: selected === id ? "#221e23" : "#1A191B",
              borderRadius: 14, padding: "14px 12px",
              border: "none", cursor: "pointer",
              textAlign: "center", position: "relative",
              overflow: "hidden", transition: "background 0.15s",
              opacity: isLocked(i) ? 0.38 : 1,
            }}
          >
            {selected === id && (
              <div style={{
                position: "absolute", inset: 0,
                borderRadius: 14,
                border: "1.5px solid rgba(255,138,169,0.6)",
                pointerEvents: "none",
              }} />
            )}
            <span style={{
              fontSize: 20, marginBottom: 8,
              display: "block",
            }}>
              {EMOJIS[i]}
            </span>
            <p style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: 12, fontWeight: 700,
              color: "#F2F0F4", margin: 0,
            }}>
              {t.scenarios[i]}
            </p>
            {!user && i === 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "6px",
                  right: "6px",
                  fontSize: "9px",
                  fontWeight: 700,
                  background: "rgba(255,138,169,0.18)",
                  color: "#FF8AA9",
                  padding: "2px 6px",
                  borderRadius: "99px",
                }}
              >
                Free
              </span>
            )}
            {isLocked(i) && (
              <span
                style={{
                  position: "absolute",
                  top: "7px",
                  right: "8px",
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.2)",
                }}
              >
                🔒
              </span>
            )}
          </button>
        ))}
      </div>

      {!user && (
        <div
          style={{
            margin: "8px 0 0",
            background: "rgba(255,255,255,0.03)",
            border: "0.5px solid rgba(255,255,255,0.07)",
            borderRadius: "10px",
            padding: "9px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.32)" }}>
            Sign in to unlock all scenarios — free
          </span>
          <button
            type="button"
            onClick={() => setShowLoginModal(true)}
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#FF8AA9",
              background: "none",
              border: "none",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            Sign in →
          </button>
        </div>
      )}

      {/* 구분선 */}
      <div style={{
        height: 1,
        background: "rgba(255,255,255,0.06)",
        margin: "16px 0",
      }} />

      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: "14px",
        padding: "16px",
        marginBottom: "10px",
      }}>
        <p style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "#fff",
          margin: "0 0 4px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}>
          <span aria-hidden="true">🎧</span>
          <span>{t.voice_label}</span>
        </p>
        <p style={{
          fontSize: "11px",
          color: "rgba(255,255,255,0.3)",
          margin: "0 0 12px",
          lineHeight: 1.5,
        }}>
          {t.voice_desc}
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
        }}>
          {(["FEMALE", "MALE"]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                setVoiceGender(g);
                if (typeof window !== "undefined") {
                  localStorage.setItem(VOICE_KEY, g);
                }
              }}
              style={{
                background: voiceGender === g
                  ? "linear-gradient(135deg, #FF8AA9, #FF719B)"
                  : "rgba(255,255,255,0.07)",
                border: "none",
                borderRadius: "99px",
                padding: "10px",
                fontSize: "13px",
                fontWeight: 600,
                color: voiceGender === g ? "#fff" : "rgba(255,255,255,0.5)",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {g === "FEMALE" ? t.voice_female : t.voice_male}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: "14px",
        padding: "16px",
        marginBottom: "10px",
      }}>
        <p style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "#fff",
          margin: "0 0 4px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexWrap: "wrap",
        }}>
          <span aria-hidden="true">✨</span>
          <span>Idol&apos;s name</span>
          <span style={{
            fontSize: "11px",
            fontWeight: 400,
            color: "rgba(255,255,255,0.3)",
          }}>
            optional
          </span>
        </p>
        <p style={{
          fontSize: "11px",
          color: "rgba(255,255,255,0.3)",
          margin: "0 0 12px",
          lineHeight: 1.5,
        }}>
          Your fansign call will use this name throughout
        </p>
        <input
          type="text"
          value={idolName}
          onChange={(e) => setIdolName(e.target.value)}
          placeholder={
            voiceGender === "MALE"
              ? "e.g. Jisung, Felix, Mingyu"
              : "e.g. Wonyoung, Chaeyeon, Karina"
          }
          maxLength={20}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "none",
            borderRadius: "10px",
            padding: "12px 14px",
            fontSize: "13px",
            color: "#fff",
            boxSizing: "border-box",
            fontFamily: "'Inter', sans-serif",
            outline: "none",
          }}
        />
      </div>

      <div
        style={{
          background: "rgba(255,216,77,0.05)",
          border: "1px dashed rgba(255,216,77,0.25)",
          borderRadius: "14px",
          padding: "14px 12px",
          marginBottom: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#FFD84D",
              fontFamily: "'Manrope', sans-serif",
              letterSpacing: "0.04em",
            }}
          >
            <span aria-hidden="true">🎟 </span>
            {t.fansign_date_label.toUpperCase()}
          </span>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.38)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {t.fansign_date_optional}
          </span>
        </div>
        <p
          style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.52)",
            margin: "0 0 12px",
            lineHeight: 1.55,
          }}
        >
          {t.fansign_date_hint}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <input
            type="date"
            value={fansignDate}
            aria-label={t.fansign_date_label}
            onChange={(e) => {
              const v = e.target.value;
              setFansignDate(v);
              if (typeof window === "undefined") return;
              if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
                localStorage.setItem(FANSIGN_DATE_KEY, v);
              } else {
                localStorage.removeItem(FANSIGN_DATE_KEY);
              }
            }}
            style={{
              flex: 1,
              minWidth: 0,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,216,77,0.2)",
              borderRadius: "10px",
              padding: "10px 12px",
              fontSize: "13px",
              color: "#fff",
              boxSizing: "border-box",
              fontFamily: "'Inter', sans-serif",
              outline: "none",
              colorScheme: "dark",
            }}
          />
          {fansignDate && /^\d{4}-\d{2}-\d{2}$/.test(fansignDate) ? (
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#FFD84D",
                whiteSpace: "nowrap",
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              {(() => {
                const n = calculateDday(fansignDate);
                if (n === null) return "";
                if (n > 0)
                  return t.dday_label_format.replace("{n}", String(n));
                return formatDday(n);
              })()}
            </span>
          ) : null}
        </div>
        <p
          style={{
            fontSize: "10px",
            color: "rgba(255,255,255,0.28)",
            margin: "10px 0 0",
          }}
        >
          {t.fansign_date_placeholder}
        </p>
      </div>

      {/* CTA 영역 */}
      {!isPaid && sessionsLeft !== null && sessionsLeft <= 0 ? (
        <div style={{
          background: "#1A191B",
          borderRadius: 14, padding: "18px 16px",
          textAlign: "center",
        }}>
          <p style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 14, fontWeight: 700,
            color: "#F2F0F4", marginBottom: 4,
          }}>
            {t.limit_title}
          </p>
          <p style={{ fontSize: 12, color: "#9E9BA4" }}>
            {t.limit_desc}
          </p>
        </div>
      ) : (
        <>
          {/* D안 스타일 CTA 버튼 */}
          <button
            onClick={handleStart}
            disabled={!selected}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 14px 14px 24px",
              borderRadius: 9999,
              background: selected ? "#FF8AA9" : "#2C2C2D",
              border: "none", cursor: selected ? "pointer" : "default",
              marginBottom: 10,
              transition: "background 0.2s",
            }}
          >
            <div style={{ width: 32 }} />
            <span style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: 14, fontWeight: 700,
              color: selected ? "#fff" : "#5C5A62",
              letterSpacing: "0.01em",
            }}>
              {selected && selectedLabel
                ? t.cta_ready(selectedLabel)
                : t.cta_placeholder}
            </span>
            <div style={{
              width: 32, height: 32,
              borderRadius: "50%",
              background: selected
                ? "rgba(255,255,255,0.25)"
                : "rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M7 3l4 4-4 4"
                  stroke={selected ? "#fff" : "#5C5A62"}
                  strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </button>

          {/* 횟수 표시 */}
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: "8px" }}>
            {user ? (
              <>
                Free ·{" "}
                <span style={{ color: "#FF8AA9" }}>
                  {isPaid
                    ? "Unlimited"
                    : sessionsLeft === null
                      ? "…"
                      : `${sessionsLeft} session${sessionsLeft !== 1 ? "s" : ""} left today`}
                </span>
              </>
            ) : (
              "Free · 1 session today"
            )}
          </p>
        </>
      )}

      {showLoginModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "0 24px",
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: "#1A191B",
              borderRadius: "20px",
              padding: "28px 24px",
              width: "100%",
              maxWidth: "340px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔒</div>
            <p
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#fff",
                margin: "0 0 8px",
              }}
            >
              Unlock all 5 scenarios
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "rgba(255,255,255,0.4)",
                margin: "0 0 20px",
                lineHeight: 1.6,
              }}
            >
              Sign in to practice every fansign moment — free.
            </p>

            {[
              "All 5 scenarios unlocked",
              "3 sessions per day — free",
              "Progress & idol name saved",
              "Korean lessons access",
            ].map((perk) => (
              <div
                key={perk}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.6)",
                  textAlign: "left",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#FF8AA9",
                    flexShrink: 0,
                  }}
                />
                {perk}
              </div>
            ))}

            <button
              type="button"
              onClick={() => void continueWithGoogle()}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #FF8AA9, #FF719B)",
                border: "none",
                borderRadius: "99px",
                padding: "14px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#fff",
                cursor: "pointer",
                marginTop: "8px",
              }}
            >
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => setShowLoginModal(false)}
              style={{
                width: "100%",
                background: "none",
                border: "0.5px solid rgba(255,255,255,0.15)",
                borderRadius: "99px",
                padding: "12px",
                fontSize: "13px",
                color: "rgba(255,255,255,0.4)",
                cursor: "pointer",
                marginTop: "8px",
              }}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScenarioPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh", background: "#0E0E0F",
        display: "flex", alignItems: "center",
        justifyContent: "center",
      }}>
        <p style={{ color: "#5C5A62", fontSize: 13 }}>Loading...</p>
      </div>
    }>
      <ScenarioPageInner />
    </Suspense>
  );
}
