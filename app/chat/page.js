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

function stripHints(text, enabled) {
  if (enabled) return text;
  return text.replace(/\s*\([^)]*\)/g, "");
}

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function getSpeechSynthesis() {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis;
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
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [level3Countdown, setLevel3Countdown] = useState(null);
  const [allCorrections, setAllCorrections] = useState([]);
  const [usageLimited, setUsageLimited] = useState(false);
  const [missionCelebration, setMissionCelebration] = useState(false);
  const [pendingCorrections, setPendingCorrections] = useState(null);
  const [userCardLift, setUserCardLift] = useState(false);
  const [showStarterButtons, setShowStarterButtons] = useState(isOnboarding);

  const recognitionRef = useRef(null);
  const synthesisRef = useRef(getSpeechSynthesis());
  const level3CountdownStartedRef = useRef(false);
  const missionCompleteRef = useRef(false);
  const firstUserSentRef = useRef(false);
  const allCorrectionsRef = useRef([]);

  useEffect(() => {
    allCorrectionsRef.current = allCorrections;
  }, [allCorrections]);

  const personaMeta = useMemo(() => {
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
  }, [persona, language, isPhraseMode]);

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

  const starterMessages = useMemo(() => {
    const map = {
      "greeting-friend": {
        ko: ["안녕하세요!", "오랜만이에요!", "잘 지냈어요?"],
        en: ["Hi there!", "Long time no see!", "How are you?"],
        id: ["Halo!", "Lama tidak jumpa!", "Apa kabar?"]
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

  // STT: SpeechRecognition 초기화 및 이벤트
  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ko-KR";

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript.trim()) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript).trim());
      }
    };

    recognition.onstart = () => {
      setIsRequestingPermission(false);
      setIsRecording(true);
      setShowMicPermissionModal(false);
    };

    recognition.onerror = (event) => {
      setIsRequestingPermission(false);
      if (event.error === "not-allowed" || event.error === "denied") {
        setIsRecording(false);
        setShowMicPermissionModal(true);
      } else if (event.error === "aborted") {
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.abort();
      } catch (_) {}
      recognitionRef.current = null;
      getSpeechSynthesis()?.cancel();
    };
  }, []);

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
          return;
        }
      }
    } catch (_) {}

    setIsRequestingPermission(true);
    try {
      recognition.start();
      trackSendVoice();
    } catch (e) {
      console.warn("SpeechRecognition start failed", e);
      setIsRequestingPermission(false);
      setShowMicPermissionModal(true);
    }
  }, [isRecording]);

  const lastSpokenRef = useRef(null);

  // TTS: 마지막 AI 응답이 바뀌었을 때만 한국어로 읽기 (힌트 제외, 위반 메시지는 읽지 않음)
  useEffect(() => {
    if (isMuted || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last?.role !== "assistant" || !last?.content || last?.violationLevel) return;

    const toSpeak = stripHints(String(last.content), false).trim();
    if (!toSpeak || lastSpokenRef.current === toSpeak) return;
    lastSpokenRef.current = toSpeak;

    const synth = synthesisRef.current;
    if (!synth) return;

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(toSpeak);
    utterance.lang = "ko-KR";
    utterance.rate = 0.9;
    synth.speak(utterance);
  }, [messages, isMuted]);

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
          setMessages([{ role: "assistant", content: displayText, corrections: corrections.length ? corrections : undefined }]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    startConversation();
  }, [level, persona, language]);

  const completeMissionFlow = useCallback(
    (historyMessages) => {
      if (missionCompleteRef.current) return;
      missionCompleteRef.current = true;
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

      setTimeout(() => {
        try {
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem("ogu-chat-history", JSON.stringify(historyMessages));
            window.sessionStorage.setItem("ogu-chat-end", String(Date.now()));
            window.localStorage.setItem("ogu_corrections", JSON.stringify(allCorrectionsRef.current));
          }
        } catch {}
        const q = new URLSearchParams({ level, persona, lang: language });
        if (missionId) q.set("mission", missionId);
        router.push(`/report?${q.toString()}`);
      }, 2000);
    },
    [todayKey, challengeDayParam, level, persona, language, missionId, router]
  );

  const handleSend = async (presetText) => {
    const trimmed = (presetText ?? input).trim();
    if (!trimmed || isLoading) return;

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

    const nextMessages = [...messages, { role: "user", content: trimmed }];
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
          missionMeta && (includesMissionComplete || userMsgCount >= 3);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: cleanedDisplay,
            corrections: corrections.length ? corrections : undefined
          }
        ]);

        if (shouldCompleteMission) {
          completeMissionFlow([...nextMessages, { role: "assistant", content: cleanedDisplay }]);
        } else if (corrections.length) {
          setPendingCorrections(corrections);
        } else {
          setPendingCorrections(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

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
      if (messages[i].role === "assistant") return messages[i];
    }
    return null;
  }, [messages]);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const assistantCount = messages.filter((m) => m.role === "assistant").length;
  const pairsComplete = Math.min(userTurns, Math.max(0, assistantCount - 1));

  const isViolationAssistant =
    lastMsg?.role === "assistant" && lastMsg?.violationLevel != null;

  const userBlocked =
    usageLimited ||
    missionCelebration ||
    (pendingCorrections?.length ?? 0) > 0 ||
    (lastMsg?.violationLevel === 3 && level3Countdown != null);

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

  return (
    <main className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#F9FAFB] text-[#0F172A]">
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
            <p className="mb-5 text-sm leading-relaxed text-[#0F172A]">
              {language === "ko"
                ? "음성 대화를 사용하려면 마이크 접근을 허용해주세요. 브라우저 주소창 왼쪽 🔒 아이콘을 클릭하고 마이크를 '허용'으로 변경해주세요."
                : language === "id"
                ? "Untuk menggunakan obrolan suara, izinkan akses mikrofon. Klik ikon 🔒 di bilah alamat browser dan setel mikrofon ke 'Izinkan'."
                : "To use voice chat, please allow microphone access. Click the 🔒 icon in your browser's address bar and set microphone to 'Allow'."}
            </p>
            <button
              type="button"
              onClick={() => setShowMicPermissionModal(false)}
              className="w-full rounded-2xl bg-[#4F46E5] py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.35)] transition hover:bg-[#4338CA] active:scale-[0.98]"
            >
              {language === "ko" ? "알겠어요!" : language === "id" ? "Mengerti!" : "Got it!"}
            </button>
          </div>
        </div>
      )}

      {missionCelebration && (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#4F46E5] px-4 py-6">
          <div className="flex min-h-0 flex-[45] flex-col items-center justify-center rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.15)]" />
          <div className="flex flex-[10] flex-col items-center justify-center px-2">
            <p className="text-center text-xl font-bold text-white sm:text-2xl">{missionDoneLabel}</p>
          </div>
          <div className="flex min-h-0 flex-[45] flex-col items-center justify-center rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.15)]" />
        </div>
      )}

      {/* 상단 헤더 */}
      <header className="shrink-0 border-b border-[#E5E7EB] bg-white px-3 py-2.5">
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
            </div>
          )}
        </div>
      </header>

      {/* 카드 영역: 45% / 10% / 45% */}
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden px-3 pb-3 pt-2">
        {/* 위: AI 카드 + 교정 */}
        <div className="flex min-h-0 flex-[45] flex-col gap-2 overflow-hidden">
          <div
            className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl p-5 shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-colors duration-300 ${
              isViolationAssistant
                ? lastMsg.violationLevel === 1
                  ? "border-2 border-[#D97706] bg-[#FFFBEB]"
                  : "border-2 border-[#DC2626] bg-[#FEF2F2]"
                : aiSpeakHighlight
                ? "border-0 bg-[#4F46E5]"
                : "border border-solid border-[#E5E7EB] bg-[#F8FAFC]"
            }`}
          >
            <span className="absolute left-3 top-3 text-lg leading-none">🐥</span>
            <div className="mt-7 min-h-0 flex-1 overflow-hidden pr-0.5">
              {displayAssistant?.content ? (
                <div key={aiFadeKey} className="animate-chat-ai-fade">
                  {isViolationAssistant ? (
                    <div>
                      {renderAiMessageCard(displayAssistant.content, showHints, "violation")}
                      {lastMsg?.violationLevel === 3 && level3Countdown != null && (
                        <p className="mt-3 text-base font-medium leading-[1.8] text-[#0F172A]">
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
            <div className="animate-correction-slide-up shrink-0 rounded-xl border-2 border-[#D97706] bg-[#FFFBEB] p-5 shadow-sm">
              <p className="mb-3 text-base font-semibold leading-[1.8] text-[#92400E]">
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
        <div className="flex min-h-0 flex-[10] flex-col items-center justify-center gap-1 px-2">
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
          className={`flex min-h-0 flex-[45] flex-col overflow-hidden rounded-2xl transition-all duration-300 ease-out ${
            userCardLift ? "animate-chat-card-lift" : ""
          } ${
            canUserType && !usageLimited
              ? "border-2 border-[#4F46E5] bg-white shadow-[0_8px_28px_rgba(79,70,229,0.12)]"
              : "border border-[#E5E7EB] bg-[#F8FAFC]"
          }`}
        >
          {canUserType && !usageLimited ? (
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <p className="mb-2 text-center text-[12px] font-semibold text-[#4F46E5]">{turnLabel}</p>
              {showStarterButtons && (
                <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
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
                <div className="mb-2 flex items-center justify-center gap-1.5 text-base leading-[1.8] text-[#C53030]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#C53030]" />
                  {language === "ko" ? "녹음 중..." : language === "id" ? "Merekam..." : "Recording..."}
                </div>
              )}
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (isOnboarding && e.target.value.trim().length > 0) setShowStarterButtons(false);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={inputPlaceholder}
                  className="min-h-[48px] w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-base leading-[1.8] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20"
                />
                <div className="mt-auto flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!input.trim() || isLoading}
                    onClick={() => handleSend()}
                    className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[#4F46E5] text-base font-semibold leading-[1.8] text-white shadow-[0_8px_24px_rgba(79,70,229,0.3)] transition disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#94A3B8] disabled:shadow-none hover:bg-[#4338CA] active:scale-[0.98]"
                  >
                    {language === "ko" ? "전송" : language === "id" ? "Kirim" : "Send"}
                  </button>
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={!getSpeechRecognition() || isRequestingPermission}
                    className={`flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl transition active:scale-[0.98] ${
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
