"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function stripHints(text, enabled) {
  if (enabled) return text;
  // 괄호 안 영어 번역을 단순히 제거
  return text.replace(/\s*\([^)]*\)/g, "");
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const level = searchParams.get("level") || "beginner";
  const persona = searchParams.get("persona") || "cafe";
  const language = searchParams.get("lang") || "en";

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
    <main className="flex min-h-screen flex-col items-center bg-[#1A1008] px-4 py-6 text-slate-50">
      <div className="flex w-full max-w-3xl flex-1 flex-col rounded-3xl border border-[#3A2515] bg-[#241208]/95 shadow-[0_18px_50px_rgba(0,0,0,0.7)] overflow-hidden">
        <header className="flex items-center justify-between border-b border-[#3A2515] bg-[#1D1009] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#2D1A0E] text-xl">
              {personaMeta.emoji}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[#FFE9A6]">
                {personaMeta.name}
              </span>
              <span className="text-[11px] text-[#D9BFA3]">
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
                  ? "border-[#FFD93D] bg-[#3A210C] text-[#FFE9A6]"
                  : "border-[#3A2515] bg-[#241208] text-[#D9BFA3] hover:border-[#FFD93D55]"
              }`}
            >
              힌트 보기 👀
            </button>
            <button
              type="button"
              onClick={handleEndConversation}
              className="rounded-full bg-[#3A2515] px-3 py-1.5 text-[11px] font-semibold text-[#FFE9A6] hover:bg-[#4A2F1C] active:translate-y-0.5 active:scale-[0.97] transition"
            >
              {language === "ko" ? "대화 끝내기" : "End Conversation"}
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, idx) => {
            const isUser = m.role === "user";
            const bubbleText =
              m.role === "assistant"
                ? stripHints(m.content || "", showHints)
                : m.content || "";

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
                      isUser ? "bg-[#FF6B4A]" : "bg-[#2D1A0E]"
                    }`}
                  >
                    {isUser ? "👤" : "🐥"}
                  </div>
                  <div
                    className={`rounded-2xl px-3 py-2 text-[13px] leading-relaxed shadow-md ${
                      isUser
                        ? "bg-[#FF6B4A] text-white"
                        : "bg-[#2D1A0E] text-[#FFE9A6]"
                    }`}
                  >
                    {bubbleText}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#2D1A0E] text-lg">
                  🐥
                </div>
                <div className="flex items-center gap-1 rounded-2xl bg-[#2D1A0E] px-3 py-2 text-[11px] text-[#FFE9A6]">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#FFE9A6]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#FFE9A6] [animation-delay:0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#FFE9A6] [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}
        </div>

        <form
          className="border-t border-[#3A2515] bg-[#1D1009]/95 px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={
                language === "ko"
                  ? "한국어로 말해보세요. (Shift+Enter 줄바꿈)"
                  : "Type in Korean. (Shift+Enter for newline)"
              }
              className="max-h-32 flex-1 resize-none rounded-2xl border border-[#3A2515] bg-[#241208] px-3 py-2 text-[13px] text-slate-50 placeholder:text-[#8F6E57] focus:border-[#FF6B4A] focus:outline-none focus:ring-1 focus:ring-[#FF6B4A]"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex items-center justify-center rounded-2xl bg-[#FF6B4A] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_10px_25px_rgba(255,107,74,0.7)] transition disabled:cursor-not-allowed disabled:bg-[#6A4A3A] disabled:shadow-none hover:bg-[#ff5a33] active:translate-y-0.5 active:scale-[0.97]"
            >
              {language === "ko" ? "전송" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
