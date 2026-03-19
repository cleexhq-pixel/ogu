"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import {
  pageview,
  trackAppOpen,
  trackStartDailyPhrase,
  trackChallengeStart
} from "@/app/lib/gtag";
import Analytics from "@/app/components/Analytics";
import { DAILY_PHRASES } from "@/app/data/daily_phrases";
import { CHALLENGE_DAYS } from "@/app/data/missions";

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function HomePage() {
  const router = useRouter();
  const [language, setLanguage] = useState("en");
  const [isFirstVisitor, setIsFirstVisitor] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [learningCount, setLearningCount] = useState(0);
  const [streakBadge, setStreakBadge] = useState(null);
  const [usageToday, setUsageToday] = useState({ mission: 0, conversation: 0 });
  const [challengeProgress, setChallengeProgress] = useState([]);
  const activeUserIdRef = useRef(null);

  // GA4: 첫 진입 시 페이지뷰 + app_open 이벤트
  useEffect(() => {
    if (typeof window === "undefined") return;
    pageview(window.location.pathname + window.location.search);
    trackAppOpen();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const visited = window.localStorage.getItem("ogu_visited");
    if (!visited) {
      setIsFirstVisitor(true);
      const timer = setTimeout(() => {
        setShowOnboardingModal(true);
        window.localStorage.setItem("ogu_visited", "true");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Supabase 접속자 폴링 (5초)
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

    const fetchCounts = async () => {
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { count: totalCount } = await supabase
          .from("active_users")
          .select("*", { count: "exact", head: true })
          .gte("last_seen", fiveMinutesAgo);

        const { count: chattingCount } = await supabase
          .from("active_users")
          .select("*", { count: "exact", head: true })
          .eq("status", "chatting")
          .gte("last_seen", fiveMinutesAgo);

        setOnlineCount(totalCount || 0);
        setLearningCount(chattingCount || 0);
      } catch (err) {
        console.log("Count fetch failed silently");
      }
    };

    (async () => {
      await supabase.from("active_users").insert({
        id,
        status: "browsing",
        last_seen: new Date().toISOString()
      });
      await fetchCounts();
    })();

    const interval = setInterval(fetchCounts, 5000);
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
      clearInterval(interval);
      clearInterval(lastSeenInterval);
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
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.log("Streak not found, creating new");
          return;
        }
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
    // 서버 기준 사용량 동기화
    try {
      let userId = window.localStorage.getItem("ogu_user_id");
      if (!userId) {
        userId =
          crypto.randomUUID?.() ??
          `ogu-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        window.localStorage.setItem("ogu_user_id", userId);
      }
      const params = new URLSearchParams();
      params.set("userId", userId);
      params.set("date", todayKey);
      fetch(`/api/usage?${params.toString()}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (!data) return;
          if (
            typeof data.mission === "number" &&
            typeof data.conversation === "number"
          ) {
            setUsageToday({
              mission: data.mission,
              conversation: data.conversation
            });
          }
        })
        .catch(() => {
          // 폴백: localStorage 값 유지
        });
    } catch {
      // ignore
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
    trackStartDailyPhrase();
    const params = new URLSearchParams();
    params.set("seed", encodeURIComponent(todayPhrase.korean));
    params.set("lang", language);
    params.set("mode", "phrase");
    router.push(`/chat?${params.toString()}`);
  };

  const handleStartTodayMission = () => {
    if (!currentChallenge) return;
    trackChallengeStart(currentChallenge.day);
    const params = new URLSearchParams({
      mission: currentChallenge.mission_id,
      lang: language,
      challenge_day: String(currentChallenge.day)
    });
    router.push(`/chat?${params.toString()}`);
  };

  const startOneMinuteTrial = () => {
    const params = new URLSearchParams({
      mission: "greeting-friend",
      level: "beginner",
      lang: language,
      onboarding: "true"
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
      language === "ko" ? "자유 대화" : language === "id" ? "Bebas Bicara" : "Free Talk",
    oneMinuteCta:
      language === "ko"
        ? "한국어 1분 체험 시작 🐥"
        : language === "id"
        ? "Mulai Praktik 1 Menit 🐥"
        : "Start 1-Min Korean Practice 🐥",
    oneMinuteSub:
      language === "ko"
        ? "회원가입 없이 3턴 체험 가능 · 영어 힌트 제공"
        : language === "id"
        ? "Tanpa daftar · 3 giliran gratis · Ada petunjuk"
        : "No sign-up needed · 3-turn free trial · English hints",
    onboardingTitle:
      language === "ko"
        ? "안녕하세요! 오구오구예요 🐥"
        : language === "id"
        ? "Halo! Saya OguOgu 🐥"
        : "Hello! I'm OguOgu 🐥",
    onboardingDesc:
      language === "ko"
        ? "AI 친구와 1분 한국어 대화를 해보세요.\n회원가입 없이 바로 시작할 수 있어요!"
        : language === "id"
        ? "Praktik bahasa Korea dengan teman AI dalam 1 menit.\nTanpa perlu daftar!"
        : "Practice Korean with your AI friend in 1 minute.\nNo sign-up needed!",
    onboardingPick:
      language === "ko"
        ? "👋 오늘의 추천: 친구에게 안부 묻기"
        : language === "id"
        ? "👋 Rekomendasi: Sapa teman"
        : "👋 Today's pick: Greet a friend",
    onboardingStart:
      language === "ko" ? "지금 바로 시작하기 →" : language === "id" ? "Mulai Sekarang →" : "Start Right Now →",
    onboardingBrowse:
      language === "ko" ? "둘러보기" : language === "id" ? "Lihat dulu" : "Browse first"
  };

  return (
    <>
      <Analytics />
      <main className="min-h-screen bg-[#F9FAFB] px-4 py-6 sm:py-10 text-[#0F172A]">
        <div className="mx-auto flex max-w-lg flex-col gap-8 sm:gap-10">
        {showOnboardingModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <p className="text-center text-4xl">🐥</p>
              <h2 className="mt-3 text-center text-lg font-bold text-[#0F172A]">{t.onboardingTitle}</h2>
              <p className="mt-2 whitespace-pre-line text-center text-sm text-[#64748B]">{t.onboardingDesc}</p>
              <p className="mt-3 rounded-xl bg-[#EEF2FF] px-3 py-2 text-center text-sm font-medium text-[#4F46E5]">
                {t.onboardingPick}
              </p>
              <button
                type="button"
                onClick={startOneMinuteTrial}
                className="mt-4 w-full rounded-2xl bg-[#4F46E5] py-3 text-sm font-semibold text-white transition hover:bg-[#4338CA]"
              >
                {t.onboardingStart}
              </button>
              <button
                type="button"
                onClick={() => setShowOnboardingModal(false)}
                className="mt-2 w-full text-center text-xs font-medium text-[#64748B] underline-offset-2 hover:underline"
              >
                {t.onboardingBrowse}
              </button>
            </div>
          </div>
        )}
        {/* 헤더 */}
        <header className="flex flex-col gap-4 opacity-0 animate-fade-in-up" style={{ animationDelay: "0ms", animationFillMode: "forwards" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                🐥
              </span>
              <span className="text-lg font-bold tracking-tight text-[#0F172A]">OguOgu</span>
            </div>
            <div className="inline-flex rounded-full border border-[#E5E7EB] bg-[#FFFFFF] p-1 text-[11px] font-medium shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.currentTarget.blur();
                  setLanguage("ko");
                }}
                className={`rounded-full px-2.5 py-1 transition-all duration-200 ${
                  language === "ko" ? "bg-[#4F46E5] text-white" : "bg-[#FFFFFF] text-[#64748B] hover:bg-[#EEF2FF]"
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
                  language === "en" ? "bg-[#4F46E5] text-white" : "bg-[#FFFFFF] text-[#64748B] hover:bg-[#EEF2FF]"
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
                  language === "id" ? "bg-[#4F46E5] text-white" : "bg-[#FFFFFF] text-[#64748B] hover:bg-[#EEF2FF]"
                }`}
              >
                🇮🇩 Indonesia
              </button>
            </div>
          </div>
          
        </header>

        {/* 히어로 */}
        {!isFirstVisitor && <section className="space-y-3 text-center opacity-0 animate-fade-in-up" style={{ animationDelay: "80ms", animationFillMode: "forwards" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#64748B]">
            {language === "ko" ? "AI 한국어 회화" : language === "id" ? "Percakapan Korea AI" : "AI Korean Conversation"}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl md:text-[2.5rem]">
            {language === "ko" ? "오구오구 🐥" : "OguOgu 🐥"}
          </h1>
          <div className="mx-auto max-w-md text-center text-base leading-relaxed text-[#64748B] sm:text-lg">
            {language === "ko" ? (
              <>
                <p>짧고 재미있게,</p>
                <p>AI 친구와 한국어로 말해보세요!</p>
              </>
            ) : language === "id" ? (
              <>
                <p>Singkat, seru, dan ramah —</p>
                <p>Ngobrol bahasa Korea dengan teman AI!</p>
              </>
            ) : (
              <>
                <p>Short, fun, and friendly —</p>
                <p>Chat in Korean with your AI friend!</p>
              </>
            )}
          </div>
        </section>}

        {/* 오늘의 표현 */}
        {todayPhrase && (
          <section className="opacity-0 animate-fade-in-up" style={{ animationDelay: "140ms", animationFillMode: "forwards" }}>
            <div className="rounded-3xl border border-[#E5E7EB] bg-[#FFFFFF] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.06)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4F46E5]">
                {t.todayLabel}
              </p>
              <p className="korean-text mt-2 text-lg font-bold text-[#0F172A]">{todayPhrase.korean}</p>
              <p className="mt-1 text-[13px] text-[#64748B]">{phraseTranslation}</p>
              <p className="korean-body mt-2 text-[12px] text-[#64748B]">
                🐥 {todayPhrase.context}
              </p>
              <button
                type="button"
                onClick={handleStartTodayPhrase}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4F46E5] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_28px_rgba(79,70,229,0.35)] transition hover:bg-[#4338CA] active:scale-[0.98]"
              >
                {t.todayButton}
              </button>
            </div>
          </section>
        )}

        <section className="space-y-3 opacity-0 animate-fade-in-up" style={{ animationDelay: "180ms", animationFillMode: "forwards" }}>
          <button
            type="button"
            onClick={startOneMinuteTrial}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-[#4F46E5] px-4 py-4 text-[15px] font-semibold text-white shadow-[0_12px_32px_rgba(79,70,229,0.35)] transition hover:bg-[#4338CA] active:scale-[0.98]"
          >
            {t.oneMinuteCta}
          </button>
          <p className="text-center text-xs text-[#64748B]">{t.oneMinuteSub}</p>
        </section>

        {/* 7일 챌린지 */}
        <section className="space-y-3 opacity-0 animate-fade-in-up" style={{ animationDelay: "220ms", animationFillMode: "forwards" }}>
          <div className="rounded-3xl border border-[#E5E7EB] bg-[#FFFFFF] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                  {t.challengeTitle}
                </p>
                <p className="mt-1 text-[12px] text-[#64748B]">{t.challengeSubtitle}</p>
              </div>
              <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold text-[#4F46E5]">
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
                        ? "bg-[#4F46E5] text-white"
                        : isCurrent
                        ? "bg-[#4F46E5] text-white"
                        : "bg-[#E5E7EB] text-[#64748B]"
                    }`}
                  >
                    {d.day}
                  </div>
                );
              })}
            </div>
            {currentChallenge && (
              <p className="mt-3 text-[13px] font-medium text-[#0F172A]">
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
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4F46E5] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_28px_rgba(79,70,229,0.35)] transition hover:bg-[#4338CA] active:scale-[0.98]"
            >
              {t.startTodayMission}
            </button>
          </div>
        </section>

        {/* 하루 사용량 */}
        <section className="opacity-0 animate-fade-in-up" style={{ animationDelay: "280ms", animationFillMode: "forwards" }}>
          <div className="rounded-3xl border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-3 text-[12px] text-[#64748B] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[#0F172A]">{t.usageLabel}</span>
              <span className="font-semibold text-[#4F46E5]">
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
          <h2 className="text-sm font-semibold text-[#0F172A]">{t.quickTitle}</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={goMissionList}
              className="flex flex-col items-start gap-1 rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-3 text-left text-[13px] shadow-sm transition hover:bg-[#EEF2FF]"
            >
              <span className="text-lg">🎭</span>
              <span className="font-semibold text-[#0F172A]">{t.quickMission}</span>
              <span className="text-[11px] text-[#64748B]">
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
              className="flex flex-col items-start gap-1 rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-3 text-left text-[13px] shadow-sm transition hover:bg-[#EEF2FF]"
            >
              <span className="text-lg">📺</span>
              <span className="font-semibold text-[#0F172A]">{t.quickDrama}</span>
              <span className="text-[11px] text-[#64748B]">
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
              className="flex flex-col items-start gap-1 rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-3 text-left text-[13px] shadow-sm transition hover:bg-[#EEF2FF]"
            >
              <span className="text-lg">📚</span>
              <span className="font-semibold text-[#0F172A]">{t.quickPhrases}</span>
              <span className="text-[11px] text-[#64748B]">
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
              className="flex flex-col items-start gap-1 rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-3 text-left text-[13px] shadow-sm transition hover:bg-[#EEF2FF]"
            >
              <span className="text-lg">💬</span>
              <span className="font-semibold text-[#0F172A]">{t.quickFree}</span>
              <span className="text-[11px] text-[#64748B]">
                {language === "ko"
                  ? "주제 상관없이 편하게"
                  : language === "id"
                  ? "Ngobrol bebas topik apa saja"
                  : "Talk about anything you like"}
              </span>
            </button>
          </div>
        </section>

        <section className="opacity-0 animate-fade-in-up" style={{ animationDelay: "380ms", animationFillMode: "forwards" }}>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {streakBadge != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFBEB] px-3 py-1.5 text-[11px] font-medium text-[#92400E]">
                <span aria-hidden>🔥</span>
                {language === "ko"
                  ? `${streakBadge}일 연속`
                  : language === "id"
                  ? `${streakBadge} hari berturut-turut`
                  : `${streakBadge} day streak`}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2FF] px-3 py-1.5 text-[11px] font-medium text-[#4F46E5]">
              <span aria-hidden>🟢</span>
              {language === "ko" ? `접속자 ${onlineCount}명` : language === "id" ? `${onlineCount} daring` : `${onlineCount} online`}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2FF] px-3 py-1.5 text-[11px] font-medium text-[#4F46E5]">
              <span aria-hidden>📚</span>
              {language === "ko" ? `학습 중 ${learningCount}명` : language === "id" ? `${learningCount} sedang belajar` : `${learningCount} learning`}
            </span>
          </div>
        </section>

        {/* 게시판 링크 */}
        <div className="mt-4 text-center">
          <a
            href={"/board" + (language && language !== "ko" ? "?lang=" + language : "")}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-2.5 text-sm font-medium text-[#0F172A] shadow-sm transition hover:bg-[#EEF2FF] hover:text-[#4F46E5]"
          >
            {language === "ko" ? "📋 유저 게시판" : language === "id" ? "📋 Forum Komunitas" : "📋 Community Board"}
          </a>
        </div>

        {/* 푸터 */}
        <footer className="mt-10 border-t border-[#E5E7EB] bg-[#F8FAFC] py-6 text-center text-sm text-[#64748B]">
          <p className="font-medium text-[#64748B]">White Rabbit</p>
          <p className="mt-1">
            {language === "ko"
              ? "문의사항은 "
              : language === "id"
              ? "Untuk pertanyaan, hubungi "
              : "For inquiries, contact "}
            <a
              href="mailto:cleex.hq@gmail.com"
              className="text-[#4F46E5] underline decoration-[#4F46E5]/60 underline-offset-2 transition hover:decoration-[#4F46E5]"
            >
              cleex.hq@gmail.com
            </a>
            {language === "ko" ? " 로 보내주세요." : "."}
          </p>
        </footer>
        </div>
      </main>
    </>
  );
}

