"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DAILY_LIMIT = 3;
const FREE_DATE_KEY = "kkobi_m90s_free_date";
const FREE_COUNT_KEY = "kkobi_m90s_free_count";
const LANG_KEY = "ogu_lang";

const LANGS = [
  { code: "en", label: "EN", flag: "🇺🇸" },
  { code: "ko", label: "KO", flag: "🇰🇷" },
  { code: "id", label: "ID", flag: "🇮🇩" },
  { code: "pt", label: "PT", flag: "🇧🇷" },
  { code: "fr", label: "FR", flag: "🇫🇷" },
];

const COPY = {
  en: {
    nav_learn: "Korean Learning",
    remaining: (n) => `${n} left today`,
    hero_title_1: "Those 90 seconds,",
    hero_title_2: "make them unforgettable",
    hero_sub: "You worked hard for this moment.\nDon't let it slip away.\nGet ready for a real connection.",
    cta: "Get Ready in 90 Seconds",
    free_note: "Free · 3 times a day · No account needed",
    section_scenario: "What would you like to practice",
    section_why: "Why you should practice",
    why: [
      { title: "Your mind might go blank", desc: "Without preparation, 90 seconds can feel like 10." },
      { title: "Your idol is waiting to talk", desc: "Long silences make it awkward for both of you." },
      { title: "This is a once-in-a-lifetime moment", desc: "The difference between prepared and unprepared is obvious." },
    ],
    cta_bottom: "Get Ready in 90 Seconds",
    learn_title: "Want to learn Korean too?",
    learn_desc: "Kkobi Day 1~30 learning flow",
    learn_btn: "Go",
    limit_title: "You've used all your sessions today!",
    limit_desc: "Come back tomorrow for 3 more sessions 🌙",
    scenarios: ["Compliment", "Birthday", "Game", "Request", "Ask", "Confession"],
  },
  ko: {
    nav_learn: "한국어 학습",
    remaining: (n) => `오늘 ${n}회 남음`,
    hero_title_1: "어렵게 얻은 90초,",
    hero_title_2: "평생 기억될 순간으로",
    hero_sub: "어렵게 얻은 기회예요.\n그냥 흘려보내지 말고\n진짜 마음을 전할 준비를 해요.",
    cta: "90초, 후회 없이 준비하기",
    free_note: "무료 · 하루 3회 · 계정 불필요",
    section_scenario: "어떤 순간을 연습할까요",
    section_why: "왜 연습해야 할까요",
    why: [
      { title: "머리가 하얘질 수 있어요", desc: "준비 없이 들어가면 90초가 10초처럼 끝나요." },
      { title: "아이돌은 대화를 기다려요", desc: "침묵이 길어지면 양쪽 모두 어색해져요." },
      { title: "한 번뿐인 기회예요", desc: "연습한 사람과 안 한 사람의 차이는 분명해요." },
    ],
    cta_bottom: "90초, 후회 없이 준비하기",
    learn_title: "한국어도 함께 배우고 싶다면",
    learn_desc: "꼬비 Day 1~30 학습 플로우",
    learn_btn: "이동하기",
    limit_title: "오늘 연습을 다 했어요!",
    limit_desc: "내일 다시 3회 충전돼요 🌙",
    scenarios: ["칭찬", "생일 축하", "게임", "멘트 요청", "질문", "사랑 고백"],
  },
  id: {
    nav_learn: "Belajar Korea",
    remaining: (n) => `Sisa ${n} hari ini`,
    hero_title_1: "90 detik berharga itu,",
    hero_title_2: "buat jadi tak terlupakan",
    hero_sub: "Kamu sudah berjuang untuk momen ini.\nJangan biarkan begitu saja.\nSiapkan dirimu untuk koneksi yang nyata.",
    cta: "Siap dalam 90 Detik",
    free_note: "Gratis · 3x sehari · Tanpa akun",
    section_scenario: "Apa yang ingin kamu latih",
    section_why: "Kenapa harus latihan",
    why: [
      { title: "Kamu bisa blank total", desc: "Tanpa persiapan, 90 detik bisa terasa seperti 10 detik." },
      { title: "Idolmu menunggu diajak bicara", desc: "Diam terlalu lama bikin canggung untuk keduanya." },
      { title: "Ini kesempatan sekali seumur hidup", desc: "Perbedaan antara yang siap dan tidak siap sangat jelas." },
    ],
    cta_bottom: "Siap dalam 90 Detik",
    learn_title: "Mau belajar bahasa Korea juga?",
    learn_desc: "Alur belajar Kkobi Day 1~30",
    learn_btn: "Pergi",
    limit_title: "Sesi latihan hari ini habis!",
    limit_desc: "Kembali besok untuk 3 sesi lagi 🌙",
    scenarios: ["Pujian", "Ulang Tahun", "Game", "Permintaan", "Tanya", "Pengakuan"],
  },
  pt: {
    nav_learn: "Aprender Coreano",
    remaining: (n) => `${n} restantes hoje`,
    hero_title_1: "Aqueles 90 segundos,",
    hero_title_2: "torne-os inesquecíveis",
    hero_sub: "Você se esforçou por este momento.\nNão deixe escapar.\nPrepare-se para uma conexão verdadeira.",
    cta: "Prepare-se em 90 Segundos",
    free_note: "Grátis · 3x por dia · Sem conta",
    section_scenario: "O que você quer praticar",
    section_why: "Por que praticar",
    why: [
      { title: "Sua mente pode travar", desc: "Sem preparação, 90 segundos parecem 10." },
      { title: "Seu idol está esperando conversar", desc: "Silêncio longo deixa tudo constrangedor." },
      { title: "Esta é uma chance única", desc: "A diferença entre preparado e despreparado é clara." },
    ],
    cta_bottom: "Prepare-se em 90 Segundos",
    learn_title: "Quer aprender coreano também?",
    learn_desc: "Fluxo de aprendizado Kkobi Day 1~30",
    learn_btn: "Ir",
    limit_title: "Você usou todas as sessões de hoje!",
    limit_desc: "Volte amanhã para mais 3 sessões 🌙",
    scenarios: ["Elogio", "Aniversário", "Jogo", "Pedido", "Pergunta", "Confissão"],
  },
  fr: {
    nav_learn: "Apprendre le coréen",
    remaining: (n) => `${n} restantes aujourd'hui`,
    hero_title_1: "Ces 90 secondes,",
    hero_title_2: "rendez-les inoubliables",
    hero_sub: "Vous avez travaillé dur pour ce moment.\nNe le laissez pas filer.\nPréparez-vous pour une vraie connexion.",
    cta: "Soyez Prêt en 90 Secondes",
    free_note: "Gratuit · 3x par jour · Sans compte",
    section_scenario: "Que voulez-vous pratiquer",
    section_why: "Pourquoi s'entraîner",
    why: [
      { title: "Votre esprit peut se bloquer", desc: "Sans préparation, 90 secondes semblent 10." },
      { title: "Votre idol attend de discuter", desc: "Un long silence rend la situation gênante pour tous les deux." },
      { title: "C'est une chance unique", desc: "La différence entre préparé et non préparé est évidente." },
    ],
    cta_bottom: "Soyez Prêt en 90 Secondes",
    learn_title: "Vous voulez aussi apprendre le coréen?",
    learn_desc: "Parcours d'apprentissage Kkobi Jour 1~30",
    learn_btn: "Aller",
    limit_title: "Vous avez utilisé toutes vos sessions aujourd'hui!",
    limit_desc: "Revenez demain pour 3 nouvelles sessions 🌙",
    scenarios: ["Compliment", "Anniversaire", "Jeu", "Demande", "Question", "Confession"],
  },
};

const SCENARIOS = [
  { emoji: "💝", id: "compliment" },
  { emoji: "🎂", id: "birthday" },
  { emoji: "🎮", id: "game" },
  { emoji: "🎤", id: "request" },
  { emoji: "💬", id: "question" },
  { emoji: "💗", id: "confession" },
];

function getRemainingCount() {
  if (typeof window === "undefined") return DAILY_LIMIT;
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = localStorage.getItem(FREE_DATE_KEY);
  if (lastDate !== today) return DAILY_LIMIT;
  const count = parseInt(localStorage.getItem(FREE_COUNT_KEY) || "0");
  return Math.max(0, DAILY_LIMIT - count);
}

export default function HomePage() {
  const [remaining, setRemaining] = useState(3);
  const [lang, setLang] = useState("en");
  const [showLangMenu, setShowLangMenu] = useState(false);

  useEffect(() => {
    setRemaining(getRemainingCount());
    const saved = localStorage.getItem(LANG_KEY) || "en";
    setLang(saved);
  }, []);

  function handleLangChange(code) {
    setLang(code);
    localStorage.setItem(LANG_KEY, code);
    setShowLangMenu(false);
  }

  const t = COPY[lang] || COPY.en;
  const currentLang = LANGS.find((l) => l.code === lang) || LANGS[0];

  return (
    <div style={{
      background: "#0E0E0F",
      minHeight: "100vh",
      maxWidth: 390,
      margin: "0 auto",
      fontFamily: "'Inter', sans-serif",
      color: "#F2F0F4",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Spotlight 배경 */}
      <div style={{
        position: "absolute", width: 320, height: 320,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(158,143,253,0.14) 0%, transparent 70%)",
        top: -80, right: -80, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", width: 240, height: 240,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,138,169,0.08) 0%, transparent 70%)",
        top: 200, left: -60, pointerEvents: "none",
      }} />

      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 22px 0",
        position: "relative", zIndex: 10,
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

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* 한국어 학습 링크 */}
          <Link href="/first-line" style={{
            fontSize: 11, color: "#5C5A62",
            textDecoration: "none",
            padding: "6px 10px",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 9999,
          }}>
            {t.nav_learn}
          </Link>

          {/* 언어 선택 버튼 */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 9999,
                padding: "6px 10px",
                color: "#F2F0F4",
                fontSize: 11, fontWeight: 600,
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {currentLang.flag} {currentLang.label}
            </button>

            {/* 언어 드롭다운 */}
            {showLangMenu && (
              <div style={{
                position: "absolute", top: 36, right: 0,
                background: "#2C2C2D",
                borderRadius: 12, padding: "6px",
                zIndex: 100, minWidth: 100,
                boxShadow: "0px 20px 40px rgba(0,0,0,0.4)",
              }}>
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => handleLangChange(l.code)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%", padding: "8px 10px",
                      borderRadius: 8, border: "none",
                      background: lang === l.code
                        ? "rgba(255,138,169,0.15)"
                        : "transparent",
                      color: lang === l.code ? "#FF8AA9" : "#9E9BA4",
                      fontSize: 12, fontWeight: lang === l.code ? 600 : 400,
                      cursor: "pointer", textAlign: "left",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{l.flag}</span>
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 히어로 섹션 */}
      <div style={{ padding: "48px 22px 0", position: "relative", zIndex: 1 }}>

        {/* 남은 횟수 */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(0,227,253,0.08)",
          borderRadius: 9999, padding: "5px 12px", marginBottom: 24,
        }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: "50%",
                background: i < remaining ? "#00E3FD" : "rgba(255,255,255,0.1)",
              }} />
            ))}
          </div>
          <span style={{
            fontSize: 10, fontWeight: 600,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: "#00E3FD",
          }}>
            {t.remaining(remaining)}
          </span>
        </div>

        {/* 메인 카피 */}
        <h1 style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: 34, fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.1, marginBottom: 16, color: "#F2F0F4",
        }}>
          {t.hero_title_1}<br />
          <span style={{
            background: "linear-gradient(135deg, #FF8AA9, #FF719B)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            {t.hero_title_2}
          </span>
        </h1>

        {/* 서브 카피 */}
        <p style={{
          fontSize: 15, color: "#9E9BA4",
          lineHeight: 1.65, marginBottom: 36,
          letterSpacing: "-0.01em",
          whiteSpace: "pre-line",
        }}>
          {t.hero_sub}
        </p>

        {/* 메인 CTA */}
        <Link href="/my-90-seconds" style={{
          display: "block", padding: "17px 0",
          borderRadius: 9999,
          background: "linear-gradient(135deg, #FF8AA9, #FF719B)",
          color: "#fff",
          fontFamily: "'Manrope', sans-serif",
          fontSize: 15, fontWeight: 700,
          textDecoration: "none", textAlign: "center",
          marginBottom: 12,
        }}>
          {t.cta}
        </Link>

        <p style={{
          textAlign: "center", fontSize: 11,
          color: "#5C5A62", marginBottom: 48,
        }}>
          {t.free_note}
        </p>
      </div>

      {/* 시나리오 카드 */}
      <div style={{ padding: "0 22px", position: "relative", zIndex: 1, marginBottom: 40 }}>
        <p style={{
          fontSize: 10, fontWeight: 600,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#5C5A62", marginBottom: 14,
        }}>
          {t.section_scenario}
        </p>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
        }}>
          {SCENARIOS.map((s, i) => (
            <Link key={s.id} href={`/my-90-seconds?scenario=${s.id}`} style={{
              background: "#1A191B", borderRadius: 14,
              padding: "14px 10px", textDecoration: "none",
              display: "block", textAlign: "center",
            }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{s.emoji}</div>
              <div style={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: 11, fontWeight: 700, color: "#F2F0F4",
              }}>
                {t.scenarios[i]}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 왜 연습해야 할까요 */}
      <div style={{ padding: "0 22px", position: "relative", zIndex: 1, marginBottom: 40 }}>
        <p style={{
          fontSize: 10, fontWeight: 600,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#5C5A62", marginBottom: 14,
        }}>
          {t.section_why}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {t.why.map((item, i) => (
            <div key={i} style={{
              background: "#1A191B", borderRadius: 14, padding: "16px",
              borderLeft: "2px solid rgba(255,138,169,0.4)",
            }}>
              <p style={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: 13, fontWeight: 700,
                color: "#F2F0F4", marginBottom: 4,
              }}>
                {item.title}
              </p>
              <p style={{ fontSize: 12, color: "#9E9BA4", lineHeight: 1.6 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 하단 CTA */}
      <div style={{ padding: "0 22px 48px", position: "relative", zIndex: 1 }}>
        {remaining <= 0 ? (
          <div style={{
            background: "#1A191B", borderRadius: 14,
            padding: "20px 16px", textAlign: "center",
            marginBottom: 16,
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
          <Link href="/my-90-seconds" style={{
            display: "block", padding: "17px 0",
            borderRadius: 9999,
            background: "linear-gradient(135deg, #FF8AA9, #FF719B)",
            color: "#fff",
            fontFamily: "'Manrope', sans-serif",
            fontSize: 15, fontWeight: 700,
            textDecoration: "none", textAlign: "center",
            marginBottom: 16,
          }}>
            {t.cta_bottom}
          </Link>
        )}

        {/* 기존 꼬비 학습 링크 */}
        <div style={{
          background: "#131314", borderRadius: 14,
          padding: "14px 16px",
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <p style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: 12, fontWeight: 700,
              color: "#9E9BA4", marginBottom: 2,
            }}>
              {t.learn_title}
            </p>
            <p style={{ fontSize: 11, color: "#5C5A62" }}>{t.learn_desc}</p>
          </div>
          <Link href="/first-line" style={{
            fontSize: 11, fontWeight: 600, color: "#9E9BA4",
            textDecoration: "none",
            padding: "6px 12px",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 9999, whiteSpace: "nowrap",
          }}>
            {t.learn_btn}
          </Link>
        </div>
      </div>

    </div>
  );
}
