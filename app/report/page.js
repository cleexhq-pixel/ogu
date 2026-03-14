"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

function getTodayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getYesterdayLocal() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MILESTONES = { 3: { ko: "🔥 3일 연속! 오구오구 열심히네요!", en: "3 day streak! Keep it up!" }, 7: { ko: "⭐ 일주일 연속! 대단해요!", en: "7 day streak! Amazing!" }, 30: { ko: "👑 한 달 연속! 오구 마스터!", en: "30 day streak! Ogu Master!" } };

const PERSONA_NAMES = {
  cafe: { ko: "카페오구", en: "Café Ogu" },
  office: { ko: "직장오구", en: "Office Ogu" },
  drama: { ko: "드라마오구", en: "Drama Ogu" },
  free: { ko: "자유대화오구", en: "Free Talk Ogu" }
};

function ReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [history, setHistory] = useState([]);
  const [expressions, setExpressions] = useState([]);
  const [isLoadingExpressions, setIsLoadingExpressions] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [cardSaving, setCardSaving] = useState(false);
  const [streakData, setStreakData] = useState(null);
  const [milestoneModal, setMilestoneModal] = useState(null);
  const shareCardRef = useRef(null);

  const level = searchParams.get("level") || "beginner";
  const persona = searchParams.get("persona") || "cafe";
  const language = searchParams.get("lang") || "en";

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.sessionStorage.getItem("ogu-chat-history");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setHistory(parsed);

      const startRaw = window.sessionStorage.getItem("ogu-chat-start");
      const endRaw = window.sessionStorage.getItem("ogu-chat-end");
      if (startRaw && endRaw) {
        const start = Number(startRaw);
        const end = Number(endRaw);
        if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
          const minutes = Math.max(1, Math.round((end - start) / 1000 / 60));
          setDurationMinutes(minutes);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    const fetchExpressions = async () => {
      if (!history.length) return;
      setIsLoadingExpressions(true);
      try {
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history })
        });
        if (!res.ok) throw new Error("Failed to load expressions");
        const data = await res.json();
        if (Array.isArray(data.expressions)) {
          setExpressions(data.expressions.slice(0, 3));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingExpressions(false);
      }
    };
    fetchExpressions();
  }, [history]);

  // 스트릭: localStorage + Supabase 업데이트
  useEffect(() => {
    if (typeof window === "undefined") return;
    let userId = window.localStorage.getItem("ogu_user_id");
    if (!userId) {
      userId = crypto.randomUUID?.() ?? `ogu-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem("ogu_user_id", userId);
    }
    const lastStudy = window.localStorage.getItem("ogu_last_study");
    const today = getTodayLocal();
    const yesterday = getYesterdayLocal();

    const supabase = getSupabase();
    if (!supabase) return;

    (async () => {
      const { data: row } = await supabase.from("streaks").select("current_streak, best_streak, total_sessions").eq("user_id", userId).single();

      let current = row?.current_streak ?? 0;
      let best = row?.best_streak ?? 0;
      const total = (row?.total_sessions ?? 0) + 1;

      if (lastStudy === today) {
        // 오늘 이미 학습 → 스트릭 변화 없음
      } else if (lastStudy === yesterday) {
        current += 1;
        best = Math.max(best, current);
      } else {
        current = 1;
        best = Math.max(best, 1);
      }

      await supabase.from("streaks").upsert(
        { user_id: userId, current_streak: current, best_streak: best, total_sessions: total, last_study: today },
        { onConflict: "user_id" }
      );
      window.localStorage.setItem("ogu_last_study", today);

      setStreakData({ current_streak: current, best_streak: best, total_sessions: total });
      if ([3, 7, 30].includes(current)) setMilestoneModal(current);
    })().catch((e) => console.error("Streak update failed", e));
  }, []);

  const levelLabel =
    level === "beginner"
      ? language === "ko" ? "왕초보 오구" : "Beginner Ogu"
      : level === "elementary"
      ? language === "ko" ? "초급 오구" : "Elementary Ogu"
      : language === "ko" ? "중급 오구" : "Intermediate Ogu";

  const personaLabel = PERSONA_NAMES[persona] ? (language === "ko" ? PERSONA_NAMES[persona].ko : PERSONA_NAMES[persona].en) : (language === "ko" ? "오구" : "Ogu");

  const progressPercent =
    level === "beginner" ? 33 : level === "elementary" ? 66 : 100;

  const durationText =
    durationMinutes != null
      ? language === "ko"
        ? `${durationMinutes}분 대화 완료!`
        : `${durationMinutes} min of practice completed!`
      : language === "ko"
      ? "오늘도 열심히 연습했어요!"
      : "You practiced hard today!";

  const loadHtml2Canvas = () =>
    new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("No window"));
        return;
      }
      if (window.html2canvas) {
        resolve(window.html2canvas);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      script.async = true;
      script.onload = () => resolve(window.html2canvas);
      script.onerror = () => reject(new Error("Failed to load html2canvas"));
      document.head.appendChild(script);
    });

  const handleSaveShareCard = async () => {
    if (!shareCardRef.current) return;
    setCardSaving(true);
    try {
      const html2canvas = await loadHtml2Canvas();
      const canvas = await html2canvas(shareCardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#FFF8F0"
      });
      const link = document.createElement("a");
      link.download = "oguogu-card.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("Share card save failed:", e);
    } finally {
      setCardSaving(false);
    }
  };

  const handleShare = async () => {
    const lines = [];
    lines.push(
      language === "ko"
        ? "🐥 오구오구 한국어 회화 리포트"
        : "🐥 OguOgu Korean Conversation Report"
    );
    lines.push(
      language === "ko" ? `레벨: ${levelLabel}` : `Level: ${levelLabel}`
    );
    if (durationMinutes != null) {
      lines.push(
        language === "ko"
          ? `대화 시간: ${durationMinutes}분`
          : `Conversation time: ${durationMinutes} min`
      );
    }
    if (expressions.length) {
      lines.push("");
      lines.push(
        language === "ko" ? "오늘 배운 표현:" : "Key expressions today:"
      );
      expressions.forEach((e, idx) => {
        lines.push(`${idx + 1}. ${e.korean} - ${e.english} (${e.example})`);
      });
    }
    const text = lines.join("\n");
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof window !== "undefined") {
        window.prompt("Copy this report:", text);
      }
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy", e);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#FFF8F0] px-4 py-8 text-[#3D2010]">
      {/* 마일스톤 축하 모달 */}
      {milestoneModal && MILESTONES[milestoneModal] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-3xl border border-[#FFE0D0] bg-[#FFF8F0] p-6 shadow-xl">
            <p className="text-center text-lg font-bold text-[#FF6B4A]">
              {language === "ko" ? MILESTONES[milestoneModal].ko : MILESTONES[milestoneModal].en}
            </p>
            <button
              type="button"
              onClick={() => setMilestoneModal(null)}
              className="mt-4 w-full rounded-2xl bg-[#FF6B4A] py-3 text-sm font-semibold text-white transition hover:bg-[#ff5a33]"
            >
              {language === "ko" ? "확인" : "OK"}
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl space-y-8">
        {/* ① 칭찬 배너 */}
        <section className="rounded-3xl border border-[#FFE0D0] bg-[#FFFFFF] px-6 py-6 shadow-[0_16px_48px_rgba(0,0,0,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9A7060]">
                {language === "ko" ? "오늘의 오구 리포트" : "Today's Ogu Report"}
              </p>
              <h1 className="text-2xl font-extrabold text-[#FF6B4A] sm:text-3xl">
                오구오구~ 잘했어요! 🎉
              </h1>
              <p className="text-sm text-[#9A7060]">Great job today!</p>
              <p className="text-[12px] text-[#9A7060]">{durationText}</p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0E8] text-3xl shadow-[0_8px_24px_rgba(255,107,74,0.2)]">
              🐥
            </div>
          </div>
        </section>

        {/* 스트릭 카드 */}
        {streakData != null && (
          <section className="rounded-3xl border border-[#FFE0D0] bg-[#FFF3E0] px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <p className="text-center text-base font-bold text-[#FF6B4A]">
              🔥 {language === "ko" ? `${streakData.current_streak}일 연속 학습 중!` : `${streakData.current_streak} day streak!`}
            </p>
            <div className="mt-2 flex justify-center gap-4 text-[12px] text-[#E65100]">
              <span>{language === "ko" ? `최장 기록: ${streakData.best_streak}일` : `Best: ${streakData.best_streak} days`}</span>
              <span>{language === "ko" ? `총 학습 횟수: ${streakData.total_sessions}회` : `Total sessions: ${streakData.total_sessions}`}</span>
            </div>
          </section>
        )}

        {/* ② 오늘 배운 표현 카드 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#3D2010]">
              {language === "ko" ? "오늘 배운 표현" : "Key Expressions Today"}
            </h2>
            {isLoadingExpressions && (
              <span className="text-[11px] text-[#9A7060]">
                {language === "ko" ? "요약 중..." : "Analyzing..."}
              </span>
            )}
          </div>

          {expressions.length === 0 && !isLoadingExpressions ? (
            <p className="rounded-2xl border border-[#FFE0D0] bg-[#FFFFFF] p-4 text-[12px] text-[#9A7060] shadow-sm">
              {language === "ko"
                ? "표현을 아직 불러오지 못했어요. 대화를 조금 더 길게 나눠보면 더 잘 분석할 수 있어요."
                : "We couldn't extract expressions yet. Try having a slightly longer conversation next time."}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {(expressions.length ? expressions : [1, 2, 3]).map((expr, idx) => {
                const korean = expr?.korean ?? "…";
                const english = expr?.english ?? "…";
                const example = expr?.example ?? "…";
                return (
                  <div
                    key={idx}
                    className="flex flex-col rounded-2xl border border-[#FFE0D0] bg-[#FFFFFF] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)]"
                  >
                    <span className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[#FF6B4A]">
                      {language === "ko" ? `표현 ${idx + 1}` : `Expression ${idx + 1}`}
                    </span>
                    <p className="text-sm font-semibold text-[#3D2010]">{korean}</p>
                    <p className="mt-1 text-[11px] text-[#9A7060]">{english}</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-[#C09A8A]">
                      {example}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ③ 레벨 진행도 */}
        <section className="rounded-3xl border border-[#FFE0D0] bg-[#FFFFFF] p-5 shadow-[0_16px_48px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#3D2010]">
                {language === "ko" ? "나의 오구 레벨" : "My Ogu Level"}
              </h2>
              <p className="mt-0.5 text-[11px] text-[#9A7060]">
                {language === "ko"
                  ? "다음 레벨까지 한 걸음 더!"
                  : "One step closer to the next level."}
              </p>
            </div>
            <span className="rounded-full bg-[#FFF0E8] px-3 py-1.5 text-[11px] font-semibold text-[#FF6B4A]">
              {levelLabel}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#FFE0D0]">
              <div
                className="h-full rounded-full bg-[#FF6B4A] transition-[width] duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-[#9A7060]">
              {language === "ko"
                ? "내일도 오구오구와 연습해볼까요?"
                : "Come back and practice with Ogu again tomorrow!"}
            </p>
          </div>
        </section>

        {/* ④ 하단 버튼 */}
        <section className="flex flex-col items-center gap-4 pt-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF6B4A] px-5 py-3.5 text-[14px] font-semibold text-white shadow-[0_12px_32px_rgba(255,107,74,0.4)] transition hover:bg-[#ff5a33] hover:shadow-[0_16px_40px_rgba(255,107,74,0.45)] active:scale-[0.98] sm:w-auto"
          >
            {language === "ko" ? "다시 대화하기 🐥" : "Talk Again 🐥"}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#FFE0D0] bg-[#FFFFFF] px-5 py-3.5 text-[14px] font-semibold text-[#3D2010] transition hover:bg-[#FFF0E8] hover:border-[#FF6B4A]/40 active:scale-[0.98] sm:w-auto"
          >
            {language === "ko" ? "공유하기 📸" : "Share Result 📸"}
          </button>
        </section>
        {shareCopied && (
          <p className="text-center text-[12px] text-[#9A7060]">
            {language === "ko"
              ? "리포트가 클립보드에 복사되었어요!"
              : "Report copied to clipboard!"}
          </p>
        )}

        {/* 공유 카드 (1080x1080 캡처용, 화면에는 360px로 표시) */}
        <section className="flex flex-col items-center gap-4 pt-4">
          <h2 className="text-sm font-semibold text-[#3D2010]">
            {language === "ko" ? "📸 공유 카드" : "📸 Share Card"}
          </h2>
          <div className="flex justify-center overflow-x-auto">
            <div
              ref={shareCardRef}
              className="flex shrink-0 flex-col rounded-3xl border-2 border-[#FFE0D0] bg-[#FFF8F0] shadow-xl"
              style={{ width: 360, height: 360 }}
            >
              {/* 상단: 로고 + URL */}
              <div className="flex items-center justify-between border-b border-[#FFE0D0] px-5 py-3">
                <span className="text-lg font-bold text-[#FF6B4A]">🐥 OguOgu</span>
                <span className="text-[9px] text-[#9A7060]">ogu-three.vercel.app</span>
              </div>
              {/* 중앙: 완료 문구 + 페르소나/레벨 + 표현 3개 */}
              <div className="flex flex-1 flex-col justify-center px-5 py-4">
                <p className="text-center text-sm font-bold leading-snug text-[#3D2010]">
                  {language === "ko" ? "오늘의 한국어 학습 완료!" : "Korean practice done today!"}
                </p>
                <p className="mt-2 text-center text-[11px] font-semibold text-[#FF6B4A]">
                  {personaLabel} · {levelLabel}
                </p>
                <div className="mt-3 space-y-0.5 rounded-xl border border-[#FFE0D0] bg-[#FFFFFF] px-3 py-2">
                  {(expressions.length ? expressions : []).slice(0, 3).map((e, i) => (
                    <p key={i} className="line-clamp-2 text-[10px] leading-tight text-[#3D2010]">
                      {i + 1}. {e.korean} — {e.english}
                    </p>
                  ))}
                </div>
              </div>
              {/* 하단: CTA */}
              <div className="border-t border-[#FFE0D0] px-5 py-3 text-center">
                <p className="text-[10px] font-semibold text-[#FF6B4A]">
                  {language === "ko" ? "나도 해보기 →" : "Try it →"} ogu-three.vercel.app
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveShareCard}
            disabled={cardSaving}
            className="flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl border-2 border-[#FF6B4A] bg-[#FFF0E8] px-5 py-3 text-[14px] font-semibold text-[#FF6B4A] transition hover:bg-[#FFE0D0] disabled:opacity-60 sm:w-auto"
          >
            {cardSaving
              ? (language === "ko" ? "저장 중..." : "Saving...")
              : language === "ko"
              ? "📸 공유 카드 저장하기"
              : "📸 Save & Share Card"}
          </button>
        </section>
      </div>
    </main>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#FFF8F0] px-4 py-8 text-[#3D2010]">
          <span className="animate-pulse-soft">🐥</span>
        </main>
      }
    >
      <ReportContent />
    </Suspense>
  );
}
