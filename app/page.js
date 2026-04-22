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
    service_tag: "Fansign Video Call Prep",
    hero_title_1: "Those 90 seconds.",
    hero_title_2: "Don't freeze.",
    hero_sub: "One memorized line changes everything.\nNow is the time to get ready.",
    cta: "Make 90 Seconds Worth It",
    free_note: "Free · 3 times a day · No account needed",
    free_badge: (n) => `Free · ${n} sessions left today`,
    section_scenario: "What would you like to practice",
    section_why: "Real fan stories",
    why_desc: "You don't want this to happen to you.",
    why: [
      { title: "I just cried the whole time", desc: "I spent $400 on albums. I couldn't say a single word." },
      { title: "My mind went completely blank", desc: "I had practiced for weeks but everything disappeared the moment I saw them." },
      { title: "A regret I can't undo", desc: "I wasted my one chance. I didn't even say hello properly." },
      { title: "I froze the second they said hi", desc: "They were so kind and waiting for me. I just froze." },
      { title: "I forgot everything I prepared", desc: "All my notes, all my practice — gone in an instant." },
      { title: "90 seconds felt like 5", desc: "I had so much more to say but the time was gone." },
    ],
    cta_bottom: "Make 90 Seconds Worth It",
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
    service_tag: "영통 팬싸인회 준비 서비스",
    hero_title_1: "그 90초,",
    hero_title_2: "얼지 마세요.",
    hero_sub: "외운 한 마디가 모든 걸 바꿔요.\n지금이 준비할 시간이에요.",
    cta: "후회 없는 90초 만들기",
    free_note: "무료 · 하루 3회 · 계정 불필요",
    free_badge: (n) => `무료 · 오늘 ${n}회 남음`,
    section_scenario: "어떤 순간을 연습할까요",
    section_why: "진짜 팬들의 이야기",
    why_desc: "이런 일, 당신에게 일어나지 않았으면 해요.",
    why: [
      { title: "그냥 울다가 끝났어요", desc: "앨범값만 40만원이었는데. 정말 아무 말도 못 하고 눈물만 흘렸어요." },
      { title: "머리가 완전히 하얘졌어요", desc: "몇 주를 연습했는데 얼굴 보는 순간 다 사라졌어요." },
      { title: "다시는 못 하는 후회예요", desc: "딱 한 번의 기회를 날렸어요. 인사도 제대로 못 했어요." },
      { title: "안녕이라는 말에 굳어버렸어요", desc: "오빠가 먼저 말 걸어줬는데 저만 아무 말도 못 했어요." },
      { title: "준비한 게 다 날아갔어요", desc: "메모도 연습도 다 했는데 그 순간 아무것도 생각이 안 났어요." },
      { title: "90초가 5초처럼 끝났어요", desc: "하고 싶은 말이 너무 많았는데 시간이 너무 짧았어요." },
    ],
    cta_bottom: "후회 없는 90초 만들기",
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
    service_tag: "Persiapan Video Call Fansign",
    hero_title_1: "90 detik itu.",
    hero_title_2: "Jangan beku.",
    hero_sub: "Satu kalimat hafalan mengubah segalanya.\nSekarang waktunya bersiap.",
    cta: "Jadikan 90 Detik Berarti",
    free_note: "Gratis · 3x sehari · Tanpa akun",
    free_badge: (n) => `Gratis · Sisa ${n} sesi hari ini`,
    section_scenario: "Apa yang ingin kamu latih",
    section_why: "Cerita nyata para fans",
    why_desc: "Jangan sampai ini terjadi padamu.",
    why: [
      { title: "Aku cuma nangis sepanjang waktu", desc: "Beli album sampai Rp 6 juta, akhirnya cuma diam dan nangis." },
      { title: "Pikiranku blank total", desc: "Sudah latihan berminggu-minggu tapi semuanya hilang begitu saja." },
      { title: "Penyesalan yang nggak bisa diulang", desc: "Aku menyia-nyiakan satu-satunya kesempatan itu." },
      { title: "Aku kaku saat mereka menyapa", desc: "Mereka begitu baik, tapi aku hanya terdiam membeku." },
      { title: "Semua yang kupersiapkan hilang", desc: "Semua catatan, semua latihan — lenyap seketika." },
      { title: "90 detik terasa seperti 5 detik", desc: "Masih banyak yang ingin kuucapkan tapi waktunya sudah habis." },
    ],
    cta_bottom: "Jadikan 90 Detik Berarti",
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
    service_tag: "Preparação para Videochamada Fansign",
    hero_title_1: "Esses 90 segundos.",
    hero_title_2: "Não congele.",
    hero_sub: "Uma frase decorada muda tudo.\nAgora é hora de se preparar.",
    cta: "Faça 90 Segundos Valerem",
    free_note: "Grátis · 3x por dia · Sem conta",
    free_badge: (n) => `Grátis · ${n} sessões restantes hoje`,
    section_scenario: "O que você quer praticar",
    section_why: "Histórias reais de fãs",
    why_desc: "Você não quer que isso aconteça com você.",
    why: [
      { title: "Só chorei o tempo todo", desc: "Gastei R$ 2.000 em álbuns. Não consegui dizer uma palavra." },
      { title: "Minha mente travou completamente", desc: "Pratiquei por semanas mas quando vi meu idol, tudo sumiu." },
      { title: "Um arrependimento sem volta", desc: "Desperdicei minha única chance. Nem consegui dizer oi direito." },
      { title: "Travei quando eles disseram oi", desc: "Eles foram tão gentis e esperando por mim. Só travei." },
      { title: "Esqueci tudo que preparei", desc: "Todas as anotações, toda a prática — foi tudo num instante." },
      { title: "90 segundos pareceram 5", desc: "Tinha tanto mais a dizer mas o tempo acabou." },
    ],
    cta_bottom: "Faça 90 Segundos Valerem",
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
    service_tag: "Préparation Appel Vidéo Fansign",
    hero_title_1: "Ces 90 secondes.",
    hero_title_2: "Ne figez pas.",
    hero_sub: "Une phrase apprise change tout.\nC'est le moment de se préparer.",
    cta: "Faites Valoir 90 Secondes",
    free_note: "Gratuit · 3x par jour · Sans compte",
    free_badge: (n) => `Gratuit · ${n} sessions restantes aujourd'hui`,
    section_scenario: "Que voulez-vous pratiquer",
    section_why: "Vraies histoires de fans",
    why_desc: "Vous ne voulez pas que cela vous arrive.",
    why: [
      { title: "J'ai juste pleuré tout le temps", desc: "J'ai dépensé 350€ en albums. Je n'ai pas pu dire un mot." },
      { title: "Mon esprit s'est complètement bloqué", desc: "J'avais pratiqué des semaines mais tout a disparu." },
      { title: "Un regret qu'on ne peut pas effacer", desc: "J'ai gaspillé ma seule chance. Je n'ai même pas pu dire bonjour." },
      { title: "J'ai figé quand ils ont dit bonjour", desc: "Ils étaient si gentils et j'ai juste figé." },
      { title: "J'ai tout oublié ce que j'avais préparé", desc: "Toutes mes notes, toute ma pratique — disparues en un instant." },
      { title: "90 secondes ont semblé 5", desc: "J'avais tant à dire mais le temps était écoulé." },
    ],
    cta_bottom: "Faites Valoir 90 Secondes",
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
  const [storyIndex, setStoryIndex] = useState(0);

  useEffect(() => {
    setRemaining(getRemainingCount());
    const saved = localStorage.getItem(LANG_KEY) || "en";
    setLang(saved);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setStoryIndex((prev) => {
        const stories = COPY[lang]?.why || COPY.en.why;
        return (prev + 1) % stories.length;
      });
    }, 3500);
    return () => clearInterval(interval);
  }, [lang]);

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

        {/* 서비스 태그 */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "rgba(255,138,169,0.08)",
          borderRadius: 9999, padding: "6px 14px",
          marginBottom: 24,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "#FF8AA9",
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: "#FF8AA9",
            letterSpacing: "0.01em",
          }}>
            {t.service_tag}
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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 14px 14px 24px",
          borderRadius: 9999,
          background: "#FF8AA9",
          textDecoration: "none",
          marginBottom: 12,
        }}>
          <div style={{ width: 32 }} />
          <span style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 15, fontWeight: 700,
            color: "#fff",
            letterSpacing: "0.01em",
          }}>
            {t.cta}
          </span>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(255,255,255,0.25)",
            display: "flex", alignItems: "center",
            justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M7 3l4 4-4 4"
                stroke="#fff" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </Link>

        <p style={{
          textAlign: "center", fontSize: 11,
          color: "#5C5A62", marginBottom: 48,
        }}>
          {typeof t.free_badge === "function"
            ? t.free_badge(remaining)
            : t.free_note}
        </p>
      </div>

      {/* 시나리오 카드 */}
      <div style={{ padding: "0 22px", position: "relative", zIndex: 1, marginBottom: 40 }}>
        <p style={{
          fontSize: 10, fontWeight: 600,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#5C5A62", marginBottom: 14,
        }}>
          Or choose your moment
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

      {/* 팬 스토리 섹션 */}
      <div style={{ padding: "0 22px", position: "relative", zIndex: 1, marginBottom: 40 }}>
        {/* 섹션 헤더 */}
        <p style={{
          fontSize: 10, fontWeight: 600,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#5C5A62", marginBottom: 6,
        }}>
          {t.section_why}
        </p>
        <p style={{
          fontSize: 12, color: "#5C5A62",
          marginBottom: 16, lineHeight: 1.5,
        }}>
          {t.why_desc}
        </p>

        {/* 자동 슬라이드 스토리 카드 */}
        <div style={{ position: "relative", minHeight: 130 }}>
          {t.why.map((item, i) => (
            <div
              key={i}
              style={{
                background: "#1A191B",
                borderRadius: 14,
                padding: "18px 18px 18px 20px",
                borderLeft: "2px solid rgba(255,138,169,0.6)",
                position: i === storyIndex ? "relative" : "absolute",
                top: 0, left: 0, right: 0,
                opacity: i === storyIndex ? 1 : 0,
                transition: "opacity 0.6s ease",
                pointerEvents: i === storyIndex ? "auto" : "none",
              }}
            >
              <p style={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: 15, fontWeight: 700,
                color: "#F2F0F4", marginBottom: 8,
                lineHeight: 1.3,
              }}>
                "{item.title}"
              </p>
              <p style={{
                fontSize: 12, color: "#9E9BA4",
                lineHeight: 1.6,
              }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* 슬라이드 인디케이터 */}
        <div style={{
          display: "flex", gap: 5,
          justifyContent: "center",
          marginTop: 14,
        }}>
          {t.why.map((_, i) => (
            <button
              key={i}
              onClick={() => setStoryIndex(i)}
              style={{
                width: i === storyIndex ? 18 : 5,
                height: 5, borderRadius: 9999,
                background: i === storyIndex
                  ? "#FF8AA9"
                  : "rgba(255,255,255,0.12)",
                border: "none", cursor: "pointer",
                padding: 0,
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
      </div>

      {/* 하단 섹션 */}
      <div style={{ padding: "0 22px 48px", position: "relative", zIndex: 1 }}>
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
