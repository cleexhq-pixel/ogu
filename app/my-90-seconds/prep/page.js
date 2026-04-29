"use client";

const LANG_KEY = "ogu_lang";
const VOICE_KEY = "kkobi_voice_gender";

const PREP_COPY = {
  en: {
    eyebrow: (scenario) => scenario?.toUpperCase() || "PREP",
    title_1: "4 lines to",
    title_2: "get you ready",
    line_labels: ["LINE 1 · Greeting", "LINE 2 · Main message", "LINE 3 · Keep going", "LINE 4 · Closing"],
    listen: "Hear it",
    playing: "Playing...",
    repeat: "Repeat",
    next: "Start 90 seconds",
    hint: "Say all lines to continue",
    listening: "Listening...",
    processing: "Processing...",
    tap_to_speak: "Say it",
    done: "Done",
    retry_msg: "Didn't catch that. Tap and try again!",
    voice_label: "Idol voice",
    voice_female: "Female",
    voice_male: "Male",
  },
  ko: {
    eyebrow: (scenario) => scenario?.toUpperCase() || "준비",
    title_1: "4문장을",
    title_2: "배워볼게요",
    line_labels: ["LINE 1 · 인사", "LINE 2 · 핵심 메시지", "LINE 3 · 대화 이어가기", "LINE 4 · 마무리"],
    listen: "들어보기",
    playing: "재생 중...",
    repeat: "따라 말하기",
    next: "90초 시뮬 시작하기",
    hint: "모든 문장을 따라 말해야 다음으로 넘어갈 수 있어요",
    listening: "듣는 중...",
    processing: "인식 중...",
    tap_to_speak: "말하기",
    done: "완료",
    retry_msg: "인식하지 못했어요. 다시 탭해서 말해봐요!",
    voice_label: "아이돌 목소리",
    voice_female: "여성",
    voice_male: "남성",
  },
  id: {
    eyebrow: (scenario) => scenario?.toUpperCase() || "PERSIAPAN",
    title_1: "4 kalimat untuk",
    title_2: "kamu siapkan",
    line_labels: ["LINE 1 · Salam", "LINE 2 · Pesan utama", "LINE 3 · Lanjutkan", "LINE 4 · Penutup"],
    listen: "Dengar",
    playing: "Memutar...",
    repeat: "Ulangi",
    next: "Mulai 90 detik",
    hint: "Ucapkan semua kalimat untuk melanjutkan",
    listening: "Mendengar...",
    processing: "Memproses...",
    tap_to_speak: "Ucapkan",
    done: "Selesai",
    retry_msg: "Tidak terdengar. Ketuk dan coba lagi!",
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
    playing: "Reproduzindo...",
    repeat: "Repetir",
    next: "Iniciar 90 segundos",
    hint: "Diga todas as frases para continuar",
    listening: "Ouvindo...",
    processing: "Processando...",
    tap_to_speak: "Falar",
    done: "Concluído",
    retry_msg: "Não ouvi. Toque e tente novamente!",
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
    playing: "En lecture...",
    repeat: "Répéter",
    next: "Commencer 90 secondes",
    hint: "Dites toutes les phrases pour continuer",
    listening: "En écoute...",
    processing: "Traitement...",
    tap_to_speak: "Parler",
    done: "Terminé",
    retry_msg: "Pas entendu. Appuyez et réessayez!",
    voice_label: "Voix de l'idol",
    voice_female: "Féminin",
    voice_male: "Masculin",
  },
};

import { useState, useEffect, useRef, Suspense } from "react";
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

const IconSpeaker = ({ color = "#9E9BA4" }) => (
  <svg width="14" height="14" viewBox="0 0 14 14"
    fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 5h2.5L8 2v10L4.5 9H2V5z"
      stroke={color} strokeWidth="1.3"
      strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 4.5c1 .8 1 4.2 0 5"
      stroke={color} strokeWidth="1.3"
      strokeLinecap="round"/>
  </svg>
);

const IconMic = ({ color = "#fff" }) => (
  <svg width="14" height="14" viewBox="0 0 14 14"
    fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="1" width="4" height="7" rx="2"
      stroke={color} strokeWidth="1.3"/>
    <path d="M2.5 7.5A4.5 4.5 0 0 0 11.5 7.5"
      stroke={color} strokeWidth="1.3"
      strokeLinecap="round"/>
    <line x1="7" y1="12" x2="7" y2="10"
      stroke={color} strokeWidth="1.3"
      strokeLinecap="round"/>
  </svg>
);

const IconWave = ({ color = "#fff" }) => (
  <svg width="16" height="14" viewBox="0 0 16 14"
    fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="4" width="2" height="6"
      rx="1" fill={color} opacity="0.6"/>
    <rect x="3.5" y="2" width="2" height="10"
      rx="1" fill={color}/>
    <rect x="7" y="4" width="2" height="6"
      rx="1" fill={color} opacity="0.8"/>
    <rect x="10.5" y="1" width="2" height="12"
      rx="1" fill={color}/>
    <rect x="14" y="4" width="2" height="6"
      rx="1" fill={color} opacity="0.6"/>
  </svg>
);

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingLine, setPlayingLine] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [heard, setHeard] = useState([false, false, false, false]);
  const listenPhaseRef = useRef("idle");
  // "idle"      = 초기/완료 상태
  // "waiting"   = 탭했지만 아직 isListening=true 안 됨
  // "listening" = isListening이 실제로 true가 된 상태
  const audioRef = useRef(null);
  const { transcript, isListening, hasResult, startListening, stopListening, reset } = useSpeechRecognition();

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

  async function playTTS(text, lineIndex) {
    if (typeof window === "undefined") return;

    // 이전 재생 중지
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();

    setIsPlaying(true);
    setPlayingLine(lineIndex);

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
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          setPlayingLine(null);
          setHeard((prev) => {
            const next = [...prev];
            next[lineIndex] = true;
            return next;
          });
        };
        audio.onerror = () => {
          setIsPlaying(false);
          setPlayingLine(null);
        };
        audio.play();
      }
    } catch (e) {
      console.error("TTS error:", e);
      setIsPlaying(false);
      setPlayingLine(null);
    }
  }

  function handleSpeak(index) {
    reset();
    startListening();
    setCurrentLine(index);
  }

  function completeCurrentLine(index) {
    const newCompleted = [...completed];
    newCompleted[index] = true;
    setCompleted(newCompleted);
    setRetryIndex(null);
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
  }

  useEffect(() => {
    if (
      (listenPhaseRef.current === "listening" ||
       listenPhaseRef.current === "waiting") &&
      !isListening &&
      hasResult &&
      transcript.trim().length > 0 &&
      currentLine !== null &&
      !completed[currentLine]
    ) {
      console.log("[COMPLETE]", {
        phase: listenPhaseRef.current,
        isListening,
        hasResult,
        transcript,
        currentLine,
      });
      listenPhaseRef.current = "idle";
      setIsProcessing(false);
      setRetryIndex(null);

      const newCompleted = [...completed];
      newCompleted[currentLine] = true;
      setCompleted(newCompleted);
    }
  }, [isListening, hasResult, transcript, currentLine, completed]);

  // waiting → listening 전환: isListening이 실제 true가 된 시점에 phase 갱신
  useEffect(() => {
    if (isListening && listenPhaseRef.current === "waiting") {
      listenPhaseRef.current = "listening";
    }
  }, [isListening]);

  useEffect(() => {
    if (
      listenPhaseRef.current === "listening" &&
      !isListening
    ) {
      const timer = setTimeout(() => {
        if (
          listenPhaseRef.current === "listening" &&
          !hasResult &&
          currentLine !== null
        ) {
          console.log("[RETRY]", {
            phase: listenPhaseRef.current,
            isListening,
            hasResult,
            transcript,
            currentLine,
          });
          setRetryIndex(currentLine);
          reset();
          listenPhaseRef.current = "idle";
          setIsProcessing(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isListening, hasResult, currentLine, reset, transcript]);

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
          const isDoneThis = completed[i];
          const isListeningThis = isListening && currentLine === i;
          const isProcessingThis = isProcessing && currentLine === i;
          const isPlayingThis = isPlaying && playingLine === i;
          const heardThis = heard[i];
          if (currentLine === i) {
            console.log("[STATE]", {
              line: i,
              isListening,
              isProcessing,
              currentLine,
              isListeningThis,
              isProcessingThis,
              heardThis,
              isDoneThis,
            });
          }
          return (
          <div
            key={i}
            style={{
              background: "#1A191B",
              borderRadius: 14,
              padding: "16px",
              position: "relative",
              opacity: isDoneThis ? 0.7 : 1,
              transition: "opacity 0.3s",
            }}
          >
            {/* 완료 체크 뱃지 — 우상단 */}
            {isDoneThis && (
              <div style={{
                position: "absolute",
                top: 12, right: 12,
                width: 22, height: 22,
                borderRadius: "50%",
                background: "#00E3FD",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5"
                    stroke="#0E0E0F"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"/>
                </svg>
              </div>
            )}

            {/* 라인 레이블 */}
            <p style={{
              fontSize: 10, fontWeight: 600,
              color: "#5C5A62", margin: "0 0 10px",
              letterSpacing: "0.05em",
            }}>
              {t.line_labels[i]}
            </p>

            {/* 한국어 텍스트 */}
            <p style={{
              fontSize: 15, fontWeight: 700,
              color: "#F2F0F4", margin: "0 0 3px",
            }}>
              {line.korean}
            </p>
            <p style={{
              fontSize: 11, color: "#00E3FD",
              margin: "0 0 2px",
            }}>
              {line.romanization}
            </p>
            <p style={{
              fontSize: 11, color: "#5C5A62",
              margin: "0 0 14px",
            }}>
              {line.translation}
            </p>

            {/* 버튼 영역 */}
            <div style={{ display: "flex", gap: 8 }}>

              {/* Hear it 버튼 */}
              <button
                onClick={() => playTTS(line.korean, i)}
                style={{
                  flex: 1, padding: "10px",
                  borderRadius: 9999,
                  cursor: isDoneThis ? "default" : "pointer",
                  background: isPlayingThis
                    ? "#2C2C2D"
                    : "transparent",
                  border: isPlayingThis
                    ? "none"
                    : heardThis || isDoneThis
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1.5px solid #FF8AA9",
                  color: isPlayingThis
                    ? "#00E3FD"
                    : heardThis || isDoneThis
                    ? "#5C5A62"
                    : "#FF8AA9",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12, fontWeight: 600,
                  display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 6,
                  transition: "all 0.2s",
                }}
              >
                <IconSpeaker
                  color={
                    isPlayingThis ? "#00E3FD"
                    : heardThis || isDoneThis ? "#5C5A62"
                    : "#FF8AA9"
                  }
                />
                {isPlayingThis ? t.playing : t.listen}
              </button>

              {/* Say it 버튼 */}
              <button
                onClick={() => {
                  if (completed[i] || isProcessing) return;

                  if (isListening && currentLine === i) {
                    // 두 번째 탭: 녹음 종료 → Processing 시작
                    setIsProcessing(true);
                    console.log("[TAP 2: STOP]", {
                      beforeIsListening: isListening,
                      beforeIsProcessing: isProcessing,
                      currentLine,
                      i,
                    });
                    stopListening();

                    setTimeout(() => {
                      console.log("[AFTER 100ms]", {
                        note: "should see isProcessing=true here",
                      });
                    }, 100);
                    return;
                  }

                  // 첫 번째 탭: 즉시 currentLine 설정
                  setCurrentLine(i);
                  setRetryIndex(null);
                  setIsProcessing(false);
                  stopListening();
                  reset();
                  listenPhaseRef.current = "waiting";

                  setTimeout(() => {
                    startListening();
                  }, 300);
                }}
                disabled={isDoneThis}
                style={{
                  flex: 1, padding: "10px",
                  borderRadius: 9999, border: "none",
                  cursor: isDoneThis || isProcessingThis
                    ? "default" : "pointer",
                  background: isProcessingThis
                    ? "#2C2C2D"
                    : isDoneThis
                    ? "#2C2C2D"
                    : isListeningThis
                    ? "#E24B4A"
                    : heardThis
                    ? "#FF8AA9"
                    : "#2C2C2D",
                  color: isDoneThis || isProcessingThis
                    ? "#3A3A3A"
                    : isListeningThis || heardThis
                    ? "#fff"
                    : "#5C5A62",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12, fontWeight: 700,
                  display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 6,
                  transition: "all 0.2s",
                }}
              >
                {(() => {
                  if (currentLine === i) {
                    console.log("[BUTTON RENDER]", {
                      line: i,
                      isProcessingThis,
                      isListeningThis,
                      branch: isProcessingThis
                        ? "PROCESSING"
                        : isListeningThis
                        ? "LISTENING"
                        : "DEFAULT",
                    });
                  }
                  return null;
                })()}
                {isProcessingThis ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <circle cx="6.5" cy="6.5" r="5.5"
                        stroke="#9E9BA4" strokeWidth="1.3"
                        strokeDasharray="3 2"/>
                    </svg>
                    {t.processing}
                  </>
                ) : isListeningThis ? (
                  <>
                    <IconWave color="#fff" />
                    {t.listening}
                  </>
                ) : (
                  <>
                    <IconMic
                      color={
                        isDoneThis ? "#3A3A3A"
                        : heardThis ? "#fff"
                        : "#5C5A62"
                      }
                    />
                    {t.tap_to_speak}
                  </>
                )}
              </button>
            </div>

            {/* Retry 메시지 */}
            {retryIndex === i && !completed[i] && (
              <div style={{
                marginTop: 8,
                background: "rgba(226,75,74,0.12)",
                borderRadius: 8,
                padding: "7px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                <div style={{
                  width: 5, height: 5,
                  borderRadius: "50%",
                  background: "#E24B4A",
                  flexShrink: 0,
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
