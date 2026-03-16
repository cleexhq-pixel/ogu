"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { pageview, event as gaEvent } from "@/app/lib/gtag";
import { DAILY_PHRASES } from "@/app/data/daily_phrases";
import { CHALLENGE_DAYS } from "@/app/data/missions";

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function HomePage() {
  const router = useRouter();
  const [language, setLanguage] = useState("en");
  const [onlineCount, setOnlineCount] = useState(0);
  const [learningCount, setLearningCount] = useState(0);
  const [streakBadge, setStreakBadge] = useState(null);
  const [usageToday, setUsageToday] = useState({ mission: 0, conversation: 0 });
  const [challengeProgress, setChallengeProgress] = useState([]);
  const activeUserIdRef = useRef(null);
  const channelRef = useRef(null);

  // GA4: 첫 진입 시 페이지뷰 + app_open 이벤트
  useEffect(() => {
    if (typeof window === "undefined") return;
    pageview(window.location.pathname + window.location.search);
    gaEvent("app_open");
  }, []);

  // Supabase 실시간 접속자
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
        () => {
          fetchCounts();
        }
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

  // 스트릭 뱃지
  useEffect(() => {
    if (typeof window === "undefined") return;
    const userId = window.localStorage.getItem("ogu_user_id");
    if (!userId) return;
    const supabase = getSupabase();
    if (!supabase) return;
    supabase
      .from("streaks")
      .select("current_streak")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data?.current_streak >= 2) setStreakBadge(data.current_streak);
      })
      .catch(() => {});
  }, []);

  // 하루 사용량 & 챌린지 진행도
  useEffect(() => {
    if (typeof window === "undefined") return;
    const todayKey = getTodayKey();
    const usageRaw = window.localStorage.getItem(`ogu_usage_${todayKey}`);
    if (usageRaw) {
      try {
        const parsed = JSON.parse(usageRaw);
        setUsageToday({
          mission: parsed.mission ?? 0,
          conversation: parsed.conversation ?? 0
        });
      } catch {
        setUsageToday({ mission: 0, conversation: 0 });
      }
    }
    const progressRaw = window.localStorage.getItem("ogu_challenge_progress");
    if (progressRaw) {
      try {
        const parsed = JSON.parse(progressRaw);
        if (Array.isArray(parsed)) setChallengeProgress(parsed);
      } catch {
        setChallengeProgress([]);
      }
    }
  }, []);

  const totalUsage = usageToday.mission + usageToday.conversation;
  const remaining = Math.max(0, 5 - totalUsage);

  const todayIndex = (() => {
    const d = new Date();
    return d.getDate() % DAILY_PHRASES.length;
  })();
  const todayPhrase = DAILY_PHRASES[todayIndex];

  const currentDay = (() => {
    const completed = Array.isArray(challengeProgress) ? challengeProgress.length : 0;
    return Math.min(7, completed + 1);
  })();
  const currentChallenge = CHALLENGE_DAYS.find((d) => d.day === currentDay) || CHALLENGE_DAYS[0];

  const phraseTranslation =
    language === "ko" ? todayPhrase?.en : language === "id" ? todayPhrase?.id_lang : todayPhrase?.en;

  const handleStartTodayPhrase = () => {
    if (!todayPhrase) return;
    gaEvent("start_daily_phrase");
    const params = new URLSearchParams();
    params.set("seed", encodeURIComponent(todayPhrase.korean));
    params.set("lang", language);
    params.set("mode", "phrase");
    router.push(`/chat?${params.toString()}`);
  };

  const handleStartTodayMission = () => {
    if (!currentChallenge) return;
    gaEvent("start_challenge_day", { day: currentChallenge.day });
    const params = new URLSearchParams({
      mission: currentChallenge.mission_id,
      lang: language,
      challenge_day: String(currentChallenge.day)
    });
    router.push(`/chat?${params.toString()}`);
  };

  const goMissionList = () => {
    const qs = new URLSearchParams();
    qs.set("lang", language);
    router.push(`/mission?${qs.toString()}`);
  };

  const goDramaChat = () => {
    const params = new URLSearchParams({ persona: "drama", lang: language });
    router.push(`/chat?${params.toString()}`);
  };

  const goPhrases = () => {
    const qs = new URLSearchParams();
    qs.set("lang", language);
    router.push(`/phrases?${qs.toString()}`);
  };

  const goFreeChat = () => {
    const params = new URLSearchParams({ persona: "free", lang: language });
    router.push(`/chat?${params.toString()}`);
  };

  const t = {
    todayLabel: language === "ko" ? "오늘의 표현" : language === "id" ? "Frasa Hari Ini" : "Today's Phrase",
    todayButton: language === "ko" ? "이 표현으로 연습하기" : language === "id" ? "Latihan sekarang" : "Practice this now",
    challengeTitle: language === "ko" ? "7일 챌린지" : language === "id" ? "Tantangan 7 Hari" : "7-Day Challenge",
    challengeSubtitle:
      language === "ko"
        ? "하루에 하나씩, 7일간 한국어 챌린지!"
        : language === "id"
        ? "Satu misi per hari selama 7 hari!"
        : "One mission per day for 7 days!",
    startTodayMission:
      language === "ko" ? "오늘 미션 시작" : language === "id" ? "Mulai Misi Hari Ini" : "Start Today's Mission",
    usageLabel:
      language === "ko"
        ? "오늘 남은 연습"
        : language === "id"
        ? "Sisa sesi hari ini"
        : "Today's remaining sessions",
    quickTitle:
      language === "ko" ? "빠른 시작" : language === "id" ? "Mulai cepat" : "Quick Start",
    quickMission:
      language === "ko" ? "미션 대화" : language === "id" ? "Misi Berbicara" : "Mission Talk",
    quickDrama:
      language === "ko" ? "드라마오구" : language === "id" ? "Drama Ogu" : "Drama Ogu",
    quickPhrases:
      language === "ko" ? "내 표현장" : language === "id" ? "Frasaku" : "My Phrases",
    quickFree:
      language === "ko" ? "자유 대화" : language === "id" ? "Bebas Bicara" : "Free Talk"
  };

  return (
    <main className="min-h-screen bg-[#FFF8F0] px-4 py-6 sm:py-10 text-[#3D2010]">
      <div className="mx-auto flex max-w-lg flex-col gap-8 sm:gap-10">
        {/* 헤더 */}
        <header className="flex flex-col gap-4 opacity-0 animate-fade-in-up" style={{ animationDelay: "0ms", animationFillMode: "forwards" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                🐥
              </span>
              <span className="text-lg font-bold tracking-tight text-[#3D2010]">OguOgu</span>
            </div>
            <div className="inline-flex rounded-full border border-[#FFE0D0] bg-[#FFFFFF] p-1 text-[11px] font-medium shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.currentTarget.blur();
                  setLanguage("ko");
                }}
                className={`rounded-full px-2.5 py-1 transition-all duration-200 ${
                  language === "ko" ? "bg-[#FF6B4A] text-white" : "bg-transparent text-[#FF6B4A] hover:bg-[#FFF0E8]"
                }`}
              >
                🇰🇷 한국어
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.currentTarget.blur();
                  setLanguage("en");
                }}
                className={`rounded-full px-2.5 py-1 transition-all duration-200 ${
                  language === "en" ? "bg-[#FF6B4A] text-white" : "bg-transparent text-[#FF6B4A] hover:bg-[#FFF0E8]"
                }`}
              >
                🇺🇸 English
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.currentTarget.blur();
                  setLanguage("id");
                }}
                className={`rounded-full px-2.5 py-1 transition-all duration-200 ${
                  language === "id" ? "bg-[#FF6B4A] text-white" : "bg-transparent text-[#FF6B4A] hover:bg-[#FFF0E8]"
                }`}
              >
                🇮🇩 Indonesia
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {streakBadge != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF3E0] px-3 py-1.5 text-[11px] font-medium text-[#E65100]">
                <span aria-hidden>🔥</span>
                {language === "ko"
                  ? `${streakBadge}일 연속`
                  : language === "id"
                  ? `${streakBadge} hari berturut-turut`
                  : `${streakBadge} day streak`}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0E8] px-3 py-1.5 text-[11px] font-medium text-[#FF6B4A]">
              <span aria-hidden>🟢</span>
              {language === "ko"
                ? `접속자 ${onlineCount}명`
                : language === "id"
                ? `${onlineCount} daring`
                : `${onlineCount} online`}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0E8] px-3 py-1.5 text-[11px] font-medium text-[#FF6B4A]">
              <span aria-hidden>📚</span>
              {language === "ko"
                ? `학습 중 ${learningCount}명`
                : language === "id"
                ? `${learningCount} sedang belajar`
                : `${learningCount} learning`}
            </span>
          </div>
        </header>

        {/* 히어로 */}
        <section className="space-y-3 text-center opacity-0 animate-fade-in-up" style={{ animationDelay: "80ms", animationFillMode: "forwards" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9A7060]">
            {language === "ko" ? "AI 한국어 회화" : language === "id" ? "Percakapan Korea AI" : "AI Korean Conversation"}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#FF6B4A] sm:text-4xl md:text-[2.5rem]">
            {language === "ko" ? "오구오구" : "OguOgu"}
          </h1>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-[#9A7060] sm:text-base">
            {language === "ko"
              ? "따뜻한 오구 친구와 함께, 내 일상에 딱 맞는 한국어 회화를 연습해보세요."
              : language === "id"
              ? "Berlatih percakapan Korea yang cocok dengan keseharianmu, bersama teman Ogu yang hangat."
              : "Practice everyday Korean conversations with your warm Ogu friend—perfectly matched to your life."}
          </p>
        </section>

        {/* 오늘의 표현 */}
        {todayPhrase && (
          <section className="opacity-0 animate-fade-in-up" style={{ animationDelay: "140ms", animationFillMode: "forwards" }}>
            <div className="rounded-3xl border border-[#FFE0D0] bg-[#FFFFFF] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.06)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#FF6B4A]">
                {t.todayLabel}
              </p>
              <p className="mt-2 text-lg font-bold text-[#3D2010]">{todayPhrase.korean}</p>
              <p className="mt-1 text-[13px] text-[#9A7060]">{phraseTranslation}</p>
              <p className="mt-2 text-[12px] text-[#9A7060]">
                🐥 {todayPhrase.context}
              </p>
              <button
                type="button"
                onClick={handleStartTodayPhrase}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF6B4A] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_28px_rgba(255,107,74,0.45)] transition hover:bg-[#ff5a33] active:scale-[0.98]"
              >
                {t.todayButton}
              </button>
            </div>
          </section>
        )}

        {/* 7일 챌린지 */}
        <section className="space-y-3 opacity-0 animate-fade-in-up" style={{ animationDelay: "220ms", animationFillMode: "forwards" }}>
          <div className="rounded-3xl border border-[#FFE0D0] bg-[#FFFFFF] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A7060]">
                  {t.challengeTitle}
                </p>
                <p className="mt-1 text-[12px] text-[#9A7060]">{t.challengeSubtitle}</p>
              </div>
              <span className="rounded-full bg-[#FFF3E0] px-3 py-1 text-[11px] font-semibold text-[#FF6B4A]">
                Day {currentDay}/7
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              {CHALLENGE_DAYS.map((d) => {
                const completed = challengeProgress.includes(d.day);
                const isCurrent = d.day === currentDay;
                return (
                  <div
                    key={d.day}
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                      completed
                        ? "bg-[#6BCB77] text-white"
                        : isCurrent
                        ? "bg-[#FF6B4A] text-white"
                        : "bg-[#FFF0E8] text-[#9A7060]"
                    }`}
                  >
                    {d.day}
                  </div>
                );
              })}
            </div>
            {currentChallenge && (
              <p className="mt-3 text-[13px] font-medium text-[#3D2010]">
                {language === "ko"
                  ? `오늘의 미션: ${currentChallenge.title.ko}`
                  : language === "id"
                  ? `Misi hari ini: ${currentChallenge.title.id}`
                  : `Today's mission: ${currentChallenge.title.en}`}
              </p>
            )}
            <button
              type="button"
              onClick={handleStartTodayMission}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF6B4A] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_28px_rgba(255,107,74,0.45)] transition hover:bg-[#ff5a33] active:scale-[0.98]"
            >
              {t.startTodayMission}
            </button>
          </div>
        </section>

        {/* 하루 사용량 */}
        <section className="opacity-0 animate-fade-in-up" style={{ animationDelay: "280ms", animationFillMode: "forwards" }}>
          <div className="rounded-3xl border border-[#FFE0D0] bg-[#FFFFFF] px-4 py-3 text-[12px] text-[#9A7060] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[#3D2010]">{t.usageLabel}</span>
              <span className="font-semibold text-[#FF6B4A]">
                {remaining}/5
              </span>
            </div>
            <p className="mt-1">
              {language === "ko"
                ? `미션 ${usageToday.mission}회 · 자유 대화 ${usageToday.conversation}회`
                : language === "id"
                ? `Misi ${usageToday.mission}x · Obrolan bebas ${usageToday.conversation}x`
                : `Missions ${usageToday.mission} · Free chats ${usageToday.conversation}`}
            </p>
          </div>
        </section>

        {/* 빠른 시작 2x2 */}
        <section className="space-y-2 opacity-0 animate-fade-in-up" style={{ animationDelay: "340ms", animationFillMode: "forwards" }}>
          <h2 className="text-sm font-semibold text-[#3D2010]">{t.quickTitle}</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={goMissionList}
              className="flex flex-col items-start gap-1 rounded-2xl border border-[#FFE0D0] bg-[#FFFFFF] px-3 py-3 text-left text-[13px] shadow-sm transition hover:border-[#FF6B4A] hover:bg-[#FFF0E8]"
            >
              <span className="text-lg">🎭</span>
              <span className="font-semibold text-[#3D2010]">{t.quickMission}</span>
              <span className="text-[11px] text-[#9A7060]">
                {language === "ko"
                  ? "상황별 미션으로 연습"
                  : language === "id"
                  ? "Latihan dengan misi harian"
                  : "Practice with guided missions"}
              </span>
            </button>
            <button
              type="button"
              onClick={goDramaChat}
              className="flex flex-col items-start gap-1 rounded-2xl border border-[#FFE0D0] bg-[#FFFFFF] px-3 py-3 text-left text-[13px] shadow-sm transition hover:border-[#FF6B4A] hover:bg-[#FFF0E8]"
            >
              <span className="text-lg">📺</span>
              <span className="font-semibold text-[#3D2010]">{t.quickDrama}</span>
              <span className="text-[11px] text-[#9A7060]">
                {language === "ko"
                  ? "K-드라마 감성 대화"
                  : language === "id"
                  ? "Obrolan ala K-drama"
                  : "K-drama style chat"}
              </span>
            </button>
            <button
              type="button"
              onClick={goPhrases}
              className="flex flex-col items-start gap-1 rounded-2xl border border-[#FFE0D0] bg-[#FFFFFF] px-3 py-3 text-left text-[13px] shadow-sm transition hover:border-[#FF6B4A] hover:bg-[#FFF0E8]"
            >
              <span className="text-lg">📚</span>
              <span className="font-semibold text-[#3D2010]">{t.quickPhrases}</span>
              <span className="text-[11px] text-[#9A7060]">
                {language === "ko"
                  ? "저장한 표현 다시 보기"
                  : language === "id"
                  ? "Lihat kembali frasa tersimpan"
                  : "Review saved phrases"}
              </span>
            </button>
            <button
              type="button"
              onClick={goFreeChat}
              className="flex flex-col items-start gap-1 rounded-2xl border border-[#FFE0D0] bg-[#FFFFFF] px-3 py-3 text-left text-[13px] shadow-sm transition hover:border-[#FF6B4A] hover:bg-[#FFF0E8]"
            >
              <span className="text-lg">💬</span>
              <span className="font-semibold text-[#3D2010]">{t.quickFree}</span>
              <span className="text-[11px] text-[#9A7060]">
                {language === "ko"
                  ? "주제 상관없이 편하게"
                  : language === "id"
                  ? "Ngobrol bebas topik apa saja"
                  : "Talk about anything you like"}
              </span>
            </button>
          </div>
        </section>

        {/* 게시판 링크 */}
        <div className="mt-4 text-center">
          <a
            href={"/board" + (language && language !== "ko" ? "?lang=" + language : "")}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-[#FFE0D0] bg-[#FFFFFF] px-4 py-2.5 text-sm font-medium text-[#3D2010] shadow-sm transition hover:border-[#FF6B4A] hover:bg-[#FFF0E8] hover:text-[#FF6B4A]"
          >
            {language === "ko" ? "📋 유저 게시판" : language === "id" ? "📋 Forum Komunitas" : "📋 Community Board"}
          </a>
        </div>

        {/* 푸터 */}
        <footer className="mt-10 border-t border-[#FFE0D0] bg-[#FFF0E8] py-6 text-center text-sm text-[#9A7060]">
          <p className="font-medium text-[#9A7060]">White Rabbit</p>
          <p className="mt-1">
            {language === "ko"
              ? "문의사항은 "
              : language === "id"
              ? "Untuk pertanyaan, hubungi "
              : "For inquiries, contact "}
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

