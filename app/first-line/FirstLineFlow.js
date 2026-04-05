"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { pageview, trackSendVoice } from "@/app/lib/gtag";
import Analytics from "@/app/components/Analytics";
import {
  isValidLang,
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
  buildSentenceFromTemplate,
  getJourneyRow,
  normalizeVibe
} from "@/lib/journey-data";
import { trackEvent } from "@/lib/analytics";

const OGU_CURRENT_DAY_KEY = "ogu_current_day";
const OGU_STREAK_KEY = "ogu_streak_count";
const OGU_STREAK_LAST_KEY = "ogu_streak_last_date";

/** @typedef {'listen'|'understand'|'repeat'|'recall'|'result'} FlowStep */
/** @typedef {'pick'|'flow'|'summary'} Phase */

const STT_MAX_MS = 10000;
const STT_SILENCE_MS = 1500;

/** @param {string} ko */
function splitSentenceWords(ko) {
  return String(ko || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

const flowBtnBase =
  "flex w-full items-center justify-center text-center text-[15px] font-bold transition active:scale-[0.99] disabled:opacity-50";
const primaryBtn = `${flowBtnBase} rounded-[24px] py-[14px] text-white hover:brightness-105`;
const primaryStyle = {
  background: "linear-gradient(135deg, #2a14b4, #4338ca)",
  boxShadow: "0 8px 24px rgba(42,20,180,0.22)"
};
const secondaryBtn = `${flowBtnBase} rounded-[24px] border border-[rgba(26,28,29,0.12)] bg-white py-[14px] text-[#2a14b4] hover:bg-[var(--surface-low)]`;
const secondaryBtnHome = `${flowBtnBase} rounded-[24px] border border-[rgba(26,28,29,0.12)] bg-white py-[14px] text-[#6b6f72] hover:bg-[var(--surface-low)]`;
const nextStepBtn = `${flowBtnBase} rounded-[24px] border-[1.5px] border-[rgba(42,20,180,0.2)] bg-white py-[14px] text-[#2a14b4] hover:bg-[rgba(42,20,180,0.04)]`;
const step1PrimaryBtn = `${primaryBtn} gap-3`;

function readStoredCurrentDay() {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(OGU_CURRENT_DAY_KEY);
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, JOURNEY_DONE_MARKER);
}

function readStreakCount() {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(OGU_STREAK_KEY);
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function bumpStudyStreakOnMissionComplete() {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10);
  const last = window.localStorage.getItem(OGU_STREAK_LAST_KEY);
  const prev = parseInt(window.localStorage.getItem(OGU_STREAK_KEY) || "0", 10);
  if (last === today) return;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const ystr = y.toISOString().slice(0, 10);
  let next = 1;
  if (last === ystr) {
    next = (Number.isFinite(prev) && prev > 0 ? prev : 0) + 1;
  }
  window.localStorage.setItem(OGU_STREAK_KEY, String(next));
  window.localStorage.setItem(OGU_STREAK_LAST_KEY, today);
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
  const swapTemplate = row.swapTemplate ?? null;
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
    swapIndex,
    swapTemplate
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
    swapIndex: 2,
    swapTemplate: "제 최애는 ___예요."
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
    swapIndex: 0,
    swapTemplate: "___ 싶었어요."
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
    swapIndex: 1,
    swapTemplate: "여기 ___ 가요?"
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
    swapIndex: line.swapIndex,
    swapTemplate: line.swapTemplate ?? null
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

/** @param {{ active: number, allComplete?: boolean }} props */
function ProgressDots({ active, allComplete }) {
  const steps = [0, 1, 2, 3];
  if (allComplete) {
    return (
      <div className="mb-6 flex items-center justify-center gap-2">
        {steps.map((i) => (
          <span key={i} className="h-2 w-[18px] rounded-full bg-[#22c55e] transition-all duration-300" aria-hidden />
        ))}
      </div>
    );
  }
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

function WordPlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ display: "block" }} aria-hidden>
      <polygon points="2,1 9,5 2,9" fill="white" />
    </svg>
  );
}

function WordPauseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ display: "block" }} aria-hidden>
      <rect x="1.5" y="1" width="2.5" height="8" rx="1" fill="white" />
      <rect x="6" y="1" width="2.5" height="8" rx="1" fill="white" />
    </svg>
  );
}

function WordCheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ display: "block" }} aria-hidden>
      <path
        d="M2 5l2.5 2.5 3.5-4"
        stroke="white"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-[#2a14b4]">
      <path
        d="M4 19.5A2.5 2.5 0 016.5 17H20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 7h8M8 11h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function WarningMarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="shrink-0">
      <circle cx="9" cy="9" r="9" fill="#eab308" />
      <path d="M9 5v5M9 12h.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ResultXIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="shrink-0">
      <circle cx="9" cy="9" r="9" fill="#ef4444" />
      <path d="M6 6l6 6M12 6l-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
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
  const [signupModalDismissed, setSignupModalDismissed] = useState(false);
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupError, setSignupError] = useState(null);
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const sttTranscriptRef = useRef("");
  const userStoppedMicRef = useRef(false);
  const hydratedFromUrl = useRef(false);
  const signupModalShownGaArmedRef = useRef(false);
  const missionResultGaFiredRef = useRef(false);
  const sttPurposeRef = useRef(/** @type {'repeat'|'recall'|null} */ (null));
  const sttSilenceTimerRef = useRef(null);
  const sttMaxTimerRef = useRef(null);
  const wordAudioRef = useRef(null);

  const [listenCount, setListenCount] = useState(0);
  const [listenedWords, setListenedWords] = useState(() => new Set());
  const [playingWordIdx, setPlayingWordIdx] = useState(null);
  const [repeatDone, setRepeatDone] = useState(false);
  const [recallDone, setRecallDone] = useState(false);
  const [recallText, setRecallText] = useState("");
  /** 칩 TTS 재생 중 하이라이트 (phrase `swapOptions` 값과 동일 문자열) */
  const [activeSel, setActiveSel] = useState(/** @type {string | null} */ (null));
  const [streakDisplay, setStreakDisplay] = useState(1);

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
            : 0;

  const vocab = content?.vocab ?? [];
  const situationText = content?.situation ?? "";
  /** 일일 phrase(journey row / category line)의 응용 후보·템플릿 */
  const applyOptions = content?.swapOptions ?? [];
  const applyTemplate = content?.swapTemplate ?? null;
  const showApplySection =
    Boolean(
      applyTemplate && applyOptions.length > 0 && typeof applyTemplate === "string" && applyTemplate.includes("___")
    );

  const resetFlowState = useCallback(() => {
    setFlowStep("listen");
    setListenCount(0);
    setListenedWords(new Set());
    setPlayingWordIdx(null);
    setRepeatDone(false);
    setRecallDone(false);
    setRecallText("");
    setUserInput("");
    setActiveSel(null);
    missionResultGaFiredRef.current = false;
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
      setActiveSel(null);
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

  const playApplyChipTts = useCallback(
    async (sentence) => {
      if (!sentence) return;
      stopAudio();
      setTtsLoading(true);
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sentence, lang: "ko-KR", speakingRate: 0.9 })
        });
        const data = await response.json();
        if (!data?.audioContent) return;
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        audioRef.current = audio;
        audio.onended = () => {
          if (audioRef.current === audio) audioRef.current = null;
        };
        await audio.play();
      } catch {
        // keep activeSel
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
      setActiveSel(null);
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
    setActiveSel(null);
    const qs = buildQs();
    const tail = qs.toString();
    router.push(tail ? `/?${tail}` : "/");
  };

  const gaCategory =
    journeyVibe === "drama" ? "kdrama" : journeyVibe === "trip" ? "trip" : "idol";

  useEffect(() => {
    if (flowStep !== "result" || !journeyActive || !content) return;
    if (typeof window === "undefined") return;
    const k = `ogu_mission_ga_${journeyDay}`;
    if (sessionStorage.getItem(k)) {
      setStreakDisplay(readStreakCount());
      return;
    }
    if (missionResultGaFiredRef.current) return;
    missionResultGaFiredRef.current = true;
    sessionStorage.setItem(k, "1");
    const completed = journeyDay;
    trackEvent("first_line_complete", { category: gaCategory, day: completed });
    trackEvent("day_complete", { day_number: completed });
    trackEvent("mission_complete", { day_number: completed });
    bumpStudyStreakOnMissionComplete();
    setStreakDisplay(readStreakCount());
  }, [flowStep, journeyActive, content, journeyDay, gaCategory]);

  useEffect(() => {
    if (flowStep !== "result") return;
    setStreakDisplay(readStreakCount());
  }, [flowStep]);

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
    if (flowStep !== "repeat" && flowStep !== "recall") {
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
  const resultScreenTier =
    flowStep === "result" && content && recallDone ? computeRecallTier(recallText, content.ko) : "keep";

  const retryFromResult = () => {
    stopAudio();
    setActiveSel(null);
    missionResultGaFiredRef.current = false;
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(`ogu_mission_ga_${journeyDay}`);
    }
    setRecallDone(false);
    setRecallText("");
    setFlowStep("recall");
  };

  const goNextDayFromResult = () => {
    stopAudio();
    if (!journeyActive) return;
    const next = Math.min(journeyDay + 1, JOURNEY_DONE_MARKER);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(OGU_CURRENT_DAY_KEY, String(next));
    }
    setJourneyDay(next);
    missionResultGaFiredRef.current = false;
    resetFlowState();
  };

  const showDay3SignupModal = flowStep === "result" && journeyActive && journeyDay === 3 && !signupModalDismissed;

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

  const showNextDayFromResult = journeyActive && journeyDay < MAX_JOURNEY_DAY;
  const nextDayNumFromResult = journeyDay + 1;

  const tryAnother = () => {
    stopAudio();
    setActiveSel(null);
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
              {flowStep === "result" ? (
                <>
                  <ProgressDots allComplete />
                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#2a14b4]">
                    {tx(L, "fl5_over_done")}
                  </p>
                  <div
                    className="mt-4 rounded-[28px] px-4 py-4 text-center text-white"
                    style={{
                      background: "linear-gradient(135deg, #2a14b4, #4338ca)",
                      boxShadow: "0 8px 24px rgba(42,20,180,0.25)"
                    }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[rgba(255,255,255,0.6)]">
                      {tx(L, "fl5_badge_first_done")}
                    </p>
                    <p className="mt-2 text-[20px] font-extrabold leading-snug">{tx(L, "fl5_result_title", { n: dayN })}</p>
                    <p className="mt-2 text-[12px] text-[rgba(255,255,255,0.65)]">{tx(L, "fl5_day_done_sub")}</p>
                  </div>

                  <div
                    className="mt-6 rounded-[24px] bg-white p-5"
                    style={{
                      boxShadow: "0 20px 50px rgba(26,28,29,0.05)",
                      border:
                        resultScreenTier === "perfect"
                          ? "1.5px solid rgba(34,197,94,0.3)"
                          : resultScreenTier === "good"
                            ? "1.5px solid rgba(234,179,8,0.3)"
                            : "1.5px solid rgba(239,68,68,0.3)"
                    }}
                  >
                    <div
                      className="inline-flex rounded-full px-3 py-1.5 text-[12px] font-bold"
                      style={{
                        backgroundColor:
                          resultScreenTier === "perfect"
                            ? "rgba(34,197,94,0.1)"
                            : resultScreenTier === "good"
                              ? "rgba(234,179,8,0.1)"
                              : "rgba(239,68,68,0.1)",
                        color:
                          resultScreenTier === "perfect"
                            ? "#166534"
                            : resultScreenTier === "good"
                              ? "#854d0e"
                              : "#991b1b"
                      }}
                    >
                      {tx(L, resultScreenTier === "perfect" ? "fl_badge_perfect" : resultScreenTier === "good" ? "fl_badge_good" : "fl_badge_keep")}
                    </div>
                    <p className="mt-4 text-[10px] text-[#6b6f72]">{tx(L, "fl5_rs_you_said")}</p>
                    <p className="font-korean mt-1 text-[15px] font-bold text-[#1a1c1d]">{recallText || "—"}</p>
                    <div className="mt-3 flex items-center gap-2">
                      {resultScreenTier === "perfect" ? (
                        <TierCheckIcon fill="#22c55e" />
                      ) : resultScreenTier === "good" ? (
                        <WarningMarkIcon />
                      ) : (
                        <ResultXIcon />
                      )}
                      <p
                        className="text-[13px] font-semibold"
                        style={{
                          color: resultScreenTier === "perfect" ? "#22c55e" : resultScreenTier === "good" ? "#ca8a04" : "#ef4444"
                        }}
                      >
                        {tx(
                          L,
                          resultScreenTier === "perfect" ? "fl5_rs_eval_perfect" : resultScreenTier === "good" ? "fl5_rs_eval_good" : "fl5_rs_eval_keep"
                        )}
                      </p>
                    </div>
                    <div className="my-4 h-px w-full bg-[rgba(26,28,29,0.06)]" aria-hidden />
                    <p className="text-[10px] text-[#6b6f72]">{tx(L, "fl5_rs_model")}</p>
                    <p className="font-korean mt-1 text-[14px] font-bold text-[#1a1c1d]">{content.ko}</p>
                    {content.romanization ? (
                      <p className="mt-2 text-[11px] italic text-[#2a14b4]">{content.romanization}</p>
                    ) : null}
                  </div>

                  {vocab.length > 0 ? (
                    <div
                      className="mt-4 rounded-[24px] bg-white p-4"
                      style={{ boxShadow: "0 20px 50px rgba(26,28,29,0.05)" }}
                    >
                      <div className="flex items-center gap-1.5">
                        <BookIcon />
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#2a14b4]">{tx(L, "fl5_rs_vocab")}</p>
                      </div>
                      <ul className="mt-3">
                        {vocab.map((row, i) => (
                          <li
                            key={`${row.word}-${i}`}
                            className="mb-[5px] flex items-start justify-between gap-2 rounded-[10px] px-2 py-1.5 last:mb-0"
                            style={{ backgroundColor: "#f3f3f5" }}
                          >
                            <div className="min-w-0">
                              <p className="font-korean text-[12px] font-bold">{row.word}</p>
                              <p className="text-[9px] italic text-[#2a14b4]">{row.roman}</p>
                            </div>
                            <p className="max-w-[45%] text-right text-[10px] text-[#6b6f72]">{row.meaning}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {showApplySection && applyTemplate ? (
                    <div
                      className="mt-4 rounded-[28px] bg-white"
                      style={{
                        padding: "18px 16px",
                        boxShadow: "0 20px 50px rgba(26,28,29,0.05)"
                      }}
                    >
                      <p
                        className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#2a14b4]"
                        style={{ marginBottom: 12 }}
                      >
                        {tx(L, "fl5_apply_section")}
                      </p>
                      <div
                        className="text-center font-korean text-[18px] font-bold leading-relaxed text-[#1a1c1d]"
                        style={{
                          background: "#f9f9fb",
                          borderRadius: 16,
                          padding: "12px 14px",
                          marginBottom: 12
                        }}
                      >
                        {applyTemplate.split("___").map((part, i, arr) => (
                          <Fragment key={i}>
                            {part}
                            {i < arr.length - 1 ? (
                              activeSel ? (
                                <span className="mx-1 inline-block font-bold text-[#2a14b4]">{activeSel}</span>
                              ) : (
                                <span
                                  className="mx-1 inline-block"
                                  style={{
                                    display: "inline-block",
                                    minWidth: 56,
                                    height: 24,
                                    margin: "0 4px",
                                    borderBottom: "2px solid #2a14b4",
                                    verticalAlign: "bottom"
                                  }}
                                />
                              )
                            ) : null}
                          </Fragment>
                        ))}
                      </div>
                      <div className="flex flex-wrap justify-center" style={{ gap: "8px" }}>
                        {applyOptions.map((opt, i) => {
                          const active = activeSel === opt;
                          return (
                            <button
                              key={`${opt}-${i}`}
                              type="button"
                              onClick={() => {
                                setActiveSel(opt);
                                const s = buildSentenceFromTemplate(applyTemplate, opt);
                                void playApplyChipTts(s);
                              }}
                              className="cursor-pointer rounded-[20px] text-[14px] font-semibold"
                              style={{
                                padding: "7px 16px",
                                backgroundColor: active ? "#2a14b4" : "#f3f3f5",
                                color: active ? "#fff" : "#1a1c1d"
                              }}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white px-3 py-4 text-center" style={{ boxShadow: "0 20px 50px rgba(26,28,29,0.05)" }}>
                      <p className="text-[20px] font-extrabold text-[#2a14b4]">1</p>
                      <p className="mt-1 text-[10px] text-[#6b6f72]">{tx(L, "fl5_stat_times")}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-4 text-center" style={{ boxShadow: "0 20px 50px rgba(26,28,29,0.05)" }}>
                      <p className="text-[20px] font-extrabold text-[#2a14b4]">{streakDisplay}</p>
                      <p className="mt-1 text-[10px] text-[#6b6f72]">{tx(L, "fl5_stat_streak")}</p>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col-reverse gap-3">
                    {showNextDayFromResult ? (
                      <button type="button" onClick={goNextDayFromResult} className={primaryBtn} style={primaryStyle}>
                        {tx(L, "fl5_btn_next_day", { n: nextDayNumFromResult })}
                      </button>
                    ) : journeyActive ? (
                      <button type="button" onClick={tryAnother} className={primaryBtn} style={primaryStyle}>
                        {tx(L, "fl_tryAnother")}
                      </button>
                    ) : (
                      <button type="button" onClick={goChooseTopic} className={primaryBtn} style={primaryStyle}>
                        {tx(L, "fl_chooseOtherTopic")}
                      </button>
                    )}
                    <button type="button" onClick={retryFromResult} className={secondaryBtn}>
                      {tx(L, "fl5_btn_retry_swap")}
                    </button>
                    <button type="button" onClick={goHome} className={secondaryBtnHome}>
                      {tx(L, "fl5_btn_home_go")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <ProgressDots active={flowIndex} />

              {flowStep === "listen" && (
                <>
                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#2a14b4]">
                    {tx(L, "fl5_over_listen")}
                  </p>
                  <div className="mt-4">{heroCard}</div>
                  <button
                    type="button"
                    onClick={onListenMain}
                    disabled={ttsLoading}
                    className={`${step1PrimaryBtn} mt-6`}
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
                    {tx(L, "fl5_over_understand")}
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
                              {done ? <WordCheckIcon /> : playing ? <WordPauseIcon /> : <WordPlayIcon />}
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
                    {tx(L, "fl5_over_repeat")}
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
                    className={`${primaryBtn} mt-4`}
                    style={primaryStyle}
                  >
                    {isListening ? tx(L, "fl5_btn_follow_speaking") : tx(L, "fl5_btn_follow_speak")}
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
                    {tx(L, "fl5_over_recall")}
                  </p>
                  <div
                    className="mt-4 rounded-[28px] text-center"
                    style={{
                      backgroundColor: "#f3f3f5",
                      border: "1.5px dashed rgba(42,20,180,0.2)",
                      padding: "20px 16px"
                    }}
                  >
                    <p className="text-[13px] leading-relaxed text-[#6b6f72]">{tx(L, "fl5_recall_line1")}</p>
                    <div className="h-2" aria-hidden />
                    <div
                      className="flex flex-wrap justify-center"
                      style={{ gap: "6px" }}
                    >
                      {splitSentenceWords(content.ko).map((w, wi) => {
                        const n = [...w].length;
                        const wPx = Math.max(24, n * 14);
                        return (
                          <span
                            key={`blank-${wi}-${w}`}
                            className="inline-block"
                            style={{
                              width: wPx,
                              minWidth: 24,
                              height: 20,
                              margin: "0 4px",
                              borderBottom: "2px solid rgba(42,20,180,0.3)"
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className="h-2" aria-hidden />
                    <p className="text-[13px] leading-relaxed text-[#6b6f72]">{tx(L, "fl5_recall_line2")}</p>
                    {content.romanization ? (
                      <>
                        <div
                          className="my-2 w-full"
                          style={{ height: 1, backgroundColor: "rgba(42,20,180,0.1)" }}
                          aria-hidden
                        />
                        <p className="text-[12px] italic leading-[1.6] text-[#2a14b4]">{content.romanization}</p>
                      </>
                    ) : null}
                  </div>
                  {!recallDone ? (
                    <button
                      type="button"
                      onClick={() => void toggleVoiceInput("recall")}
                      disabled={!getSpeechRecognition() || isRequestingMic}
                      className={`${primaryBtn} mt-6`}
                      style={primaryStyle}
                    >
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
                      <button type="button" onClick={() => setFlowStep("result")} className={`${nextStepBtn} mt-6`}>
                        {tx(L, "fl5_next_result")}
                      </button>
                    </>
                  ) : null}
                </>
              )}

              {!journeyActive && flowStep !== "result" ? (
                <button
                  type="button"
                  onClick={goChooseTopic}
                  className="mt-8 w-full text-center text-xs font-medium text-[var(--on-surface-variant)] transition hover:opacity-80"
                >
                  {tx(L, "fl_chooseOtherTopic")}
                </button>
              ) : null}
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
