"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

function renderAssistantContent(text, showHints) {
  if (!text) return null;
  if (!showHints) {
    return stripHints(text, false);
  }

  const parts = text.split(/(\([^)]*\))/g);

  return parts.map((part, index) => {
    if (!part) return null;
    const isTranslation = part.startsWith("(") && part.endsWith(")");

    if (isTranslation) {
      return (
        <span
          key={index}
          className="block text-[11px] font-medium text-[#64748B]"
        >
          {part}
        </span>
      );
    }

    return (
      <span key={index} className="block">
        {part.trim()}
      </span>
    );
  });
}

function ChatContent() {
  const router = useRouter();
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
  const [correctionCollapsed, setCorrectionCollapsed] = useState({});
  const [usageLimited, setUsageLimited] = useState(false);
  const [showMissionCompleteModal, setShowMissionCompleteModal] = useState(false);
  const [showStarterButtons, setShowStarterButtons] = useState(isOnboarding);

  const recognitionRef = useRef(null);
  const synthesisRef = useRef(getSpeechSynthesis());
  const level3CountdownStartedRef = useRef(false);
  const missionCompleteRef = useRef(false);
  const firstUserSentRef = useRef(false);

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
        setMessages((prev) => [...prev, { role: "assistant", content: displayText.replace("[MISSION_COMPLETE]", "").trim(), corrections: corrections.length ? corrections : undefined }]);

        if (missionMeta && includesMissionComplete && !missionCompleteRef.current) {
          missionCompleteRef.current = true;
          setShowMissionCompleteModal(true);
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
                window.sessionStorage.setItem("ogu-chat-history", JSON.stringify([...nextMessages, { role: "assistant", content: displayText }]));
                window.sessionStorage.setItem("ogu-chat-end", String(Date.now()));
                window.localStorage.setItem("ogu_corrections", JSON.stringify(allCorrections));
              }
            } catch {}
            router.push(`/report?level=${level}&persona=${persona}&lang=${language}`);
          }, 2000);
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
    router.push(`/report?level=${level}&persona=${persona}&lang=${language}`);
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

  const userTurns = messages.filter((m) => m.role === "user").length;
  const currentStep =
    userTurns <= 2 ? 1 : userTurns <= 5 ? 2 : 3;

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#F9FAFB] px-3 py-4 sm:px-4 sm:py-6 text-[#0F172A]">
      {/* 마이크 권한 안내 모달 */}
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

      <div className="flex w-full max-w-2xl flex-1 flex-col rounded-3xl border border-[#E5E7EB] bg-[#FFFFFF] shadow-[0_20px_50px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* 헤더 */}
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] bg-[#FFFFFF] px-3 py-3">
          <div className="flex min-w-0 flex-shrink items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EEF2FF] text-xl shadow-sm">
              {personaMeta.emoji}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#0F172A]">
                {personaMeta.name}
              </p>
              <p className="text-[11px] text-[#64748B]">
                {personaMeta.subtitle ?? levelLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              className={`rounded-xl border px-3 py-2 text-[11px] font-medium transition-all duration-200 ${
                isMuted
                  ? "border-[#E5E7EB] bg-[#FFFFFF] text-[#64748B] hover:border-[#CBD5E1]"
                  : "border-[#4F46E5] bg-[#EEF2FF] text-[#4F46E5]"
              }`}
              title={isMuted ? (language === "ko" ? "음성 켜기" : language === "id" ? "Nyalakan suara" : "Turn on voice") : (language === "ko" ? "음성 끄기" : language === "id" ? "Matikan suara" : "Mute voice")}
            >
              {isMuted ? "🔇" : "🔊"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowHints((v) => !v);
                trackUseHint();
              }}
              className={`rounded-xl border px-3 py-2 text-[11px] font-medium transition-all duration-200 ${
                showHints
                  ? "border-[#4F46E5] bg-[#EEF2FF] text-[#4F46E5]"
                  : "border-[#E5E7EB] bg-[#FFFFFF] text-[#64748B] hover:border-[#CBD5E1]"
              }`}
            >
              <span className="sm:hidden">👀</span>
              <span className="hidden sm:inline">
                {language === "ko"
                  ? (showHints ? "힌트 숨기기 👀" : "힌트 보기 👀")
                  : language === "id"
                  ? (showHints ? "Sembunyikan Petunjuk 👀" : "Tampilkan Petunjuk 👀")
                  : (showHints ? "Hide Hints 👀" : "Show Hints 👀")}
              </span>
            </button>
            <button
              type="button"
              onClick={handleEndConversation}
              className="rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-2 text-[11px] font-semibold text-[#DC2626] transition hover:bg-[#F8FAFC] active:scale-[0.98]"
            >
              <span className="sm:hidden">End</span>
              <span className="hidden sm:inline">
                {language === "ko" ? "대화 끝내기" : language === "id" ? "Akhiri Percakapan" : "End Conversation"}
              </span>
            </button>
          </div>
        </header>

        {/* 미션 진행바 */}
        {missionMeta && (
          <div className="border-b border-[#E5E7EB] bg-[#FFFFFF] px-4 py-2">
            <p className="text-[11px] font-semibold text-[#64748B]">
              {language === "ko"
                ? `미션: ${missionMeta.title.ko}`
                : language === "id"
                ? `Misi: ${missionMeta.title.id}`
                : `Mission: ${missionMeta.title.en}`}
            </p>
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center gap-1">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                      step < currentStep
                        ? "bg-[#4F46E5] text-white"
                        : step === currentStep
                        ? "bg-[#4F46E5] text-white"
                        : "bg-[#E5E7EB] text-[#64748B]"
                    }`}
                  >
                    {step}
                  </div>
                  {missionSteps && missionSteps[step - 1] && (
                    <span className="hidden text-[10px] text-[#64748B] sm:inline">
                      {missionSteps[step - 1]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 채팅 영역 */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          {messages.map((m, idx) => {
            const isUser = m.role === "user";
            const content = m.content || "";
            const violationLevel = m.violationLevel;

            const isViolationBubble = !isUser && violationLevel != null;
            const bubbleStyle = isUser
              ? "bg-[#4F46E5] text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)]"
              : isViolationBubble
              ? violationLevel === 1
                ? "border-2 border-[#D97706] bg-[#FFFBEB] text-[#92400E]"
                : violationLevel === 2
                ? "border-2 border-[#DC2626] bg-[#FEF2F2] text-[#991B1B]"
                : "border-2 border-[#DC2626] bg-[#FEF2F2] text-[#991B1B]"
              : "border border-[#E5E7EB] bg-[#FFFFFF] text-[#0F172A] shadow-[0_2px_12px_rgba(0,0,0,0.04)]";

            const hasCorrections = !isUser && !isViolationBubble && m.corrections && m.corrections.length > 0;
            const isCorrectionCollapsed = correctionCollapsed[idx];

            return (
              <div key={idx} className="w-full space-y-2">
                <div
                  className={`animate-bubble-in flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex max-w-[85%] items-end gap-2 sm:max-w-[80%] ${
                      isUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base ${
                        isUser ? "bg-[#4F46E5]" : "bg-[#EEF2FF]"
                      }`}
                    >
                      {isUser ? "👤" : "🐥"}
                    </div>
                    <div
                      className={`korean-text rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${bubbleStyle}`}
                    >
                      {isUser ? content : isViolationBubble ? content : renderAssistantContent(content, showHints)}
                      {isViolationBubble && violationLevel === 3 && level3Countdown != null && (
                        <p className="mt-2 text-[11px] font-medium opacity-90">
                          {language === "ko"
                            ? `${level3Countdown}초 후 대화가 종료됩니다...`
                            : language === "id"
                            ? `Percakapan berakhir dalam ${level3Countdown} detik...`
                            : `Ending in ${level3Countdown} seconds...`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                {hasCorrections && (
                  <div
                    className="animate-bubble-in ml-10 rounded-2xl border-2 px-4 py-3 sm:ml-12"
                    style={{ backgroundColor: "#FFFBEB", borderColor: "#D97706" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-[#0F172A]">
                        ✏️ {language === "ko" ? "교정" : language === "id" ? "Koreksi" : "Correction"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCorrectionCollapsed((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                        className="text-[11px] font-medium text-[#D97706] hover:underline"
                      >
                        {isCorrectionCollapsed
                          ? (language === "ko" ? "펼치기 ▼" : language === "id" ? "Buka ▼" : "Expand ▼")
                          : (language === "ko" ? "접기 ▲" : language === "id" ? "Tutup ▲" : "Collapse ▲")}
                      </button>
                    </div>
                    {!isCorrectionCollapsed && (
                      <div className="mt-2 space-y-2">
                        {m.corrections.map((c, cIdx) => (
                          <div key={cIdx} className="rounded-xl bg-white/60 px-3 py-2">
                            <p className="korean-text text-[12px]">
                              <span className="text-[#DC2626] line-through">{c.original ?? ""}</span>
                              <span className="mx-1.5 text-[#D97706]">→</span>
                              <span className="font-medium text-[#16A34A]">{c.corrected ?? ""}</span>
                            </p>
                            <p className="mt-1 text-[11px] text-[#64748B]">
                              {language === "ko" ? (c.explanation_ko ?? c.explanation_en) : language === "id" ? (c.explanation_id ?? c.explanation_en) : (c.explanation_en ?? c.explanation_ko)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-base animate-pulse-soft">
                  🐥
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl bg-[#EEF2FF] px-4 py-2.5">
                  <span className="h-2 w-2 animate-pulse-soft rounded-full bg-[#4F46E5]/60" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 animate-pulse-soft rounded-full bg-[#4F46E5]/60" style={{ animationDelay: "200ms" }} />
                  <span className="h-2 w-2 animate-pulse-soft rounded-full bg-[#4F46E5]/60" style={{ animationDelay: "400ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 입력창 */}
        <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
          {showStarterButtons && !usageLimited && (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
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
          {usageLimited && (
            <div className="mb-2 rounded-2xl bg-[#FEF2F2] px-3 py-2 text-center text-[12px] text-[#991B1B]">
              {language === "ko"
                ? "오늘의 무료 연습 5회를 모두 사용했어요 🐥 내일 다시 만나요!"
                : language === "id"
                ? "Sesi gratis hari ini sudah habis 🐥 Sampai jumpa besok!"
                : "You've used all 5 free sessions today 🐥 See you tomorrow!"}
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="rounded-xl bg-[#4F46E5] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-[#4338CA]"
                >
                  {language === "ko" ? "홈으로 돌아가기" : language === "id" ? "Kembali ke Beranda" : "Back to Home"}
                </button>
              </div>
            </div>
          )}
          {isRecording && (
            <div className="mb-2 flex items-center justify-center gap-1.5 text-[11px] text-[#C53030]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#C53030]" />
              {language === "ko" ? "녹음 중..." : language === "id" ? "Merekam..." : "Recording..."}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleRecording}
              disabled={!getSpeechRecognition() || isRequestingPermission}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition active:scale-[0.98] ${
                isRequestingPermission
                  ? "border border-[#E5E7EB] bg-[#F1F5F9] text-[#64748B]"
                  : isRecording
                  ? "bg-[#C53030] text-white shadow-[0_0_0_3px_rgba(197,48,48,0.3)] animate-pulse"
                  : "border border-[#E5E7EB] bg-[#FFFFFF] text-[#0F172A] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
              }`}
              title={language === "ko" ? (isRecording ? "녹음 중지" : isRequestingPermission ? "권한 요청 중..." : "음성 입력") : language === "id" ? (isRecording ? "Stop rekam" : isRequestingPermission ? "Meminta izin..." : "Input suara") : (isRecording ? "Stop recording" : isRequestingPermission ? "Requesting permission..." : "Voice input")}
            >
              {isRequestingPermission ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#4F46E5] border-t-transparent" />
              ) : (
                "🎤"
              )}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (isOnboarding && e.target.value.trim().length > 0) setShowStarterButtons(false);
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                language === "ko" ? "한국어로 말해보세요..." : language === "id" ? "Ketik dalam bahasa Korea..." : "Type in Korean..."
              }
              className="h-12 flex-1 rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] px-4 text-sm text-[#0F172A] placeholder:text-[#94A3B8] shadow-sm transition focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20"
            />
            <button
              type="button"
              disabled={!input.trim() || isLoading || usageLimited}
              onClick={handleSend}
              className="flex h-12 items-center justify-center rounded-2xl bg-[#4F46E5] px-5 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.35)] transition disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:text-[#94A3B8] disabled:shadow-none hover:bg-[#4338CA] active:scale-[0.98]"
            >
              {language === "ko" ? "전송" : language === "id" ? "Kirim" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4 py-6 text-[#0F172A]">
          <span className="animate-pulse-soft">🐥</span>
        </main>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
