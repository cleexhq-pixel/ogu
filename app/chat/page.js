"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

function stripHints(text, enabled) {
  if (enabled) return text;
  return text.replace(/\s*\([^)]*\)/g, "");
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

  const personaMeta = useMemo(() => {
    if (persona === "office") return { emoji: "💼", name: "직장오구" };
    if (persona === "drama") return { emoji: "📺", name: "드라마오구" };
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
          body: JSON.stringify({ level, persona, language, messages: [] })
        });
        if (!res.ok) throw new Error("Failed to start chat");
        const data = await res.json();
        setMessages([{ role: "assistant", content: data.reply ?? "" }]);
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
        body: JSON.stringify({ level, persona, language, messages: nextMessages })
      });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? "" }]);
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

  const levelLabel =
    level === "beginner"
      ? language === "ko" ? "왕초보" : "Beginner"
      : level === "elementary"
      ? language === "ko" ? "초급" : "Elementary"
      : language === "ko" ? "중급" : "Intermediate";

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#FFF8F0] px-3 py-4 sm:px-4 sm:py-6 text-[#3D2010]">
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
                    className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                      isUser
                        ? "bg-[#FF6B4A] text-white shadow-[0_4px_14px_rgba(255,107,74,0.25)]"
                        : "bg-[#FFF0E8] text-[#3D2010] shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
                    }`}
                  >
                    {isUser ? content : renderAssistantContent(content, showHints)}
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
          <div className="flex items-center gap-2">
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
