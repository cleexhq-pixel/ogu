"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import {
  pageview,
  trackStartFreeChat,
  trackMissionComplete,
  trackReachDailyLimit,
  trackUseHint,
  trackSendVoice
} from "@/app/lib/gtag";
import { MISSIONS } from "@/app/data/missions";
import { OGU_MODEL_ANSWER_TOKEN, getInterviewQuestionTopicHints } from "@/app/lib/ogu-interview";

/** 동일 AI 메시지에 TTS가 두 번 도는 것 방지 (Strict Mode 이중 effect·연속 호출) */
let ttsLastScheduledAssistantKey = "";

function stripHints(text, enabled) {
  if (enabled) return text;
  return text.replace(/\s*\([^)]*\)/g, "");
}

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/** 브라우저 마이크 권한 UI를 띄우고, 허용 여부를 확인 (iOS/Android에서 STT 전에 권장) */
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

/** 인터뷰 첫 인사: 질문 예시·모범 답변 등은 제거하고 짧은 인사 한 줄만 남김 */
function sanitizeOguInterviewOpening(displayText) {
  if (!displayText || typeof displayText !== "string") return displayText;
  let t = displayText.replace(/\[MISSION_COMPLETE\]/g, "").trim();
  t = t.replace(/\s*질문\s*예시\s*[:：][\s\S]*/gi, "");
  t = t.replace(/\s*모범\s*답변\s*[:：][\s\S]*/gi, "");
  t = t.replace(/\s*예시\s*질문\s*[:：][\s\S]*/gi, "");
  t = t.replace(/\s*기자\s*예시\s*[:：][\s\S]*/gi, "");
  const stripLinePatterns =
    /^(질문\s*예시|모범\s*답변|예시\s*질문|기자\s*예시|샘플\s*질문|예\s*[:：])/i;
  const lines = t
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !stripLinePatterns.test(l) && !/질문\s*예시/.test(l) && !/모범\s*답변/.test(l));
  if (lines.length === 0) return (t.split(/\n/)[0] || displayText).trim();
  const first = lines[0];
  const oneSentence = first.split(/(?<=[.!?])\s+/)[0]?.trim() || first;
  return oneSentence;
}

function parseViolationReply(reply) {
  if (!reply || typeof reply !== "string") return null;
  let raw = reply.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  }
  try {
    const data = JSON.parse(raw);
    if (data && data.violation === true && typeof data.level === "number") return data;
  } catch (_) {}
  return null;
}

/**
 * AI 응답 파싱: 말풍선에는 [RESPONSE]/[CORRECTION] 태그와 JSON이 절대 보이지 않도록 처리.
 * - [RESPONSE]...[/RESPONSE] 있으면 그 안의 텍스트만 표시
 * - 없으면 [CORRECTION] 이전 텍스트만 표시 (CORRECTION 블록 제거)
 */
function parseAIResponse(rawText) {
  if (!rawText || typeof rawText !== "string") return { displayText: rawText || "", corrections: [] };
  const raw = rawText.trim();
  let displayText = raw;
  let corrections = [];

  const correctionMatch = raw.match(/\[CORRECTION\]([\s\S]*?)\[\/CORRECTION\]/);
  if (correctionMatch) {
    try {
      let jsonStr = correctionMatch[1].trim();
      if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
      const data = JSON.parse(jsonStr);
      if (Array.isArray(data.corrections)) {
        corrections = data.corrections.filter((c) => c && (c.original != null || c.corrected != null));
      }
    } catch (_) {}
    displayText = raw.replace(/\[CORRECTION\][\s\S]*?\[\/CORRECTION\]/g, "").trim();
  }

  const responseMatch = displayText.match(/\[RESPONSE\]([\s\S]*?)\[\/RESPONSE\]/);
  if (responseMatch) {
    displayText = responseMatch[1].trim();
  } else {
    displayText = displayText
      .replace(/\[\/RESPONSE\]/g, "")
      .replace(/\[RESPONSE\]/g, "")
      .trim();
  }

  return { displayText, corrections };
}

/**
 * 괄호 밖 = 한국어, 괄호 () 안 = 번역 (API가 끝에 한 쌍만 두지 않을 때 fallback)
 */
function splitKoreanAndTranslation(text, showHints) {
  if (!text || typeof text !== "string") return { korean: "", translation: null };
  let t = text.replace(/\[MISSION_COMPLETE\]/g, "").trim();
  if (!showHints) {
    return { korean: stripHints(t, false).trim(), translation: null };
  }
  const parts = t.split(/(\([^)]*\))/g).filter((p) => p.length > 0);
  let korean = "";
  const translations = [];
  for (const part of parts) {
    if (/^\([^)]*\)$/.test(part)) {
      translations.push(part.slice(1, -1).trim());
    } else {
      korean += part;
    }
  }
  korean = korean.trim();
  const translation = translations.length ? translations.join(" ") : null;
  return { korean, translation };
}

/** 마침표/물음표/느낌표 뒤(공백·줄바꿈)에서 한국어 줄 분리 */
function splitKoreanIntoLines(korean) {
  if (!korean) return [];
  return korean
    .split(/(?<=[.?!])[\s\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * 번역: 문자열 끝의 (...), 없으면 splitKoreanAndTranslation fallback
 * 한국어: . ? ! 뒤 줄바꿈(또는 공백) 기준 분리
 */
function formatKoreanText(text, showHints) {
  const raw = (text || "").replace(/\[MISSION_COMPLETE\]/g, "").trim();
  if (!raw) return { lines: [], translation: null };

  if (!showHints) {
    const korean = stripHints(raw, false).trim();
    const lines = splitKoreanIntoLines(korean);
    return {
      lines: lines.length ? lines : korean ? [korean] : [],
      translation: null
    };
  }

  const translationMatch = raw.match(/\(([^)]+)\)\s*$/);
  let translation = translationMatch ? translationMatch[1].trim() : null;
  let koreanBody = translationMatch ? raw.slice(0, translationMatch.index).trim() : raw;

  if (!translation) {
    const { korean, translation: t } = splitKoreanAndTranslation(raw, true);
    if (t) {
      translation = t;
      koreanBody = korean;
    }
  }

  let lines = splitKoreanIntoLines(koreanBody);
  if (!lines.length && koreanBody) lines = [koreanBody];
  return { lines, translation };
}

/** @param {"indigo" | "muted" | "violation"} variant */
function renderAiMessageCard(text, showHints, variant = "muted") {
  if (!text) return null;
  const rawFallback = text.replace(/\[MISSION_COMPLETE\]/g, "").trim();
  const { lines, translation } = formatKoreanText(text, showHints);
  const showTranslation = showHints && translation;
  const displayLines = lines.length ? lines : !showTranslation && rawFallback ? [rawFallback] : [];

  if (!displayLines.length && !showTranslation) return null;

  const content = (
    <div className="ai-card-content">
      <div className="korean-lines">
        {displayLines.map((line, i) => (
          <p key={i} className="korean-line korean-text">
            {line}
          </p>
        ))}
      </div>
      {showTranslation ? (
        <>
          <hr className="divider" />
          <p className="translation">{translation}</p>
        </>
      ) : null}
    </div>
  );

  if (variant === "violation") {
    return <div className="ai-message-card ai-message-card--violation">{content}</div>;
  }

  const mod = variant === "indigo" ? "ai-message-card--indigo" : "ai-message-card--muted";
  return <div className={`ai-message-card ${mod}`}>{content}</div>;
}

function ChatContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const levelParam = searchParams.get("level") || "beginner";
  const personaParam = searchParams.get("persona") || "cafe";
  const language = searchParams.get("lang") || "en";
  const userIdFromUrl = searchParams.get("userId");
  const missionId = searchParams.get("mission");
  const isInterviewMission = missionId === "greeting-friend";
  const seed = searchParams.get("seed");
  const challengeDayParam = searchParams.get("challenge_day");
  const mode = searchParams.get("mode");
  const onboardingParam = searchParams.get("onboarding");
  const isOnboarding = onboardingParam === "true";

  const isPhraseMode = !!seed && mode === "phrase";
  const level = isPhraseMode ? "elementary" : levelParam;
  const persona = isPhraseMode ? "free" : personaParam;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHints, setShowHints] = useState(language === "en" || language === "id");
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showMicPermissionModal, setShowMicPermissionModal] = useState(false);
  const [micPermissionHint, setMicPermissionHint] = useState(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [level3Countdown, setLevel3Countdown] = useState(null);
  const [allCorrections, setAllCorrections] = useState([]);
  const [usageLimited, setUsageLimited] = useState(false);
  const [missionCelebration, setMissionCelebration] = useState(false);
  const [missionCompleteStats, setMissionCompleteStats] = useState(null);
  const [pendingCorrections, setPendingCorrections] = useState(null);
  const [userCardLift, setUserCardLift] = useState(false);
  const [showStarterButtons, setShowStarterButtons] = useState(isOnboarding);
  /** OGU 인터뷰 미션 전용 */
  const [interviewSessionStarted, setInterviewSessionStarted] = useState(false);
  const [interviewMissionSecondsLeft, setInterviewMissionSecondsLeft] = useState(null);
  const [responseWindowSec, setResponseWindowSec] = useState(null);
  /** 인터뷰 답변 타이머: 마이크 누름~TTS 종료까지 감소 일시정지 */
  const [interviewResponseTimerPaused, setInterviewResponseTimerPaused] = useState(false);

  const recognitionRef = useRef(null);
  const level3CountdownStartedRef = useRef(false);
  const missionCompleteRef = useRef(false);
  const firstUserSentRef = useRef(false);
  const allCorrectionsRef = useRef([]);
  /** 👀 번역/힌트 버튼 누른 횟수 (미션 완료 모달 통계용) */
  const hintsUsedCountRef = useRef(0);
  const messagesRef = useRef([]);
  const interviewTranscriptBufferRef = useRef("");
  const interviewMicHoldingRef = useRef(false);
  const interviewMicGestureAtRef = useRef(0);
  const voiceMicTouchAtRef = useRef(0);
  const interviewMicStartInFlightRef = useRef(false);
  const isInterviewMissionRef = useRef(isInterviewMission);
  const handleSendRef = useRef(null);

  useEffect(() => {
    allCorrectionsRef.current = allCorrections;
  }, [allCorrections]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isInterviewMissionRef.current = isInterviewMission;
  }, [isInterviewMission]);

  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const personaMeta = useMemo(() => {
    if (isInterviewMission) {
      return {
        emoji: "🎤",
        name: "OGU",
        subtitle:
          language === "ko"
            ? "케이팝 솔로 아티스트 · 인터뷰"
            : language === "id"
            ? "Artis solo K-pop · Wawancara"
            : "K-pop solo artist · Interview"
      };
    }
    const names = {
      cafe: { ko: "카페오구", en: "Café Ogu", id: "Kafe Ogu" },
      office: { ko: "직장오구", en: "Office Ogu", id: "Kantor Ogu" },
      drama: { ko: "드라마오구", en: "Drama Ogu", id: "Drama Ogu" },
      free: { ko: "자유대화오구", en: "Free Talk Ogu", id: "Obrolan Bebas Ogu" }
    };
    const subs = {
      free: { ko: "어떤 주제든 OK!", en: "Any topic OK!", id: "Topik apa saja!" }
    };
    const n = names[persona] || names.cafe;
    const baseName = language === "ko" ? n.ko : language === "id" ? n.id : n.en;
    const name = isPhraseMode
      ? language === "ko"
        ? "오늘의 표현 연습"
        : language === "id"
        ? "Latihan Frasa Hari Ini"
        : "Today's Phrase Practice"
      : baseName;
    const sub = !isPhraseMode && persona === "free"
      ? (language === "ko" ? subs.free.ko : language === "id" ? subs.free.id : subs.free.en)
      : null;
    return {
      emoji: persona === "office" ? "💼" : persona === "drama" ? "📺" : persona === "free" ? "🌟" : "☕",
      name,
      subtitle: sub
    };
  }, [persona, language, isPhraseMode, isInterviewMission]);

  useEffect(() => {
    setShowHints(language === "en" || language === "id");
  }, [language]);

  // GA4: 채팅 페이지 진입 시 페이지뷰 전송
  useEffect(() => {
    if (typeof window === "undefined") return;
    pageview(window.location.pathname + window.location.search);
  }, [level, persona, language]);

  // GA4: 자유 대화 시작 (미션이 없을 때)
  useEffect(() => {
    if (!missionId) {
      trackStartFreeChat();
    }
  }, [missionId]);

  const activeUserIdRef = useRef(null);

  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const missionMeta = useMemo(() => {
    if (!missionId) return null;
    return MISSIONS.find((m) => m.id === missionId) || null;
  }, [missionId]);

  const missionSteps = missionMeta ? missionMeta.steps[language] || missionMeta.steps.en : [];

  const beginInterviewSession = useCallback(() => {
    setInterviewSessionStarted(true);
    setInterviewMissionSecondsLeft(missionMeta?.timerSeconds ?? 60);
  }, [missionMeta]);

  const starterMessages = useMemo(() => {
    const map = {
      "greeting-friend": {
        ko: ["데뷔는 언제였어요?", "오늘 컨디션 어때요?", "팬들에게 한 말씀 부탁드려요!"],
        en: ["When did you debut?", "How do you feel today?", "A word for your fans?"],
        id: ["Kapan debut?", "Bagaimana kondisimu hari ini?", "Pesan untuk penggemar?"]
      },
      "cafe-order": {
        ko: ["아이스 아메리카노 주세요!", "따뜻한 라떼 주세요!", "메뉴 추천해 주세요!"],
        en: ["Iced Americano please!", "Warm latte please!", "Can you recommend?"],
        id: ["Es Americano!", "Latte hangat!", "Ada rekomendasi?"]
      },
      "self-intro": {
        ko: ["안녕하세요, 저는 학생이에요!", "반갑습니다!", "한국어 공부 중이에요!"],
        en: ["Hi, I'm a student!", "Nice to meet you!", "I'm learning Korean!"],
        id: ["Halo, saya mahasiswa!", "Senang bertemu!", "Saya belajar Korea!"]
      },
      default: {
        ko: ["안녕하세요!", "잘 부탁드려요!", "시작해볼게요!"],
        en: ["Hello!", "Nice to meet you!", "Let's start!"],
        id: ["Halo!", "Senang bertemu!", "Ayo mulai!"]
      }
    };
    const key = missionId && map[missionId] ? missionId : "default";
    return map[key][language] || map[key].en;
  }, [missionId, language]);

  useEffect(() => {
    const currentUserTurns = messages.filter((m) => m.role === "user").length;
    if (!isOnboarding) {
      setShowStarterButtons(false);
      return;
    }
    if (messages.length > 0 && messages[0]?.role === "assistant" && currentUserTurns === 0 && !input.trim()) {
      setShowStarterButtons(true);
    }
    if (currentUserTurns > 0) {
      setShowStarterButtons(false);
    }
  }, [isOnboarding, messages, input]);

  // STT: SpeechRecognition 초기화 및 이벤트 (인터뷰: 푸시투토크·단발, 그 외: 연속)
  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = !isInterviewMission;
    recognition.interimResults = !isInterviewMission;
    recognition.lang = "ko-KR";

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (!transcript.trim()) return;
      if (isInterviewMissionRef.current) {
        interviewTranscriptBufferRef.current = (
          interviewTranscriptBufferRef.current + transcript
        ).trim();
      } else {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript).trim());
      }
    };

    recognition.onstart = () => {
      setIsRequestingPermission(false);
      setIsRecording(true);
      setShowMicPermissionModal(false);
      setMicPermissionHint(null);
    };

    recognition.onerror = (event) => {
      setIsRequestingPermission(false);
      if (isInterviewMissionRef.current) {
        interviewMicHoldingRef.current = false;
        interviewTranscriptBufferRef.current = "";
        setInterviewResponseTimerPaused(false);
      }
      if (event.error === "not-allowed" || event.error === "denied" || event.error === "service-not-allowed") {
        setIsRecording(false);
        setShowMicPermissionModal(true);
        const lang = languageRef.current;
        setMicPermissionHint(
          lang === "ko"
            ? "마이크 권한을 허용해주세요"
            : lang === "id"
            ? "Izinkan akses mikrofon"
            : "Please allow microphone access"
        );
      } else if (event.error === "aborted") {
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (isInterviewMissionRef.current && interviewMicHoldingRef.current === false) {
        const t = interviewTranscriptBufferRef.current.trim();
        interviewTranscriptBufferRef.current = "";
        if (t && handleSendRef.current) {
          handleSendRef.current(t);
        } else {
          setInterviewResponseTimerPaused(false);
        }
      }
    };

    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.abort();
      } catch (_) {}
      recognitionRef.current = null;
    };
  }, [isInterviewMission]);

  const toggleRecording = useCallback(async () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isRecording) {
      try {
        recognition.stop();
      } catch (_) {}
      setIsRecording(false);
      return;
    }

    // 권한이 이미 거부된 경우 모달 표시 (Permissions API 지원 시)
    try {
      if (navigator.permissions?.query) {
        const result = await navigator.permissions.query({ name: "microphone" });
        if (result.state === "denied") {
          setShowMicPermissionModal(true);
          const lang = languageRef.current;
          setMicPermissionHint(
            lang === "ko"
              ? "마이크 권한을 허용해주세요"
              : lang === "id"
              ? "Izinkan akses mikrofon"
              : "Please allow microphone access"
          );
          return;
        }
      }
    } catch (_) {}

    setIsRequestingPermission(true);
    try {
      const mic = await requestMicrophoneAccess();
      if (!mic.ok && mic.denied) {
        setIsRequestingPermission(false);
        setShowMicPermissionModal(true);
        const lang = languageRef.current;
        setMicPermissionHint(
          lang === "ko"
            ? "마이크 권한을 허용해주세요"
            : lang === "id"
            ? "Izinkan akses mikrofon"
            : "Please allow microphone access"
        );
        return;
      }
      recognition.start();
      trackSendVoice();
    } catch (e) {
      console.warn("SpeechRecognition start failed", e);
      setIsRequestingPermission(false);
      setShowMicPermissionModal(true);
      const lang = languageRef.current;
      setMicPermissionHint(
        lang === "ko"
          ? "마이크 권한을 허용해주세요"
          : lang === "id"
          ? "Izinkan akses mikrofon"
          : "Please allow microphone access"
      );
    }
  }, [isRecording]);

  const startInterviewMic = useCallback(async () => {
    const recognition = recognitionRef.current;
    if (!recognition || !isInterviewMissionRef.current) return;
    if (responseWindowSec === 0) return;
    if (interviewMicStartInFlightRef.current) return;
    const now = Date.now();
    if (now - interviewMicGestureAtRef.current < 90) return;
    interviewMicGestureAtRef.current = now;

    setInterviewResponseTimerPaused(true);
    interviewTranscriptBufferRef.current = "";
    interviewMicHoldingRef.current = true;
    try {
      if (navigator.permissions?.query) {
        const result = await navigator.permissions.query({ name: "microphone" });
        if (result.state === "denied") {
          interviewMicHoldingRef.current = false;
          setInterviewResponseTimerPaused(false);
          setShowMicPermissionModal(true);
          const lang = languageRef.current;
          setMicPermissionHint(
            lang === "ko"
              ? "마이크 권한을 허용해주세요"
              : lang === "id"
              ? "Izinkan akses mikrofon"
              : "Please allow microphone access"
          );
          return;
        }
      }
    } catch (_) {}
    setIsRequestingPermission(true);
    interviewMicStartInFlightRef.current = true;
    try {
      const mic = await requestMicrophoneAccess();
      if (!mic.ok && mic.denied) {
        interviewMicHoldingRef.current = false;
        setInterviewResponseTimerPaused(false);
        setIsRequestingPermission(false);
        setShowMicPermissionModal(true);
        const lang = languageRef.current;
        setMicPermissionHint(
          lang === "ko"
            ? "마이크 권한을 허용해주세요"
            : lang === "id"
            ? "Izinkan akses mikrofon"
            : "Please allow microphone access"
        );
        return;
      }
      recognition.start();
      trackSendVoice();
    } catch (e) {
      console.warn("SpeechRecognition start failed", e);
      interviewMicHoldingRef.current = false;
      setInterviewResponseTimerPaused(false);
      setIsRequestingPermission(false);
      setShowMicPermissionModal(true);
      const lang = languageRef.current;
      setMicPermissionHint(
        lang === "ko"
          ? "마이크 권한을 허용해주세요"
          : lang === "id"
          ? "Izinkan akses mikrofon"
          : "Please allow microphone access"
      );
    } finally {
      interviewMicStartInFlightRef.current = false;
    }
  }, [responseWindowSec]);

  const endInterviewMic = useCallback(() => {
    if (!isInterviewMissionRef.current) return;
    interviewMicHoldingRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch (_) {}
  }, []);

  const onVoiceMicTouchStart = useCallback(
    (e) => {
      if (!getSpeechRecognition() || isRequestingPermission) return;
      e.preventDefault();
      voiceMicTouchAtRef.current = Date.now();
      void toggleRecording();
    },
    [toggleRecording, isRequestingPermission]
  );

  const onVoiceMicTouchEnd = useCallback((e) => {
    e.preventDefault();
  }, []);

  const onVoiceMicClick = useCallback(() => {
    if (Date.now() - voiceMicTouchAtRef.current < 450) return;
    void toggleRecording();
  }, [toggleRecording]);

  const onInterviewMicTouchStart = useCallback(
    (e) => {
      e.preventDefault();
      void startInterviewMic();
    },
    [startInterviewMic]
  );

  const onInterviewMicTouchEnd = useCallback(
    (e) => {
      e.preventDefault();
      endInterviewMic();
    },
    [endInterviewMic]
  );

  const lastSpokenRef = useRef(null);
  const ttsAudioRef = useRef(null);

  const playTTS = useCallback(async (rawText, options) => {
    let reservedToSpeak = null;
    const onEnded = options?.onEnded;
    try {
      const koreanOnly = String(rawText)
        .replace(/\[MISSION_COMPLETE\]/g, "")
        .replace(/\([^)]+\)/g, "")
        .trim();
      const toSpeak = stripHints(koreanOnly, false).trim();
      if (!toSpeak) {
        onEnded?.();
        return;
      }
      // await 전에 동기로 막아 병렬 playTTS(이중 fetch·이중 재생) 방지
      if (lastSpokenRef.current === toSpeak) return;

      if (ttsAudioRef.current) {
        try {
          ttsAudioRef.current.pause();
          ttsAudioRef.current.src = "";
        } catch (_) {}
        ttsAudioRef.current = null;
      }

      lastSpokenRef.current = toSpeak;
      reservedToSpeak = toSpeak;

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: toSpeak,
          lang: "ko-KR"
        })
      });
      const data = await response.json();
      if (!data?.audioContent) {
        if (lastSpokenRef.current === reservedToSpeak) lastSpokenRef.current = null;
        onEnded?.();
        return;
      }

      const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
      audio.playbackRate = 1.0;
      ttsAudioRef.current = audio;
      audio.addEventListener(
        "ended",
        () => {
          if (ttsAudioRef.current === audio) ttsAudioRef.current = null;
          onEnded?.();
        },
        { once: true }
      );
      try {
        await audio.play();
      } catch {
        if (lastSpokenRef.current === reservedToSpeak) lastSpokenRef.current = null;
        onEnded?.();
      }
    } catch (err) {
      if (reservedToSpeak != null && lastSpokenRef.current === reservedToSpeak) {
        lastSpokenRef.current = null;
      }
      console.log("TTS failed, skipping");
      onEnded?.();
    }
  }, []);

  // Google Cloud TTS: AI 응답 완료 후 재생 (위반 메시지 제외, 음소거 시 미호출)
  useEffect(() => {
    if (messages.length === 0) {
      ttsLastScheduledAssistantKey = "";
      return;
    }
    if (isLoading) return;
    const last = messages[messages.length - 1];
    if (last?.role !== "assistant" || !last?.content || last?.violationLevel != null) return;

    const assistantKey = `${messages.length - 1}:${last.content}`;
    if (ttsLastScheduledAssistantKey === assistantKey) return;
    ttsLastScheduledAssistantKey = assistantKey;

    const startInterviewResponseWindow = () => {
      setResponseWindowSec(10);
      setInterviewResponseTimerPaused(false);
    };

    if (last?.hiddenFromUi) {
      ttsLastScheduledAssistantKey = `${messages.length - 1}:${last.content}`;
      if (isInterviewMission && interviewSessionStarted) {
        startInterviewResponseWindow();
      }
      return;
    }

    if (isInterviewMission && interviewSessionStarted) {
      if (isMuted) {
        startInterviewResponseWindow();
        return;
      }
      playTTS(last.content, { onEnded: startInterviewResponseWindow });
      return;
    }

    if (isMuted) return;
    playTTS(last.content);
  }, [
    messages,
    isMuted,
    isLoading,
    playTTS,
    isInterviewMission,
    interviewSessionStarted
  ]);

  useEffect(() => {
    if (!isMuted) return;
    const a = ttsAudioRef.current;
    if (a) {
      try {
        a.pause();
      } catch (_) {}
    }
  }, [isMuted]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const id = userIdFromUrl || crypto.randomUUID?.() || `ogu-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    activeUserIdRef.current = id;

    supabase
      .from("active_users")
      .upsert(
        { id, status: "chatting", last_seen: new Date().toISOString() },
        { onConflict: "id" }
      )
      .then(() => {});

    return () => {
      const toDelete = activeUserIdRef.current;
      if (toDelete) {
        supabase.from("active_users").delete().eq("id", toDelete).then(() => {});
        activeUserIdRef.current = null;
      }
    };
  }, [userIdFromUrl]);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        if (!window.sessionStorage.getItem("ogu-chat-start")) {
          window.sessionStorage.setItem("ogu-chat-start", String(Date.now()));
        }
      }
    } catch {}

    if (isInterviewMission && !interviewSessionStarted) return;

    const startConversation = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level,
            persona,
            language,
            messages: [],
            violationCount: 0,
            mission: missionId || null,
            seed: seed || null
          })
        });
        if (!res.ok) throw new Error("Failed to start chat");
        const data = await res.json();
        const reply = data.reply ?? "";
        const violation = parseViolationReply(reply);
        if (violation) {
          const content = language === "ko" ? violation.message_ko : (violation.message_id || violation.message_en);
          setMessages([{ role: "assistant", content, violationLevel: violation.level }]);
          setViolationCount(violation.level);
          if (violation.level === 3) setLevel3Countdown(3);
        } else {
          const { displayText, corrections } = parseAIResponse(reply);
          if (corrections.length) setAllCorrections((prev) => [...prev, ...corrections]);
          const opening = isInterviewMission ? sanitizeOguInterviewOpening(displayText) : displayText;
          setMessages([
            {
              role: "assistant",
              content: opening,
              corrections: corrections.length ? corrections : undefined
            }
          ]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    startConversation();
  }, [level, persona, language, missionId, seed, isInterviewMission, interviewSessionStarted]);

  const completeMissionFlow = useCallback(
    (historyMessages) => {
      if (missionCompleteRef.current) return;
      missionCompleteRef.current = true;

      try {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem("ogu-chat-history", JSON.stringify(historyMessages));
          window.sessionStorage.setItem("ogu-chat-end", String(Date.now()));
          window.localStorage.setItem("ogu_corrections", JSON.stringify(allCorrectionsRef.current));
        }
      } catch {
        // ignore
      }

      const userTurns = historyMessages.filter((m) => m.role === "user" && !m.hiddenFromUi).length;
      setMissionCompleteStats({
        userTurns,
        hintsUsed: hintsUsedCountRef.current
      });

      setMissionCelebration(true);
      setPendingCorrections(null);
      trackMissionComplete(missionId);

      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(`ogu_usage_${todayKey}`);
          let missionCount = 0;
          let convoCount = 0;
          if (raw) {
            const parsed = JSON.parse(raw);
            missionCount = parsed.mission || 0;
            convoCount = parsed.conversation || 0;
          }
          missionCount += 1;
          window.localStorage.setItem(
            `ogu_usage_${todayKey}`,
            JSON.stringify({ mission: missionCount, conversation: convoCount })
          );

          if (challengeDayParam) {
            const dayNum = Number(challengeDayParam);
            if (!Number.isNaN(dayNum)) {
              const progressRaw = window.localStorage.getItem("ogu_challenge_progress");
              let arr = [];
              if (progressRaw) {
                try {
                  const parsed = JSON.parse(progressRaw);
                  if (Array.isArray(parsed)) arr = parsed;
                } catch {
                  arr = [];
                }
              }
              if (!arr.includes(dayNum)) {
                arr.push(dayNum);
                arr.sort((a, b) => a - b);
                window.localStorage.setItem("ogu_challenge_progress", JSON.stringify(arr));
              }
            }
          }
        } catch {
          // ignore localStorage errors
        }
      }
    },
    [todayKey, challengeDayParam, missionId]
  );

  const handleMissionCompleteHome = useCallback(() => {
    setMissionCelebration(false);
    setMissionCompleteStats(null);
    router.push("/");
  }, [router]);

  const handleMissionCompleteRetry = useCallback(() => {
    missionCompleteRef.current = false;
    setMissionCelebration(false);
    setMissionCompleteStats(null);
    hintsUsedCountRef.current = 0;
    if (typeof window !== "undefined") {
      window.location.assign(`${window.location.pathname}${window.location.search}`);
    }
  }, []);

  // OGU 인터뷰: 1분 미션 타이머
  useEffect(() => {
    if (!isInterviewMission || !interviewSessionStarted || interviewMissionSecondsLeft === null) return;
    if (interviewMissionSecondsLeft <= 0) return;
    const id = window.setTimeout(() => {
      setInterviewMissionSecondsLeft((s) => (s == null || s <= 0 ? s : s - 1));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [isInterviewMission, interviewSessionStarted, interviewMissionSecondsLeft]);

  useEffect(() => {
    if (!isInterviewMission || interviewMissionSecondsLeft !== 0) return;
    if (missionCompleteRef.current) return;
    completeMissionFlow(messagesRef.current);
  }, [isInterviewMission, interviewMissionSecondsLeft, completeMissionFlow]);

  const handleSend = async (presetText, options) => {
    const trimmed = (presetText ?? input).trim();
    if (!trimmed || isLoading) return;
    if (isInterviewMission && responseWindowSec === 0 && !options?.hiddenFromUi) return;

    if (isInterviewMission) {
      setResponseWindowSec(null);
      setInterviewResponseTimerPaused(true);
    }

    // 하루 사용량 제한 체크 (첫 유저 발화 시)
    if (!firstUserSentRef.current) {
      firstUserSentRef.current = true;
      if (typeof window !== "undefined") {
        try {
          // localStorage 빠른 체크
          const raw = window.localStorage.getItem(`ogu_usage_${todayKey}`);
          let missionCount = 0;
          let convoCount = 0;
          if (raw) {
            const parsed = JSON.parse(raw);
            missionCount = parsed.mission || 0;
            convoCount = parsed.conversation || 0;
          }
          const total = missionCount + convoCount;
          if (total >= 5) {
            setUsageLimited(true);
            trackReachDailyLimit();
            const blockMessage =
              language === "ko"
                ? "오늘의 무료 연습 5회를 모두 사용했어요 🐥\n내일 다시 만나요!"
                : language === "id"
                ? "Sesi gratis hari ini sudah habis 🐥\nSampai jumpa besok!"
                : "You've used all 5 free sessions today 🐥\nSee you tomorrow!";
            setMessages((prev) => [...prev, { role: "assistant", content: blockMessage }]);
            setInput("");
            return;
          }

          // 서버 측 사용량 체크
          let userId = window.localStorage.getItem("ogu_user_id");
          if (!userId) {
            userId =
              crypto.randomUUID?.() ??
              `ogu-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            window.localStorage.setItem("ogu_user_id", userId);
          }
          const usageType = missionId ? "mission" : "conversation";
          const res = await fetch("/api/usage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, type: usageType })
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.allowed === false) {
              setUsageLimited(true);
              trackReachDailyLimit();
              const blockMessage =
                language === "ko"
                  ? "오늘의 무료 연습 5회를 모두 사용했어요 🐥\n내일 다시 만나요!"
                  : language === "id"
                  ? "Sesi gratis hari ini sudah habis 🐥\nSampai jumpa besok!"
                  : "You've used all 5 free sessions today 🐥\nSee you tomorrow!";
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: blockMessage }
              ]);
              setInput("");
              return;
            }
            // allowed인 경우 localStorage도 동기화 증가
            const serverMission = data?.mission ?? missionCount;
            const serverConvo = data?.conversation ?? convoCount;
            window.localStorage.setItem(
              `ogu_usage_${todayKey}`,
              JSON.stringify({
                mission: serverMission,
                conversation: serverConvo
              })
            );
          }
        } catch {
          // 서버 오류 시 localStorage 기준으로만 동작
        }
      }
    }

    const nextMessages = [
      ...messages,
      {
        role: "user",
        content: trimmed,
        ...(options?.hiddenFromUi ? { hiddenFromUi: true } : {})
      }
    ];
    setMessages(nextMessages);
    setInput("");
    setShowStarterButtons(false);
    setUserCardLift(true);
    setTimeout(() => setUserCardLift(false), 300);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          persona,
          language,
          messages: nextMessages,
          violationCount,
          mission: missionId || null,
          seed: seed || null
        })
      });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      const reply = data.reply ?? "";
      const violation = parseViolationReply(reply);
      if (violation) {
        const content = language === "ko" ? violation.message_ko : (violation.message_id || violation.message_en);
        setMessages((prev) => [...prev, { role: "assistant", content, violationLevel: violation.level }]);
        setViolationCount(violation.level);
        if (violation.level === 3) setLevel3Countdown(3);
      } else {
        const { displayText, corrections } = parseAIResponse(reply);
        if (corrections.length) setAllCorrections((prev) => [...prev, ...corrections]);
        const includesMissionComplete = displayText.includes("[MISSION_COMPLETE]");
        const cleanedDisplay = displayText.replace("[MISSION_COMPLETE]", "").trim();
        const userMsgCount = nextMessages.filter((m) => m.role === "user").length;
        const shouldCompleteMission =
          missionMeta &&
          missionId !== "greeting-friend" &&
          (includesMissionComplete || userMsgCount >= 3);

        const modelAnswerRequest = nextMessages[nextMessages.length - 1]?.content === OGU_MODEL_ANSWER_TOKEN;
        const assistantMsg = {
          role: "assistant",
          content: cleanedDisplay,
          corrections: corrections.length ? corrections : undefined,
          ...(modelAnswerRequest ? { hiddenFromUi: true } : {})
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (shouldCompleteMission) {
          completeMissionFlow([...nextMessages, { role: "assistant", content: cleanedDisplay }]);
        } else if (corrections.length && !modelAnswerRequest) {
          setPendingCorrections(corrections);
        } else {
          setPendingCorrections(null);
        }
      }
    } catch (e) {
      console.error(e);
      if (isInterviewMission) {
        setInterviewResponseTimerPaused(false);
      }
    } finally {
      setIsLoading(false);
    }
  };
  handleSendRef.current = handleSend;

  const handleEndConversation = () => {
    const supabase = getSupabase();
    const id = activeUserIdRef.current;
    if (id && supabase) {
      supabase.from("active_users").delete().eq("id", id).then(() => {});
      activeUserIdRef.current = null;
    }
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("ogu-chat-history", JSON.stringify(messages));
        window.sessionStorage.setItem("ogu-chat-end", String(Date.now()));
        window.localStorage.setItem("ogu_corrections", JSON.stringify(allCorrections));
      }
    } catch (e) {
      console.error("Failed to store history", e);
    }
    const q = new URLSearchParams({ level, persona, lang: language });
    if (missionId) q.set("mission", missionId);
    router.push(`/report?${q.toString()}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStarterSelect = (text) => {
    setInput(text);
    setShowStarterButtons(false);
    handleSend(text);
  };

  // level 3: 3초 후 메인(/)으로 이동 (한 번만 시작)
  useEffect(() => {
    if (level3Countdown !== 3 || level3CountdownStartedRef.current) return;
    level3CountdownStartedRef.current = true;
    const id = setInterval(() => {
      setLevel3Countdown((c) => {
        if (c == null || c <= 1) {
          clearInterval(id);
          router.push("/");
          return null;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [level3Countdown, router]);

  const levelLabel =
    level === "beginner"
      ? language === "ko" ? "왕초보" : language === "id" ? "Pemula" : "Beginner"
      : level === "elementary"
      ? language === "ko" ? "초급" : language === "id" ? "Dasar" : "Elementary"
      : language === "ko" ? "중급" : language === "id" ? "Menengah" : "Intermediate";

  const lastMsg = messages[messages.length - 1];
  const displayAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && !m.hiddenFromUi) return m;
    }
    return null;
  }, [messages]);

  // OGU 인터뷰: 답변 후 10초 카운트다운 (일시정지 중·0초에서는 감소 없음; 0초일 때만 타임아웃 버튼)
  useEffect(() => {
    if (!isInterviewMission || responseWindowSec === null || responseWindowSec < 1) return;
    if (interviewResponseTimerPaused) return;
    const id = window.setTimeout(() => {
      setResponseWindowSec((s) => (s == null || s < 1 ? s : s - 1));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [isInterviewMission, responseWindowSec, interviewResponseTimerPaused]);

  const handleInterviewModelAnswer = () => {
    setResponseWindowSec(null);
    void handleSend(OGU_MODEL_ANSWER_TOKEN, { hiddenFromUi: true });
  };

  const handleInterviewRetryTimer = () => {
    setResponseWindowSec(10);
    setInterviewResponseTimerPaused(false);
  };

  const visibleChatMessages = useMemo(() => messages.filter((m) => !m.hiddenFromUi), [messages]);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const assistantCount = messages.filter((m) => m.role === "assistant").length;

  /** 남은 시간 5초 이하(5,4,3,2,1)일 때만 질문 키워드 힌트 표시 */
  const interviewHintsToShow = useMemo(() => {
    if (!isInterviewMission || !interviewSessionStarted) return [];
    if (responseWindowSec == null || responseWindowSec > 5 || responseWindowSec < 1) return [];
    if (responseWindowSec === 0) return [];
    const ac = messages.filter((m) => m.role === "assistant").length;
    return getInterviewQuestionTopicHints(Math.max(1, ac));
  }, [isInterviewMission, interviewSessionStarted, responseWindowSec, messages]);
  const pairsComplete = Math.min(userTurns, Math.max(0, assistantCount - 1));

  const isViolationAssistant =
    lastMsg?.role === "assistant" && lastMsg?.violationLevel != null;

  const userBlocked =
    usageLimited ||
    missionCelebration ||
    (pendingCorrections?.length ?? 0) > 0 ||
    (lastMsg?.violationLevel === 3 && level3Countdown != null) ||
    (isInterviewMission && responseWindowSec === 0);

  const canUserType =
    !userBlocked && !isLoading && lastMsg?.role === "assistant";

  const aiSpeakHighlight =
    !isViolationAssistant &&
    (!!pendingCorrections ||
      isLoading ||
      lastMsg?.role === "user" ||
      (messages.length === 0 && isLoading) ||
      (!canUserType && lastMsg?.role === "assistant"));

  const missionStepDisplay = missionMeta
    ? isLoading && lastMsg?.role === "user"
      ? Math.min(userTurns, 3)
      : Math.min(userTurns + 1, 3)
    : 0;

  const aiFadeKey = `${assistantCount}-${(displayAssistant?.content || "").slice(0, 40)}`;

  const turnLabel =
    language === "ko" ? "내 차례예요 💬" : language === "id" ? "Giliran kamu 💬" : "Your turn 💬";
  const inputPlaceholder =
    language === "ko"
      ? "한국어로 답해보세요!"
      : language === "id"
      ? "Balas dalam bahasa Korea!"
      : "Reply in Korean!";
  const correctionDismissLabel =
    language === "ko" ? "이해했어요 👍" : language === "id" ? "Mengerti 👍" : "Got it 👍";
  const missionDoneLabel =
    language === "ko" ? "🎉 미션 완료!" : language === "id" ? "🎉 Misi selesai!" : "🎉 Mission complete!";
  const missionCompleteTitle =
    missionMeta?.completion
      ? language === "ko"
        ? missionMeta.completion.ko
        : language === "id"
        ? missionMeta.completion.id
        : missionMeta.completion.en
      : missionDoneLabel;
  const missionStatTurnsLabel =
    language === "ko" ? "대화 횟수" : language === "id" ? "Jumlah percakapan" : "Conversation turns";
  const missionStatHintsLabel =
    language === "ko" ? "힌트 사용" : language === "id" ? "Petunjuk digunakan" : "Hints used";
  const missionRetryLabel =
    language === "ko" ? "다시 도전" : language === "id" ? "Coba lagi" : "Try again";
  const missionHomeLabel =
    language === "ko" ? "홈으로" : language === "id" ? "Beranda" : "Home";
  const interviewApiLoadingLabel =
    language === "ko"
      ? "OGU가 답하는 중…"
      : language === "id"
      ? "OGU sedang menjawab…"
      : "OGU is replying…";

  return (
    <main className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-[#F9FAFB] text-[#0F172A] max-sm:h-[100dvh] max-sm:max-h-[100dvh]">
      {showMicPermissionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mic-permission-title"
        >
          <div className="w-full max-w-md rounded-3xl border border-[#E5E7EB] bg-[#FFFFFF] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.12)]">
            <h2 id="mic-permission-title" className="mb-3 text-lg font-bold text-[#0F172A]">
              🎤 {language === "ko" ? "마이크 권한이 필요해요" : language === "id" ? "Akses mikrofon diperlukan" : "Microphone Access Required"}
            </h2>
            <p className="mb-2 text-sm font-semibold text-[#B91C1C]">
              {language === "ko"
                ? "마이크 권한을 허용해주세요"
                : language === "id"
                ? "Izinkan akses mikrofon"
                : "Please allow microphone access"}
            </p>
            <p className="mb-5 text-sm leading-relaxed text-[#0F172A]">
              {language === "ko"
                ? "음성 대화를 사용하려면 마이크 접근을 허용해주세요. 브라우저 주소창 왼쪽 🔒 아이콘을 클릭하고 마이크를 '허용'으로 변경해주세요."
                : language === "id"
                ? "Untuk menggunakan obrolan suara, izinkan akses mikrofon. Klik ikon 🔒 di bilah alamat browser dan setel mikrofon ke 'Izinkan'."
                : "To use voice chat, please allow microphone access. Click the 🔒 icon in your browser's address bar and set microphone to 'Allow'."}
            </p>
            <button
              type="button"
              onClick={() => {
                setShowMicPermissionModal(false);
                setMicPermissionHint(null);
              }}
              className="w-full rounded-2xl bg-[#4F46E5] py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.35)] transition hover:bg-[#4338CA] active:scale-[0.98]"
            >
              {language === "ko" ? "알겠어요!" : language === "id" ? "Mengerti!" : "Got it!"}
            </button>
          </div>
        </div>
      )}

      {missionCelebration && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mission-complete-title"
        >
          <div className="w-full max-w-[320px] rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
            <h2
              id="mission-complete-title"
              className="text-center text-base font-bold leading-snug text-[#0F172A]"
            >
              {missionCompleteTitle}
            </h2>
            {missionCompleteStats && (
              <div className="mt-4 space-y-2 rounded-xl bg-[#F8FAFC] px-3 py-3 text-center text-sm text-[#64748B]">
                <p>
                  <span className="font-medium text-[#475569]">{missionStatTurnsLabel}</span>
                  <span className="mx-1 text-[#CBD5E1]">·</span>
                  <span className="tabular-nums font-semibold text-[#0F172A]">
                    {missionCompleteStats.userTurns}
                    {language === "ko" ? "회" : language === "id" ? " kali" : " turns"}
                  </span>
                </p>
                <p>
                  <span className="font-medium text-[#475569]">{missionStatHintsLabel}</span>
                  <span className="mx-1 text-[#CBD5E1]">·</span>
                  <span className="tabular-nums font-semibold text-[#0F172A]">
                    {missionCompleteStats.hintsUsed}
                    {language === "ko" ? "회" : language === "id" ? " kali" : " times"}
                  </span>
                </p>
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleMissionCompleteRetry}
                className="flex-1 rounded-xl border border-[#E5E7EB] bg-white py-2.5 text-sm font-semibold text-[#475569] transition hover:bg-[#F8FAFC] active:scale-[0.98]"
              >
                {missionRetryLabel}
              </button>
              <button
                type="button"
                onClick={handleMissionCompleteHome}
                className="flex-1 rounded-xl bg-[#4F46E5] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338CA] active:scale-[0.98]"
              >
                {missionHomeLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상단 헤더 */}
      <header className="shrink-0 border-b border-[#E5E7EB] bg-white px-3 py-2.5 max-sm:px-3 max-sm:py-2">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-lg">
                {personaMeta.emoji}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#0F172A]">
                  {missionMeta
                    ? language === "ko"
                      ? missionMeta.title.ko
                      : language === "id"
                      ? missionMeta.title.id
                      : missionMeta.title.en
                    : personaMeta.name}
                </p>
                <p className="truncate text-[11px] text-[#64748B]">
                  {missionMeta ? (personaMeta.subtitle ?? levelLabel) : personaMeta.subtitle ?? levelLabel}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <div className="flex rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-0.5 text-[10px] font-semibold">
                {["ko", "en", "id"].map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      const p = new URLSearchParams(searchParams.toString());
                      p.set("lang", code);
                      router.replace(`${pathname}?${p.toString()}`);
                    }}
                    className={`rounded-md px-2 py-1 uppercase transition ${
                      language === code ? "bg-[#4F46E5] text-white" : "text-[#64748B] hover:bg-[#EEF2FF]"
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium ${
                  isMuted
                    ? "border-[#E5E7EB] bg-white text-[#64748B]"
                    : "border-[#4F46E5] bg-[#EEF2FF] text-[#4F46E5]"
                }`}
                title={
                  isMuted
                    ? language === "ko"
                      ? "음성 켜기"
                      : language === "id"
                      ? "Nyalakan suara"
                      : "Turn on voice"
                    : language === "ko"
                    ? "음성 끄기"
                    : language === "id"
                    ? "Matikan suara"
                    : "Mute voice"
                }
              >
                {isMuted ? "🔇" : "🔊"}
              </button>
              <button
                type="button"
                onClick={() => {
                  hintsUsedCountRef.current += 1;
                  setShowHints((v) => !v);
                  trackUseHint();
                }}
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium ${
                  showHints
                    ? "border-[#4F46E5] bg-[#EEF2FF] text-[#4F46E5]"
                    : "border-[#E5E7EB] bg-white text-[#64748B]"
                }`}
              >
                👀
              </button>
              <button
                type="button"
                onClick={handleEndConversation}
                className="rounded-lg border border-[#FEE2E2] bg-[#FEF2F2] px-2.5 py-1.5 text-[11px] font-semibold text-[#DC2626] active:scale-[0.98]"
              >
                {missionMeta
                  ? language === "ko"
                    ? "종료"
                    : language === "id"
                    ? "Selesai"
                    : "End"
                  : language === "ko"
                  ? "대화 끝내기"
                  : language === "id"
                  ? "Akhiri"
                  : "End chat"}
              </button>
            </div>
          </div>

          {missionMeta && (
            <div className="space-y-1">
              {isInterviewMission ? (
                <>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B]">
                    <span>
                      {language === "ko"
                        ? "남은 시간"
                        : language === "id"
                        ? "Sisa waktu"
                        : "Time left"}
                    </span>
                    <span className="tabular-nums text-[#4F46E5]">
                      {interviewSessionStarted && interviewMissionSecondsLeft != null
                        ? `${Math.floor(interviewMissionSecondsLeft / 60)}:${String(
                            interviewMissionSecondsLeft % 60
                          ).padStart(2, "0")}`
                        : "—"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                    <div
                      className="h-full rounded-full bg-[#4F46E5] transition-all duration-300 ease-out"
                      style={{
                        width: `${
                          interviewSessionStarted &&
                          interviewMissionSecondsLeft != null &&
                          (missionMeta.timerSeconds ?? 60) > 0
                            ? (interviewMissionSecondsLeft / (missionMeta.timerSeconds ?? 60)) * 100
                            : 0
                        }%`
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B]">
                    <span>
                      Step {missionStepDisplay} / 3
                    </span>
                    {missionSteps[missionStepDisplay - 1] && (
                      <span className="ml-2 max-w-[55%] truncate text-[10px] font-normal">
                        {missionSteps[missionStepDisplay - 1]}
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                    <div
                      className="h-full rounded-full bg-[#4F46E5] transition-all duration-300 ease-out"
                      style={{ width: `${(missionStepDisplay / 3) * 100}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {isInterviewMission && !interviewSessionStarted ? (
        <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center overflow-hidden px-6 pb-8 pt-2">
          <div className="w-full max-w-md rounded-3xl border border-[#E5E7EB] bg-white p-8 text-center shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
            <div className="mb-4 text-5xl">🎤</div>
            <p className="mb-6 text-base font-medium leading-relaxed text-[#0F172A]">
              {language === "ko"
                ? "안녕하세요! 저는 케이팝 아티스트 OGU예요. 인터뷰 시작해볼까요? 🎤"
                : language === "id"
                ? "Halo! Aku OGU, artis solo K-pop. Mulai wawancara yuk? 🎤"
                : "Hi! I'm OGU, a K-pop solo artist. Shall we start the interview? 🎤"}
            </p>
            <button
              type="button"
              onClick={beginInterviewSession}
              className="w-full rounded-2xl bg-[#4F46E5] py-4 text-base font-bold text-white shadow-[0_8px_24px_rgba(79,70,229,0.35)] transition hover:bg-[#4338CA] active:scale-[0.99]"
            >
              {language === "ko" ? "인터뷰 시작" : language === "id" ? "Mulai wawancara" : "Start interview"}
            </button>
          </div>
        </div>
      ) : isInterviewMission && interviewSessionStarted ? (
        <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden px-3 pb-3 pt-2 max-sm:min-h-0 max-sm:flex-1 max-sm:gap-3 max-sm:px-3 max-sm:pb-[max(4px,env(safe-area-inset-bottom))] max-sm:pt-2">
          <div className="flex max-h-[28vh] min-h-0 shrink-0 flex-col gap-2 overflow-y-auto max-sm:max-h-[min(24vh,32%)] max-sm:min-h-0 max-sm:gap-3 max-sm:overflow-y-auto max-sm:[-webkit-overflow-scrolling:touch]">
            {pendingCorrections && pendingCorrections.length > 0 && (
              <div className="animate-correction-slide-up rounded-xl border-2 border-[#D97706] bg-[#FFFBEB] p-4 shadow-sm">
                <p className="mb-2 text-sm font-semibold leading-[1.8] text-[#92400E]">
                  ✏️ {language === "ko" ? "교정" : language === "id" ? "Koreksi" : "Correction"}
                </p>
                <div className="mb-3 max-h-[18vh] space-y-2 overflow-y-auto">
                  {pendingCorrections.map((c, cIdx) => (
                    <div key={cIdx} className="rounded-lg bg-white/70 px-3 py-2">
                      <p className="mb-1 korean-text text-sm leading-snug text-[#DC2626] line-through">
                        {c.original ?? ""}
                      </p>
                      <p className="mb-1 korean-text text-sm font-bold leading-snug text-[#16A34A]">
                        {c.corrected ?? ""}
                      </p>
                      <p className="text-xs leading-snug text-[#64748B]">
                        {language === "ko"
                          ? c.explanation_ko ?? c.explanation_en
                          : language === "id"
                          ? c.explanation_id ?? c.explanation_en
                          : c.explanation_en ?? c.explanation_ko}
                      </p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPendingCorrections(null)}
                  className="w-full rounded-xl bg-[#D97706] py-2.5 text-sm font-semibold text-white"
                >
                  {correctionDismissLabel}
                </button>
              </div>
            )}
            <div
              className={`rounded-2xl border p-3 shadow-sm ${
                isViolationAssistant
                  ? lastMsg.violationLevel === 1
                    ? "border-[#D97706] bg-[#FFFBEB]"
                    : "border-[#DC2626] bg-[#FEF2F2]"
                  : "border-[#E5E7EB] bg-[#F8FAFC]"
              }`}
            >
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">OGU</p>
              {displayAssistant?.content ? (
                <div key={aiFadeKey} className="origin-top scale-[0.94] animate-chat-ai-fade">
                  {isViolationAssistant ? (
                    <div>
                      {renderAiMessageCard(displayAssistant.content, showHints, "violation")}
                      {lastMsg?.violationLevel === 3 && level3Countdown != null && (
                        <p className="mt-2 text-sm font-medium text-[#0F172A] max-sm:text-left">
                          {language === "ko"
                            ? `${level3Countdown}초 후 대화가 종료됩니다...`
                            : language === "id"
                            ? `Percakapan berakhir dalam ${level3Countdown} detik...`
                            : `Ending in ${level3Countdown} seconds...`}
                        </p>
                      )}
                    </div>
                  ) : (
                    renderAiMessageCard(displayAssistant.content, showHints, "muted")
                  )}
                </div>
              ) : isLoading && messages.length === 0 ? (
                <div className="flex justify-center gap-1 py-4 text-[#94A3B8]">
                  <span className="animate-pulse-soft">·</span>
                  <span className="animate-pulse-soft" style={{ animationDelay: "150ms" }}>
                    ·
                  </span>
                  <span className="animate-pulse-soft" style={{ animationDelay: "300ms" }}>
                    ·
                  </span>
                </div>
              ) : null}
              {responseWindowSec != null && responseWindowSec > 0 && interviewSessionStarted && (
                <p className="mt-2 text-center text-sm font-bold tabular-nums text-[#4F46E5]">
                  {interviewResponseTimerPaused
                    ? language === "ko"
                      ? "일시정지"
                      : language === "id"
                      ? "Dijeda"
                      : "Paused"
                    : language === "ko"
                    ? `답할 수 있는 시간 ${responseWindowSec}초`
                    : language === "id"
                    ? `Waktu: ${responseWindowSec} dtk`
                    : `${responseWindowSec}s left to reply`}
                </p>
              )}
              {interviewHintsToShow.length > 0 && (
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {interviewHintsToShow.map((h, i) => (
                    <span
                      key={`${h.word}-${i}`}
                      className="rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-2.5 py-1 text-xs font-medium text-[#3730A3]"
                    >
                      {h.word}{" "}
                      <span className="text-[10px] font-normal text-[#6366F1]">({h.romaja})</span>
                    </span>
                  ))}
                </div>
              )}
              {responseWindowSec === 0 && interviewSessionStarted && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleInterviewModelAnswer}
                    className="flex-1 rounded-xl bg-[#4F46E5] py-2.5 text-sm font-semibold text-white shadow-md"
                  >
                    {language === "ko"
                      ? "모범 답변 보기"
                      : language === "id"
                      ? "Lihat contoh"
                      : "Show model answer"}
                  </button>
                  <button
                    type="button"
                    onClick={handleInterviewRetryTimer}
                    className="flex-1 rounded-xl border border-[#E5E7EB] bg-white py-2.5 text-sm font-semibold text-[#0F172A]"
                  >
                    {language === "ko" ? "다시 시도" : language === "id" ? "Coba lagi" : "Try again"}
                  </button>
                </div>
              )}
            </div>
            {visibleChatMessages.length > 0 && (
              <div className="rounded-lg border border-[#E5E7EB] bg-white/80 px-2 py-1.5 text-[10px] text-[#64748B]">
                <p className="mb-0.5 font-semibold text-[#94A3B8]">
                  {language === "ko" ? "대화" : language === "id" ? "Log" : "Log"}
                </p>
                <div className="max-h-12 overflow-y-auto leading-tight">
                  {visibleChatMessages.slice(-8).map((m, idx) => (
                    <div key={idx} className="truncate">
                      {m.role === "user" ? "You: " : "OGU: "}
                      {(m.content || "").slice(0, 80)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-1 max-sm:hidden">
            <div className="text-[clamp(3.5rem,16vw,6.5rem)] leading-none drop-shadow-sm">🎤</div>
          </div>
          <div
            className="mt-auto shrink-0 space-y-2 pb-2 max-sm:mt-0 max-sm:w-full max-sm:space-y-3 max-sm:border-t max-sm:border-[#E5E7EB] max-sm:bg-[#F9FAFB] max-sm:px-3 max-sm:pb-[max(4px,env(safe-area-inset-bottom))] max-sm:pt-3"
          >
            {isRecording && (
              <p className="text-center text-sm font-medium text-[#C53030]">
                {language === "ko" ? "듣고 있어요…" : language === "id" ? "Mendengarkan…" : "Listening…"}
              </p>
            )}
            {isLoading && lastMsg?.role === "user" && interviewSessionStarted && !isRecording && (
              <div className="flex flex-col items-center gap-1.5 py-1">
                <p className="text-center text-sm font-medium text-[#64748B]">{interviewApiLoadingLabel}</p>
                <div className="flex items-center gap-1 text-xl font-bold text-[#94A3B8]">
                  <span className="animate-pulse-soft">·</span>
                  <span className="animate-pulse-soft" style={{ animationDelay: "150ms" }}>
                    ·
                  </span>
                  <span className="animate-pulse-soft" style={{ animationDelay: "300ms" }}>
                    ·
                  </span>
                </div>
              </div>
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (isOnboarding && e.target.value.trim().length > 0) setShowStarterButtons(false);
              }}
              onKeyDown={handleKeyDown}
              placeholder={inputPlaceholder}
              disabled={!canUserType || usageLimited}
              className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 max-sm:px-3"
            />
            <button
              type="button"
              disabled={!input.trim() || isLoading || !canUserType || usageLimited}
              onClick={() => handleSend()}
              className="h-11 w-full rounded-xl bg-[#4F46E5] text-sm font-bold text-white shadow-md transition hover:bg-[#4338CA] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#94A3B8]"
            >
              {language === "ko" ? "전송" : language === "id" ? "Kirim" : "Send"}
            </button>
            {micPermissionHint && (
              <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-left text-xs font-medium text-[#B91C1C] max-sm:text-[11px]">
                {micPermissionHint}
              </p>
            )}
            <button
              type="button"
              disabled={
                !canUserType ||
                isLoading ||
                responseWindowSec === 0 ||
                !getSpeechRecognition() ||
                usageLimited ||
                isRequestingPermission
              }
              onTouchStart={onInterviewMicTouchStart}
              onTouchEnd={onInterviewMicTouchEnd}
              onTouchCancel={onInterviewMicTouchEnd}
              onPointerDown={(e) => {
                e.preventDefault();
                void startInterviewMic();
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                endInterviewMic();
              }}
              onPointerCancel={() => endInterviewMic()}
              onPointerLeave={(e) => {
                if (e.buttons === 0 && isRecording) endInterviewMic();
              }}
              className={`flex h-28 w-full touch-manipulation select-none items-center justify-center rounded-[2rem] text-4xl shadow-[0_12px_32px_rgba(79,70,229,0.25)] transition active:scale-[0.98] max-sm:h-20 max-sm:rounded-3xl max-sm:text-3xl ${
                isRecording
                  ? "bg-[#C53030] text-white ring-4 ring-[#FECACA]"
                  : "bg-gradient-to-b from-[#A5B4FC] to-[#4F46E5] text-white"
              } disabled:cursor-not-allowed disabled:opacity-35 disabled:grayscale`}
            >
              {isRequestingPermission ? (
                <span className="h-9 w-9 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                "🎤"
              )}
            </button>
            <p className="px-0 text-center text-[11px] leading-snug text-[#64748B] max-sm:text-left">
              {language === "ko"
                ? "버튼을 누른 채 한국어로 말하고, 손을 떼면 전송돼요"
                : language === "id"
                ? "Tahan tombol, berbicara bahasa Korea, lepas untuk kirim"
                : "Hold the button, speak Korean, release to send"}
            </p>
          </div>
        </div>
      ) : (
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden px-3 pb-3 pt-2 max-sm:min-h-0 max-sm:flex-1 max-sm:gap-3 max-sm:px-3 max-sm:pb-[max(4px,env(safe-area-inset-bottom))] max-sm:pt-2">
        {/* 위: AI 카드 + 교정 */}
        <div className="flex min-h-0 flex-[45] flex-col gap-2 overflow-hidden max-sm:max-h-[min(38vh,44%)] max-sm:flex-none max-sm:gap-3">
          <div
            className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl p-5 shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-colors duration-300 max-sm:p-3 max-sm:shadow-[0_8px_20px_rgba(0,0,0,0.06)] ${
              isViolationAssistant
                ? lastMsg.violationLevel === 1
                  ? "border-2 border-[#D97706] bg-[#FFFBEB]"
                  : "border-2 border-[#DC2626] bg-[#FEF2F2]"
                : aiSpeakHighlight
                ? "border-0 bg-[#4F46E5]"
                : "border border-solid border-[#E5E7EB] bg-[#F8FAFC]"
            }`}
          >
            <span className="absolute left-3 top-3 text-lg leading-none max-sm:left-3 max-sm:top-3 max-sm:text-base">🐥</span>
            <div className="mt-7 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5 max-sm:mt-6 max-sm:pr-0">
              {displayAssistant?.content ? (
                <div key={aiFadeKey} className="animate-chat-ai-fade">
                  {isViolationAssistant ? (
                    <div>
                      {renderAiMessageCard(displayAssistant.content, showHints, "violation")}
                      {lastMsg?.violationLevel === 3 && level3Countdown != null && (
                        <p className="mt-3 text-base font-medium leading-[1.8] text-[#0F172A] max-sm:mt-2 max-sm:text-left max-sm:text-sm">
                          {language === "ko"
                            ? `${level3Countdown}초 후 대화가 종료됩니다...`
                            : language === "id"
                            ? `Percakapan berakhir dalam ${level3Countdown} detik...`
                            : `Ending in ${level3Countdown} seconds...`}
                        </p>
                      )}
                    </div>
                  ) : (
                    renderAiMessageCard(
                      displayAssistant.content,
                      showHints,
                      aiSpeakHighlight ? "indigo" : "muted"
                    )
                  )}
                </div>
              ) : isLoading && messages.length === 0 ? (
                <div className="flex h-full items-center justify-center gap-1 text-[#94A3B8]">
                  <span className="animate-pulse-soft">·</span>
                  <span className="animate-pulse-soft" style={{ animationDelay: "150ms" }}>
                    ·
                  </span>
                  <span className="animate-pulse-soft" style={{ animationDelay: "300ms" }}>
                    ·
                  </span>
                </div>
              ) : (
                <p className="text-sm text-[#94A3B8]"> </p>
              )}
            </div>
          </div>

          {pendingCorrections && pendingCorrections.length > 0 && (
            <div className="animate-correction-slide-up shrink-0 rounded-xl border-2 border-[#D97706] bg-[#FFFBEB] p-5 shadow-sm max-sm:max-h-[22vh] max-sm:overflow-y-auto max-sm:p-3">
              <p className="mb-3 text-base font-semibold leading-[1.8] text-[#92400E] max-sm:mb-2 max-sm:text-sm">
                ✏️ {language === "ko" ? "교정" : language === "id" ? "Koreksi" : "Correction"}
              </p>
              <div className="mb-4 max-h-[24vh] space-y-3 overflow-hidden">
                {pendingCorrections.map((c, cIdx) => (
                  <div key={cIdx} className="rounded-lg bg-white/70 px-4 py-3">
                    <p className="mb-2 korean-text text-base leading-[1.8] text-[#DC2626] line-through">
                      {c.original ?? ""}
                    </p>
                    <p className="mb-2 korean-text text-base font-bold leading-[1.8] text-[#16A34A]">
                      {c.corrected ?? ""}
                    </p>
                    <p className="mt-2 text-base leading-[1.8] text-[#64748B]">
                      {language === "ko"
                        ? c.explanation_ko ?? c.explanation_en
                        : language === "id"
                        ? c.explanation_id ?? c.explanation_en
                        : c.explanation_en ?? c.explanation_ko}
                    </p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPendingCorrections(null)}
                className="w-full rounded-xl bg-[#D97706] py-3 text-base font-semibold leading-[1.8] text-white shadow-sm transition hover:bg-[#B45309] active:scale-[0.99]"
              >
                {correctionDismissLabel}
              </button>
            </div>
          )}
        </div>

        {/* 중간: 진행 */}
        <div className="flex min-h-0 flex-[10] flex-col items-center justify-center gap-1 px-2 max-sm:w-full max-sm:shrink-0 max-sm:flex-none max-sm:gap-1.5 max-sm:px-0 max-sm:py-0">
          {missionMeta ? (
            <>
              <span className="text-base font-bold tabular-nums leading-[1.8] text-[#0F172A]">
                {missionStepDisplay} / 3
              </span>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full transition-colors duration-300"
                    style={{
                      backgroundColor: i <= pairsComplete ? "#4F46E5" : "#E5E7EB"
                    }}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="h-px w-2/3 rounded-full bg-[#E5E7EB]" />
          )}
        </div>

        {/* 아래: 유저 카드 */}
        <div
          className={`mt-auto flex min-h-0 flex-[45] flex-col overflow-hidden rounded-2xl transition-all duration-300 ease-out max-sm:mt-0 max-sm:min-h-0 max-sm:flex-1 max-sm:shrink-0 ${
            userCardLift ? "animate-chat-card-lift" : ""
          } ${
            canUserType && !usageLimited
              ? "border-2 border-[#4F46E5] bg-white shadow-[0_8px_28px_rgba(79,70,229,0.12)]"
              : "border border-[#E5E7EB] bg-[#F8FAFC]"
          }`}
        >
          {canUserType && !usageLimited ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 max-sm:min-h-0 max-sm:flex-1 max-sm:gap-3 max-sm:p-3 max-sm:pb-2">
              {micPermissionHint && (
                <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-left text-[11px] font-medium leading-snug text-[#B91C1C]">
                  {micPermissionHint}
                </p>
              )}
              <p className="text-center text-[12px] font-semibold text-[#4F46E5] max-sm:text-left max-sm:text-[11px]">
                {turnLabel}
              </p>
              {showStarterButtons && (
                <div className="flex gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
                  {starterMessages.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => handleStarterSelect(starter)}
                      className="shrink-0 rounded-full border border-[#4F46E5] bg-[#EEF2FF] px-3 py-1.5 text-[12px] font-medium text-[#4F46E5]"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              )}
              {isRecording && (
                <div className="flex items-center justify-start gap-1.5 text-base leading-[1.8] text-[#C53030] max-sm:text-sm">
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#C53030]" />
                  {language === "ko" ? "녹음 중..." : language === "id" ? "Merekam..." : "Recording..."}
                </div>
              )}
              <div className="flex min-h-0 flex-1 flex-col gap-3 max-sm:min-h-0 max-sm:gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (isOnboarding && e.target.value.trim().length > 0) setShowStarterButtons(false);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={inputPlaceholder}
                  className="min-h-[48px] w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-base leading-[1.8] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 max-sm:min-h-[42px] max-sm:px-3 max-sm:py-2.5 max-sm:text-sm"
                />
                <div className="mt-auto flex w-full shrink-0 items-stretch gap-3 max-sm:mt-0">
                  <button
                    type="button"
                    disabled={!input.trim() || isLoading}
                    onClick={() => handleSend()}
                    className="flex min-h-[48px] min-w-0 flex-1 items-center justify-center rounded-xl bg-[#4F46E5] text-base font-semibold leading-[1.8] text-white shadow-[0_8px_24px_rgba(79,70,229,0.3)] transition disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#94A3B8] disabled:shadow-none hover:bg-[#4338CA] active:scale-[0.98] max-sm:min-h-[42px] max-sm:text-sm"
                  >
                    {language === "ko" ? "전송" : language === "id" ? "Kirim" : "Send"}
                  </button>
                  <button
                    type="button"
                    onClick={onVoiceMicClick}
                    onTouchStart={onVoiceMicTouchStart}
                    onTouchEnd={onVoiceMicTouchEnd}
                    disabled={!getSpeechRecognition() || isRequestingPermission}
                    className={`touch-manipulation flex min-h-[48px] min-w-[48px] shrink-0 select-none items-center justify-center rounded-xl transition active:scale-[0.98] max-sm:min-h-[42px] max-sm:min-w-[42px] max-sm:shrink-0 ${
                      isRequestingPermission
                        ? "border border-[#E5E7EB] bg-[#F1F5F9] text-[#64748B]"
                        : isRecording
                        ? "bg-[#C53030] text-white shadow-[0_0_0_3px_rgba(197,48,48,0.3)] animate-pulse"
                        : "border border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
                    }`}
                    title={
                      language === "ko"
                        ? isRecording
                          ? "녹음 중지"
                          : isRequestingPermission
                          ? "권한 요청 중..."
                          : "음성 입력"
                        : language === "id"
                        ? isRecording
                          ? "Stop rekam"
                          : isRequestingPermission
                          ? "Meminta izin..."
                          : "Input suara"
                        : isRecording
                        ? "Stop recording"
                        : isRequestingPermission
                        ? "Requesting permission..."
                        : "Voice input"
                    }
                  >
                    {isRequestingPermission ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#4F46E5] border-t-transparent" />
                    ) : (
                      "🎤"
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : usageLimited ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
              <p className="text-sm font-medium text-[#991B1B]">
                {language === "ko"
                  ? "오늘의 무료 연습 5회를 모두 사용했어요 🐥"
                  : language === "id"
                  ? "Sesi gratis hari ini sudah habis 🐥"
                  : "You've used all 5 free sessions today 🐥"}
              </p>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-xl bg-[#4F46E5] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#4338CA]"
              >
                {language === "ko" ? "홈으로" : language === "id" ? "Beranda" : "Home"}
              </button>
            </div>
          ) : pendingCorrections?.length > 0 && lastMsg?.role === "assistant" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-5 text-center">
              <p className="text-base font-medium leading-[1.8] text-[#64748B]">
                {language === "ko"
                  ? "위 교정을 확인한 뒤 계속해 주세요"
                  : language === "id"
                  ? "Periksa koreksi di atas untuk melanjutkan"
                  : "Check the correction above to continue"}
              </p>
            </div>
          ) : isLoading && lastMsg?.role === "user" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 overflow-hidden p-4">
              {lastMsg?.content && (
                <p className="line-clamp-3 w-full text-center text-base leading-[1.8] text-[#64748B] korean-text">
                  {lastMsg.content}
                </p>
              )}
              <div className="flex items-center gap-1 text-xl font-bold text-[#94A3B8]">
                <span className="animate-pulse-soft">·</span>
                <span className="animate-pulse-soft" style={{ animationDelay: "150ms" }}>
                  ·
                </span>
                <span className="animate-pulse-soft" style={{ animationDelay: "300ms" }}>
                  ·
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-4">
              <div className="flex items-center gap-1 text-xl font-bold text-[#94A3B8]">
                <span className="animate-pulse-soft">·</span>
                <span className="animate-pulse-soft" style={{ animationDelay: "150ms" }}>
                  ·
                </span>
                <span className="animate-pulse-soft" style={{ animationDelay: "300ms" }}>
                  ·
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <main className="flex h-[100dvh] max-h-[100dvh] items-center justify-center overflow-hidden bg-[#F9FAFB] text-[#0F172A]">
          <span className="animate-pulse-soft">🐥</span>
        </main>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
