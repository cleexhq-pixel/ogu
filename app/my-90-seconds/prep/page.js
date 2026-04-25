"use client";

const LANG_KEY = "ogu_lang";
const VOICE_KEY = "kkobi_voice_gender";

const PREP_COPY = {
  en: {
    eyebrow: (scenario) => scenario?.toUpperCase() || "PREP",
    title_1: "4 lines to",
    title_2: "get you ready",
    line_labels: ["LINE 1 · Greeting", "LINE 2 · Main message", "LINE 3 · Keep going", "LINE 4 · Closing"],
    listen: "Listen",
    repeat: "Repeat",
    next: "Start 90 seconds",
    hint: "Say all lines to continue",
    listening: "Listening...",
    tap_to_speak: "Tap to speak",
    done: "Done",
    retry_msg: "Didn't catch that. Try again!",
    voice_label: "Idol voice",
    voice_female: "Female",
    voice_male: "Male",
  },
  ko: {
    eyebrow: (scenario) => scenario?.toUpperCase() || "준비",
    title_1: "4문장을",
    title_2: "배워볼게요",
    line_labels: ["LINE 1 · 인사", "LINE 2 · 핵심 메시지", "LINE 3 · 대화 이어가기", "LINE 4 · 마무리"],
    listen: "듣기",
    repeat: "따라 말하기",
    next: "90초 시뮬 시작하기",
    hint: "모든 문장을 따라 말해야 다음으로 넘어갈 수 있어요",
    listening: "듣는 중...",
    tap_to_speak: "탭해서 말하기",
    done: "완료",
    retry_msg: "인식하지 못했어요. 다시 말해봐요!",
    voice_label: "아이돌 목소리",
    voice_female: "여성",
    voice_male: "남성",
  },
  id: {
    eyebrow: (scenario) => scenario?.toUpperCase() || "PERSIAPAN",
    title_1: "4 kalimat untuk",
    title_2: "kamu siapkan",
    line_labels: ["LINE 1 · Salam", "LINE 2 · Pesan utama", "LINE 3 · Lanjutkan", "LINE 4 · Penutup"],
    listen: "Dengarkan",
    repeat: "Ulangi",
    next: "Mulai 90 detik",
    hint: "Ucapkan semua kalimat untuk melanjutkan",
    listening: "Mendengarkan...",
    tap_to_speak: "Ketuk untuk bicara",
    done: "Selesai",
    retry_msg: "Tidak terdengar. Coba lagi!",
    voice_label: "Suara idol",
    voice_female: "Perempuan",
    voice_male: "Laki-laki",
  },
  pt: {
    eyebrow: (scenario) => scenario?.toUpperCase() || "PREP",
    title_1: "4 frases para",
    title_2: "se preparar",
    line_labels: ["LINE 1 · Saudação", "LINE 2 · Mensagem principal", "LINE 3 · Continue", "LINE 4 · Encerramento"],
    listen: "Ouvir",
    repeat: "Repetir",
    next: "Iniciar 90 segundos",
    hint: "Diga todas as frases para continuar",
    listening: "Ouvindo...",
    tap_to_speak: "Toque para falar",
    done: "Concluído",
    retry_msg: "Não ouvi. Tente novamente!",
    voice_label: "Voz do idol",
    voice_female: "Feminino",
    voice_male: "Masculino",
  },
  fr: {
    eyebrow: (scenario) => scenario?.toUpperCase() || "PREP",
    title_1: "4 phrases pour",
    title_2: "vous préparer",
    line_labels: ["LINE 1 · Salutation", "LINE 2 · Message principal", "LINE 3 · Continuez", "LINE 4 · Clôture"],
    listen: "Écouter",
    repeat: "Répéter",
    next: "Commencer 90 secondes",
    hint: "Dites toutes les phrases pour continuer",
    listening: "En écoute...",
    tap_to_speak: "Appuyez pour parler",
    done: "Terminé",
    retry_msg: "Pas entendu. Réessayez!",
    voice_label: "Voix de l'idol",
    voice_female: "Féminin",
    voice_male: "Masculin",
  },
};

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import scenarios from "../../../src/data/scenarios";
import { generateScript } from "../../../src/lib/generateScript";
import { useSpeechRecognition } from "../../../src/hooks/useSpeechRecognition";

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

function PrepPageInner() {
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get("scenario") || "compliment";
  const scenario = scenarios.find((s) => s.id === scenarioId) || scenarios[0];

  const [lines, setLines] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLine, setCurrentLine] = useState(0);
  const [completed, setCompleted] = useState([false, false, false, false]);
  const [lang, setLang] = useState("en");
  const [voiceGender, setVoiceGender] = useState("FEMALE");
  const [retryIndex, setRetryIndex] = useState(null);
  const { transcript, isListening, error, startListening, reset } = useSpeechRecognition();

  useEffect(() => {
    const savedLang = localStorage.getItem(LANG_KEY) || "en";
    setLang(savedLang);
    const savedGender = localStorage.getItem(VOICE_KEY) || "FEMALE";
    setVoiceGender(savedGender);
  }, []);

  useEffect(() => {
    if (!scenarioId) return;

    async function loadScript() {
      const cacheKey = `kkobi_m90s_v3_${scenarioId}`;

      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setLines(JSON.parse(cached));
          setLoading(false);
          return;
        }
      } catch (e) {}

      try {
        setLoading(true);
        const generated = await generateScript(scenario);
        const newLines = [
          LINE1,
          { ...generated.line2, isTemplate: false },
          { ...generated.line3, isTemplate: false },
          LINE4,
        ];
        setLines(newLines);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(newLines));
        } catch (e) {}
      } catch (e) {
        console.error(e);
        const fallbacks = {
          compliment: [
            { korean: "오빠 노래가 진짜 좋아요!", romanization: "Oppa noraega jinjja johayo!", translation: "I really love your music!", isTemplate: false },
            { korean: "항상 응원하고 있어요!", romanization: "Hangsang eungwonhago isseoyo!", translation: "I'm always cheering for you!", isTemplate: false },
          ],
          birthday: [
            { korean: "오빠 생일 진심으로 축하해요!", romanization: "Oppa saengil jinsimeuro chukahaeyo!", translation: "Happy birthday from the bottom of my heart!", isTemplate: false },
            { korean: "항상 건강하고 행복하세요!", romanization: "Hangsang geonganghago haengbokhaseyo!", translation: "Always stay healthy and happy!", isTemplate: false },
          ],
          game: [
            { korean: "오빠랑 게임 해보고 싶었어요!", romanization: "Opparang geim haebogo sipeoisseoyo!", translation: "I've always wanted to play a game with you!", isTemplate: false },
            { korean: "당연하지 게임 알아요?", romanization: "Dangyeonhaji geim arayo?", translation: "Do you know the 'of course' game?", isTemplate: false },
          ],
          request: [
            { korean: "오빠한테 부탁이 있어요!", romanization: "Oppahante butagi isseoyo!", translation: "I have a request for you!", isTemplate: false },
            { korean: "제 이름 한 번 불러줄 수 있어요?", romanization: "Je ireum han beon bulleojul su isseoyo?", translation: "Can you call my name once?", isTemplate: false },
          ],
          question: [
            { korean: "요즘 제일 좋아하는 노래가 뭐예요?", romanization: "Yojeum jeil joahaneun noraega mwoyeyo?", translation: "What's your favorite song lately?", isTemplate: false },
            { korean: "오빠 대답이 진짜 궁금해요!", romanization: "Oppa daedabi jinjja gunggeumhaeyo!", translation: "I'm so curious about your answer!", isTemplate: false },
          ],
          confession: [
            { korean: "오빠를 오래 좋아했어요!", romanization: "Oppareul orae johahaesseoyo!", translation: "I've liked you for a long time!", isTemplate: false },
            { korean: "드디어 만나서 너무 행복해요!", romanization: "Deudieo mannaseo neomu haengbokhaeyo!", translation: "I'm so happy to finally meet you!", isTemplate: false },
          ],
        };
        const fb = fallbacks[scenarioId] || fallbacks.compliment;
        setLines([LINE1, fb[0], fb[1], LINE4]);
      } finally {
        setLoading(false);
      }
    }

    loadScript();
  }, [scenarioId]);

  async function playTTS(text) {
    if (typeof window === "undefined") return;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          lang: "ko-KR",
          speakingRate: 0.85,
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
      setRetryIndex(null);
      reset();
    }
  }, [transcript]);

  useEffect(() => {
    if (error && currentLine !== null) {
      setRetryIndex(currentLine);
      reset();
    }
  }, [error]);

  function handleNext() {
    window.location.href = `/my-90-seconds/call?scenario=${scenarioId}`;
  }

  const allDone = completed.every(Boolean);
  const labels = ["인사", "핵심 메시지", "대화 이어가기", "마무리"];
  const t = PREP_COPY[lang] || PREP_COPY.en;

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
          {scenario.emoji} {t.eyebrow(scenarioId)}
        </div>
        <h1 className="m-display">
          {t.title_1}<br />
          <span className="m-gradient-text">{t.title_2}</span>
        </h1>
      </div>

      {/* Lines */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative", zIndex: 1 }}>
        {lines && lines.map((line, i) => {
          const isListeningThis = isListening && currentLine === i;
          const isDoneThis = completed[i];
          const isRetryThis = retryIndex === i;
          return (
          <div
            key={i}
            className={`m-card ${currentLine === i ? "m-card-active" : ""}`}
            style={{ opacity: i > 0 && !completed[i - 1] ? 0.4 : 1, transition: "opacity 0.3s" }}
          >
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: completed[i] ? "var(--m-secondary)" : "var(--m-text-dim)", marginBottom: 8 }}>
              {completed[i] ? `✓ ${t.done}` : t.line_labels[i]}
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
                🔊 {t.listen}
              </button>
              <button
                onClick={() => {
                  if (!isDoneThis) {
                    setRetryIndex(null);
                    startListening();
                    setCurrentLine(i);
                  }
                }}
                disabled={isDoneThis}
                style={{
                  flex: 1, padding: "10px 6px",
                  borderRadius: 9999, border: "none",
                  cursor: isDoneThis ? "default" : "pointer",
                  background: isDoneThis
                    ? "#2C2C2D"
                    : isListeningThis
                    ? "#E24B4A"
                    : "#FF8AA9",
                  color: isDoneThis ? "#3A3A3A" : "#fff",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12, fontWeight: 700,
                  display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 6,
                  transition: "background 0.2s",
                }}
              >
                {isListeningThis ? (
                  <>
                    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                      {[8, 14, 10, 6].map((h, j) => (
                        <div key={j} style={{
                          width: 3, height: h,
                          background: "#fff",
                          borderRadius: 2,
                          opacity: 0.7 + j * 0.1,
                        }} />
                      ))}
                    </div>
                    {t.listening}
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1v10M3 4a3 3 0 006 0"
                        stroke={isDoneThis ? "#3A3A3A" : "#fff"}
                        strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    {t.tap_to_speak}
                  </>
                )}
              </button>
            </div>
            {retryIndex === i && (
              <div style={{
                marginTop: 8,
                background: "rgba(226,75,74,0.12)",
                borderRadius: 8, padding: "7px 12px",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <div style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: "#E24B4A", flexShrink: 0,
                }} />
                <p style={{
                  fontSize: 11, color: "#E24B4A",
                  margin: 0, fontWeight: 500,
                }}>
                  {t.retry_msg}
                </p>
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* CTA */}
      <div style={{ marginTop: 20, position: "relative", zIndex: 1 }}>
        <button
          onClick={handleNext}
          disabled={!allDone}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 14px 14px 24px",
            borderRadius: 9999,
            background: allDone ? "#FF8AA9" : "#2C2C2D",
            border: "none",
            cursor: allDone ? "pointer" : "default",
            transition: "background 0.2s",
          }}
        >
          <div style={{ width: 32 }} />
          <span style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 15, fontWeight: 700,
            color: allDone ? "#fff" : "#5C5A62",
            letterSpacing: "0.01em",
          }}>
            {t.next}
          </span>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: allDone
              ? "rgba(255,255,255,0.25)"
              : "rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center",
            justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M7 3l4 4-4 4"
                stroke={allDone ? "#fff" : "#5C5A62"}
                strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>
        {!allDone && (
          <p style={{ textAlign: "center", fontSize: 11, color: "var(--m-text-dim)", marginTop: 10 }}>
            {t.hint}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PrepPage() {
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
      <PrepPageInner />
    </Suspense>
  );
}
