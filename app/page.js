"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

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
  },
  {
    id: "free",
    emoji: "🌟",
    title: "자유대화오구",
    titleEn: "Free Talk Ogu",
    subtitleKo: "어떤 주제든 OK!",
    subtitleEn: "Any topic, anytime!"
  }
];

export default function HomePage() {
  const router = useRouter();
  const [language, setLanguage] = useState("en");
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [learningCount, setLearningCount] = useState(0);
  const activeUserIdRef = useRef(null);
  const channelRef = useRef(null);

  const canStart = !!selectedLevel && !!selectedPersona;

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const id = crypto.randomUUID?.() ?? `ogu-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    activeUserIdRef.current = id;

    const fetchCounts = async () => {
      const { data, error } = await supabase.from("active_users").select("id, status");
      if (error) return;
      const list = data ?? [];
      setOnlineCount(list.length);
      setLearningCount(list.filter((r) => r.status === "chatting").length);
    };

    (async () => {
      await supabase.from("active_users").insert({
        id,
        status: "browsing",
        last_seen: new Date().toISOString()
      });
      await fetchCounts();
    })();

    const channel = supabase
      .channel("active_users_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "active_users" },
        () => { fetchCounts(); }
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      const toDelete = activeUserIdRef.current;
      if (toDelete) {
        supabase.from("active_users").delete().eq("id", toDelete).then(() => {});
        activeUserIdRef.current = null;
      }
    };
  }, []);

  const handleStart = (e) => {
    e?.preventDefault?.();
    if (!canStart) return;
    const userId = activeUserIdRef.current;
    const params = new URLSearchParams({
      level: selectedLevel,
      persona: selectedPersona,
      lang: language
    });
    if (userId) params.set("userId", userId);
    router.push(`/chat?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-[#FFF8F0] px-4 py-6 sm:py-10 text-[#3D2010]">
      <div className="mx-auto flex max-w-lg flex-col gap-8 sm:gap-10">
        {/* 상단 헤더: 로고 + 뱃지 + 언어 토글 */}
        <header className="flex flex-col gap-4 opacity-0 animate-fade-in-up" style={{ animationDelay: "0ms", animationFillMode: "forwards" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>🐥</span>
              <span className="text-lg font-bold tracking-tight text-[#3D2010]">OguOgu</span>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-[#FFE0D0] bg-[#FFFFFF] px-2 py-1.5 text-[11px] font-medium shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.currentTarget.blur(); setLanguage("ko"); }}
                className={`rounded-full px-2.5 py-1 transition-all duration-200 ${
                  language === "ko" ? "bg-[#FF6B4A] text-white shadow-sm" : "text-[#3D2010] hover:bg-[#FFF0E8]"
                }`}
              >
                🇰🇷 한국어
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.currentTarget.blur(); setLanguage("en"); }}
                className={`rounded-full px-2.5 py-1 transition-all duration-200 ${
                  language === "en" ? "bg-[#FF6B4A] text-white shadow-sm" : "text-[#3D2010] hover:bg-[#FFF0E8]"
                }`}
              >
                🇺🇸 English
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0E8] px-3 py-1.5 text-[11px] font-medium text-[#FF6B4A]">
              <span aria-hidden>🟢</span>
              {language === "ko" ? `접속자 ${onlineCount}명` : `${onlineCount} online`}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0E8] px-3 py-1.5 text-[11px] font-medium text-[#FF6B4A]">
              <span aria-hidden>📚</span>
              {language === "ko" ? `학습 중 ${learningCount}명` : `${learningCount} learning`}
            </span>
          </div>
        </header>

        {/* 히어로 섹션 */}
        <section className="space-y-3 text-center opacity-0 animate-fade-in-up" style={{ animationDelay: "80ms", animationFillMode: "forwards" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9A7060]">
            {language === "ko" ? "AI 한국어 회화" : "AI Korean Conversation"}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#FF6B4A] sm:text-4xl md:text-[2.5rem]">
            {language === "ko" ? "오구오구" : "OguOgu"}
          </h1>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-[#9A7060] sm:text-base">
            {language === "ko"
              ? "따뜻한 오구 친구와 함께, 내 레벨에 맞는 한국어 회화를 연습해보세요."
              : "Practice real Korean with your Ogu friends—warm, fun, and level-just-right."}
          </p>
        </section>

        {/* 레벨 선택 */}
        <section className="space-y-4 opacity-0 animate-fade-in-up" style={{ animationDelay: "160ms", animationFillMode: "forwards" }}>
          <div>
            <h2 className="text-sm font-semibold text-[#3D2010]">
              {language === "ko" ? "레벨 선택" : "Choose Your Level"}
            </h2>
            <p className="mt-0.5 text-[11px] text-[#9A7060]">
              {language === "ko" ? "실력에 맞는 오구를 골라주세요." : "Pick the Ogu that matches you."}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {LEVELS.map((level, idx) => {
              const isActive = selectedLevel === level.id;
              return (
                <button
                  key={level.id}
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.currentTarget.blur(); setSelectedLevel(level.id); }}
                  className={`opacity-0 animate-fade-in-up group flex w-full items-center gap-3 rounded-2xl border-2 bg-[#FFFFFF] px-4 py-3 text-left transition-all duration-300 hover:shadow-[0_8px_24px_rgba(255,107,74,0.15)] active:scale-[0.98] md:flex-col md:items-start md:py-4 ${
                    isActive
                      ? "border-[#FF6B4A] bg-[#FFF0E8] shadow-[0_8px_24px_rgba(255,107,74,0.2)]"
                      : "border-[#FFE0D0] hover:border-[#FF6B4A]/60"
                  }`}
                  style={{ animationDelay: `${240 + idx * 80}ms`, animationFillMode: "forwards" }}
                >
                  <span className="text-2xl md:text-3xl">{level.emoji}</span>
                  <div className="flex-1 space-y-0.5">
                    <p className="text-sm font-semibold text-[#3D2010]">{level.title}</p>
                    <p className="text-[11px] text-[#9A7060]">
                      {language === "ko" ? level.subtitleKo : level.subtitleEn}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 페르소나 선택 */}
        <section className="space-y-4 opacity-0 animate-fade-in-up" style={{ animationDelay: "340ms", animationFillMode: "forwards" }}>
          <div>
            <h2 className="text-sm font-semibold text-[#3D2010]">
              {language === "ko" ? "함께할 오구" : "Choose Your Ogu Friend"}
            </h2>
            <p className="mt-0.5 text-[11px] text-[#9A7060]">
              {language === "ko" ? "어떤 상황에서 연습할까요?" : "Who do you want to practice with?"}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {PERSONAS.map((persona, idx) => {
              const isActive = selectedPersona === persona.id;
              const isFree = persona.id === "free";
              const titleText = persona.titleEn && language === "en" ? persona.titleEn : persona.title;
              return (
                <button
                  key={persona.id}
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.currentTarget.blur(); setSelectedPersona(persona.id); }}
                  className={`opacity-0 animate-fade-in-up group relative flex w-full items-center gap-3 rounded-2xl border-2 bg-[#FFFFFF] px-4 py-3 text-left transition-all duration-300 hover:shadow-[0_8px_24px_rgba(255,107,74,0.15)] active:scale-[0.98] md:flex-col md:items-start md:py-4 ${
                    isFree
                      ? "border-[#FFD93D] hover:border-[#FFD93D] hover:shadow-[0_8px_24px_rgba(255,217,61,0.25)]"
                      : ""
                  } ${
                    isActive
                      ? isFree
                        ? "border-[#FFD93D] bg-[#FFFEF5] shadow-[0_8px_24px_rgba(255,217,61,0.25)]"
                        : "border-[#FF6B4A] bg-[#FFF0E8] shadow-[0_8px_24px_rgba(255,107,74,0.2)]"
                      : !isFree
                      ? "border-[#FFE0D0] hover:border-[#FF6B4A]/60"
                      : ""
                  }`}
                  style={{ animationDelay: `${480 + idx * 80}ms`, animationFillMode: "forwards" }}
                >
                  {isFree && (
                    <span className="absolute right-2 top-2 rounded bg-[#FFD93D] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#3D2010]">
                      {language === "ko" ? "NEW" : "NEW"}
                    </span>
                  )}
                  <span className="text-2xl md:text-3xl">{persona.emoji}</span>
                  <div className="flex-1 space-y-0.5 pr-6">
                    <p className="text-sm font-semibold text-[#3D2010]">{titleText}</p>
                    <p className="text-[11px] text-[#9A7060]">
                      {language === "ko" ? persona.subtitleKo : persona.subtitleEn}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 내 오구 설정 + CTA */}
        <section className="space-y-4 rounded-3xl border border-[#FFE0D0] bg-[#FFFFFF] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.06)] opacity-0 animate-fade-in-up" style={{ animationDelay: "520ms", animationFillMode: "forwards" }}>
          <h2 className="text-sm font-semibold text-[#3D2010]">
            {language === "ko" ? "내 오구 설정" : "My Ogu Setup"}
          </h2>
          <div className="space-y-3 rounded-2xl bg-[#FFF8F0] p-3">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[#9A7060]">{language === "ko" ? "레벨" : "Level"}</span>
              <span className="font-medium text-[#3D2010]">
                {selectedLevel ? LEVELS.find((l) => l.id === selectedLevel)?.title : (language === "ko" ? "선택 안 함" : "Not selected")}
              </span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[#9A7060]">{language === "ko" ? "페르소나" : "Persona"}</span>
              <span className="font-medium text-[#3D2010]">
                {selectedPersona
                  ? (() => {
                      const p = PERSONAS.find((x) => x.id === selectedPersona);
                      return p && p.titleEn && language === "en" ? p.titleEn : p?.title ?? (language === "ko" ? "선택 안 함" : "Not selected");
                    })()
                  : (language === "ko" ? "선택 안 함" : "Not selected")}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-semibold text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#FF6B4A] focus:ring-offset-2 focus:ring-offset-[#FFF8F0] ${
              canStart
                ? "bg-[#FF6B4A] shadow-[0_12px_32px_rgba(255,107,74,0.4)] hover:bg-[#ff5a33] hover:shadow-[0_16px_40px_rgba(255,107,74,0.45)] active:scale-[0.98]"
                : "cursor-not-allowed bg-[#E8D5CF] text-[#9A7060]"
            }`}
          >
            {language === "ko" ? "오구오구 시작하기 🐥" : "Start OguOgu 🐥"}
          </button>
          <p className="text-center text-[11px] leading-relaxed text-[#9A7060]">
            {language === "ko"
              ? "레벨과 페르소나를 선택하면 맞춤 한국어 회화가 시작돼요."
              : "Select both to start your personalized Korean conversation."}
          </p>
        </section>

        {/* 게시판 링크 */}
        <div className="mt-6 text-center">
          <a
            href="/board"
            className="inline-flex items-center gap-1.5 rounded-2xl border border-[#FFE0D0] bg-[#FFFFFF] px-4 py-2.5 text-sm font-medium text-[#3D2010] shadow-sm transition hover:border-[#FF6B4A] hover:bg-[#FFF0E8] hover:text-[#FF6B4A]"
          >
            {language === "ko" ? "📋 유저 게시판" : "📋 Community Board"}
          </a>
        </div>

        {/* 푸터 */}
        <footer className="mt-10 border-t border-[#FFE0D0] bg-[#FFF0E8] py-6 text-center text-sm text-[#9A7060]">
          <p className="font-medium text-[#9A7060]">White Rabbit</p>
          <p className="mt-1">
            {language === "ko" ? "문의사항은 " : "For inquiries, contact "}
            <a
              href="mailto:cleex.hq@gmail.com"
              className="text-[#FF6B4A] underline decoration-[#FF6B4A]/60 underline-offset-2 transition hover:decoration-[#FF6B4A]"
            >
              cleex.hq@gmail.com
            </a>
            {language === "ko" ? " 로 보내주세요." : "."}
          </p>
        </footer>
      </div>
    </main>
  );
}
