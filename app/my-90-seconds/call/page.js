"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTimer } from "../../../src/hooks/useTimer";
import { useSpeechRecognition } from "../../../src/hooks/useSpeechRecognition";
import { classifyUserInput, selectIdolResponse } from "../../../src/lib/selectIdolResponse";
import idolScripts, { getRandomLine } from "../../../src/data/idol-scripts";
import scenarios from "../../../src/data/scenarios";

const LANG_KEY = "ogu_lang";
const VOICE_KEY = "kkobi_voice_gender";

const CALL_COPY = {
  en: {
    hint: "Silence for 3 seconds shows a hint",
    speak_now: "Speak now",
    tap_to_speak: "Tap to speak",
    listening: "Listening...",
    hint_bubble: "Say something! It's okay to make mistakes~",
    start_sim: "Start simulation",
    time_label: "TIME REMAINING",
    idol_label: "IDOL",
    you_label: "YOU",
  },
  ko: {
    hint: "침묵하면 힌트가 나타나요",
    speak_now: "지금 말하기",
    tap_to_speak: "탭해서 말하기",
    listening: "듣는 중...",
    hint_bubble: "뭔가 말해봐요! 틀려도 괜찮아요~",
    start_sim: "시뮬레이션 시작",
    time_label: "남은 시간",
    idol_label: "아이돌",
    you_label: "나",
  },
  id: {
    hint: "Diam 3 detik menampilkan petunjuk",
    speak_now: "Bicara sekarang",
    tap_to_speak: "Ketuk untuk bicara",
    listening: "Mendengarkan...",
    hint_bubble: "Katakan sesuatu! Tidak apa-apa salah~",
    start_sim: "Mulai simulasi",
    time_label: "WAKTU TERSISA",
    idol_label: "IDOL",
    you_label: "KAMU",
  },
  pt: {
    hint: "Silêncio por 3 segundos mostra uma dica",
    speak_now: "Fale agora",
    tap_to_speak: "Toque para falar",
    listening: "Ouvindo...",
    hint_bubble: "Diga algo! Tudo bem errar~",
    start_sim: "Iniciar simulação",
    time_label: "TEMPO RESTANTE",
    idol_label: "IDOL",
    you_label: "VOCÊ",
  },
  fr: {
    hint: "3 secondes de silence affiche un indice",
    speak_now: "Parlez maintenant",
    tap_to_speak: "Appuyez pour parler",
    listening: "En écoute...",
    hint_bubble: "Dites quelque chose! C'est ok de faire des erreurs~",
    start_sim: "Commencer la simulation",
    time_label: "TEMPS RESTANT",
    idol_label: "IDOL",
    you_label: "VOUS",
  },
};

const EMERGENCY_CARDS = [
  { id: "E01", text: "아 잠깐만요~ 다시 말할게요." },
  { id: "E02", text: "다른 얘기 할게요!" },
  { id: "E03", text: "너무 좋아서 말이 안 나와요~" },
];

function CallPageInner() {
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
  const [lang, setLang] = useState("en");
  const [voiceGender, setVoiceGender] = useState("FEMALE");
  const chatRef = useRef(null);

  // 첫 아이돌 인사
  useEffect(() => {
    const savedLang = localStorage.getItem(LANG_KEY) || "en";
    setLang(savedLang);
    const savedGender = localStorage.getItem(VOICE_KEY) || "FEMALE";
    setVoiceGender(savedGender);

    const greeting = getRandomLine("greeting");
    const firstQ = getRandomLine("first_question");
    setMessages([
      { role: "idol", text: greeting.text, id: greeting.id, turn: 0 },
      { role: "idol", text: firstQ.text, id: firstQ.id, turn: 0 },
    ]);
    playIdolTTS(greeting.text);
    setTimeout(() => playIdolTTS(firstQ.text), 1800);
  }, []);

  // 타이머 시작
  function handleStart() {
    setHasStarted(true);
    start();
  }

  async function playIdolTTS(text) {
    if (typeof window === "undefined") return;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          lang: "ko-KR",
          speakingRate: 0.9,
          gender: voiceGender,
        }),
      });
      const data = await res.json();
      if (data.audioContent) {
        const audio = new Audio(
          `data:audio/mp3;base64,${data.audioContent}`
        );
        audio.play();
      }
    } catch (e) {
      console.error("TTS error:", e);
    }
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
        playIdolTTS(idolMsg.text);

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
    setTimeout(() => {
      setMessages((prev) => [...prev, response]);
      playIdolTTS(response.text);
    }, 800);
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

  const tc = CALL_COPY[lang] || CALL_COPY.en;

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
          {tc.time_label}
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
          {isWarning ? "⚡ 마무리할 시간이에요!" : tc.hint}
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
                {tc.idol_label}
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
                <p style={{
                  fontSize: 15, fontWeight: 600,
                  color: "#F2F0F4", margin: "0 0 4px",
                  lineHeight: 1.4,
                }}>
                  {msg.korean || msg.text}
                </p>
                {(msg.translation || msg.english) && (
                  <p style={{
                    fontSize: 11, color: "#5C5A62",
                    margin: 0, lineHeight: 1.4,
                  }}>
                    {msg.translation || msg.english}
                  </p>
                )}
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
            💡 {tc.hint_bubble}
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
      <div style={{
        position: "sticky",
        bottom: 0,
        left: 0, right: 0,
        padding: "12px 22px 24px",
        background: "linear-gradient(to top, #0E0E0F 70%, transparent)",
        zIndex: 10,
      }}>
        {!hasStarted ? (
          <button onClick={handleStart} className="m-btn-primary">
            🎬 {tc.start_sim}
          </button>
        ) : (
          <button
            onClick={startListening}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 9999,
              border: "none",
              background: isListening ? "#E24B4A" : "#FF8AA9",
              color: "#fff",
              fontFamily: "'Manrope', sans-serif",
              fontSize: 15, fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "background 0.2s",
            }}
          >
            {isListening ? (
              <>
                <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                  {[8, 14, 10, 6].map((h, j) => (
                    <div key={j} style={{
                      width: 3, height: h,
                      background: "#fff", borderRadius: 2,
                    }} />
                  ))}
                </div>
                {tc.listening}
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1v14M4 6a4 4 0 008 0"
                    stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {tc.tap_to_speak}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function CallPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh",
        background: "#0E0E0F",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <p style={{ color: "#5C5A62", fontSize: 13 }}>
          Loading...
        </p>
      </div>
    }>
      <CallPageInner />
    </Suspense>
  );
}
