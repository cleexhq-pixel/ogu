"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [history, setHistory] = useState([]);
  const [expressions, setExpressions] = useState([]);
  const [isLoadingExpressions, setIsLoadingExpressions] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);

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

  const levelLabel =
    level === "beginner"
      ? language === "ko" ? "왕초보 오구" : "Beginner Ogu"
      : level === "elementary"
      ? language === "ko" ? "초급 오구" : "Elementary Ogu"
      : language === "ko" ? "중급 오구" : "Intermediate Ogu";

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
