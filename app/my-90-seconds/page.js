"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const DAILY_LIMIT = 3;
const FREE_DATE_KEY = "kkobi_m90s_free_date";
const FREE_COUNT_KEY = "kkobi_m90s_free_count";
const LANG_KEY = "ogu_lang";
const VOICE_KEY = "kkobi_voice_gender";

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
  },
};

const SCENARIO_IDS = [
  "compliment", "birthday", "game",
  "request", "question", "confession"
];

const EMOJIS = ["💝", "🎂", "🎮", "🎤", "💬", "💗"];

function getRemainingCount() {
  if (typeof window === "undefined") return DAILY_LIMIT;
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = localStorage.getItem(FREE_DATE_KEY);
  if (lastDate !== today) return DAILY_LIMIT;
  const count = parseInt(localStorage.getItem(FREE_COUNT_KEY) || "0");
  return Math.max(0, DAILY_LIMIT - count);
}

function markOneUsed() {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(FREE_DATE_KEY, today);
  const count = parseInt(localStorage.getItem(FREE_COUNT_KEY) || "0");
  localStorage.setItem(FREE_COUNT_KEY, String(count + 1));
}

function ScenarioPageInner() {
  const searchParams = useSearchParams();
  const preSelected = searchParams.get("scenario");

  const [selected, setSelected] = useState(preSelected || null);
  const [lang, setLang] = useState("en");
  const [remaining, setRemaining] = useState(DAILY_LIMIT);
  const [voiceGender, setVoiceGender] = useState("FEMALE");
  const [idolName, setIdolName] = useState("");

  useEffect(() => {
    const savedLang = localStorage.getItem(LANG_KEY) || "en";
    setLang(savedLang);
    setRemaining(getRemainingCount());
    const savedGender = localStorage.getItem(VOICE_KEY) || "FEMALE";
    setVoiceGender(savedGender);
    const savedIdol = localStorage.getItem("kkobi_idol_name");
    if (savedIdol && savedIdol !== "IDOL") {
      setIdolName(savedIdol);
    }
  }, []);

  const t = COPY[lang] || COPY.en;
  const selectedIndex = SCENARIO_IDS.indexOf(selected);
  const selectedLabel = selectedIndex >= 0 ? t.scenarios[selectedIndex] : null;

  function handleStart() {
    if (!selected || remaining <= 0) return;
    markOneUsed();
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
        gap: 8, marginBottom: 24,
      }}>
        {SCENARIO_IDS.map((id, i) => (
          <button
            key={id}
            onClick={() => setSelected(id)}
            style={{
              background: selected === id ? "#221e23" : "#1A191B",
              borderRadius: 14, padding: "14px 12px",
              border: "none", cursor: "pointer",
              textAlign: "center", position: "relative",
              overflow: "hidden", transition: "background 0.15s",
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
          </button>
        ))}
      </div>

      {/* 구분선 */}
      <div style={{
        height: 1,
        background: "rgba(255,255,255,0.06)",
        margin: "16px 0",
      }} />

      {/* 목소리 선택 */}
      <div style={{
        background: "#1A191B",
        borderRadius: 14,
        padding: "14px 16px",
        marginBottom: 16,
      }}>
        {/* 헤더 */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
        }}>
          <span style={{ fontSize: 14 }}>🎧</span>
          <p style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 12, fontWeight: 700,
            color: "#F2F0F4", margin: 0,
          }}>
            {t.voice_label}
          </p>
        </div>

        {/* 설명 */}
        <p style={{
          fontSize: 10, color: "#5C5A62",
          margin: "0 0 12px", lineHeight: 1.5,
        }}>
          {t.voice_desc}
        </p>

        {/* 가로 배치 버튼 */}
        <div style={{ display: "flex", gap: 8 }}>
          {["FEMALE", "MALE"].map((g) => (
            <button
              key={g}
              onClick={() => {
                setVoiceGender(g);
                if (typeof window !== "undefined") {
                  localStorage.setItem(VOICE_KEY, g);
                }
              }}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 10,
                border: "none",
                background: voiceGender === g
                  ? "#FF8AA9"
                  : "#2C2C2D",
                color: voiceGender === g
                  ? "#fff"
                  : "#5C5A62",
                fontSize: 12,
                fontWeight: voiceGender === g ? 700 : 600,
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                transition: "all 0.15s",
              }}
            >
              {g === "FEMALE" ? t.voice_female : t.voice_male}
            </button>
          ))}
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: "16px",
            padding: "16px 18px",
            marginTop: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "4px",
            }}
          >
            <span style={{ fontSize: "15px" }}>✨</span>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#fff",
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              Idol&apos;s name
            </span>
            <span
              style={{
                fontSize: "10px",
                color: "rgba(255,255,255,0.4)",
                fontWeight: 400,
                marginLeft: "2px",
              }}
            >
              optional
            </span>
          </div>

          <div
            style={{
              fontSize: "11px",
              color: "rgba(255,255,255,0.45)",
              marginBottom: "14px",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Your fansign call will use this name throughout
          </div>

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
              padding: "10px 16px",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "9999px",
              color: "#fff",
              fontSize: "13px",
              fontFamily: "'Inter', sans-serif",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "rgba(255,138,169,0.5)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(255,255,255,0.1)";
            }}
          />
        </div>
      </div>

      {/* CTA 영역 */}
      {remaining <= 0 ? (
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

          {/* 횟수 한 줄만 */}
          <p style={{
            textAlign: "center", fontSize: 11,
            color: "#5C5A62", margin: 0,
          }}>
            {typeof t.free_badge === "function"
              ? t.free_badge(remaining)
              : `Free · ${remaining} sessions left today`}
          </p>
        </>
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
