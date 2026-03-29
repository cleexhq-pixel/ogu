"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { pageview } from "@/app/lib/gtag";
import Analytics from "@/app/components/Analytics";

const BRAND_PURPLE = "#6c2eff";
const BRAND_GOLD = "#ffd84d";

const CATEGORIES = {
  idol: {
    id: "idol",
    cardLabel: "👑 My favorite idol",
    headerLabel: "My favorite idol",
    ko: "제 최애는 BTS예요.",
    en: "My favorite is BTS."
  },
  drama: {
    id: "drama",
    cardLabel: "🎬 K-drama line",
    headerLabel: "K-drama line",
    ko: "보고 싶었어요.",
    en: "I missed you."
  },
  trip: {
    id: "trip",
    cardLabel: "✈️ Korea trip",
    headerLabel: "Korea trip",
    ko: "여기 어떻게 가요?",
    en: "How do I get there?"
  }
};

function normalizeKorean(s) {
  return String(s || "")
    .replace(/\s+/g, "")
    .replace(/[.?!。…]/g, "")
    .trim();
}

function FirstLineFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState(null);
  const [userInput, setUserInput] = useState("");
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef(null);
  const hydratedFromUrl = useRef(false);

  const content = category ? CATEGORIES[category] : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    pageview(window.location.pathname + window.location.search);
  }, []);

  useEffect(() => {
    if (hydratedFromUrl.current) return;
    const cat = searchParams.get("category");
    if (cat === "idol" || cat === "drama" || cat === "trip") {
      setCategory(cat);
      setStep(2);
      setUserInput("");
    }
    hydratedFromUrl.current = true;
  }, [searchParams]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = "";
      } catch {
        // ignore
      }
      audioRef.current = null;
    }
  }, []);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const playKoreanTts = useCallback(async () => {
    if (!content?.ko) return;
    stopAudio();
    setTtsLoading(true);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content.ko, lang: "ko-KR" })
      });
      const data = await response.json();
      if (!data?.audioContent) return;
      const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
      audioRef.current = audio;
      await audio.play();
    } catch {
      // silent
    } finally {
      setTtsLoading(false);
    }
  }, [content, stopAudio]);

  const buildQs = useCallback(() => {
    const lang = searchParams.get("lang");
    const qs = new URLSearchParams();
    if (lang && ["ko", "en", "id"].includes(lang)) qs.set("lang", lang);
    return qs;
  }, [searchParams]);

  const selectCategory = (key) => {
    setCategory(key);
    setUserInput("");
    setStep(2);
    const qs = buildQs();
    qs.set("category", key);
    router.replace(`/first-line?${qs.toString()}`);
  };

  const goChooseTopic = () => {
    stopAudio();
    setCategory(null);
    setUserInput("");
    setStep(1);
    const qs = buildQs();
    const tail = qs.toString();
    router.replace(tail ? `/first-line?${tail}` : "/first-line");
  };

  const goHome = () => {
    stopAudio();
    const qs = buildQs();
    const tail = qs.toString();
    router.push(tail ? `/?${tail}` : "/");
  };

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    const trimmed = userInput.trim();
    if (!trimmed) return;
    stopAudio();
    setStep(4);
  };

  const tryAnother = () => {
    stopAudio();
    setCategory(null);
    setUserInput("");
    setStep(1);
    const qs = buildQs();
    const tail = qs.toString();
    router.replace(tail ? `/first-line?${tail}` : "/first-line");
  };

  const stepClass =
    "w-full transition-all duration-300 ease-out motion-reduce:transition-none animate-fade-in-up";

  return (
    <>
      <Analytics />
      <main
        className="min-h-screen px-4 py-8 font-jakarta text-[#0F172A]"
        style={{ backgroundColor: "#f7f6f2" }}
      >
        <div className="mx-auto w-full max-w-[480px]">
          {step === 1 && (
            <div key="s1" className={stepClass}>
              <h1 className="text-center text-xl font-bold leading-snug text-[#0F172A] sm:text-2xl">
                What&apos;s your vibe today?
              </h1>
              <p className="mt-2 text-center text-sm text-[#64748B] sm:text-[15px]">
                Pick a topic to say your first Korean sentence.
              </p>
              <div className="mt-8 flex flex-col gap-4">
                {["idol", "drama", "trip"].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectCategory(key)}
                    className="w-full rounded-2xl border border-[#E8E6E0] bg-white px-6 py-5 text-left text-lg font-semibold text-[#0F172A] shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:border-[#d4d0c8] hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)] active:scale-[0.99]"
                  >
                    {CATEGORIES[key].cardLabel}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && content && (
            <div key="s2" className={stepClass}>
              <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#6c2eff]">
                {content.headerLabel}
              </p>
              <div className="mt-6 rounded-2xl bg-white px-6 py-8 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                <p className="font-korean text-center text-2xl font-bold leading-relaxed text-[#0F172A] sm:text-[1.65rem]">
                  {content.ko}
                </p>
                <p className="mt-4 text-center text-sm italic text-[#94A3B8] sm:text-base">{content.en}</p>
                <button
                  type="button"
                  onClick={() => void playKoreanTts()}
                  disabled={ttsLoading}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 bg-white py-3 text-sm font-semibold transition disabled:opacity-50"
                  style={{ borderColor: BRAND_GOLD, color: "#0F172A" }}
                >
                  <span aria-hidden>🔊</span>
                  {ttsLoading ? "Loading…" : "Listen"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="mt-4 w-full rounded-2xl py-4 text-[17px] font-bold text-white shadow-[0_12px_32px_rgba(108,46,255,0.35)] transition hover:brightness-110 active:scale-[0.98]"
                  style={{ backgroundColor: BRAND_PURPLE }}
                >
                  Say it now →
                </button>
              </div>
              <button
                type="button"
                onClick={goChooseTopic}
                className="mt-6 w-full text-center text-xs font-medium text-[#94A3B8] transition hover:text-[#64748B]"
              >
                ← Choose another topic
              </button>
            </div>
          )}

          {step === 3 && content && (
            <div key="s3" className={stepClass}>
              <h2 className="text-center text-lg font-bold text-[#0F172A] sm:text-xl">
                Now, say it in Korean! 🎤
              </h2>
              <p className="font-korean mt-6 text-center text-lg text-[#94A3B8]/45 sm:text-xl">
                {content.ko}
              </p>
              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Type in Korean..."
                  rows={4}
                  className="font-korean w-full resize-none rounded-2xl border border-[#E8E6E0] bg-white px-4 py-3 text-[15px] text-[#0F172A] shadow-sm outline-none ring-[#6c2eff]/20 placeholder:text-[#94A3B8] focus:border-[#6c2eff] focus:ring-2"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="submit"
                  disabled={!userInput.trim()}
                  className="w-full rounded-2xl py-4 text-[16px] font-bold text-white shadow-[0_12px_32px_rgba(108,46,255,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ backgroundColor: BRAND_PURPLE }}
                >
                  Submit →
                </button>
              </form>
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                  void playKoreanTts();
                }}
                className="mt-6 w-full text-center text-xs font-medium text-[#94A3B8] transition hover:text-[#64748B]"
              >
                ← Listen again
              </button>
            </div>
          )}

          {step === 4 && content && (
            <div key="s4" className={stepClass}>
              <p className="text-center text-5xl" aria-hidden>
                🎉
              </p>
              <h2 className="mt-4 text-center text-2xl font-extrabold leading-tight text-[#0F172A] sm:text-[1.65rem]">
                You just said your first Korean sentence!
              </h2>
              <div className="mt-8 space-y-4 rounded-2xl bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">You typed</p>
                  <p className="font-korean mt-1 text-lg font-semibold text-[#0F172A]">{userInput.trim()}</p>
                </div>
                <div className="border-t border-[#F1F5F9] pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6c2eff]">Model line</p>
                  <p className="font-korean mt-1 text-lg font-semibold text-[#0F172A]">{content.ko}</p>
                  <p className="mt-1 text-sm italic text-[#94A3B8]">{content.en}</p>
                </div>
                {normalizeKorean(userInput) === normalizeKorean(content.ko) ? (
                  <p
                    className="rounded-xl py-2 text-center text-sm font-semibold"
                    style={{ backgroundColor: `${BRAND_GOLD}40`, color: "#854d0e" }}
                  >
                    Perfect match!
                  </p>
                ) : null}
              </div>
              <div className="mt-8 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={tryAnother}
                  className="w-full rounded-2xl py-4 text-[15px] font-bold text-white shadow-[0_12px_32px_rgba(108,46,255,0.35)] transition hover:brightness-110"
                  style={{ backgroundColor: BRAND_PURPLE }}
                >
                  Try another one →
                </button>
                <button
                  type="button"
                  onClick={goHome}
                  className="w-full rounded-2xl border-2 border-[#E8E6E0] bg-white py-3.5 text-[15px] font-semibold text-[#475569] transition hover:bg-[#FAFAF8]"
                >
                  Go to home
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function FirstLineFallback() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: "#f7f6f2" }}>
      <div className="mx-auto max-w-[480px] px-4 py-16 text-center text-sm text-[#94A3B8]">Loading…</div>
    </main>
  );
}

export default function FirstLinePage() {
  return (
    <Suspense fallback={<FirstLineFallback />}>
      <FirstLineFlow />
    </Suspense>
  );
}
