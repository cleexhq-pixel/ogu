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
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const sttTranscriptRef = useRef("");
  const userStoppedMicRef = useRef(false);
  const completeStep3Ref = useRef(() => {});
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

  const completeStep3WithText = useCallback(
    (text) => {
      const trimmed = String(text || "").trim();
      if (!trimmed) return;
      stopAudio();
      setUserInput(trimmed);
      setStep(4);
    },
    [stopAudio]
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

          {step === 4 && content && (
            <div key="s4" className={stepClass}>
              <p className="text-center text-6xl leading-none" aria-hidden>
                🎉
              </p>
              <h2
                className="mt-5 text-center text-2xl font-extrabold leading-tight sm:text-[1.65rem]"
                style={{ color: TEXT_PRIMARY }}
              >
                You just said your first Korean sentence!
              </h2>
              <div
                className="mt-8 space-y-4 rounded-[18px] border-2 bg-white p-5"
                style={{ borderColor: CARD_BORDER, boxShadow: "0 10px 32px rgba(109, 40, 255, 0.06)" }}
              >
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.14em] sm:text-[11px]"
                    style={{ color: BRAND_PURPLE }}
                  >
                    You typed
                  </p>
                  <p className="font-korean mt-2 text-lg font-semibold" style={{ color: TEXT_PRIMARY }}>
                    {userInput.trim()}
                  </p>
                </div>
                <div className="border-t pt-4" style={{ borderColor: CARD_BORDER }}>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.14em] sm:text-[11px]"
                    style={{ color: BRAND_PURPLE }}
                  >
                    Model line
                  </p>
                  <p className="font-korean mt-2 text-lg font-semibold" style={{ color: TEXT_PRIMARY }}>
                    {content.ko}
                  </p>
                  <p className="mt-1 text-sm text-[#94A3B8]">{content.en}</p>
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
                  className="w-full rounded-2xl py-4 text-[15px] font-bold text-white transition hover:brightness-110"
                  style={{ backgroundColor: BRAND_PURPLE, boxShadow: "0 12px 28px rgba(108, 46, 255, 0.35)" }}
                >
                  Try another one
                </button>
                <button
                  type="button"
                  onClick={goHome}
                  className="w-full rounded-2xl border-2 bg-white py-3.5 text-[15px] font-semibold transition hover:bg-[#FAF8FF]"
                  style={{ borderColor: BRAND_PURPLE, color: BRAND_PURPLE }}
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
