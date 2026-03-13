"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const LEVELS = [
  {
    id: "beginner",
    emoji: "🐣",
    title: "왕초보 오구",
    subtitleKo: "한국어 처음이에요!",
    subtitleEn: "Total Beginner!"
  },
  {
    id: "elementary",
    emoji: "🐥",
    title: "초급 오구",
    subtitleKo: "조금 알아요~",
    subtitleEn: "I know a little~"
  },
  {
    id: "intermediate",
    emoji: "🐦",
    title: "중급 오구",
    subtitleKo: "꽤 잘해요!",
    subtitleEn: "Getting pretty good!"
  }
];

const PERSONAS = [
  {
    id: "cafe",
    emoji: "☕",
    title: "카페오구",
    subtitleKo: "카페 알바생 지은이",
    subtitleEn: "Café barista Jieun"
  },
  {
    id: "office",
    emoji: "💼",
    title: "직장오구",
    subtitleKo: "직장 선배 민준 씨",
    subtitleEn: "Office senior Minjun"
  },
  {
    id: "drama",
    emoji: "📺",
    title: "드라마오구",
    subtitleKo: "K-드라마 주인공",
    subtitleEn: "K-drama lead character"
  }
];

export default function HomePage() {
  const router = useRouter();
  const [language, setLanguage] = useState("en"); // 'ko' | 'en'
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedPersona, setSelectedPersona] = useState(null);

  const canStart = !!selectedLevel && !!selectedPersona;

  const handleStart = () => {
    if (!canStart) return;

    const params = new URLSearchParams({
      level: selectedLevel,
      persona: selectedPersona,
      lang: language
    }).toString();

    router.push(`/chat?${params}`);
  };

  return (
    <main className="min-h-screen bg-[#1A1008] px-4 py-8 text-slate-50">
      <div className="mx-auto flex max-w-lg flex-col gap-5">
        {/* 1. 언어 토글 버튼 */}
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-1 rounded-full border border-[#3A2515] bg-[#241208]/90 px-2 py-1 text-[11px] shadow-[0_8px_20px_rgba(0,0,0,0.6)]">
            <button
              type="button"
              onClick={() => setLanguage("ko")}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors ${
                language === "ko"
                  ? "bg-[#FF6B4A] text-white"
                  : "text-[#FFE9A6] hover:bg-[#3A2515]"
              }`}
            >
              <span>🇰🇷</span>
              <span>한국어</span>
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors ${
                language === "en"
                  ? "bg-[#FF6B4A] text-white"
                  : "text-[#FFE9A6] hover:bg-[#3A2515]"
              }`}
            >
              <span>🇺🇸</span>
              <span>English</span>
            </button>
          </div>
        </div>

        {/* 2. 헤더 */}
        <header className="space-y-2 text-center">
          <p className="text-xs font-medium tracking-wide text-[#FFD93D]">
            {language === "ko"
              ? "AI 한국어 회화 연습"
              : "AI Korean Conversation Practice"}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#FFD93D] drop-shadow-[0_0_22px_rgba(255,217,61,0.4)] sm:text-4xl">
            {language === "ko" ? "🐥 오구오구" : "🐥 OguOgu"}
          </h1>
          <p className="text-sm text-[#FFE9A6] sm:text-base">
            {language === "ko"
              ? "통통 튀는 오구 친구들과 레벨에 딱 맞는 한국어 회화를 연습해보세요."
              : "Practice real Korean conversations with your Ogu friends!"}
          </p>
        </header>

        {/* 3. 레벨 선택 */}
        <section className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold text-[#FFE9A6]">
              {language === "ko" ? "레벨 선택" : "Choose Your Level"}
            </h2>
            <p className="text-[11px] text-[#D9BFA3]">
              {language === "ko"
                ? "지금 내 실력에 맞는 오구를 골라주세요."
                : "Pick the Ogu that matches your Korean level."}
            </p>
          </div>

          <div className="mt-1 grid gap-3 md:grid-cols-3">
            {LEVELS.map((level) => {
              const isActive = selectedLevel === level.id;
              return (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => setSelectedLevel(level.id)}
                  className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left text-[12px] transition-all active:scale-[0.98] md:flex-col md:items-start md:py-3 ${
                    isActive
                      ? "border-[#FF6B4A] bg-[#34160E] shadow-[0_10px_28px_rgba(255,107,74,0.5)]"
                      : "border-[#3A2515] bg-[#2D1A0E] hover:border-[#FF6B4A99]"
                  }`}
                >
                  <span className="text-2xl">{level.emoji}</span>
                  <div className="flex-1 space-y-0.5">
                    <p className="text-xs font-semibold text-[#FFE9A6]">
                      {level.title}
                    </p>
                    <p className="text-[10px] text-[#D9BFA3]">
                      {language === "ko"
                        ? level.subtitleKo
                        : level.subtitleEn}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 4. 페르소나 선택 */}
        <section className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold text-[#FFE9A6]">
              {language === "ko"
                ? "페르소나 선택"
                : "Choose Your Ogu Friend"}
            </h2>
            <p className="text-[11px] text-[#D9BFA3]">
              {language === "ko"
                ? "어떤 상황의 오구와 함께 연습해볼까요?"
                : "Who do you want to practice Korean with?"}
            </p>
          </div>

          <div className="mt-1 grid gap-3 md:grid-cols-3">
            {PERSONAS.map((persona) => {
              const isActive = selectedPersona === persona.id;
              return (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => setSelectedPersona(persona.id)}
                  className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left text-[12px] transition-all active:scale-[0.98] md:flex-col md:items-start md:py-3 ${
                    isActive
                      ? "border-[#FFD93D] bg-[#3A210C] shadow-[0_10px_28px_rgba(255,217,61,0.5)]"
                      : "border-[#3A2515] bg-[#2D1A0E] hover:border-[#FFD93D99]"
                  }`}
                >
                  <span className="text-2xl">{persona.emoji}</span>
                  <div className="flex-1 space-y-0.5">
                    <p className="text-xs font-semibold text-[#FFE9A6]">
                      {persona.title}
                    </p>
                    <p className="text-[10px] text-[#D9BFA3]">
                      {language === "ko"
                        ? persona.subtitleKo
                        : persona.subtitleEn}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 5. 내 오구 설정 박스 */}
        <section className="space-y-3 rounded-3xl border border-[#3A2515] bg-[#241208]/95 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.7)]">
          <h2 className="text-sm font-semibold text-[#FFE9A6]">
            {language === "ko" ? "내 오구 설정" : "My Ogu Setup"}
          </h2>

          <div className="space-y-3 rounded-2xl bg-[#1C0E07] p-3 text-[11px] text-[#D9BFA3]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#FFE9A6]">
                {language === "ko" ? "레벨" : "Level"}
              </span>
              <span className="text-xs font-medium">
                {selectedLevel
                  ? LEVELS.find((l) => l.id === selectedLevel)?.title
                  : language === "ko"
                  ? "아직 선택 안 함"
                  : "Not selected yet"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#FFE9A6]">
                {language === "ko" ? "페르소나" : "Persona"}
              </span>
              <span className="text-xs font-medium">
                {selectedPersona
                  ? PERSONAS.find((p) => p.id === selectedPersona)?.title
                  : language === "ko"
                  ? "아직 선택 안 함"
                  : "Not selected yet"}
              </span>
            </div>
          </div>
        </section>

        {/* 6. 시작 버튼 */}
        <section className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            className={`flex w-full items-center justify-center gap-1.5 rounded-full px-5 py-3 text-base font-semibold text-white transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD93D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1008] ${
              canStart
                ? "bg-[#FF6B4A] shadow-[0_14px_40px_rgba(255,107,74,0.7)] hover:bg-[#ff5a33] active:translate-y-0.5 active:scale-[0.97]"
                : "cursor-not-allowed bg-[#6A4A3A] opacity-60"
            }`}
          >
            {language === "ko" ? "오구오구 시작! 🐥" : "Start OguOgu! 🐥"}
          </button>
          <p className="text-center text-[10px] leading-relaxed text-[#BFA28D]">
            {language === "ko"
              ? "레벨과 페르소나를 모두 선택하면, 당신만을 위한 오구 시나리오로 한국어 회화 연습이 시작돼요."
              : "Select both level and persona to start your personalized Korean conversation!"}
          </p>
        </section>
      </div>
    </main>
  );
}
