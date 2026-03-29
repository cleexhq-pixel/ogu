"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { pageview, trackSendVoice } from "@/app/lib/gtag";
import Analytics from "@/app/components/Analytics";

const BRAND_PURPLE = "#6c2eff";
const BRAND_GOLD = "#ffd84d";
const LAVENDER_BG = "#EDE9FE";
const CARD_BORDER = "#DDD6FE";
const TEXT_PRIMARY = "#0f172a";
const OGU_CURRENT_DAY_KEY = "ogu_current_day";

const JOURNEY_DAYS = [
  {
    day: 1,
    ko: "제 최애는 BTS예요.",
    en: "My favorite is BTS.",
    journeyTitle: "My favorite",
    journeyKoLine: "제 최애는 ___예요."
  },
  {
    day: 2,
    ko: "저는 K-pop을 좋아해요.",
    en: "I like K-pop.",
    journeyTitle: "I like this",
    journeyKoLine: "저는 ___를 좋아해요."
  },
  {
    day: 3,
    ko: "저는 한국어를 배우고 있어요.",
    en: "I'm learning Korean.",
    journeyTitle: "I'm learning",
    journeyKoLine: "저는 한국어를 배우고 있어요."
  }
];

function readStoredCurrentDay() {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(OGU_CURRENT_DAY_KEY);
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 4);
}

function journeyDayToContent(dayNum) {
  const row = JOURNEY_DAYS[dayNum - 1];
  if (!row) return null;
  return {
    id: "idol",
    cardLabel: `👑 Day ${dayNum}`,
    headerLabel: `Day ${dayNum} · ${row.journeyTitle}`,
    ko: row.ko,
    en: row.en
  };
}

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

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

async function requestMicrophoneAccess() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { ok: true };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return { ok: true };
  } catch (err) {
    const name = err && err.name;
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return { ok: false, denied: true };
    }
    return { ok: true };
  }
}

function FirstLineFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState(null);
  const [userInput, setUserInput] = useState("");
  const [ttsLoading, setTtsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [micHint, setMicHint] = useState(null);
  const [journeyDay, setJourneyDay] = useState(1);
  const [completedJourneyDay, setCompletedJourneyDay] = useState(null);
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const sttTranscriptRef = useRef("");
  const userStoppedMicRef = useRef(false);
  const completeStep3Ref = useRef(() => {});
  const hydratedFromUrl = useRef(false);

  const journeyActive = journeyDay >= 1 && journeyDay <= 3;
  const journeyContent = journeyActive ? journeyDayToContent(journeyDay) : null;
  const categoryContent = category ? CATEGORIES[category] : null;
  const content = journeyActive && journeyContent ? journeyContent : categoryContent;

  useEffect(() => {
    if (typeof window === "undefined") return;
    pageview(window.location.pathname + window.location.search);
  }, []);

  useEffect(() => {
    if (hydratedFromUrl.current) return;
    hydratedFromUrl.current = true;
    const d = readStoredCurrentDay();
    setJourneyDay(d);
    const cat = searchParams.get("category");
    if (d <= 3) {
      setCategory("idol");
      setStep(2);
      setUserInput("");
      return;
    }
    if (cat === "idol" || cat === "drama" || cat === "trip") {
      setCategory(cat);
      setStep(2);
      setUserInput("");
    }
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

  const completeStep3WithText = useCallback(
    (text) => {
      const trimmed = String(text || "").trim();
      if (!trimmed) return;
      stopAudio();
      if (journeyDay >= 1 && journeyDay <= 3) {
        setCompletedJourneyDay(journeyDay);
        const next = Math.min(journeyDay + 1, 4);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(OGU_CURRENT_DAY_KEY, String(next));
        }
        setJourneyDay(next);
      } else {
        setCompletedJourneyDay(null);
      }
      setUserInput(trimmed);
      setStep(4);
    },
    [stopAudio, journeyDay]
  );

  completeStep3Ref.current = completeStep3WithText;

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "ko-KR";

    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      const t = text.trim();
      sttTranscriptRef.current = t;
      setUserInput(t);
    };

    recognition.onstart = () => {
      setIsRequestingMic(false);
      setIsListening(true);
      setMicHint(null);
      sttTranscriptRef.current = "";
    };

    recognition.onerror = (event) => {
      setIsRequestingMic(false);
      setIsListening(false);
      if (event.error === "not-allowed" || event.error === "denied" || event.error === "service-not-allowed") {
        setMicHint("Please allow microphone access");
      } else if (event.error !== "aborted") {
        setMicHint("Voice input failed. Try again.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setIsRequestingMic(false);
      if (userStoppedMicRef.current) {
        userStoppedMicRef.current = false;
        return;
      }
      const t = sttTranscriptRef.current.trim();
      if (t) {
        completeStep3Ref.current(t);
      }
    };

    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.abort();
      } catch (_) {}
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (step === 3) return;
    try {
      recognitionRef.current?.stop();
    } catch (_) {}
    setIsListening(false);
    setIsRequestingMic(false);
  }, [step]);

  const toggleVoiceInput = useCallback(async () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isListening) {
      userStoppedMicRef.current = true;
      try {
        recognition.stop();
      } catch (_) {}
      setIsListening(false);
      return;
    }

    try {
      if (navigator.permissions?.query) {
        const result = await navigator.permissions.query({ name: "microphone" });
        if (result.state === "denied") {
          setMicHint("Please allow microphone access");
          return;
        }
      }
    } catch (_) {}

    setMicHint(null);
    setIsRequestingMic(true);
    try {
      const mic = await requestMicrophoneAccess();
      if (!mic.ok && mic.denied) {
        setIsRequestingMic(false);
        setMicHint("Please allow microphone access");
        return;
      }
      userStoppedMicRef.current = false;
      sttTranscriptRef.current = "";
      recognition.start();
      trackSendVoice();
    } catch (e) {
      console.warn("SpeechRecognition start failed", e);
      setIsRequestingMic(false);
      setMicHint("Please allow microphone access");
    }
  }, [isListening]);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    const trimmed = userInput.trim();
    if (!trimmed) return;
    completeStep3WithText(trimmed);
  };

  const tryAnother = () => {
    stopAudio();
    setCompletedJourneyDay(null);
    setUserInput("");
    if (journeyDay <= 3) {
      setStep(2);
      return;
    }
    setCategory(null);
    setStep(1);
    const qs = buildQs();
    const tail = qs.toString();
    router.replace(tail ? `/first-line?${tail}` : "/first-line");
  };

  const startNextJourneyDay = () => {
    stopAudio();
    setCompletedJourneyDay(null);
    setUserInput("");
    setStep(2);
  };

  const stepClass =
    "w-full transition-all duration-300 ease-out motion-reduce:transition-none animate-fade-in-up";

  const successContent =
    completedJourneyDay != null ? journeyDayToContent(completedJourneyDay) : content;
  const nextJourneyPreview =
    completedJourneyDay != null && completedJourneyDay < 3 ? JOURNEY_DAYS[completedJourneyDay] : null;
  const nextDayNumber = completedJourneyDay != null ? completedJourneyDay + 1 : null;

  return (
    <>
      <Analytics />
      <main
        className="min-h-screen px-4 py-8 font-jakarta"
        style={{ backgroundColor: LAVENDER_BG, color: TEXT_PRIMARY }}
      >
        <div className="mx-auto w-full max-w-[480px]">
          {step === 1 && (
            <div key="s1" className={stepClass}>
              <h1
                className="text-center text-xl font-bold leading-snug sm:text-2xl"
                style={{ color: TEXT_PRIMARY }}
              >
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
                    className="w-full rounded-2xl border-2 border-[#DDD6FE] bg-white px-6 py-5 text-left text-lg font-bold text-[#0f172a] transition hover:border-[#6c2eff] active:scale-[0.99]"
                  >
                    {CATEGORIES[key].cardLabel}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && content && (
            <div key="s2" className={stepClass}>
              <p
                className="text-center text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[11px]"
                style={{ color: BRAND_PURPLE }}
              >
                {content.headerLabel}
              </p>
              <div
                className="mt-5 rounded-[18px] border-2 bg-white px-6 py-8"
                style={{ borderColor: CARD_BORDER, boxShadow: "0 10px 32px rgba(109, 40, 255, 0.06)" }}
              >
                <p
                  className="font-korean text-center text-2xl font-bold leading-relaxed sm:text-[1.65rem]"
                  style={{ color: TEXT_PRIMARY }}
                >
                  {content.ko}
                </p>
                <p className="mt-4 text-center text-sm text-[#94A3B8] sm:text-base">{content.en}</p>
                <button
                  type="button"
                  onClick={() => void playKoreanTts()}
                  disabled={ttsLoading}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 bg-white py-3 text-sm font-semibold transition hover:bg-[#FAF8FF] disabled:opacity-50"
                  style={{ borderColor: BRAND_PURPLE, color: BRAND_PURPLE }}
                >
                  <span aria-hidden>🔊</span>
                  {ttsLoading ? "Loading…" : "Listen"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="mt-4 w-full rounded-2xl py-4 text-[17px] font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
                  style={{ backgroundColor: BRAND_PURPLE, boxShadow: "0 12px 28px rgba(108, 46, 255, 0.35)" }}
                >
                  Say it now
                </button>
              </div>
              {!journeyActive ? (
                <button
                  type="button"
                  onClick={goChooseTopic}
                  className="mt-6 w-full text-center text-xs font-medium text-[#94A3B8] transition hover:text-[#64748B]"
                >
                  ← Choose another topic
                </button>
              ) : null}
            </div>
          )}

          {step === 3 && content && (
            <div key="s3" className={stepClass}>
              <h2
                className="text-center text-lg font-bold sm:text-xl"
                style={{ color: TEXT_PRIMARY }}
              >
                Now, say it in Korean! 🗣️
              </h2>
              <p className="font-korean mt-6 text-center text-lg text-[#94A3B8]/50 sm:text-xl">
                {content.ko}
              </p>
              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div className="flex gap-3">
                  <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Type in Korean..."
                    rows={4}
                    className="font-korean min-h-[120px] min-w-0 flex-1 resize-none rounded-[14px] border-2 border-[#DDD6FE] bg-white px-4 py-3 text-[15px] text-[#0f172a] outline-none transition placeholder:text-[#94A3B8] focus:border-[#6c2eff] focus:ring-2 focus:ring-[#6c2eff]/20"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => void toggleVoiceInput()}
                    disabled={!getSpeechRecognition() || isRequestingMic}
                    title={getSpeechRecognition() ? "Voice input" : "Voice input not supported"}
                    className={`flex h-[120px] w-[52px] shrink-0 flex-col items-center justify-center rounded-[14px] border-2 bg-white text-xl transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      isListening ? "shadow-[0_4px_16px_rgba(108,46,255,0.2)]" : "hover:bg-[#FAF8FF]"
                    }`}
                    style={{
                      borderColor: isListening ? BRAND_PURPLE : CARD_BORDER,
                      color: BRAND_PURPLE
                    }}
                    aria-pressed={isListening}
                    aria-label={isListening ? "Stop listening" : "Start voice input"}
                  >
                    <span aria-hidden>🗣️</span>
                    {isRequestingMic && !isListening ? (
                      <span className="mt-1 text-[9px] font-semibold leading-tight" style={{ color: BRAND_PURPLE }}>
                        …
                      </span>
                    ) : null}
                  </button>
                </div>
                {micHint ? <p className="text-center text-xs text-red-600/90">{micHint}</p> : null}
                <button
                  type="submit"
                  disabled={!userInput.trim() || isListening}
                  className="w-full rounded-2xl py-4 text-[16px] font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ backgroundColor: BRAND_PURPLE, boxShadow: "0 12px 28px rgba(108, 46, 255, 0.35)" }}
                >
                  Submit
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

          {step === 4 && successContent && (
            <div key="s4" className={`${stepClass} mx-auto w-full max-w-[400px] text-center`}>
              <div
                className="inline-flex items-center justify-center rounded-[20px] px-4 py-2 text-[11px] font-bold text-white"
                style={{ backgroundColor: BRAND_PURPLE }}
              >
                🎉 FIRST LINE COMPLETE
              </div>
              <h2
                className="mt-5 text-[26px] font-bold leading-tight tracking-[-0.5px] text-[#0f172a]"
              >
                You just spoke{" "}
                <span style={{ color: BRAND_PURPLE }}>Korean!</span>
              </h2>
              <p className="mt-3 text-[14px] text-[#6b7280]">
                {completedJourneyDay != null ? (
                  <>
                    That&apos;s Day {completedJourneyDay}. Keep the streak!
                  </>
                ) : (
                  <>
                    That&apos;s your first sentence. Keep going.
                  </>
                )}
              </p>
              <div
                className="mt-8 rounded-[20px] border-2 bg-white px-5 py-6 text-center"
                style={{ borderColor: CARD_BORDER }}
              >
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: BRAND_PURPLE }}
                  >
                    YOU SAID
                  </p>
                  <p className="font-korean mt-2 text-[20px] font-bold leading-snug" style={{ color: TEXT_PRIMARY }}>
                    {userInput.trim()}
                  </p>
                </div>
                <div className="my-5 h-px w-full" style={{ backgroundColor: CARD_BORDER }} aria-hidden />
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: BRAND_PURPLE }}
                  >
                    MODEL LINE
                  </p>
                  <p className="font-korean mt-2 text-[20px] font-bold leading-snug" style={{ color: TEXT_PRIMARY }}>
                    {successContent.ko}
                  </p>
                  <p className="mt-2 text-[13px] text-[#6b7280]">{successContent.en}</p>
                </div>
                {normalizeKorean(userInput) === normalizeKorean(successContent.ko) ? (
                  <p
                    className="mt-5 rounded-full py-2.5 text-sm font-bold text-[#0f172a]"
                    style={{ backgroundColor: BRAND_GOLD }}
                  >
                    ✨ Perfect match!
                  </p>
                ) : null}
              </div>

              {nextJourneyPreview && nextDayNumber != null ? (
                <>
                  <div className="my-8 h-px w-full max-w-[360px] mx-auto" style={{ backgroundColor: CARD_BORDER }} aria-hidden />
                  <p
                    className="text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: BRAND_PURPLE }}
                  >
                    Up next — Day {nextDayNumber}
                  </p>
                  <div
                    className="mt-4 rounded-[14px] bg-white px-4 py-5 text-center"
                    style={{ border: "2px dashed rgba(108, 46, 255, 0.3)" }}
                  >
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: BRAND_PURPLE }}>
                      DAY {nextDayNumber}
                    </p>
                    <p className="font-korean mt-3 text-lg font-bold text-[#0f172a]">{nextJourneyPreview.ko}</p>
                    <p className="mt-2 text-[13px] text-[#6b7280]">{nextJourneyPreview.en}</p>
                    <button
                      type="button"
                      onClick={startNextJourneyDay}
                      className="mt-5 w-full rounded-[14px] py-3.5 text-[14px] font-bold text-white transition hover:brightness-110 active:scale-[0.99]"
                      style={{ backgroundColor: BRAND_PURPLE }}
                    >
                      Start Day {nextDayNumber} now
                    </button>
                  </div>
                </>
              ) : null}

              {completedJourneyDay === 3 ? (
                <>
                  <div className="my-8 h-px w-full max-w-[360px] mx-auto" style={{ backgroundColor: CARD_BORDER }} aria-hidden />
                  <p className="text-[15px] font-bold text-[#0f172a]">🎉 3-Day Challenge Complete!</p>
                </>
              ) : null}

              <div className="mt-8 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={tryAnother}
                  className="w-full rounded-[14px] py-4 text-[15px] font-bold text-white transition hover:brightness-110 active:scale-[0.99]"
                  style={{ backgroundColor: BRAND_PURPLE }}
                >
                  Try another one
                </button>
                <button
                  type="button"
                  onClick={goHome}
                  className="w-full rounded-[14px] border-2 bg-white py-3.5 text-[15px] font-bold transition hover:bg-white/90 active:scale-[0.99]"
                  style={{ borderColor: BRAND_PURPLE, color: BRAND_PURPLE }}
                >
                  Go to home
                </button>
              </div>
              <p className="mt-8 text-[12px] text-[#6b7280]">
                {completedJourneyDay != null ? (
                  journeyDay <= 3 ? (
                    <>
                      You&apos;re on <span style={{ color: BRAND_PURPLE }}>Day {journeyDay}</span> — come back
                      tomorrow!
                    </>
                  ) : (
                    <>You finished all 3 days — come back tomorrow!</>
                  )
                ) : (
                  <>Keep practicing — come back tomorrow!</>
                )}
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function FirstLineFallback() {
  return (
    <main className="min-h-screen font-jakarta" style={{ backgroundColor: LAVENDER_BG }}>
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
