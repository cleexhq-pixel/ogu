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
    say_again: "Say it again",
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
    say_again: "다시 말하기",
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
    say_again: "Ulangi lagi",
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
    say_again: "Falar de novo",
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
    say_again: "Reparler",
    done: "Terminé",
    retry_msg: "Pas entendu. Appuyez et réessayez!",
    voice_label: "Voix de l'idol",
    voice_female: "Féminin",
    voice_male: "Masculin",
  },
};

const loadingTexts = {
  en: {
    title: "Getting your 90 seconds ready...",
    subtitle: "Preparing every word for your fansign moment",
  },
  ko: {
    title: "90초를 준비하고 있어요...",
    subtitle: "팬싸 순간을 위해 모든 대사를 준비 중이에요",
  },
  id: {
    title: "Menyiapkan 90 detikmu...",
    subtitle: "Mempersiapkan setiap kata untuk momen fansign-mu",
  },
  fr: {
    title: "Tes 90 secondes se préparent...",
    subtitle: "Chaque mot est préparé pour ton moment fansign",
  },
  pt: {
    title: "Preparando seus 90 segundos...",
    subtitle: "Cada palavra pronta para o seu momento no fansign",
  },
};

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  Suspense,
  useCallback,
} from "react";
import { useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import scenarios from "../../../src/data/scenarios";
import { generateScript } from "../../../src/lib/generateScript";
import { useSpeechRecognition } from "../../../src/hooks/useSpeechRecognition";
import { normalizeLang } from "../../lib/i18n";

// 고정 템플릿 (API 호출 불필요)
const LINE1_TRANSLATIONS = {
  en: "Hello!",
  ko: "안녕하세요!",
  id: "Halo!",
  pt: "Olá!",
  fr: "Bonjour !",
};

const LINE4_TRANSLATIONS = {
  en: "So happy to meet you!",
  ko: "만나서 행복해요!",
  id: "Senang ketemu!",
  pt: "Feliz em te ver!",
  fr: "Content de te voir !",
};

function buildLine1(uiLang) {
  const lang = normalizeLang(uiLang);
  return {
    korean: "안녕하세요!",
    romanization: "Annyeonghaseyo!",
    translation: LINE1_TRANSLATIONS[lang] || LINE1_TRANSLATIONS.en,
    isTemplate: true,
  };
}

function buildLine4(uiLang) {
  const lang = normalizeLang(uiLang);
  return {
    korean: "만나서 행복해요!",
    romanization: "Mannaseo haengbokhaeyo!",
    translation: LINE4_TRANSLATIONS[lang] || LINE4_TRANSLATIONS.en,
    isTemplate: true,
  };
}

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
  const [heard, setHeard] = useState([false, false, false, false]);
  const listenPhaseRef = useRef("idle");
  // "idle"      = 초기/완료 상태
  // "waiting"   = 탭했지만 아직 isListening=true 안 됨
  // "listening" = 녹음 중 (isListening true)
  const currentLineRef = useRef(currentLine);
  currentLineRef.current = currentLine;
  const completedRef = useRef(completed);
  completedRef.current = completed;
  const lastCompletionKeyRef = useRef("");
  const audioRef = useRef(null);
  const [holdLineIndex, setHoldLineIndex] = useState(null);
  const [expandedLines, setExpandedLines] = useState(new Set());
  const [completingLines, setCompletingLines] = useState(new Set());
  const {
    transcript,
    isListening,
    hasResult,
    isTranscribing,
    startListening,
    stopListening,
    reset,
    finishTranscribing,
  } = useSpeechRecognition();

  const micBusy = isTranscribing || holdLineIndex !== null;

  useEffect(() => {
    const savedLang = localStorage.getItem(LANG_KEY) || "en";
    setLang(savedLang);
    const savedGender = localStorage.getItem(VOICE_KEY) || "FEMALE";
    setVoiceGender(savedGender);
  }, []);

  useEffect(() => {
    if (!scenarioId) return;

    async function loadScript() {
      const uiLang = normalizeLang(
        typeof window !== "undefined"
          ? localStorage.getItem(LANG_KEY) || "en"
          : "en",
      );
      const cacheKey = `kkobi_m90s_v6_${scenarioId}_${uiLang}`;

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
          buildLine1(uiLang),
          { ...generated.line2, isTemplate: false },
          { ...generated.line3, isTemplate: false },
          buildLine4(uiLang),
        ];
        setLines(newLines);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(newLines));
        } catch (e) {}
      } catch (e) {
        console.error(e);
        const fallbacks = {
          compliment: [
            { korean: "노래 진짜 좋아요!", romanization: "Norae jinjja joayo!", translation: "Your music is amazing!", isTemplate: false },
            { korean: "항상 응원해요!", romanization: "Hangsang eungwonhaeyo!", translation: "Always cheering for you!", isTemplate: false },
          ],
          birthday: [
            { korean: "생일 축하해요!", romanization: "Saengil chukahaeyo!", translation: "Happy birthday!", isTemplate: false },
            { korean: "건강하게 지내요!", romanization: "Geonganghage jinaeyo!", translation: "Stay healthy!", isTemplate: false },
          ],
          encouragement: [
            { korean: "노래가 힘이 됐어요!", romanization: "Noraega himi dwaesseoyo!", translation: "Your music helped me!", isTemplate: false },
            { korean: "계속 응원할게요!", romanization: "Gyesok eungwonhalgeyo!", translation: "I'll keep cheering!", isTemplate: false },
          ],
          game: [
            { korean: "게임 같이 해요!", romanization: "Geim gachi haeyo!", translation: "Let's play a game!", isTemplate: false },
            { korean: "저 잘해요!", romanization: "Jeo jalhaeyo!", translation: "I'm good at it!", isTemplate: false },
          ],
          request: [
            { korean: "볼하트 해줄 수 있어요?", romanization: "Bolhateu haejul su isseoyo?", translation: "Can you do a finger heart?", isTemplate: false },
            { korean: "부탁드려요!", romanization: "Butakdeuryeoyo!", translation: "Please!", isTemplate: false },
          ],
          question: [
            { korean: "요즘 뭐가 좋아요?", romanization: "Yojeum mwoga joayo?", translation: "What do you like lately?", isTemplate: false },
            { korean: "정말 궁금해요!", romanization: "Jeongmal gunggeumhaeyo!", translation: "I'm so curious!", isTemplate: false },
          ],
          confession: [
            { korean: "오래 좋아했어요!", romanization: "Orae joahaesseoyo!", translation: "I've liked you for so long!", isTemplate: false },
            { korean: "만나서 행복해요!", romanization: "Mannaseo haengbokhaeyo!", translation: "Happy to meet you!", isTemplate: false },
          ],
        };
        const fb = fallbacks[scenarioId] || fallbacks.compliment;
        setLines([buildLine1(uiLang), fb[0], fb[1], buildLine4(uiLang)]);
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

  function completeCurrentLine(index) {
    const newCompleted = [...completed];
    newCompleted[index] = true;
    setCompleted(newCompleted);
    setRetryIndex(null);
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
  }

  function handleHear(index) {
    if (!lines?.[index]) return;
    playTTS(lines[index].korean, index);
  }

  function handleSay(index) {
    if (!lines) return;

    if (isListening && currentLine === index) {
      stopListening();
      return;
    }

    if (micBusy) return;

    if (isListening && currentLine !== index) {
      stopListening();
      reset();
    }

    setCurrentLine(index);
    setRetryIndex(null);
    setHoldLineIndex(null);
    listenPhaseRef.current = "waiting";

    setTimeout(() => {
      startListening();
    }, 300);
  }

  const toggleExpandLine = useCallback((index) => {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
        if (completedRef.current[index]) {
          trackEvent("m90s_line_replay", {
            scenario: scenarioId,
            line_index: index + 1,
          });
        }
      }
      return next;
    });
  }, [scenarioId]);

  useLayoutEffect(() => {
    if (!hasResult || !transcript.trim()) {
      lastCompletionKeyRef.current = "";
      return undefined;
    }

    const line = currentLineRef.current;
    if (line === null || line > 3 || completedRef.current[line]) {
      return undefined;
    }
    if (
      listenPhaseRef.current !== "listening" &&
      listenPhaseRef.current !== "waiting"
    ) {
      return undefined;
    }

    const key = `${line}|${transcript.trim()}`;
    if (lastCompletionKeyRef.current === key) {
      return undefined;
    }
    lastCompletionKeyRef.current = key;

    listenPhaseRef.current = "idle";
    setCompletingLines((prev) => new Set([...prev, line]));
    setHoldLineIndex(line);
    finishTranscribing();

    const id = setTimeout(() => {
      lastCompletionKeyRef.current = "";
      setHoldLineIndex(null);
      setRetryIndex(null);

      setCompleted((prev) => {
        if (prev[line]) return prev;
        const next = [...prev];
        next[line] = true;
        return next;
      });

      setCompletingLines((prev) => {
        const next = new Set(prev);
        next.delete(line);
        return next;
      });

      const nextLine = line + 1;
      if (nextLine < 4) {
        setCurrentLine(nextLine);
      }

      reset();
      listenPhaseRef.current = "idle";
    }, 800);

    return () => {
      clearTimeout(id);
    };
  }, [hasResult, transcript, reset, finishTranscribing]);

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
          !isTranscribing &&
          currentLine !== null
        ) {
          setRetryIndex(currentLine);
          reset();
          listenPhaseRef.current = "idle";
          setHoldLineIndex(null);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isListening, hasResult, currentLine, reset, transcript, isTranscribing]);

  function handleNext() {
    if (!lines?.length) return;

    const copy = PREP_COPY[lang] || PREP_COPY.en;
    const payloadLines = lines.map((line, i) => {
      const rawLabel = copy.line_labels?.[i];
      const label =
        typeof rawLabel === "string" && rawLabel.includes(" · ")
          ? rawLabel.split(" · ")[1]?.trim()
          : undefined;

      return {
        korean: line.korean,
        romanization: line.romanization,
        translation: line.translation,
        ...(label ? { label } : {}),
      };
    });

    localStorage.setItem(
      "kkobi_m90s_saved",
      JSON.stringify({ lines: payloadLines })
    );
    localStorage.setItem("kkobi_m90s_last_scenario", scenarioId);
    trackEvent("m90s_prep_completed", {
      scenario: scenarioId,
      completed_lines: completed.filter(Boolean).length,
      total_lines: lines.length,
    });

    const billing = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    window.location.href = `/my-90-seconds/call?scenario=${scenarioId}&billing=${encodeURIComponent(
      billing,
    )}`;
  }

  const allDone = completed.every(Boolean);
  const activeLineIndex = completed.findIndex((c) => !c);
  const t = PREP_COPY[lang] || PREP_COPY.en;
  const loadT = loadingTexts[lang] || loadingTexts.en;

  function getLineLabel(i) {
    const raw = t.line_labels?.[i];
    if (typeof raw === "string" && raw.includes(" · ")) {
      return raw.split(" · ")[1]?.trim() ?? "";
    }
    return "";
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0E0E0F",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Manrope, Inter, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "#F2F0F4",
            marginBottom: "8px",
            letterSpacing: "-0.01em",
          }}
        >
          {loadT.title}
        </div>

        <div
          style={{
            fontSize: "11px",
            color: "#7A7882",
            marginBottom: "32px",
          }}
        >
          {loadT.subtitle}
        </div>

        <div
          style={{
            display: "flex",
            gap: "6px",
          }}
        >
          {[0.3, 0.65, 1].map((op, i) => (
            <span
              key={i}
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#FFD84D",
                opacity: op,
                animation: `dot-bounce 1.4s ${i * 0.2}s infinite`,
                display: "inline-block",
              }}
            />
          ))}
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
              ? "#FFD84D"
              : "rgba(255,255,255,0.1)",
            transition: "background 0.3s",
          }} />
        ))}
      </div>

      {/* Header */}
      <div style={{ position: "relative", zIndex: 1, marginBottom: 24 }}>
        <div
          className="m-eyebrow"
          style={{ marginBottom: 8, color: "#FFD84D" }}
        >
          {scenario.emoji} {t.eyebrow(scenarioId)}
        </div>
        <h1 style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "#F2F0F4",
          lineHeight: 1.15,
          margin: 0,
        }}>
          {t.title_1}<br />
          <span style={{ color: "#FFD84D" }}>{t.title_2}</span>
        </h1>
      </div>

      {/* Lines */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative", zIndex: 1 }}>
        {lines && lines.map((line, i) => {
          const isDone = completed[i];
          const isActive = i === activeLineIndex;
          const isExpanded = expandedLines.has(i);
          const lineLabel = getLineLabel(i);
          const isListeningThis = isListening && currentLine === i;
          const isProcessingThis =
            currentLine === i &&
            !completed[i] &&
            !isListeningThis &&
            (completingLines.has(i) ||
              holdLineIndex === i ||
              isTranscribing ||
              micBusy);
          const isPlayingThis = isPlaying && playingLine === i;

          if (isDone) {
            return (
              <div
                key={i}
                onClick={() => toggleExpandLine(i)}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: isExpanded ? "14px" : "10px 14px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <p style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "rgba(255,216,77,0.6)",
                    margin: 0,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    fontFamily: "Manrope, sans-serif",
                  }}>
                    {`LINE ${i + 1} · ${lineLabel}`}
                  </p>
                  <span style={{
                    fontSize: 11,
                    color: isExpanded ? "rgba(255,216,77,0.4)" : "#FFD84D",
                  }}>
                    {isExpanded ? "∧" : "✓"}
                  </span>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#F2F0F4",
                      margin: 0,
                      lineHeight: 1.4,
                      fontFamily: "Manrope, sans-serif",
                    }}>
                      {line.korean}
                    </p>
                    {line.romanization && (
                      <p style={{
                        fontSize: 10,
                        color: "#7A7882",
                        margin: "4px 0 0",
                        fontStyle: "italic",
                        fontFamily: "Inter, sans-serif",
                      }}>
                        {line.romanization}
                      </p>
                    )}
                    {line.translation && (
                      <p style={{
                        fontSize: 10,
                        color: "#B0AEB8",
                        margin: "3px 0 0",
                        fontFamily: "Inter, sans-serif",
                      }}>
                        {line.translation}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleHear(i); }}
                        style={{
                          flex: 1,
                          background: "transparent",
                          border: "0.5px solid rgba(255,216,77,0.5)",
                          borderRadius: 100,
                          padding: "9px",
                          color: "rgba(255,216,77,0.7)",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          fontFamily: "Manrope, sans-serif",
                          cursor: "pointer",
                        }}
                      >
                        {isPlayingThis ? t.playing : t.listen}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSay(i); }}
                        style={{
                          flex: 1,
                          background: "rgba(255,216,77,0.15)",
                          border: "0.5px solid rgba(255,216,77,0.3)",
                          borderRadius: 100,
                          padding: "9px",
                          color: "#FFD84D",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          fontFamily: "Manrope, sans-serif",
                          cursor: "pointer",
                        }}
                      >
                        {t.say_again}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          if (isActive) {
            return (
              <div
                key={i}
                style={{
                  background: "rgba(255,216,77,0.05)",
                  border: "0.5px solid #FFD84D",
                  borderRadius: 14,
                  padding: "14px",
                }}
              >
                <p style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#FFD84D",
                  margin: "0 0 8px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontFamily: "Manrope, sans-serif",
                }}>
                  {`LINE ${i + 1} · ${lineLabel}`}
                </p>
                <p style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#F2F0F4",
                  margin: 0,
                  lineHeight: 1.4,
                  fontFamily: "Manrope, sans-serif",
                }}>
                  {line.korean}
                </p>
                {line.romanization && (
                  <p style={{
                    fontSize: 10,
                    color: "#7A7882",
                    margin: "4px 0 0",
                    fontStyle: "italic",
                    fontFamily: "Inter, sans-serif",
                  }}>
                    {line.romanization}
                  </p>
                )}
                {line.translation && (
                  <p style={{
                    fontSize: 10,
                    color: "#B0AEB8",
                    margin: "3px 0 0",
                    fontFamily: "Inter, sans-serif",
                  }}>
                    {line.translation}
                  </p>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => handleHear(i)}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "0.5px solid #FFD84D",
                      borderRadius: 100,
                      padding: "9px",
                      color: "#FFD84D",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      fontFamily: "Manrope, sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    {isPlayingThis ? t.playing : t.listen}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSay(i)}
                    style={{
                      flex: 1,
                      background: isListeningThis || isProcessingThis
                        ? "rgba(255,216,77,0.15)"
                        : "#FFD84D",
                      border: isListeningThis || isProcessingThis
                        ? "0.5px solid rgba(255,216,77,0.3)"
                        : "none",
                      borderRadius: 100,
                      padding: "9px",
                      color: isListeningThis || isProcessingThis
                        ? "#FFD84D"
                        : "#0E0E0F",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      fontFamily: "Manrope, sans-serif",
                      cursor: "pointer",
                      opacity: isProcessingThis ? 0.85 : 1,
                    }}
                  >
                    {isProcessingThis
                      ? t.processing
                      : isListeningThis
                        ? t.listening
                        : t.tap_to_speak}
                  </button>
                </div>

                {retryIndex === i && (
                  <div style={{
                    marginTop: 8,
                    background: "rgba(255,216,77,0.08)",
                    border: "0.5px solid rgba(255,216,77,0.3)",
                    borderRadius: 8,
                    padding: "7px 12px",
                  }}>
                    <p style={{
                      fontSize: 11,
                      color: "#FFD84D",
                      margin: 0,
                      fontWeight: 500,
                    }}>
                      {t.retry_msg}
                    </p>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "0.5px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "10px 14px",
                opacity: 0.3,
              }}
            >
              <p style={{
                fontSize: 9,
                fontWeight: 700,
                color: "#F2F0F4",
                margin: 0,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontFamily: "Manrope, sans-serif",
              }}>
                {`LINE ${i + 1} · ${lineLabel}`}
              </p>
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
            justifyContent: "center",
            padding: "14px 24px",
            borderRadius: 9999,
            background: allDone ? "#FFD84D" : "rgba(255,255,255,0.05)",
            border: "none",
            cursor: allDone ? "pointer" : "not-allowed",
            transition: "background 0.2s",
          }}
        >
          <span style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 10,
            fontWeight: 700,
            color: allDone ? "#0E0E0F" : "rgba(255,255,255,0.2)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            {allDone ? `${t.next} →` : t.next}
          </span>
        </button>
        {!allDone && (
          <p style={{
            textAlign: "center",
            fontSize: 9,
            color: "#7A7882",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginTop: 10,
          }}>
            {t.hint}
          </p>
        )}
      </div>

      {process.env.NODE_ENV === "development" && (
        <button
          type="button"
          onClick={() => {
            stopListening();
            reset();
            listenPhaseRef.current = "idle";
            setRetryIndex(null);
            lastCompletionKeyRef.current = "";
            setHoldLineIndex(null);
            setCompleted([true, true, true, true]);
          }}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#FFD84D",
            color: "#000",
            border: "none",
            borderRadius: "9999px",
            padding: "10px 18px",
            fontSize: "12px",
            fontWeight: "800",
            fontFamily: "Manrope, sans-serif",
            cursor: "pointer",
            zIndex: 9999,
            letterSpacing: "0.08em",
          }}
        >
          ⚡ DEV SKIP
        </button>
      )}
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
        <p style={{ color: "#7A7882", fontSize: 13 }}>
          Loading...
        </p>
      </div>
    }>
      <PrepPageInner />
    </Suspense>
  );
}
