"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  JOURNEY_DONE_MARKER,
  MAX_JOURNEY_DAY,
  OGU_VIBE_KEY,
  buildSwapSentence,
  getJourneyRow,
  normalizeVibe
} from "@/lib/journey-data";
import { trackEvent } from "@/lib/analytics";

const OGU_CURRENT_DAY_KEY = "ogu_current_day";

/** @typedef {'listen'|'understand'|'repeat'|'recall'|'swap'} FlowStep */
/** @typedef {'pick'|'flow'|'summary'} Phase */

const STT_MAX_MS = 10000;
const STT_SILENCE_MS = 1500;

const primaryBtn =
  "w-full rounded-[24px] py-[14px] text-[15px] font-bold text-white transition hover:brightness-105 active:scale-[0.99] disabled:opacity-50";
const primaryStyle = {
  background: "linear-gradient(135deg, #2a14b4, #4338ca)",
  boxShadow: "0 8px 24px rgba(42,20,180,0.22)"
};
const secondaryBtn =
  "w-full rounded-[24px] border border-[rgba(26,28,29,0.12)] bg-white py-[11px] text-[13px] font-semibold text-[#2a14b4] transition hover:bg-[var(--surface-low)]";
const nextStepBtn =
  "w-full rounded-[24px] border-[1.5px] border-[rgba(42,20,180,0.2)] bg-white py-[13px] text-[13px] font-bold text-[#2a14b4] transition hover:bg-[rgba(42,20,180,0.04)]";

function readStoredCurrentDay() {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(OGU_CURRENT_DAY_KEY);
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, JOURNEY_DONE_MARKER);
}

/** @param {number} dayNum @param {import("@/app/lib/i18n").UILang} lang @param {'idol'|'drama'|'trip'} vibe */
function journeyDayToContent(dayNum, lang, vibe) {
  const row = getJourneyRow(dayNum, vibe);
  if (!row) return null;
  const L = normalizeLang(lang);
  const romanization = row.romanization ?? "";
  const vocab = row.vocab ?? [];
  const situation = row.situation ?? "";
  const swapOptions = row.swapOptions ?? ["영어", "스페인어", "일본어", "요리", "피아노"];
  const swapIndex = Number.isFinite(row.swapIndex) ? row.swapIndex : 0;
  return {
    id: vibe,
    cardLabel: tx(L, "j_card", { n: dayNum }),
    headerLabel: tx(L, "j_dayHeader", { n: dayNum, title: row.homeTitle }),
    ko: row.ko,
    en: row.en,
    romanization,
    vocab,
    situation,
    swapOptions,
    swapIndex
  };
}

const CATEGORY_LINE = /** @type {const} */ ({
  idol: {
    ko: "제 최애는 BTS예요.",
    romanization: "Je choe-ae-neun BTS-ye-yo.",
    vocab: [
      { word: "제", roman: "je", meaning: "my / as for me" },
      { word: "최애는", roman: "choe-ae-neun", meaning: "favorite (topic)" },
      { word: "BTS예요", roman: "BTS-ye-yo", meaning: "is BTS" }
    ],
    situation: "누가 '누구 좋아해?'라고 물었을 때 대답하는 표현이에요.",
    swapOptions: ["세븐틴", "블랙핑크", "아이유", "엑소", "NCT"],
    swapIndex: 2
  },
  drama: {
    ko: "보고 싶었어요.",
    romanization: "Bo-go sip-eo-sseo-yo.",
    vocab: [
      { word: "보고", roman: "bo-go", meaning: "seeing / to see" },
      { word: "싶었어요", roman: "sip-eo-sseo-yo", meaning: "missed / wanted to" }
    ],
    situation: "애틋한 대사를 연상할 때 쓰는 표현이에요.",
    swapOptions: ["만나고", "듣고", "기다리고", "응원하고", "보고"],
    swapIndex: 0
  },
  trip: {
    ko: "여기 어떻게 가요?",
    romanization: "Yeogi eo-tteoh-ke ga-yo?",
    vocab: [
      { word: "여기", roman: "yeo-gi", meaning: "here" },
      { word: "어떻게", roman: "eo-tteoh-ke", meaning: "how" },
      { word: "가요", roman: "ga-yo", meaning: "go?" }
    ],
    situation: "길을 물을 때 쓰는 표현이에요.",
    swapOptions: ["지하철역", "공항", "호텔", "카페", "화장실"],
    swapIndex: 1
  }
});

/** @param {"idol"|"drama"|"trip"} cat */
function categoryToContent(cat, lang) {
  const L = normalizeLang(lang);
  const line = CATEGORY_LINE[cat];
  return {
    id: cat,
    cardLabel: tx(L, `cat_${cat}_card`),
    headerLabel: tx(L, `cat_${cat}_header`),
    ko: line.ko,
    en: tx(L, `cat_${cat}_sub`),
    romanization: line.romanization,
    vocab: line.vocab,
    situation: line.situation,
    swapOptions: line.swapOptions,
    swapIndex: line.swapIndex
  };
}

function normalizeKorean(s) {
  return String(s || "")
    .replace(/\s+/g, "")
    .replace(/[.?!。…]/g, "")
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** @returns {"perfect"|"good"|"keep"} */
function computeRecallTier(userRaw, referenceRaw) {
  const u = normalizeKorean(userRaw);
  const r = normalizeKorean(referenceRaw);
  if (!r.length) return "keep";
  const d = levenshtein(u, r);
  const ratio = 1 - d / Math.max(u.length, r.length, 1);
  if (ratio >= 0.9) return "perfect";
  if (ratio >= 0.6) return "good";
  return "keep";
}

/** @param {{ fill: string }} props */
function TierCheckIcon({ fill }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="shrink-0">
      <circle cx="9" cy="9" r="9" fill={fill} />
      <path
        d="M5 9l2.5 2.5L13 6"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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

/** @param {{ active: number }} props */
function ProgressDots({ active }) {
  const steps = [0, 1, 2, 3, 4];
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {steps.map((i) => (
        <span
          key={i}
          className="h-2 rounded-full transition-all duration-300"
          style={{
            width: active === i ? 18 : 8,
            backgroundColor: active === i ? "#2a14b4" : "rgba(42,20,180,0.15)"
          }}
          aria-hidden
        />
      ))}
    </div>
  );
}

export default function FirstLineFlow() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const uiLang = normalizeLang(searchParams.get("lang") || "en");
  const uiLangRef = useRef(uiLang);
  uiLangRef.current = uiLang;
  const L = uiLang;

  const [phase, setPhase] = useState(/** @type {Phase} */ ("pick"));
  /** @type {[FlowStep, import('react').Dispatch<import('react').SetStateAction<FlowStep>>]} */
  const [flowStep, setFlowStep] = useState(/** @type {FlowStep} */ ("listen"));
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
  const hydratedFromUrl = useRef(false);
  const signupModalShownGaArmedRef = useRef(false);
  const sttPurposeRef = useRef(/** @type {'repeat'|'recall'|'swap'|null} */ (null));
  const sttSilenceTimerRef = useRef(null);
  const sttMaxTimerRef = useRef(null);
  const wordAudioRef = useRef(null);
  const completeDayMissionRef = useRef(/** @type {() => void} */ () => {});

  const [listenCount, setListenCount] = useState(0);
  const [listenedWords, setListenedWords] = useState(() => new Set());
  const [playingWordIdx, setPlayingWordIdx] = useState(null);
  const [repeatDone, setRepeatDone] = useState(false);
  const [recallDone, setRecallDone] = useState(false);
  const [recallText, setRecallText] = useState("");
  const [swapSel, setSwapSel] = useState(0);
  const [swapDone, setSwapDone] = useState(false);
  const [swapSpeakPending, setSwapSpeakPending] = useState(false);

  const clearSttTimers = useCallback(() => {
    if (sttSilenceTimerRef.current != null) {
      clearTimeout(sttSilenceTimerRef.current);
      sttSilenceTimerRef.current = null;
    }
    if (sttMaxTimerRef.current != null) {
      clearTimeout(sttMaxTimerRef.current);
      sttMaxTimerRef.current = null;
    }
  }, []);

  const journeyActive = journeyDay >= 1 && journeyDay <= MAX_JOURNEY_DAY;
  const journeyVibe = category ? normalizeVibe(category) : "idol";
  const journeyContent = journeyActive ? journeyDayToContent(journeyDay, uiLang, journeyVibe) : null;
  const categoryContent = category ? categoryToContent(category, uiLang) : null;
  const content = journeyActive && journeyContent ? journeyContent : categoryContent;

  const dayN = journeyActive ? journeyDay : 1;
  const flowIndex =
    flowStep === "listen"
      ? 0
      : flowStep === "understand"
        ? 1
        : flowStep === "repeat"
          ? 2
          : flowStep === "recall"
            ? 3
            : 4;

  const vocab = content?.vocab ?? [];
  const situationText = content?.situation ?? "";
  const swapOptions = content?.swapOptions ?? ["영어", "스페인어", "일본어"];
  const swapIndex = content?.swapIndex ?? 0;
  const swapSentence =
    content && swapOptions.length
      ? buildSwapSentence(content.ko, swapIndex, swapOptions, swapSel)
      : content?.ko ?? "";

  const resetFlowState = useCallback(() => {
    setFlowStep("listen");
    setListenCount(0);
    setListenedWords(new Set());
    setPlayingWordIdx(null);
    setRepeatDone(false);
    setRecallDone(false);
    setRecallText("");
    setUserInput("");
    setSwapSel(0);
    setSwapDone(false);
    setSwapSpeakPending(false);
  }, []);

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
    if (d <= MAX_JOURNEY_DAY) {
      const storedVibe = window.localStorage.getItem(OGU_VIBE_KEY);
      setCategory(normalizeVibe(storedVibe));
      setPhase("flow");
      resetFlowState();
      return;
    }
    if (cat === "idol" || cat === "drama" || cat === "trip") {
      setCategory(cat);
      setPhase("flow");
      resetFlowState();
    }
  }, [searchParams, router, pathname, resetFlowState]);

  useEffect(() => {
    resetFlowState();
  }, [journeyDay, category, journeyActive, resetFlowState]);

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
    if (wordAudioRef.current) {
      try {
        wordAudioRef.current.pause();
        wordAudioRef.current.src = "";
      } catch {
        // ignore
      }
      wordAudioRef.current = null;
    }
    setPlayingWordIdx(null);
  }, []);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const playTts = useCallback(
    async (text, opts) => {
      const slow = opts?.slow === true;
      const rate = slow ? 0.55 : 0.9;
      if (!text) return;
      stopAudio();
      setTtsLoading(true);
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, lang: "ko-KR", speakingRate: rate })
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
    },
    [stopAudio]
  );

  const playWordTts = useCallback(
    async (word, idx) => {
      if (!word) return;
      stopAudio();
      setPlayingWordIdx(idx);
      setTtsLoading(true);
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: word, lang: "ko-KR", speakingRate: 0.9 })
        });
        const data = await response.json();
        if (!data?.audioContent) return;
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        wordAudioRef.current = audio;
        audio.onended = () => {
          setPlayingWordIdx(null);
          wordAudioRef.current = null;
        };
        await audio.play();
      } catch {
        setPlayingWordIdx(null);
      } finally {
        setTtsLoading(false);
      }
    },
    [stopAudio]
  );

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
    setPhase("flow");
    resetFlowState();
    const qs = buildQs();
    qs.set("category", key);
    router.replace(`/first-line?${qs.toString()}`);
  };

  const goChooseTopic = () => {
    stopAudio();
    setCategory(null);
    setPhase("pick");
    resetFlowState();
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

  const gaCategory =
    journeyVibe === "drama" ? "kdrama" : journeyVibe === "trip" ? "trip" : "idol";

  const completeDayMission = useCallback(() => {
    if (!journeyActive || !content) return;
    const completed = journeyDay;
    setCompletedJourneyDay(completed);
    const next = Math.min(journeyDay + 1, JOURNEY_DONE_MARKER);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(OGU_CURRENT_DAY_KEY, String(next));
    }
    setJourneyDay(next);
    trackEvent("first_line_complete", { category: gaCategory, day: completed });
    trackEvent("day_complete", { day_number: completed });
    trackEvent("mission_complete", { day_number: completed });
    setPhase("summary");
    resetFlowState();
  }, [journeyActive, content, journeyDay, gaCategory, resetFlowState]);

  useEffect(() => {
    completeDayMissionRef.current = completeDayMission;
  }, [completeDayMission]);

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

      const lastIdx = event.results.length - 1;
      if (lastIdx < 0) return;
      const lastResult = event.results[lastIdx];
      if (lastResult.isFinal) {
        clearSttTimers();
        try {
          recognition.stop();
        } catch (_) {}
        return;
      }

      if (sttSilenceTimerRef.current != null) {
        clearTimeout(sttSilenceTimerRef.current);
        sttSilenceTimerRef.current = null;
      }
      sttSilenceTimerRef.current = setTimeout(() => {
        sttSilenceTimerRef.current = null;
        try {
          recognition.stop();
        } catch (_) {}
      }, STT_SILENCE_MS);
    };

    recognition.onstart = () => {
      clearSttTimers();
      setIsRequestingMic(false);
      setIsListening(true);
      setMicHint(null);
      sttTranscriptRef.current = "";
      sttMaxTimerRef.current = setTimeout(() => {
        sttMaxTimerRef.current = null;
        try {
          recognition.stop();
        } catch (_) {}
      }, STT_MAX_MS);
    };

    recognition.onerror = (event) => {
      clearSttTimers();
      setIsRequestingMic(false);
      setIsListening(false);
      if (event.error === "not-allowed" || event.error === "denied" || event.error === "service-not-allowed") {
        setMicHint(tx(uiLangRef.current, "fl_micAllow"));
      } else if (event.error !== "aborted") {
        setMicHint(tx(uiLangRef.current, "fl_micFail"));
      }
    };

    recognition.onend = () => {
      clearSttTimers();
      setIsListening(false);
      setIsRequestingMic(false);
      if (userStoppedMicRef.current) {
        userStoppedMicRef.current = false;
        return;
      }
      const t = sttTranscriptRef.current.trim();
      setUserInput(t);
      const purpose = sttPurposeRef.current;
      if (purpose === "repeat" && t) {
        setRepeatDone(true);
      } else if (purpose === "recall") {
        setRecallText(t);
        setRecallDone(true);
      } else if (purpose === "swap" && t) {
        setSwapDone(true);
        completeDayMissionRef.current();
      }
      sttPurposeRef.current = null;
    };

    recognitionRef.current = recognition;
    return () => {
      clearSttTimers();
      try {
        recognition.abort();
      } catch (_) {}
      recognitionRef.current = null;
    };
  }, [clearSttTimers]);

  useEffect(() => {
    if (flowStep !== "repeat" && flowStep !== "recall" && flowStep !== "swap") {
      clearSttTimers();
      try {
        recognitionRef.current?.stop();
      } catch (_) {}
      setIsListening(false);
      setIsRequestingMic(false);
    }
  }, [flowStep, clearSttTimers]);

  const toggleVoiceInput = useCallback(
    async (purpose) => {
      const recognition = recognitionRef.current;
      if (!recognition) return;

      if (isListening) {
        userStoppedMicRef.current = true;
        clearSttTimers();
        try {
          recognition.stop();
        } catch (_) {}
        setIsListening(false);
        setIsRequestingMic(false);
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
      setUserInput("");
      sttTranscriptRef.current = "";
      sttPurposeRef.current = purpose;
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
        clearSttTimers();
        setIsRequestingMic(false);
        setMicHint(tx(uiLangRef.current, "fl_micAllow"));
      }
    },
    [isListening, clearSttTimers]
  );

  const onListenMain = () => {
    if (!content?.ko) return;
    void playTts(content.ko);
    setListenCount((c) => Math.min(c + 1, 3));
  };

  const onListenSlow = () => {
    if (!content?.ko) return;
    void playTts(content.ko, { slow: true });
    setListenCount((c) => Math.min(c + 1, 3));
  };

  const onWordRow = (word, idx) => {
    setListenedWords((prev) => new Set([...prev, idx]));
    void playWordTts(word, idx);
  };

  const goNextFromListen = () => {
    if (vocab.length > 0) setFlowStep("understand");
    else setFlowStep("repeat");
  };

  const recallTier = recallDone && content ? computeRecallTier(recallText, content.ko) : "keep";

  const onSwapPrimary = async () => {
    if (!swapSentence) return;
    setSwapSpeakPending(true);
    await playTts(swapSentence);
    setSwapSpeakPending(false);
    void toggleVoiceInput("swap");
  };

  const showDay3SignupModal = phase === "summary" && completedJourneyDay === 3 && !signupModalDismissed;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!showDay3SignupModal) {
      signupModalShownGaArmedRef.current = false;
      return;
    }
    if (!signupModalShownGaArmedRef.current) {
      trackEvent("signup_modal_shown", { day_number: 3 });
      signupModalShownGaArmedRef.current = true;
    }
  }, [showDay3SignupModal]);

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
        redirectTo: "https://talk.kkobi.app/auth/callback"
      }
    });
    setSignupBusy(false);
    if (error) setSignupError(error.message);
  }, []);

  const successContent =
    completedJourneyDay != null ? journeyDayToContent(completedJourneyDay, uiLang, journeyVibe) : content;
  const vocabForResult = successContent?.vocab ?? [];
  const nextJourneyRow =
    completedJourneyDay != null && completedJourneyDay < MAX_JOURNEY_DAY
      ? getJourneyRow(completedJourneyDay + 1, journeyVibe)
      : null;
  const nextJourneyPreview = nextJourneyRow ? { ko: nextJourneyRow.ko, en: nextJourneyRow.en } : null;
  const nextDayNumber = completedJourneyDay != null ? completedJourneyDay + 1 : null;

  const tryAnother = () => {
    stopAudio();
    setCompletedJourneyDay(null);
    if (journeyDay <= MAX_JOURNEY_DAY) {
      setPhase("flow");
      resetFlowState();
      return;
    }
    setCategory(null);
    setPhase("pick");
    const qs = buildQs();
    const tail = qs.toString();
    router.replace(tail ? `/first-line?${tail}` : "/first-line");
  };

  const startNextJourneyDay = () => {
    stopAudio();
    setCompletedJourneyDay(null);
    setPhase("flow");
    resetFlowState();
  };

  const heroCard = (
    <div
      className="rounded-[32px] px-4 py-5 font-jakarta"
      style={{
        background: "linear-gradient(135deg, #2a14b4, #4338ca)",
        boxShadow: "0 8px 24px rgba(42,20,180,0.25)"
      }}
    >
      {content ? (
        <>
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.1em] text-white/80">
            {tx(L, "fl5_hero_today")}
          </p>
          <p className="font-korean mt-3 text-center text-[20px] font-extrabold leading-snug text-white [word-break:keep-all]">
            {content.ko}
          </p>
          <div className="my-4 h-px w-full bg-white/20" aria-hidden />
          {content.romanization ? (
            <p className="text-center text-[12px] italic leading-relaxed text-[rgba(255,255,255,0.65)] [word-break:break-word]">
              {content.romanization}
            </p>
          ) : null}
          <p className="mt-3 text-center text-[12px] leading-relaxed text-[rgba(255,255,255,0.45)]">{content.en}</p>
        </>
      ) : null}
    </div>
  );

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
              style={{ backgroundColor: "#EDE9FE" }}
              aria-hidden
            >
              🪄
            </div>
            <h2
              id="day3-signup-title"
              className="mt-4 text-center text-[22px] font-bold leading-snug text-[#0f172a]"
            >
              Keep your <span style={{ color: "#6c2eff" }}>streak</span> going
            </h2>
            <p className="mt-2 text-center text-[14px] leading-relaxed text-[#6b7280]">
              Save your 3-day progress and unlock Day 4 and beyond.
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => void continueWithGoogle()}
                disabled={signupBusy}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#dadce0] bg-white py-3.5 text-[14px] font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa] disabled:opacity-50"
              >
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

      <main className="min-h-screen px-4 py-8 font-jakarta" style={{ backgroundColor: "var(--surface)", color: "var(--on-surface)" }}>
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
                    ? { backgroundColor: "#2a14b4", color: "#fff" }
                    : { backgroundColor: "transparent", color: "var(--on-surface-variant)" }
                }
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>

          {phase === "pick" && (
            <div className="animate-fade-in-up">
              <h1 className="text-center text-xl font-bold leading-snug sm:text-2xl">{tx(L, "fl_vibeHeading")}</h1>
              <p className="mt-2 text-center text-sm text-[var(--on-surface-variant)] sm:text-[15px]">
                {tx(L, "fl_vibeSub")}
              </p>
              <div className="mt-8 flex flex-col gap-4">
                {["idol", "drama", "trip"].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectCategory(key)}
                    className="w-full rounded-[24px] bg-[var(--surface-lowest)] px-6 py-5 text-left text-lg font-bold transition hover:opacity-95 active:scale-[0.99]"
                    style={{ boxShadow: "var(--shadow-card)" }}
                  >
                    {categoryToContent(key, uiLang).cardLabel}
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === "flow" && content && (
            <div className="animate-fade-in-up">
              <ProgressDots active={flowIndex} />

              {flowStep === "listen" && (
                <>
                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#2a14b4]">
                    {tx(L, "fl5_over_listen", { n: dayN })}
                  </p>
                  <div className="mt-4">{heroCard}</div>
                  <button
                    type="button"
                    onClick={onListenMain}
                    disabled={ttsLoading}
                    className={`${primaryBtn} mt-6 flex items-center justify-between gap-3 px-4`}
                    style={primaryStyle}
                  >
                    <span>{tx(L, "fl5_btn_listen")}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                      style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                    >
                      {tx(L, "fl5_listen_count", { n: Math.min(listenCount, 3) })}
                    </span>
                  </button>
                  <button type="button" onClick={onListenSlow} disabled={ttsLoading} className={`${secondaryBtn} mt-3`}>
                    {tx(L, "fl5_btn_slow")}
                  </button>
                  {listenCount >= 3 ? (
                    <button type="button" onClick={goNextFromListen} className={`${nextStepBtn} mt-6`}>
                      {tx(L, "fl5_next_vocab")}
                    </button>
                  ) : null}
                </>
              )}

              {flowStep === "understand" && (
                <>
                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#2a14b4]">
                    {tx(L, "fl5_over_understand", { n: dayN })}
                  </p>
                  {situationText ? (
                    <div className="mt-4 rounded-[28px] px-4 py-4" style={{ backgroundColor: "var(--surface-low)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#2a14b4]">
                        {tx(L, "fl5_situation_when")}
                      </p>
                      <p className="mt-2 text-[14px] leading-relaxed text-[var(--on-surface)]">{situationText}</p>
                    </div>
                  ) : null}
                  <div
                    className="mt-4 rounded-[28px] bg-[var(--surface-lowest)] p-4"
                    style={{ boxShadow: "0 20px 50px rgba(26,28,29,0.05)" }}
                  >
                    <p className="text-center text-[11px] text-[var(--on-surface-variant)]">{tx(L, "fl5_words_hint")}</p>
                    <ul className="mt-4 flex flex-col gap-2">
                      {vocab.map((row, i) => {
                        const done = listenedWords.has(i);
                        const playing = playingWordIdx === i;
                        return (
                          <li
                            key={`${row.word}-${i}`}
                            className="flex items-center justify-between gap-3 rounded-[20px] px-3 py-3 transition"
                            style={{
                              opacity: done ? 0.65 : 1,
                              backgroundColor: playing ? "rgba(42,20,180,0.06)" : "transparent"
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => onWordRow(row.word, i)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <span className="font-korean text-[15px] font-bold text-[var(--on-surface)]">{row.word}</span>
                              <span className="ml-2 text-[12px] italic text-[#2a14b4]">{row.roman}</span>
                              <span className="mt-1 block text-[12px] text-[var(--on-surface-variant)]">{row.meaning}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onWordRow(row.word, i)}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition"
                              style={{
                                backgroundColor: done ? "#22c55e" : "#2a14b4",
                                boxShadow: playing ? "0 0 0 3px rgba(42,20,180,0.15)" : undefined
                              }}
                              aria-label="play"
                            >
                              {done ? "✓" : playing ? "‖" : "▶"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  {vocab.length > 0 && listenedWords.size >= vocab.length ? (
                    <button type="button" onClick={() => setFlowStep("repeat")} className={`${nextStepBtn} mt-6`}>
                      {tx(L, "fl5_next_repeat")}
                    </button>
                  ) : null}
                </>
              )}

              {flowStep === "repeat" && (
                <>
                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#2a14b4]">
                    {tx(L, "fl5_over_repeat", { n: dayN })}
                  </p>
                  <div className="mt-4">{heroCard}</div>
                  <p className="mt-2 text-center text-[12px] text-[var(--on-surface-variant)]">{tx(L, "fl5_repeat_hint")}</p>
                  <button
                    type="button"
                    onClick={() => void playTts(content.ko)}
                    disabled={ttsLoading}
                    className={`${secondaryBtn} mt-4`}
                  >
                    {tx(L, "fl5_btn_listen_again")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleVoiceInput("repeat")}
                    disabled={!getSpeechRecognition() || isRequestingMic}
                    className={`${primaryBtn} mt-4 flex items-center justify-center gap-2`}
                    style={primaryStyle}
                  >
                    <span aria-hidden>🎙</span>
                    {isListening ? tx(L, "fl5_btn_speaking") : tx(L, "fl5_btn_speak_now")}
                  </button>
                  {micHint ? <p className="mt-2 text-center text-xs text-red-600">{micHint}</p> : null}
                  {repeatDone ? (
                    <button type="button" onClick={() => setFlowStep("recall")} className={`${nextStepBtn} mt-6`}>
                      {tx(L, "fl5_next_recall")}
                    </button>
                  ) : null}
                </>
              )}

              {flowStep === "recall" && (
                <>
                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#2a14b4]">
                    {tx(L, "fl5_over_recall", { n: dayN })}
                  </p>
                  <div
                    className="mt-4 rounded-[28px] px-4 py-5"
                    style={{
                      backgroundColor: "var(--surface-low)",
                      border: "2px dashed rgba(26,28,29,0.12)"
                    }}
                  >
                    <p className="text-center text-[14px] leading-relaxed text-[var(--on-surface)]">
                      {tx(L, "fl5_recall_hint")}
                    </p>
                    {content.romanization ? (
                      <p className="mt-4 text-center text-[12px] italic text-[#2a14b4]">{content.romanization}</p>
                    ) : null}
                  </div>
                  {!recallDone ? (
                    <button
                      type="button"
                      onClick={() => void toggleVoiceInput("recall")}
                      disabled={!getSpeechRecognition() || isRequestingMic}
                      className={`${primaryBtn} mt-6 flex items-center justify-center gap-2`}
                      style={primaryStyle}
                    >
                      <span aria-hidden>🎙</span>
                      {isListening ? tx(L, "fl5_btn_speaking") : tx(L, "fl5_btn_speak_practice")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setRecallDone(false);
                        setRecallText("");
                        void toggleVoiceInput("recall");
                      }}
                      className={`${secondaryBtn} mt-6`}
                    >
                      {tx(L, "fl5_btn_retry_speak")}
                    </button>
                  )}
                  {micHint ? <p className="mt-2 text-center text-xs text-red-600">{micHint}</p> : null}
                  {recallDone ? (
                    <>
                      {(() => {
                        const tier =
                          recallTier === "perfect"
                            ? {
                                border: "#22c55e",
                                badgeBg: "#dcfce7",
                                badgeFg: "#166534",
                                badgeKey: "fl_badge_perfect",
                                evalKey: "fl_evalPerfect",
                                check: "#22c55e"
                              }
                            : recallTier === "good"
                              ? {
                                  border: "#eab308",
                                  badgeBg: "#fef9c3",
                                  badgeFg: "#854d0e",
                                  badgeKey: "fl_badge_good",
                                  evalKey: "fl_evalGood",
                                  check: "#ca8a04"
                                }
                              : {
                                  border: "#ef4444",
                                  badgeBg: "#fee2e2",
                                  badgeFg: "#991b1b",
                                  badgeKey: "fl_badge_keep",
                                  evalKey: "fl_evalKeep",
                                  check: "#ef4444"
                                };
                        return (
                          <div
                            className="mt-6 rounded-[28px] bg-[var(--surface-lowest)] p-5"
                            style={{ boxShadow: "0 20px 50px rgba(26,28,29,0.05)" }}
                          >
                            <div
                              className="inline-flex rounded-full px-3 py-1.5 text-[12px] font-bold"
                              style={{ backgroundColor: tier.badgeBg, color: tier.badgeFg }}
                            >
                              {tx(L, tier.badgeKey)}
                            </div>
                            <p className="mt-4 text-[11px] text-[var(--on-surface-variant)]">{tx(L, "fl5_you_said")}</p>
                            <p className="font-korean mt-1 text-[16px] font-semibold">{recallText}</p>
                            <div className="mt-3 flex items-center gap-2">
                              <TierCheckIcon fill={tier.check} />
                              <p className="text-[13px] font-semibold" style={{ color: tier.check }}>
                                {tx(L, tier.evalKey)}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                      <button type="button" onClick={() => setFlowStep("swap")} className={`${nextStepBtn} mt-6`}>
                        {tx(L, "fl5_next_swap")}
                      </button>
                    </>
                  ) : null}
                </>
              )}

              {flowStep === "swap" && (
                <>
                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#2a14b4]">
                    {tx(L, "fl5_over_swap", { n: dayN })}
                  </p>
                  <div
                    className="mt-4 rounded-[28px] bg-[var(--surface-lowest)] p-4"
                    style={{ boxShadow: "0 20px 50px rgba(26,28,29,0.05)" }}
                  >
                    <p className="text-[11px] text-[var(--on-surface-variant)]">{tx(L, "fl5_swap_pick")}</p>
                    <div className="font-korean mt-3 text-[18px] font-bold leading-relaxed text-[var(--on-surface)]">
                      {content.ko.split(/\s+/).map((w, i) => (
                        <span key={i}>
                          {i === swapIndex ? (
                            <span className="text-[#2a14b4] underline">{swapOptions[swapSel]}</span>
                          ) : (
                            <span>{w}</span>
                          )}
                          {i < content.ko.split(/\s+/).length - 1 ? " " : ""}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {swapOptions.map((opt, i) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSwapSel(i)}
                          className="rounded-full px-3 py-1.5 text-[12px] font-semibold transition"
                          style={{
                            backgroundColor: swapSel === i ? "#2a14b4" : "var(--surface-low)",
                            color: swapSel === i ? "#fff" : "var(--on-surface)"
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 rounded-[32px] px-4 py-4" style={{ background: "linear-gradient(135deg, #2a14b4, #4338ca)", boxShadow: "0 8px 24px rgba(42,20,180,0.25)" }}>
                    <p className="text-center text-[10px] font-bold uppercase tracking-[0.1em] text-white/80">
                      {tx(L, "fl5_swap_mini")}
                    </p>
                    <p className="font-korean mt-2 text-center text-[16px] font-bold text-white [word-break:keep-all]">
                      {swapSentence}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onSwapPrimary()}
                    disabled={swapSpeakPending || isListening}
                    className={`${primaryBtn} mt-6`}
                    style={primaryStyle}
                  >
                    {tx(L, "fl5_btn_speak_swap")}
                  </button>
                </>
              )}

              {!journeyActive ? (
                <button
                  type="button"
                  onClick={goChooseTopic}
                  className="mt-8 w-full text-center text-xs font-medium text-[var(--on-surface-variant)] transition hover:opacity-80"
                >
                  {tx(L, "fl_chooseOtherTopic")}
                </button>
              ) : null}
            </div>
          )}

          {phase === "summary" && successContent && (
            <div className="animate-fade-in-up mx-auto w-full max-w-[480px] text-left">
              <div
                className="rounded-[32px] px-5 py-8 text-center text-white"
                style={{
                  background: "linear-gradient(135deg, #2a14b4, #4338ca)",
                  boxShadow: "0 8px 24px rgba(42,20,180,0.25)"
                }}
              >
                <p className="text-[22px] font-extrabold">{tx(L, "fl5_day_done_title", { n: completedJourneyDay })}</p>
                <p className="mt-2 text-[14px] text-white/85">{tx(L, "fl5_day_done_sub")}</p>
              </div>

              <p className="mt-8 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--on-surface-variant)]">
                {completedJourneyDay != null
                  ? tx(L, "fl_dayResultLabel", { n: completedJourneyDay })
                  : tx(L, "fl_resultBrowse")}
              </p>

              <div
                className="mt-4 rounded-[28px] bg-[var(--surface-lowest)] p-5"
                style={{ boxShadow: "0 20px 50px rgba(26,28,29,0.05)" }}
              >
                <p className="text-[11px] font-bold text-[var(--on-surface-variant)]">{tx(L, "fl_modelAnswer")}</p>
                <p className="font-korean mt-3 text-[17px] font-bold leading-snug">{successContent.ko}</p>
                {successContent.romanization ? (
                  <p className="mt-2 text-[12px] italic text-[#2a14b4]">{successContent.romanization}</p>
                ) : null}
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--on-surface-variant)]">{successContent.en}</p>
              </div>

              {vocabForResult.length > 0 ? (
                <div className="mt-6 rounded-[28px] bg-[var(--surface-lowest)] p-4" style={{ boxShadow: "0 20px 50px rgba(26,28,29,0.05)" }}>
                  <p className="text-[15px] font-bold text-[#2a14b4]">📚 {tx(L, "fl_vocabHeader")}</p>
                  <ul className="mt-4 flex flex-col gap-2">
                    {vocabForResult.map((row, i) => (
                      <li key={`${row.word}-${i}`} className="flex justify-between gap-3 rounded-[12px] bg-[var(--surface-low)] px-2 py-2">
                        <div>
                          <p className="font-korean text-[14px] font-semibold">{row.word}</p>
                          <p className="text-[10px] italic text-[#2a14b4]">{row.roman}</p>
                        </div>
                        <p className="max-w-[48%] text-right text-[12px] text-[var(--on-surface-variant)]">{row.meaning}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {nextJourneyPreview && nextDayNumber != null ? (
                <>
                  <p className="mt-8 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-[#2a14b4]">
                    {tx(L, "fl_upNext", { n: nextDayNumber })}
                  </p>
                  <div className="mt-4 rounded-[14px] bg-[var(--surface-lowest)] px-4 py-5 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#2a14b4]">
                      {tx(L, "fl_dayBadge", { n: nextDayNumber })}
                    </p>
                    <p className="font-korean mt-3 text-lg font-bold">{nextJourneyPreview.ko}</p>
                    <p className="mt-2 text-[13px] text-[var(--on-surface-variant)]">{nextJourneyPreview.en}</p>
                  </div>
                </>
              ) : null}

              <div className="mt-8 flex flex-col gap-3">
                {nextJourneyPreview && nextDayNumber != null ? (
                  <button
                    type="button"
                    onClick={startNextJourneyDay}
                    className={`${primaryBtn}`}
                    style={primaryStyle}
                  >
                    {tx(L, "fl_startDayNow", { n: nextDayNumber })} →
                  </button>
                ) : null}
                <button type="button" onClick={tryAnother} className={`${primaryBtn}`} style={primaryStyle}>
                  {tx(L, "fl_tryAnother")}
                </button>
                <button type="button" onClick={goHome} className={secondaryBtn}>
                  {tx(L, "fl_goHome")}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
