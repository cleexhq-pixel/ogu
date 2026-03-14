"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

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
          className="block text-[11px] font-medium text-[#FF6B4A]"
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

  const level = searchParams.get("level") || "beginner";
  const persona = searchParams.get("persona") || "cafe";
  const language = searchParams.get("lang") || "en";
  const userIdFromUrl = searchParams.get("userId");

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHints, setShowHints] = useState(language === "en");
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showMicPermissionModal, setShowMicPermissionModal] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [level3Countdown, setLevel3Countdown] = useState(null);

  const recognitionRef = useRef(null);
  const synthesisRef = useRef(getSpeechSynthesis());
  const level3CountdownStartedRef = useRef(false);

  const personaMeta = useMemo(() => {
    if (persona === "office") return { emoji: "💼", name: "직장오구" };
    if (persona === "drama") return { emoji: "📺", name: "드라마오구" };
    return { emoji: "☕", name: "카페오구" };
  }, [persona]);

  useEffect(() => {
    setShowHints(language === "en");
  }, [language]);

  const activeUserIdRef = useRef(null);

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
          body: JSON.stringify({ level, persona, language, messages: [], violationCount: 0 })
        });
        if (!res.ok) throw new Error("Failed to start chat");
        const data = await res.json();
        const reply = data.reply ?? "";
        const violation = parseViolationReply(reply);
        if (violation) {
          const content = language === "ko" ? violation.message_ko : violation.message_en;
          setMessages([{ role: "assistant", content, violationLevel: violation.level }]);
          setViolationCount(violation.level);
          if (violation.level === 3) setLevel3Countdown(3);
        } else {
          setMessages([{ role: "assistant", content: reply }]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    startConversation();
  }, [level, persona, language]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
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
          violationCount
        })
      });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      const reply = data.reply ?? "";
      const violation = parseViolationReply(reply);
      if (violation) {
        const content = language === "ko" ? violation.message_ko : violation.message_en;
        setMessages((prev) => [...prev, { role: "assistant", content, violationLevel: violation.level }]);
        setViolationCount(violation.level);
        if (violation.level === 3) setLevel3Countdown(3);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
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
      ? language === "ko" ? "왕초보" : "Beginner"
      : level === "elementary"
      ? language === "ko" ? "초급" : "Elementary"
      : language === "ko" ? "중급" : "Intermediate";

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#FFF8F0] px-3 py-4 sm:px-4 sm:py-6 text-[#3D2010]">
      {/* 마이크 권한 안내 모달 */}
      {showMicPermissionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mic-permission-title"
        >
          <div className="w-full max-w-md rounded-3xl border border-[#FFE0D0] bg-[#FFF8F0] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.12)]">
            <h2 id="mic-permission-title" className="mb-3 text-lg font-bold text-[#3D2010]">
              🎤 {language === "ko" ? "마이크 권한이 필요해요" : "Microphone Access Required"}
            </h2>
            <p className="mb-5 text-sm leading-relaxed text-[#3D2010]">
              {language === "ko"
                ? "음성 대화를 사용하려면 마이크 접근을 허용해주세요. 브라우저 주소창 왼쪽 🔒 아이콘을 클릭하고 마이크를 '허용'으로 변경해주세요."
                : "To use voice chat, please allow microphone access. Click the 🔒 icon in your browser's address bar and set microphone to 'Allow'."}
            </p>
            <button
              type="button"
              onClick={() => setShowMicPermissionModal(false)}
              className="w-full rounded-2xl bg-[#FF6B4A] py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(255,107,74,0.35)] transition hover:bg-[#ff5a33] active:scale-[0.98]"
            >
              {language === "ko" ? "알겠어요!" : "Got it!"}
            </button>
          </div>
        </div>
      )}

      <div className="flex w-full max-w-2xl flex-1 flex-col rounded-3xl border border-[#FFE0D0] bg-[#FFFFFF] shadow-[0_20px_50px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* 헤더 */}
        <header className="flex items-center justify-between gap-3 border-b border-[#FFE0D0] bg-[#FFF8F0] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0E8] text-xl shadow-sm">
              {personaMeta.emoji}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#3D2010]">
                {personaMeta.name}
              </p>
              <p className="text-[11px] text-[#9A7060]">{levelLabel}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              className={`rounded-xl border px-3 py-2 text-[11px] font-medium transition-all duration-200 ${
                isMuted
                  ? "border-[#FFE0D0] bg-[#FFFFFF] text-[#9A7060] hover:border-[#FF6B4A]/60"
                  : "border-[#FF6B4A] bg-[#FFF0E8] text-[#3D2010]"
              }`}
              title={isMuted ? (language === "ko" ? "음성 켜기" : "Turn on voice") : (language === "ko" ? "음성 끄기" : "Mute voice")}
            >
              {isMuted ? "🔇" : "🔊"}
            </button>
            <button
              type="button"
              onClick={() => setShowHints((v) => !v)}
              className={`rounded-xl border px-3 py-2 text-[11px] font-medium transition-all duration-200 ${
                showHints
                  ? "border-[#FF6B4A] bg-[#FFF0E8] text-[#3D2010]"
                  : "border-[#FFE0D0] bg-[#FFFFFF] text-[#9A7060] hover:border-[#FF6B4A]/60"
              }`}
            >
              {language === "ko" ? "힌트 👀" : "Hints 👀"}
            </button>
            <button
              type="button"
              onClick={handleEndConversation}
              className="rounded-xl bg-[#FF6B4A] px-3 py-2 text-[11px] font-semibold text-white shadow-[0_4px_14px_rgba(255,107,74,0.35)] transition hover:bg-[#ff5a33] active:scale-[0.98]"
            >
              {language === "ko" ? "끝내기" : "End"}
            </button>
          </div>
        </header>

        {/* 채팅 영역 */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          {messages.map((m, idx) => {
            const isUser = m.role === "user";
            const content = m.content || "";
            const violationLevel = m.violationLevel;

            const isViolationBubble = !isUser && violationLevel != null;
            const bubbleStyle = isUser
              ? "bg-[#FF6B4A] text-white shadow-[0_4px_14px_rgba(255,107,74,0.25)]"
              : isViolationBubble
              ? violationLevel === 1
                ? "border-2 border-[#FF9800] bg-[#FFF3E0] text-[#E65100]"
                : violationLevel === 2
                ? "border-2 border-[#F44336] bg-[#FFEBEE] text-[#B71C1C]"
                : "border-2 border-[#F44336] bg-[#FFEBEE] text-[#B71C1C]"
              : "bg-[#FFF0E8] text-[#3D2010] shadow-[0_2px_12px_rgba(0,0,0,0.04)]";

            return (
              <div
                key={idx}
                className={`animate-bubble-in flex w-full ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex max-w-[85%] items-end gap-2 sm:max-w-[80%] ${
                    isUser ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base ${
                      isUser ? "bg-[#FF6B4A]" : "bg-[#FFF0E8]"
                    }`}
                  >
                    {isUser ? "👤" : "🐥"}
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${bubbleStyle}`}
                  >
                    {isUser ? content : isViolationBubble ? content : renderAssistantContent(content, showHints)}
                    {isViolationBubble && violationLevel === 3 && level3Countdown != null && (
                      <p className="mt-2 text-[11px] font-medium opacity-90">
                        {language === "ko"
                          ? `${level3Countdown}초 후 대화가 종료됩니다...`
                          : `Ending in ${level3Countdown} seconds...`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFF0E8] text-base animate-pulse-soft">
                  🐥
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl bg-[#FFF0E8] px-4 py-2.5">
                  <span className="h-2 w-2 animate-pulse-soft rounded-full bg-[#FF6B4A]/60" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 animate-pulse-soft rounded-full bg-[#FF6B4A]/60" style={{ animationDelay: "200ms" }} />
                  <span className="h-2 w-2 animate-pulse-soft rounded-full bg-[#FF6B4A]/60" style={{ animationDelay: "400ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 입력창 */}
        <div className="border-t border-[#FFE0D0] bg-[#FFF8F0] px-4 py-3">
          {isRecording && (
            <div className="mb-2 flex items-center justify-center gap-1.5 text-[11px] text-[#C53030]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#C53030]" />
              {language === "ko" ? "녹음 중..." : "Recording..."}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleRecording}
              disabled={!getSpeechRecognition() || isRequestingPermission}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition active:scale-[0.98] ${
                isRequestingPermission
                  ? "border border-[#FFE0D0] bg-[#FFF0E8] text-[#9A7060]"
                  : isRecording
                  ? "bg-[#C53030] text-white shadow-[0_0_0_3px_rgba(197,48,48,0.3)] animate-pulse"
                  : "border border-[#FFE0D0] bg-[#FFFFFF] text-[#3D2010] hover:border-[#FF6B4A]/60 hover:bg-[#FFF0E8]"
              }`}
              title={language === "ko" ? (isRecording ? "녹음 중지" : isRequestingPermission ? "권한 요청 중..." : "음성 입력") : (isRecording ? "Stop recording" : isRequestingPermission ? "Requesting permission..." : "Voice input")}
            >
              {isRequestingPermission ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#FF6B4A] border-t-transparent" />
              ) : (
                "🎤"
              )}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                language === "ko" ? "한국어로 말해보세요..." : "Type in Korean..."
              }
              className="h-12 flex-1 rounded-2xl border border-[#FFE0D0] bg-[#FFFFFF] px-4 text-sm text-[#3D2010] placeholder:text-[#C09A8A] shadow-sm transition focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20"
            />
            <button
              type="button"
              disabled={!input.trim() || isLoading}
              onClick={handleSend}
              className="flex h-12 items-center justify-center rounded-2xl bg-[#FF6B4A] px-5 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(255,107,74,0.35)] transition disabled:cursor-not-allowed disabled:bg-[#E8D5CF] disabled:shadow-none hover:bg-[#ff5a33] active:scale-[0.98]"
            >
              {language === "ko" ? "전송" : "Send"}
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
        <main className="flex min-h-screen items-center justify-center bg-[#FFF8F0] px-4 py-6 text-[#3D2010]">
          <span className="animate-pulse-soft">🐥</span>
        </main>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
