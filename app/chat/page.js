"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

function stripHints(text, enabled) {
  if (enabled) return text;
  // 괄호 안 영어 번역을 단순히 제거
  return text.replace(/\s*\([^)]*\)/g, "");
}

function renderAssistantContent(text, showHints) {
  if (!text) return null;
  if (!showHints) {
    return stripHints(text, false);
  }

  // 괄호 안 영어 번역을 감지해서 줄바꿈 + 스타일 분리
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

  const personaMeta = useMemo(() => {
    if (persona === "office") {
      return { emoji: "💼", name: "직장오구" };
    }
    if (persona === "drama") {
      return { emoji: "📺", name: "드라마오구" };
    }
    return { emoji: "☕", name: "카페오구" };
  }, [persona]);

  useEffect(() => {
    setShowHints(language === "en");
  }, [language]);

  const activeUserIdRef = useRef(null);

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
          window.sessionStorage.setItem(
            "ogu-chat-start",
            String(Date.now())
          );
        }
      }
    } catch {
      // ignore
    }

    // 첫 진입 시 AI 인사말 요청
    const startConversation = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            level,
            persona,
            language,
            messages: []
          })
        });
        if (!res.ok) throw new Error("Failed to start chat");
        const data = await res.json();
        setMessages([
          {
            role: "assistant",
            content: data.reply ?? ""
          }
        ]);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    startConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, persona, language]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const nextMessages = [
      ...messages,
      { role: "user", content: trimmed }
    ];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          level,
          persona,
          language,
          messages: nextMessages
        })
      });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "" }
      ]);
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
        window.sessionStorage.setItem(
          "ogu-chat-history",
          JSON.stringify(messages)
        );
        window.sessionStorage.setItem(
          "ogu-chat-end",
          String(Date.now())
        );
      }
    } catch (e) {
      console.error("Failed to store history", e);
    }
    const params = new URLSearchParams({
      level,
      persona,
      lang: language
    }).toString();
    router.push(`/report?${params}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#FFF8F0] px-4 py-6 text-[#3D2010]">
      <div className="flex w-full max-w-3xl flex-1 flex-col rounded-3xl border border-[#FFE0D0] bg-[#FFFFFF] shadow-[0_18px_50px_rgba(0,0,0,0.08)] overflow-hidden">
        <header className="flex items-center justify-between border-b border-[#FFE0D0] bg-[#FFF8F0] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#FFE0D0] text-xl">
              {personaMeta.emoji}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[#3D2010]">
                {personaMeta.name}
              </span>
              <span className="text-[11px] text-[#9A7060]">
                {level === "beginner"
                  ? language === "ko"
                    ? "왕초보 오구 레벨"
                    : "Beginner level Ogu"
                  : level === "elementary"
                  ? language === "ko"
                    ? "초급 오구 레벨"
                    : "Elementary level Ogu"
                  : language === "ko"
                  ? "중급 오구 레벨"
                  : "Intermediate level Ogu"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHints((v) => !v)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                showHints
                  ? "border-[#FF6B4A] bg-[#FFF0E8] text-[#3D2010]"
                  : "border-[#FFE0D0] bg-[#FFFFFF] text-[#9A7060] hover:border-[#FF6B4A66]"
              }`}
            >
              힌트 보기 👀
            </button>
            <button
              type="button"
              onClick={handleEndConversation}
              className="rounded-full bg-[#FF6B4A] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#ff5a33] active:translate-y-0.5 active:scale-[0.97] transition"
            >
              {language === "ko" ? "대화 끝내기" : "End Conversation"}
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, idx) => {
            const isUser = m.role === "user";
            const content = m.content || "";

            return (
              <div
                key={idx}
                className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex max-w-[80%] items-end gap-2 ${
                    isUser ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-2xl text-lg ${
                      isUser ? "bg-[#FF6B4A]" : "bg-[#FFE0D0]"
                    }`}
                  >
                    {isUser ? "👤" : "🐥"}
                  </div>
                  <div
                    className={`rounded-2xl px-3 py-2 text-[13px] leading-relaxed shadow-md ${
                      isUser
                        ? "bg-[#FF6B4A] text-white"
                        : "bg-[#FFF0E8] text-[#3D2010]"
                    }`}
                  >
                    {isUser
                      ? content
                      : renderAssistantContent(content, showHints)}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#FFE0D0] text-lg">
                  🐥
                </div>
                <div className="flex items-center gap-1 rounded-2xl bg-[#FFF0E8] px-3 py-2 text-[11px] text-[#3D2010]">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#FFE9A6]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#FFE9A6] [animation-delay:0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#FFE9A6] [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[#FFE0D0] bg-[#FFF8F0] px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                language === "ko"
                  ? "한국어로 말해보세요..."
                  : "Type in Korean..."
              }
              className="flex h-12 flex-1 items-center rounded-2xl border border-[#FFD0BC] bg-[#FFFFFF] px-3 text-sm leading-snug text-[#3D2010] placeholder:text-[#C09A8A] focus:border-[#FF6B4A] focus:outline-none focus:ring-1 focus:ring-[#FF6B4A]"
            />
            <button
              type="button"
              disabled={!input.trim() || isLoading}
              onClick={handleSend}
              className="flex h-12 items-center justify-center rounded-2xl bg-[#FF6B4A] px-4 text-[13px] font-semibold text-white shadow-[0_10px_25px_rgba(255,107,74,0.7)] transition disabled:cursor-not-allowed disabled:bg-[#F1B3A1] disabled:shadow-none hover:bg-[#ff5a33] active:translate-y-0.5 active:scale-[0.97]"
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
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#1A1008] px-4 py-6 text-slate-50">로딩중...</main>}>
      <ChatContent />
    </Suspense>
  );
}
