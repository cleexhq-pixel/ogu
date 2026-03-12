"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function ReportPage() {
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
      if (Array.isArray(parsed)) {
        setHistory(parsed);
      }

      const startRaw = window.sessionStorage.getItem("ogu-chat-start");
      const endRaw = window.sessionStorage.getItem("ogu-chat-end");
      if (startRaw && endRaw) {
        const start = Number(startRaw);
        const end = Number(endRaw);
        if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
          const minutes = Math.max(
            1,
            Math.round((end - start) / 1000 / 60)
          );
          setDurationMinutes(minutes);
        }
      }
    } catch {
      // ignore
    }
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

  const title =
    language === "ko"
      ? "오구오구 회화 리포트"
      : "OguOgu Conversation Report";

  const summaryText =
    language === "ko"
      ? "오늘 오구와 나눈 대화를 다시 보면서 표현을 복습해보세요."
      : "Review your conversation with Ogu and reflect on the expressions you used.";

  const levelLabel =
    level === "beginner"
      ? language === "ko"
        ? "왕초보 오구"
        : "Beginner Ogu"
      : level === "elementary"
      ? language === "ko"
        ? "초급 오구"
        : "Elementary Ogu"
      : language === "ko"
      ? "중급 오구"
      : "Intermediate Ogu";

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
      language === "ko"
        ? `레벨: ${levelLabel}`
        : `Level: ${levelLabel}`
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
        language === "ko"
          ? "오늘 배운 표현:"
          : "Key expressions today:"
      );
      expressions.forEach((e, idx) => {
        lines.push(
          `${idx + 1}. ${e.korean} - ${e.english} (${e.example})`
        );
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
    <main className="flex min-h-screen flex-col items-center bg-[#1A1008] px-4 py-8 text-slate-50">
      <div className="w-full max-w-3xl space-y-6">
        {/* ① 상단 칭찬 배너 */}
        <section className="rounded-3xl border border-[#FF6B4A] bg-gradient-to-r from-[#2D1A0E] via-[#34160E] to-[#2D1A0E] px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FFD93D]">
                {language === "ko" ? "오늘의 오구 리포트" : "Today’s Ogu Report"}
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#FFE9A6]">
                오구오구~ 잘했어요! 🎉
              </h1>
              <p className="text-xs sm:text-sm text-[#FFE9A6]/90">
                Great job today!
              </p>
              <p className="text-[11px] text-[#FFD93D]">{durationText}</p>
            </div>
            <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-3xl bg-[#1A1008] text-3xl shadow-[0_0_30px_rgba(255,217,61,0.6)]">
              🐥
            </div>
          </div>
        </section>

        {/* ② 오늘 배운 표현 카드 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#FFE9A6]">
              {language === "ko" ? "오늘 배운 표현" : "Key Expressions Today"}
            </h2>
            {isLoadingExpressions && (
              <span className="text-[11px] text-[#D9BFA3]">
                {language === "ko" ? "요약 중..." : "Analyzing..."}
              </span>
            )}
          </div>

          {expressions.length === 0 && !isLoadingExpressions ? (
            <p className="text-[11px] text-[#BFA28D]">
              {language === "ko"
                ? "표현을 아직 불러오지 못했어요. 대화를 조금 더 길게 나눠보면 더 잘 분석할 수 있어요."
                : "We couldn’t extract expressions yet. Try having a slightly longer conversation next time."}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {(expressions.length ? expressions : [1, 2, 3]).map((expr, idx) => {
                const korean = expr?.korean ?? "…";
                const english = expr?.english ?? "…";
                const example = expr?.example ?? "…";
                return (
                  <div
                    key={idx}
                    className="flex flex-col justify-between rounded-2xl border border-[#FF6B4A] bg-[#2D1A0E] p-3 text-[11px] text-[#FFE9A6] shadow-[0_14px_35px_rgba(0,0,0,0.7)]"
                  >
                    <div className="mb-1 flex items-center justify-between text-[10px] text-[#FFD93D]">
                      <span>
                        {language === "ko"
                          ? `표현 ${idx + 1}`
                          : `Expression ${idx + 1}`}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-[#FFE9A6]">
                        {korean}
                      </p>
                      <p className="text-[10px] text-[#FFD9A6]">{english}</p>
                      <p className="mt-1 text-[10px] text-[#D9BFA3]">
                        {example}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ③ 나의 오구 레벨 진행도 */}
        <section className="space-y-3 rounded-3xl border border-[#3A2515] bg-[#241208]/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#FFE9A6]">
                {language === "ko"
                  ? "나의 오구 레벨 진행도"
                  : "My Ogu Level Progress"}
              </h2>
              <p className="text-[11px] text-[#D9BFA3]">
                {language === "ko"
                  ? "오늘의 연습이 다음 레벨로 한 걸음 더 가까워졌어요."
                  : "Today’s practice moved you one step closer to the next level."}
              </p>
            </div>
            <span className="rounded-full bg-[#2D1A0E] px-3 py-1 text-[11px] font-semibold text-[#FFD93D]">
              {levelLabel}
            </span>
          </div>

          <div className="space-y-1">
            <div className="h-3 w-full rounded-full bg-[#1A1008]">
              <div
                className="h-3 rounded-full bg-[#FF6B4A] shadow-[0_0_20px_rgba(255,107,74,0.7)] transition-[width] duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-[#FFD93D]">
              {language === "ko"
                ? "다음 레벨까지 조금만 더! 내일도 오구오구와 연습해볼까요?"
                : "You’re getting close to the next level. Come back and practice with Ogu again tomorrow!"}
            </p>
          </div>
        </section>

        {/* ④ 하단 버튼들 */}
        <section className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="flex items-center justify-center rounded-full bg-[#FF6B4A] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_14px_35px_rgba(255,107,74,0.8)] transition hover:bg-[#ff5a33] active:translate-y-0.5 active:scale-[0.97]"
            >
              {language === "ko" ? "다시 대화하기 🐥" : "Talk Again 🐥"}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center justify-center rounded-full border border-[#FFD93D] bg-[#241208] px-4 py-2 text-[13px] font-semibold text-[#FFE9A6] shadow-[0_10px_25px_rgba(0,0,0,0.7)] transition hover:bg-[#2D1A0E] active:translate-y-0.5 active:scale-[0.97]"
            >
              {language === "ko" ? "공유하기 📸" : "Share Result 📸"}
            </button>
          </div>
          {shareCopied && (
            <p className="text-[10px] text-[#FFD93D]">
              {language === "ko"
                ? "리포트가 클립보드에 복사되었어요!"
                : "Report copied to clipboard!"}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
