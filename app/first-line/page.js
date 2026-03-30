"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { pageview, trackSendVoice } from "@/app/lib/gtag";
import Analytics from "@/app/components/Analytics";
import {
  isValidLang,
  LANG_CODES,
  normalizeLang,
  OGU_LANG_KEY,
  resolveLangFromUrlAndStorage,
  tx
} from "@/app/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import { getOAuthRedirectUrl } from "@/lib/auth-config";

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

const J_TITLE_KEYS = /** @type {const} */ (["j1_title", "j2_title", "j3_title"]);
const J_EN_KEYS = /** @type {const} */ (["j1_en", "j2_en", "j3_en"]);

/** @param {number} dayNum */
function journeyDayToContent(dayNum, lang) {
  const row = JOURNEY_DAYS[dayNum - 1];
  if (!row) return null;
  const L = normalizeLang(lang);
  const i = dayNum - 1;
  return {
    id: "idol",
    cardLabel: tx(L, "j_card", { n: dayNum }),
    headerLabel: tx(L, "j_dayHeader", { n: dayNum, title: tx(L, J_TITLE_KEYS[i]) }),
    ko: row.ko,
    en: tx(L, J_EN_KEYS[i])
  };
}

const CATEGORY_KO = {
  idol: { ko: "제 최애는 BTS예요." },
  drama: { ko: "보고 싶었어요." },
  trip: { ko: "여기 어떻게 가요?" }
};

/** @param {"idol"|"drama"|"trip"} cat */
function categoryToContent(cat, lang) {
  const L = normalizeLang(lang);
  return {
    id: cat,
    cardLabel: tx(L, `cat_${cat}_card`),
    headerLabel: tx(L, `cat_${cat}_header`),
    ko: CATEGORY_KO[cat].ko,
    en: tx(L, `cat_${cat}_sub`)
  };
}

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const uiLang = normalizeLang(searchParams.get("lang") || "en");
  const uiLangRef = useRef(uiLang);
  uiLangRef.current = uiLang;

  const [step, setStep] = useState(1);
  const [category, setCategory] = useState(null);
  const [userInput, setUserInput] = useState("");
  const [ttsLoading, setTtsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [micHint, setMicHint] = useState(null);
  const [journeyDay, setJourneyDay] = useState(1);
  const [completedJourneyDay, setCompletedJourneyDay] = useState(null);
  const [signupModalDismissed, setSignupModalDismissed] = useState(false);
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupError, setSignupError] = useState(null);
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const sttTranscriptRef = useRef("");
  const userStoppedMicRef = useRef(false);
  const completeStep3Ref = useRef(() => {});
  const hydratedFromUrl = useRef(false);

  const journeyActive = journeyDay >= 1 && journeyDay <= 3;
  const journeyContent = journeyActive ? journeyDayToContent(journeyDay, uiLang) : null;
  const categoryContent = category ? categoryToContent(category, uiLang) : null;
  const content = journeyActive && journeyContent ? journeyContent : categoryContent;

  useEffect(() => {
    if (typeof window === "undefined") return;
    pageview(window.location.pathname + window.location.search);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlLang = searchParams.get("lang");
    const stored = window.localStorage.getItem(OGU_LANG_KEY);
    const lang = resolveLangFromUrlAndStorage(urlLang, stored);
    window.localStorage.setItem(OGU_LANG_KEY, lang);
    if (!isValidLang(urlLang)) {
      const p = new URLSearchParams(searchParams.toString());
      p.set("lang", lang);
      router.replace(`${pathname}?${p.toString()}`);
      return;
    }
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
  }, [searchParams, router, pathname]);

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
    const qs = new URLSearchParams();
    qs.set("lang", normalizeLang(searchParams.get("lang") || "en"));
    return qs;
  }, [searchParams]);

  const setLang = (code) => {
    const lang = normalizeLang(code);
    if (typeof window !== "undefined") window.localStorage.setItem(OGU_LANG_KEY, lang);
    const p = new URLSearchParams(searchParams.toString());
    p.set("lang", lang);
    router.replace(`${pathname}?${p.toString()}`);
  };

  const langPillBase =
    "rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors duration-200 sm:px-3 sm:text-[12px]";

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
        setMicHint(tx(uiLangRef.current, "fl_micAllow"));
      } else if (event.error !== "aborted") {
        setMicHint(tx(uiLangRef.current, "fl_micFail"));
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
          setMicHint(tx(uiLangRef.current, "fl_micAllow"));
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
        setMicHint(tx(uiLangRef.current, "fl_micAllow"));
        return;
      }
      userStoppedMicRef.current = false;
      sttTranscriptRef.current = "";
      recognition.start();
      trackSendVoice();
    } catch (e) {
      console.warn("SpeechRecognition start failed", e);
      setIsRequestingMic(false);
      setMicHint(tx(uiLangRef.current, "fl_micAllow"));
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

  const showDay3SignupModal = step === 4 && completedJourneyDay === 3 && !signupModalDismissed;

  const continueWithGoogle = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setSignupError("Unable to connect. Try again later.");
      return;
    }
    setSignupBusy(true);
    setSignupError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getOAuthRedirectUrl(),
      },
    });
    setSignupBusy(false);
    if (error) setSignupError(error.message);
  }, []);

  const stepClass =
    "w-full transition-all duration-300 ease-out motion-reduce:transition-none animate-fade-in-up";

  const successContent =
    completedJourneyDay != null ? journeyDayToContent(completedJourneyDay, uiLang) : content;
  const nextJourneyPreview =
    completedJourneyDay != null && completedJourneyDay < 3
      ? {
          ko: JOURNEY_DAYS[completedJourneyDay].ko,
          en: tx(uiLang, J_EN_KEYS[completedJourneyDay])
        }
      : null;
  const nextDayNumber = completedJourneyDay != null ? completedJourneyDay + 1 : null;

  return (
    <>
      <Analytics />
      {showDay3SignupModal ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-jakarta"
          style={{ backgroundColor: "rgba(15, 23, 42, 0.5)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="day3-signup-title"
        >
          <div className="w-full max-w-[360px] rounded-[24px] bg-white p-7 shadow-lg">
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] text-2xl leading-none"
              style={{ backgroundColor: LAVENDER_BG }}
              aria-hidden
            >
              🪄
            </div>
            <h2
              id="day3-signup-title"
              className="mt-4 text-center text-[22px] font-bold leading-snug text-[#0f172a]"
            >
              Keep your <span style={{ color: BRAND_PURPLE }}>streak</span> going
            </h2>
            <p className="mt-2 text-center text-[14px] leading-relaxed text-[#6b7280]">
              Save your 3-day progress and unlock Day 4 and beyond.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2">
              {[1, 2, 3].map((d) => (
                <div
                  key={d}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: BRAND_PURPLE }}
                >
                  {d}
                </div>
              ))}
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#e5e7eb] bg-[#f3f4f6] text-sm font-bold text-[#9ca3af]"
                title="Locked"
                aria-label="Day 4 locked"
              >
                4
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => void continueWithGoogle()}
                disabled={signupBusy}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#dadce0] bg-white py-3.5 text-[14px] font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa] disabled:opacity-50"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </button>
              {signupError ? (
                <p className="mt-3 text-center text-xs text-red-600">{signupError}</p>
              ) : null}
            </div>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setSignupModalDismissed(true)}
                className="text-[14px] text-[#6b7280] transition hover:opacity-80"
              >
                or skip for now
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <main
        className="min-h-screen px-4 py-8 font-jakarta"
        style={{ backgroundColor: LAVENDER_BG, color: TEXT_PRIMARY }}
      >
        <div className="mx-auto w-full max-w-[480px]">
          <div className="mb-6 flex flex-wrap justify-end gap-1">
            {LANG_CODES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={langPillBase}
                style={
                  uiLang === code
                    ? { backgroundColor: BRAND_PURPLE, color: "#fff" }
                    : { backgroundColor: "transparent", color: "#64748B" }
                }
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>

          {step === 1 && (
            <div key="s1" className={stepClass}>
              <h1
                className="text-center text-xl font-bold leading-snug sm:text-2xl"
                style={{ color: TEXT_PRIMARY }}
              >
                {tx(uiLang, "fl_vibeHeading")}
              </h1>
              <p className="mt-2 text-center text-sm text-[#64748B] sm:text-[15px]">
                {tx(uiLang, "fl_vibeSub")}
              </p>
              <div className="mt-8 flex flex-col gap-4">
                {["idol", "drama", "trip"].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectCategory(key)}
                    className="w-full rounded-2xl border-2 border-[#DDD6FE] bg-white px-6 py-5 text-left text-lg font-bold text-[#0f172a] transition hover:border-[#6c2eff] active:scale-[0.99]"
                  >
                    {categoryToContent(key, uiLang).cardLabel}
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
                  {ttsLoading ? tx(uiLang, "fl_loading") : tx(uiLang, "fl_listen")}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="mt-4 w-full rounded-2xl py-4 text-[17px] font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
                  style={{ backgroundColor: BRAND_PURPLE, boxShadow: "0 12px 28px rgba(108, 46, 255, 0.35)" }}
                >
                  {tx(uiLang, "fl_sayItNow")}
                </button>
              </div>
              {!journeyActive ? (
                <button
                  type="button"
                  onClick={goChooseTopic}
                  className="mt-6 w-full text-center text-xs font-medium text-[#94A3B8] transition hover:text-[#64748B]"
                >
                  {tx(uiLang, "fl_chooseOtherTopic")}
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
                {tx(uiLang, "fl_nowSayKorean")}
              </h2>
              <p className="font-korean mt-6 text-center text-lg text-[#94A3B8]/50 sm:text-xl">
                {content.ko}
              </p>
              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div className="flex gap-3">
                  <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder={tx(uiLang, "fl_placeholder")}
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
                    aria-label={
                      isListening ? tx(uiLang, "fl_stopListening") : tx(uiLang, "fl_startVoice")
                    }
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
                  {tx(uiLang, "fl_submit")}
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
                {tx(uiLang, "fl_listenAgain")}
              </button>
            </div>
          )}

          {step === 4 && successContent && (
            <div key="s4" className={`${stepClass} mx-auto w-full max-w-[400px] text-center`}>
              <div
                className="inline-flex items-center justify-center rounded-[20px] px-4 py-2 text-[11px] font-bold text-white"
                style={{ backgroundColor: BRAND_PURPLE }}
              >
                {tx(uiLang, "fl_successBadge")}
              </div>
              <h2
                className="mt-5 text-[26px] font-bold leading-tight tracking-[-0.5px] text-[#0f172a]"
              >
                {tx(uiLang, "fl_youJustSpoke")}
                <span style={{ color: BRAND_PURPLE }}>{tx(uiLang, "fl_koreanExclaim")}</span>
                {tx(uiLang, "fl_youJustSpokeAfter")}
              </h2>
              <p className="mt-3 text-[14px] text-[#6b7280]">
                {completedJourneyDay != null ? (
                  <>{tx(uiLang, "fl_streak", { day: completedJourneyDay })}</>
                ) : (
                  <>{tx(uiLang, "fl_firstSentence")}</>
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
                    {tx(uiLang, "fl_youSaid")}
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
                    {tx(uiLang, "fl_modelLine")}
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
                    {tx(uiLang, "fl_perfectMatch")}
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
                    {tx(uiLang, "fl_upNext", { n: nextDayNumber })}
                  </p>
                  <div
                    className="mt-4 rounded-[14px] bg-white px-4 py-5 text-center"
                    style={{ border: "2px dashed rgba(108, 46, 255, 0.3)" }}
                  >
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: BRAND_PURPLE }}>
                      {tx(uiLang, "fl_dayBadge", { n: nextDayNumber })}
                    </p>
                    <p className="font-korean mt-3 text-lg font-bold text-[#0f172a]">{nextJourneyPreview.ko}</p>
                    <p className="mt-2 text-[13px] text-[#6b7280]">{nextJourneyPreview.en}</p>
                    <button
                      type="button"
                      onClick={startNextJourneyDay}
                      className="mt-5 w-full rounded-[14px] py-3.5 text-[14px] font-bold text-white transition hover:brightness-110 active:scale-[0.99]"
                      style={{ backgroundColor: BRAND_PURPLE }}
                    >
                      {tx(uiLang, "fl_startDayNow", { n: nextDayNumber })}
                    </button>
                  </div>
                </>
              ) : null}

              {completedJourneyDay === 3 ? (
                <>
                  <div className="my-8 h-px w-full max-w-[360px] mx-auto" style={{ backgroundColor: CARD_BORDER }} aria-hidden />
                  <p className="text-[15px] font-bold text-[#0f172a]">{tx(uiLang, "fl_challengeComplete")}</p>
                </>
              ) : null}

              <div className="mt-8 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={tryAnother}
                  className="w-full rounded-[14px] py-4 text-[15px] font-bold text-white transition hover:brightness-110 active:scale-[0.99]"
                  style={{ backgroundColor: BRAND_PURPLE }}
                >
                  {tx(uiLang, "fl_tryAnother")}
                </button>
                <button
                  type="button"
                  onClick={goHome}
                  className="w-full rounded-[14px] border-2 bg-white py-3.5 text-[15px] font-bold transition hover:bg-white/90 active:scale-[0.99]"
                  style={{ borderColor: BRAND_PURPLE, color: BRAND_PURPLE }}
                >
                  {tx(uiLang, "fl_goHome")}
                </button>
              </div>
              <p className="mt-8 text-[12px] text-[#6b7280]">
                {completedJourneyDay != null ? (
                  journeyDay <= 3 ? (
                    <>
                      {tx(uiLang, "fl_footerStreakBefore")}
                      <span style={{ color: BRAND_PURPLE }}>
                        {tx(uiLang, "fl_footerStreakHighlight", { day: journeyDay })}
                      </span>
                      {tx(uiLang, "fl_footerStreakAfter")}
                    </>
                  ) : (
                    <>{tx(uiLang, "fl_footerAllDone")}</>
                  )
                ) : (
                  <>{tx(uiLang, "fl_footerKeep")}</>
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
