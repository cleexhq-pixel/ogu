"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import scenarios from "@/data/scenarios";
import { generateScript } from "@/lib/generateScript";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

// 고정 템플릿 (API 호출 불필요)
const LINE1 = {
  korean: "안녕하세요! 저는 [이름]이에요.",
  romanization: "Annyeonghaseyo! Jeoneun [name]-ieyo.",
  translation: "Hello! I'm [name].",
  isTemplate: true,
};

const LINE4 = {
  korean: "오늘 만나서 정말 행복해요!",
  romanization: "Oneul mannaseo jeongmal haengbokhaeyo!",
  translation: "I'm so happy to meet you today!",
  isTemplate: true,
};

export default function PrepPage() {
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get("scenario") || "compliment";
  const scenario = scenarios.find((s) => s.id === scenarioId) || scenarios[0];

  const [lines, setLines] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLine, setCurrentLine] = useState(0);
  const [completed, setCompleted] = useState([false, false, false, false]);
  const { transcript, isListening, startListening, reset } = useSpeechRecognition();

  useEffect(() => {
    async function loadScript() {
      try {
        const generated = await generateScript(scenario);
        setLines([
          LINE1,
          { ...generated.line2, isTemplate: false },
          { ...generated.line3, isTemplate: false },
          LINE4,
        ]);
      } catch {
        // fallback
        setLines([
          LINE1,
          { korean: "오빠를 정말 좋아해요!", romanization: "Oppareul jeongmal joahaeyo!", translation: "I really like you!", isTemplate: false },
          { korean: "앞으로도 응원할게요!", romanization: "Apeuroedo eungwonhalgeyo!", translation: "I'll keep cheering for you!", isTemplate: false },
          LINE4,
        ]);
      } finally {
        setLoading(false);
      }
    }
    loadScript();
  }, [scenarioId]);

  function playTTS(text) {
    if (typeof window === "undefined") return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ko-KR";
    utter.rate = 0.85;
    window.speechSynthesis.speak(utter);
  }

  function handleSpeak(index) {
    reset();
    startListening();
    setCurrentLine(index);
  }

  useEffect(() => {
    if (transcript && currentLine !== null) {
      const newCompleted = [...completed];
      newCompleted[currentLine] = true;
      setCompleted(newCompleted);
      reset();
    }
  }, [transcript]);

  function handleNext() {
    window.location.href = `/my-90-seconds/call?scenario=${scenarioId}`;
  }

  const allDone = completed.every(Boolean);
  const labels = ["인사", "핵심 메시지", "대화 이어가기", "마무리"];

  if (loading) {
    return (
      <div className="my90sec-layout" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--m-font-display)", fontSize: 22, fontWeight: 800, color: "var(--m-text-primary)", marginBottom: 8 }}>
            스크립트 생성 중...
          </div>
          <div style={{ fontSize: 13, color: "var(--m-text-dim)" }}>AI가 맞춤 문장을 만들고 있어요</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "44px 22px 32px", position: "relative" }}>

      {/* Spotlight */}
      <div className="m-spotlight" style={{ top: -60, left: -60 }} />

      {/* Progress bar */}
      <div style={{ display: "flex", gap: 5, marginBottom: 24, position: "relative", zIndex: 1 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            height: 3, flex: 1, borderRadius: 99,
            background: completed[i]
              ? "linear-gradient(90deg, #FF8AA9, #FF719B)"
              : "var(--m-surface-bright)",
            transition: "background 0.3s",
          }} />
        ))}
      </div>

      {/* Header */}
      <div style={{ position: "relative", zIndex: 1, marginBottom: 24 }}>
        <div className="m-eyebrow" style={{ marginBottom: 8 }}>
          {scenario.emoji} {scenario.titleEn}
        </div>
        <h1 className="m-display">
          4문장을<br />
          <span className="m-gradient-text">배워볼게요</span>
        </h1>
      </div>

      {/* Lines */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative", zIndex: 1 }}>
        {lines && lines.map((line, i) => (
          <div
            key={i}
            className={`m-card ${currentLine === i ? "m-card-active" : ""}`}
            style={{ opacity: i > 0 && !completed[i - 1] ? 0.4 : 1, transition: "opacity 0.3s" }}
          >
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: completed[i] ? "var(--m-secondary)" : "var(--m-text-dim)", marginBottom: 8 }}>
              {completed[i] ? "✓ 완료" : `Line ${i + 1} · ${labels[i]}`}
            </div>
            <p style={{ fontFamily: "var(--m-font-display)", fontSize: 15, fontWeight: 700, color: "var(--m-text-primary)", marginBottom: 3 }}>
              {line.korean}
            </p>
            <p style={{ fontSize: 11, color: "var(--m-secondary)", opacity: 0.8, marginBottom: 3 }}>
              {line.romanization}
            </p>
            <p style={{ fontSize: 11, color: "var(--m-text-dim)", marginBottom: 12 }}>
              {line.translation}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => playTTS(line.korean)}
                className="m-btn-secondary"
                style={{ flex: 1, padding: "9px 6px", fontSize: 11 }}
              >
                🔊 듣기
              </button>
              <button
                onClick={() => handleSpeak(i)}
                className="m-btn-primary"
                style={{ flex: 1, padding: "9px 6px", fontSize: 11 }}
              >
                {isListening && currentLine === i ? "🎤 듣는 중..." : "🎤 따라 말하기"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ marginTop: 20, position: "relative", zIndex: 1 }}>
        <button
          onClick={handleNext}
          className="m-btn-primary"
          style={{ opacity: allDone ? 1 : 0.4 }}
          disabled={!allDone}
        >
          90초 시뮬 시작하기 →
        </button>
        {!allDone && (
          <p style={{ textAlign: "center", fontSize: 11, color: "var(--m-text-dim)", marginTop: 10 }}>
            모든 문장을 따라 말해야 다음으로 넘어갈 수 있어요
          </p>
        )}
      </div>
    </div>
  );
}
