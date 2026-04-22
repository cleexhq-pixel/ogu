"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTimer } from "../../../src/hooks/useTimer";
import { useSpeechRecognition } from "../../../src/hooks/useSpeechRecognition";
import { classifyUserInput, selectIdolResponse } from "../../../src/lib/selectIdolResponse";
import idolScripts, { getRandomLine } from "../../../src/data/idol-scripts";
import scenarios from "../../../src/data/scenarios";

const EMERGENCY_CARDS = [
  { id: "E01", text: "아 잠깐만요~ 다시 말할게요." },
  { id: "E02", text: "다른 얘기 할게요!" },
  { id: "E03", text: "너무 좋아서 말이 안 나와요~" },
];

export default function CallPage() {
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get("scenario") || "compliment";
  const scenario = scenarios.find((s) => s.id === scenarioId) || scenarios[0];

  const { formatted, seconds, isExpired, isWarning, start, isRunning } = useTimer(90);
  const { transcript, isListening, startListening, reset: resetSpeech } = useSpeechRecognition();
  const [messages, setMessages] = useState([]);
  const [turnCount, setTurnCount] = useState(0);
  const [linesDelivered, setLinesDelivered] = useState(0);
  const [silenceTimer, setSilenceTimer] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [starredTurns, setStarredTurns] = useState([]);
  const chatRef = useRef(null);

  // 첫 아이돌 인사
  useEffect(() => {
    const greeting = getRandomLine("greeting");
    const firstQ = getRandomLine("first_question");
    setMessages([
      { role: "idol", text: greeting.text, id: greeting.id, turn: 0 },
      { role: "idol", text: firstQ.text, id: firstQ.id, turn: 0 },
    ]);
  }, []);

  // 타이머 시작
  function handleStart() {
    setHasStarted(true);
    start();
  }

  // 침묵 감지 (3초)
  useEffect(() => {
    if (!isRunning) return;
    const t = setTimeout(() => setShowHint(true), 3000);
    setSilenceTimer(t);
    return () => clearTimeout(t);
  }, [messages, isRunning]);

  // 종료 처리
  useEffect(() => {
    if (isExpired) {
      // 스태프 음성
      const utter = new SpeechSynthesisUtterance(idolScripts.staff_closing);
      utter.lang = "ko-KR";
      window.speechSynthesis.speak(utter);

      // 뚜뚜뚜 효과음 (beep)
      setTimeout(() => {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.3, 0.6].forEach((delay) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.2);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.2);
        });
      }, 1500);

      // Phase C로 이동
      setTimeout(() => {
        const log = encodeURIComponent(JSON.stringify({
          scenarioId,
          linesDelivered,
          totalTurns: turnCount,
          starredTurns,
        }));
        window.location.href = `/my-90-seconds/review?scenario=${scenarioId}&log=${log}`;
      }, 3000);
    }
  }, [isExpired]);

  // 유저 발화 처리
  useEffect(() => {
    if (!transcript) return;
    setShowHint(false);
    clearTimeout(silenceTimer);

    const fanMsg = { role: "fan", text: transcript, turn: turnCount + 1 };
    setMessages((prev) => [...prev, fanMsg]);
    setLinesDelivered((n) => n + 1);
    setTurnCount((n) => n + 1);

    // 아이돌 반응 선택
    const classification = classifyUserInput(transcript);
    const forceQuestion = turnCount === 2 || turnCount === 4;
    const response = selectIdolResponse(classification, turnCount, forceQuestion);

    setTimeout(() => {
      if (response.line) {
        const idolMsg = {
          role: "idol",
          text: response.line.text,
          id: response.line.id,
          turn: turnCount + 1,
          starred: false,
        };
        setMessages((prev) => [...prev, idolMsg]);

        // 역질문 힌트 표시
        if (response.type === "question" && response.line.hintKo) {
          setTimeout(() => setShowHint(true), 2000);
        }
      }
    }, 800);

    resetSpeech();
  }, [transcript]);

  // 비상카드 사용
  function handleEmergency(card) {
    setShowHint(false);
    const msg = { role: "fan", text: card.text, turn: turnCount + 1, isEmergency: true };
    setMessages((prev) => [...prev, msg]);
    setTurnCount((n) => n + 1);
    const response = { role: "idol", text: getRandomLine("reaction_nervous").text, turn: turnCount + 1 };
    setTimeout(() => setMessages((prev) => [...prev, response]), 800);
  }

  // ⭐ 별점
  function handleStar(index) {
    setStarredTurns((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  }

  // 스크롤
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* 헤더 — 타이머 */}
      <div style={{
        background: "var(--m-surface-low)",
        padding: "36px 22px 20px",
        position: "relative", overflow: "hidden",
      }}>
        <div className="m-spotlight" style={{ top: -80, right: -60, width: 200, height: 200,
          background: "radial-gradient(circle, rgba(0,227,253,0.08) 0%, transparent 70%)" }} />
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "var(--m-text-dim)", marginBottom: 6 }}>
          Time Remaining
        </div>
        <div style={{
          fontFamily: "var(--m-font-display)", fontSize: 52, fontWeight: 800,
          letterSpacing: "-0.03em", lineHeight: 1,
          background: isWarning
            ? "linear-gradient(135deg, #FF4444, #FF719B)"
            : "linear-gradient(135deg, #FF8AA9, #FF719B)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          marginBottom: 4,
        }}>
          {formatted}
        </div>
        <div style={{ fontSize: 11, color: "var(--m-text-dim)" }}>
          {isWarning ? "⚡ 마무리할 시간이에요!" : "침묵하면 힌트가 나타나요"}
        </div>
      </div>

      {/* 대화창 */}
      <div ref={chatRef} style={{
        flex: 1, padding: "16px 22px",
        display: "flex", flexDirection: "column", gap: 10,
        overflowY: "auto", maxHeight: "calc(100vh - 320px)",
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex", flexDirection: "column",
            alignItems: msg.role === "fan" ? "flex-end" : "flex-start",
          }}>
            {msg.role === "idol" && (
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "var(--m-secondary)",
                marginBottom: 4, opacity: 0.8 }}>
                Idol AI
              </div>
            )}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6,
              flexDirection: msg.role === "fan" ? "row-reverse" : "row" }}>
              <div style={{
                padding: "11px 14px", borderRadius: 16, fontSize: 13, lineHeight: 1.5,
                maxWidth: "82%",
                background: msg.role === "idol"
                  ? "var(--m-surface-card)"
                  : "linear-gradient(135deg, rgba(255,138,169,0.2), rgba(255,113,155,0.2))",
                color: "var(--m-text-primary)",
                borderBottomLeftRadius: msg.role === "idol" ? 4 : 16,
                borderBottomRightRadius: msg.role === "fan" ? 4 : 16,
                opacity: msg.isEmergency ? 0.7 : 1,
              }}>
                {msg.text}
              </div>
              {/* ⭐ 별점 버튼 */}
              {msg.role === "idol" && msg.id && (
                <button onClick={() => handleStar(i)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 14, opacity: starredTurns.includes(i) ? 1 : 0.3,
                  transition: "opacity 0.15s",
                }}>⭐</button>
              )}
            </div>
          </div>
        ))}

        {/* 힌트 */}
        {showHint && (
          <div style={{
            background: "rgba(158,143,253,0.1)", borderRadius: 12,
            padding: "10px 14px", fontSize: 12, color: "var(--m-tertiary)",
            alignSelf: "center", textAlign: "center",
          }}>
            💡 뭔가 말해봐요! 틀려도 괜찮아요~
          </div>
        )}
      </div>

      {/* 비상카드 */}
      <div style={{ padding: "0 22px 10px", display: "flex", gap: 6, flexWrap: "wrap" }}>
        {EMERGENCY_CARDS.map((card) => (
          <button key={card.id} onClick={() => handleEmergency(card)} style={{
            padding: "6px 12px", borderRadius: 9999,
            background: "transparent",
            border: "1px solid rgba(0,227,253,0.25)",
            color: "var(--m-secondary)",
            fontSize: 10, fontWeight: 600,
            fontFamily: "var(--m-font-body)", cursor: "pointer",
          }}>
            {card.text.slice(0, 10)}...
          </button>
        ))}
      </div>

      {/* 마이크 버튼 */}
      <div style={{ padding: "0 22px 28px" }}>
        {!hasStarted ? (
          <button onClick={handleStart} className="m-btn-primary">
            🎬 시뮬레이션 시작
          </button>
        ) : (
          <button
            onClick={startListening}
            className="m-btn-primary"
            style={{
              background: isListening
                ? "linear-gradient(135deg, #00E3FD, #9E8FFD)"
                : "linear-gradient(135deg, #FF8AA9, #FF719B)",
            }}
          >
            {isListening ? "🎤 듣는 중..." : "🎤 SPEAK NOW"}
          </button>
        )}
      </div>
    </div>
  );
}
