"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { pageview, event as gaEvent } from "@/app/lib/gtag";
import { CHALLENGE_DAYS } from "@/app/data/missions";

function getTodayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getYesterdayLocal() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MILESTONES = {
  3: { ko: "🔥 3일 연속! 오구오구 열심히네요!", en: "3 day streak! Keep it up!", id: "3 hari berturut-turut! Semangat!" },
  7: { ko: "⭐ 일주일 연속! 대단해요!", en: "7 day streak! Amazing!", id: "7 hari berturut-turut! Luar biasa!" },
  30: { ko: "👑 한 달 연속! 오구 마스터!", en: "30 day streak! Ogu Master!", id: "30 hari berturut-turut! Master Ogu!" }
};

const PERSONA_NAMES = {
  cafe: { ko: "카페오구", en: "Café Ogu", id: "Kafe Ogu" },
  office: { ko: "직장오구", en: "Office Ogu", id: "Kantor Ogu" },
  drama: { ko: "드라마오구", en: "Drama Ogu", id: "Drama Ogu" },
  free: { ko: "자유대화오구", en: "Free Talk Ogu", id: "Obrolan Bebas Ogu" }
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
  const [reportCorrections, setReportCorrections] = useState([]);
  const shareCardRef = useRef(null);
  const [saveToast, setSaveToast] = useState("");

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

      const correctionsRaw = window.localStorage.getItem("ogu_corrections");
      if (correctionsRaw) {
        try {
          const arr = JSON.parse(correctionsRaw);
          if (Array.isArray(arr)) setReportCorrections(arr.slice(0, 10));
        } catch (_) {}
      }

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

  // GA4: 리포트 페이지 진입 시 페이지뷰 전송
  useEffect(() => {
    if (typeof window === "undefined") return;
    pageview(window.location.pathname + window.location.search);
  }, [level, persona, language]);

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
      ? language === "ko" ? "왕초보 오구" : language === "id" ? "Pemula" : "Beginner"
      : level === "elementary"
      ? language === "ko" ? "초급 오구" : language === "id" ? "Dasar" : "Elementary"
      : language === "ko" ? "중급 오구" : language === "id" ? "Menengah" : "Intermediate";

  const personaLabel = PERSONA_NAMES[persona] ? (language === "ko" ? PERSONA_NAMES[persona].ko : language === "id" ? PERSONA_NAMES[persona].id : PERSONA_NAMES[persona].en) : (language === "ko" ? "오구" : language === "id" ? "Ogu" : "Ogu");

  const progressPercent =
    level === "beginner" ? 33 : level === "elementary" ? 66 : 100;

  const durationText =
    durationMinutes != null
      ? language === "ko"
        ? `${durationMinutes}분 대화 완료!`
        : language === "id"
        ? `${durationMinutes} menit latihan selesai!`
        : `${durationMinutes} min of practice completed!`
      : language === "ko"
      ? "오늘도 열심히 연습했어요!"
      : language === "id"
      ? "Anda sudah berlatih dengan giat hari ini!"
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
      gaEvent("share_card");
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
        : language === "id"
        ? "🐥 Laporan Percakapan Korea OguOgu"
        : "🐥 OguOgu Korean Conversation Report"
    );
    lines.push(
      language === "ko" ? `레벨: ${levelLabel}` : language === "id" ? `Level: ${levelLabel}` : `Level: ${levelLabel}`
    );
    if (durationMinutes != null) {
      lines.push(
        language === "ko"
          ? `대화 시간: ${durationMinutes}분`
          : language === "id"
          ? `Waktu: ${durationMinutes} menit`
          : `Conversation time: ${durationMinutes} min`
      );
    }
    if (expressions.length) {
      lines.push("");
      lines.push(
        language === "ko" ? "오늘 배운 표현:" : language === "id" ? "Ekspresi kunci hari ini:" : "Key expressions today:"
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
      gaEvent("save_phrase");
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy", e);
    }
  };

  const handleSaveExpression = (expr) => {
    if (!expr) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("ogu_saved_phrases");
      let list = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) list = parsed;
        } catch {
          list = [];
        }
      }
      const exists = list.some((item) => item && item.korean === expr.korean);
      if (exists) {
        setSaveToast(
          language === "ko"
            ? "이미 저장됐어요!"
            : language === "id"
            ? "Sudah tersimpan!"
            : "Already saved!"
        );
        setTimeout(() => setSaveToast(""), 2000);
        return;
      }
      list.push({
        korean: expr.korean,
        translation: expr.english,
        saved_at: new Date().toISOString(),
        source: "report"
      });
      window.localStorage.setItem("ogu_saved_phrases", JSON.stringify(list));
      setSaveToast(
        language === "ko"
          ? "표현장에 저장됐어요! 📚"
          : language === "id"
          ? "Tersimpan di Frasaku! 📚"
          : "Saved to My Phrases! 📚"
      );
      setTimeout(() => setSaveToast(""), 2000);
    } catch {
      // ignore errors
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
              {language === "ko" ? MILESTONES[milestoneModal].ko : language === "id" ? MILESTONES[milestoneModal].id : MILESTONES[milestoneModal].en}
            </p>
            <button
              type="button"
              onClick={() => setMilestoneModal(null)}
              className="mt-4 w-full rounded-2xl bg-[#FF6B4A] py-3 text-sm font-semibold text-white transition hover:bg-[#ff5a33]"
            >
              {language === "ko" ? "확인" : language === "id" ? "Oke" : "OK"}
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
                {language === "ko" ? "오늘의 오구 리포트" : language === "id" ? "Laporan Ogu Hari Ini" : "Today's Ogu Report"}
              </p>
              <h1 className="text-2xl font-extrabold text-[#FF6B4A] sm:text-3xl">
                {language === "ko" ? "오구오구~ 잘했어요! 🎉" : language === "id" ? "Ogu ogu~ Kerja bagus! 🎉" : "Ogu ogu~ Great job! 🎉"}
              </h1>
              <p className="text-sm text-[#9A7060]">{language === "ko" ? "수고했어요!" : language === "id" ? "Kerja bagus hari ini!" : "Great job today!"}</p>
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
              🔥 {language === "ko" ? `${streakData.current_streak}일 연속 학습 중!` : language === "id" ? `${streakData.current_streak} hari berturut-turut!` : `${streakData.current_streak} day streak!`}
            </p>
            <div className="mt-2 flex justify-center gap-4 text-[12px] text-[#E65100]">
              <span>{language === "ko" ? `최장 기록: ${streakData.best_streak}일` : language === "id" ? `Terbaik: ${streakData.best_streak} hari` : `Best: ${streakData.best_streak} days`}</span>
              <span>{language === "ko" ? `총 학습 횟수: ${streakData.total_sessions}회` : language === "id" ? `Total sesi: ${streakData.total_sessions}` : `Total sessions: ${streakData.total_sessions}`}</span>
            </div>
          </section>
        )}

        {/* ② 오늘 배운 표현 카드 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#3D2010]">
              {language === "ko" ? "오늘 배운 표현" : language === "id" ? "Ekspresi Kunci Hari Ini" : "Key Expressions Today"}
            </h2>
            {isLoadingExpressions && (
              <span className="text-[11px] text-[#9A7060]">
                {language === "ko" ? "요약 중..." : language === "id" ? "Menganalisis..." : "Analyzing..."}
              </span>
            )}
          </div>

          {expressions.length === 0 && !isLoadingExpressions ? (
            <p className="rounded-2xl border border-[#FFE0D0] bg-[#FFFFFF] p-4 text-[12px] text-[#9A7060] shadow-sm">
              {language === "ko"
                ? "표현을 아직 불러오지 못했어요. 대화를 조금 더 길게 나눠보면 더 잘 분석할 수 있어요."
                : language === "id"
                ? "Belum bisa mengekstrak ekspresi. Coba percakapan yang sedikit lebih panjang lain kali."
                : "We couldn't extract expressions yet. Try having a slightly longer conversation next time."}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {(expressions.length ? expressions : [1, 2, 3]).map((expr, idx) => {
                const korean = expr?.korean ?? "…";
                const english = expr?.english ?? "…";
                const example = expr?.example ?? "…";
                const realExpr = expr && expr.korean;
                return (
                  <div
                    key={idx}
                    className="flex flex-col rounded-2xl border border-[#FFE0D0] bg-[#FFFFFF] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)]"
                  >
                    <span className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[#FF6B4A]">
                      {language === "ko" ? `표현 ${idx + 1}` : language === "id" ? `Ekspresi ${idx + 1}` : `Expression ${idx + 1}`}
                    </span>
                    <p className="text-sm font-semibold text-[#3D2010]">{korean}</p>
                    <p className="mt-1 text-[11px] text-[#9A7060]">{english}</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-[#C09A8A]">
                      {example}
                    </p>
                    {realExpr && (
                      <button
                        type="button"
                        onClick={() => handleSaveExpression(expr)}
                        className="mt-3 inline-flex items-center justify-center rounded-2xl bg-[#FFF8F0] px-3 py-1.5 text-[11px] font-semibold text-[#FF6B4A] shadow-sm transition hover:bg-[#FFE0D0]"
                      >
                        💾{" "}
                        {language === "ko"
                          ? "저장"
                          : language === "id"
                          ? "Simpan"
                          : "Save"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 교정 포인트 */}
        {reportCorrections.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[#3D2010]">
              {language === "ko" ? "📝 이번 대화 교정 포인트" : language === "id" ? "📝 Poin Koreksi" : "📝 Correction Points"}
            </h2>
            <div className="space-y-3">
              {reportCorrections.map((c, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border-2 px-4 py-3"
                  style={{ backgroundColor: "#FFF8E1", borderColor: "#FFB300" }}
                >
                  <p className="text-[13px]">
                    <span className="text-red-600 line-through">{c.original ?? ""}</span>
                    <span className="mx-1.5 font-medium text-[#FFB300]">→</span>
                    <span className="font-semibold text-green-700">{c.corrected ?? ""}</span>
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[#6D4C41]">
                    {language === "ko" ? (c.explanation_ko ?? c.explanation_en) : language === "id" ? (c.explanation_id ?? c.explanation_en) : (c.explanation_en ?? c.explanation_ko)}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-center text-[12px] font-medium text-[#FFB300]">
              {language === "ko" ? "이 표현들을 기억해두세요! 🐥" : language === "id" ? "Ingat ini! 🐥" : "Remember these! 🐥"}
            </p>
          </section>
        )}

        {/* ③ 레벨 진행도 */}
        <section className="rounded-3xl border border-[#FFE0D0] bg-[#FFFFFF] p-5 shadow-[0_16px_48px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#3D2010]">
                {language === "ko" ? "나의 오구 레벨" : language === "id" ? "Level Ogu Saya" : "My Ogu Level"}
              </h2>
              <p className="mt-0.5 text-[11px] text-[#9A7060]">
                {language === "ko"
                  ? "다음 레벨까지 한 걸음 더!"
                  : language === "id"
                  ? "Satu langkah lagi ke level berikutnya!"
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
                : language === "id"
                ? "Sampai jumpa lagi besok untuk berlatih dengan Ogu!"
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
            {language === "ko" ? "다시 대화하기 🐥" : language === "id" ? "Mulai Lagi 🐥" : "Talk Again 🐥"}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#FFE0D0] bg-[#FFFFFF] px-5 py-3.5 text-[14px] font-semibold text-[#3D2010] transition hover:bg-[#FFF0E8] hover:border-[#FF6B4A]/40 active:scale-[0.98] sm:w-auto"
          >
            {language === "ko" ? "공유하기 📸" : language === "id" ? "Bagikan Hasil 📸" : "Share Result 📸"}
          </button>
        </section>
        {shareCopied && (
          <p className="text-center text-[12px] text-[#9A7060]">
            {language === "ko"
              ? "리포트가 클립보드에 복사되었어요!"
              : language === "id"
              ? "Laporan disalin ke clipboard!"
              : "Report copied to clipboard!"}
          </p>
        )}

        {/* 공유 카드 (1080x1080 캡처용, 화면에는 360px로 표시) */}
        <section className="flex flex-col items-center gap-4 pt-4">
          <h2 className="text-sm font-semibold text-[#3D2010]">
            {language === "ko" ? "📸 공유 카드" : language === "id" ? "📸 Kartu Bagikan" : "📸 Share Card"}
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
                  {language === "ko" ? "오늘의 한국어 학습 완료!" : language === "id" ? "Latihan Korea hari ini selesai!" : "Korean practice done today!"}
                </p>
                <p className="mt-2 text-center text-[11px] font-semibold text-[#FF6B4A]">
                  {personaLabel} · {levelLabel}
                </p>
                {reportCorrections.length > 0 && (
                  <p className="mt-1.5 text-center text-[10px] font-bold" style={{ color: "#FFB300" }}>
                    {language === "ko" ? `교정 ${reportCorrections.length}개 완료!` : language === "id" ? `${reportCorrections.length} koreksi selesai!` : `${reportCorrections.length} corrections!`}
                  </p>
                )}
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
                  {language === "ko" ? "나도 해보기 →" : language === "id" ? "Coba juga →" : "Try it →"} ogu-three.vercel.app
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
              ? (language === "ko" ? "저장 중..." : language === "id" ? "Menyimpan..." : "Saving...")
              : language === "ko"
              ? "📸 공유 카드 저장하기"
              : language === "id"
              ? "📸 Simpan Kartu"
              : "📸 Save & Share Card"}
          </button>
        </section>

        {/* 내일 챌린지 카드 */}
        {(() => {
          let nextDay = 1;
          if (typeof window !== "undefined") {
            try {
              const raw = window.localStorage.getItem("ogu_challenge_progress");
              if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) {
                  const completed = arr.length;
                  nextDay = Math.min(7, completed + 1);
                }
              }
            } catch {
              nextDay = 1;
            }
          }
          const challenge = CHALLENGE_DAYS.find((d) => d.day === nextDay);
          if (!challenge) return null;
          const title =
            language === "ko"
              ? challenge.title.ko
              : language === "id"
              ? challenge.title.id
              : challenge.title.en;
          const label =
            language === "ko"
              ? `내일 챌린지: Day ${nextDay} - ${title}`
              : language === "id"
              ? `Tantangan Besok: Hari ${nextDay} - ${title}`
              : `Tomorrow's Challenge: Day ${nextDay} - ${title}`;
          const backLabel =
            language === "ko"
              ? "홈으로 돌아가기"
              : language === "id"
              ? "Kembali ke Beranda"
              : "Back to Home";
          return (
            <section className="mt-4 space-y-3 rounded-3xl border border-[#FFE0D0] bg-[#FFFFFF] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
              <h2 className="text-sm font-semibold text-[#3D2010]">🔥 {label}</h2>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[#FF6B4A] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(255,107,74,0.4)] transition hover:bg-[#ff5a33] active:scale-[0.98]"
              >
                {backLabel}
              </button>
            </section>
          );
        })()}
      </div>
      {saveToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-[#3D2010] px-4 py-2 text-[12px] font-medium text-white shadow-lg">
          {saveToast}
        </div>
      )}
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
