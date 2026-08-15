"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

const LANG_KEY = "ogu_lang";
const VOICE_KEY = "kkobi_voice_gender";
const INTENT_TEXT_KEY = "kkobi_m90s_intent_text";
const INTENT_KO_KEY = "kkobi_m90s_intent_ko";

const EXAMPLES = [
  "I've loved you since day one",
  "You got me through a hard time",
  "Take care of yourself, always",
];

const COPY = {
  en: {
    hero_line1: "What's the one thing",
    hero_line2: "you want to tell them?",
    textarea_placeholder: "your words, any language",
    dont_know_yet: "I don't know yet →",
    who_calling: "who's calling?",
    voice_female: "Female",
    voice_male: "Male",
    cta_call: "Take the call",
    loading: "Getting your words ready…",
    error_msg: "That didn't go through.",
    retry: "Try again",
    step2_label: "your words, in Korean",
    hear_it: "hear it",
    can_you_say: "Can you actually say it out loud?",
  },
  ko: {
    hero_line1: "가장 하고 싶은 말,",
    hero_line2: "한 가지만 골라볼까요?",
    textarea_placeholder: "무슨 언어든 편하게 적어보세요",
    dont_know_yet: "아직 잘 모르겠어요 →",
    who_calling: "누구한테 거는 통화인가요?",
    voice_female: "여성",
    voice_male: "남성",
    cta_call: "통화 시작하기",
    loading: "말을 옮기고 있어요…",
    error_msg: "다시 한번 해볼까요?",
    retry: "다시 시도",
    step2_label: "한국어로는 이렇게 말해요",
    hear_it: "들어보기",
    can_you_say: "이제 소리 내서 말해볼 수 있나요?",
  },
  id: {
    hero_line1: "Satu hal yang paling",
    hero_line2: "ingin kamu sampaikan?",
    textarea_placeholder: "tulis kata-katamu, bahasa apa saja",
    dont_know_yet: "Belum tahu →",
    who_calling: "mau telepon siapa?",
    voice_female: "Perempuan",
    voice_male: "Laki-laki",
    cta_call: "Mulai teleponnya",
    loading: "Sedang menyiapkan kata-katamu…",
    error_msg: "Ada yang tidak berhasil.",
    retry: "Coba lagi",
    step2_label: "kata-katamu, dalam bahasa Korea",
    hear_it: "dengarkan",
    can_you_say: "Coba, bisa kamu ucapkan dengan suara keras?",
  },
  pt: {
    hero_line1: "Qual é a única coisa",
    hero_line2: "que você quer dizer?",
    textarea_placeholder: "suas palavras, em qualquer idioma",
    dont_know_yet: "Ainda não sei →",
    who_calling: "pra quem é a ligação?",
    voice_female: "Feminino",
    voice_male: "Masculino",
    cta_call: "Atender a ligação",
    loading: "Preparando suas palavras…",
    error_msg: "Isso não funcionou.",
    retry: "Tentar de novo",
    step2_label: "suas palavras, em coreano",
    hear_it: "ouvir",
    can_you_say: "Consegue dizer isso em voz alta?",
  },
  fr: {
    hero_line1: "Quelle est la seule chose",
    hero_line2: "que vous voulez lui dire?",
    textarea_placeholder: "vos mots, dans n'importe quelle langue",
    dont_know_yet: "Je ne sais pas encore →",
    who_calling: "l'appel est pour qui?",
    voice_female: "Féminin",
    voice_male: "Masculin",
    cta_call: "Prendre l'appel",
    loading: "Préparation de vos mots…",
    error_msg: "Ça n'a pas fonctionné.",
    retry: "Réessayer",
    step2_label: "vos mots, en coréen",
    hear_it: "écouter",
    can_you_say: "Pouvez-vous le dire à voix haute?",
  },
};

function FemaleIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="5" />
      <line x1="12" y1="13" x2="12" y2="21" />
      <line x1="9" y1="18" x2="15" y2="18" />
    </svg>
  );
}

function MaleIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="14" r="5" />
      <line x1="14" y1="10" x2="20" y2="4" />
      <polyline points="14 4 20 4 20 10" />
    </svg>
  );
}

function PlayIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={color}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={color}>
      <rect x="6" y="5" width="4" height="14" />
      <rect x="14" y="5" width="4" height="14" />
    </svg>
  );
}

export default function IntentPage() {
  const router = useRouter();
  const textareaRef = useRef(null);
  const audioRef = useRef(null);

  const [lang, setLang] = useState("en");
  const [step, setStep] = useState(1);
  const [text, setText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [voiceGender, setVoiceGender] = useState("FEMALE");
  const [korean, setKorean] = useState("");
  const [romanized, setRomanized] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(false);
  const [isHearingIt, setIsHearingIt] = useState(false);

  useEffect(() => {
    setLang(localStorage.getItem(LANG_KEY) || "en");
    setVoiceGender(localStorage.getItem(VOICE_KEY) || "FEMALE");
  }, []);

  const t = COPY[lang] || COPY.en;

  function handleExampleClick(example) {
    setText(example);
    setShowExamples(false);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(example.length, example.length);
      }
    });
  }

  function handleGenderSelect(g) {
    setVoiceGender(g);
    if (typeof window !== "undefined") {
      localStorage.setItem(VOICE_KEY, g);
    }
  }

  async function handleTranslate() {
    const trimmed = text.trim();
    if (!trimmed || isTranslating) return;
    setIsTranslating(true);
    setTranslateError(false);
    try {
      const res = await fetch("/api/translate-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, lang }),
      });
      if (!res.ok) throw new Error("translate_failed");
      const data = await res.json();
      if (!data?.korean) throw new Error("translate_failed");
      setKorean(data.korean);
      setRomanized(data.romanized || "");
      if (typeof window !== "undefined") {
        localStorage.setItem(INTENT_TEXT_KEY, trimmed);
        localStorage.setItem(INTENT_KO_KEY, data.korean);
      }
      trackEvent("m90s_intent_translated", { lang });
      setStep(2);
    } catch {
      setTranslateError(true);
    } finally {
      setIsTranslating(false);
    }
  }

  async function handleHearIt() {
    if (isHearingIt || !korean) return;
    setIsHearingIt(true);
    window.setTimeout(() => setIsHearingIt(false), 1200);
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: korean, lang: "ko", gender: voiceGender }),
      });
      const data = await res.json();
      if (data?.audioContent) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        audioRef.current = audio;
        void audio.play();
      }
    } catch {
      // 재생 실패는 조용히 무시 — 아이콘은 타이머로 이미 원상 복귀됨
    }
  }

  function handleTakeCall() {
    trackEvent("m90s_scenario_selected", {
      scenario: "compliment",
      user_type: "guest",
    });
    router.push("/my-90-seconds/prep?scenario=compliment");
  }

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Gabarito:wght@600;700&display=swap"
        rel="stylesheet"
      />
      <div
        style={{
          width: 390,
          maxWidth: "100%",
          margin: "0 auto",
          background: "#FFF8F6",
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Pretendard Variable', Inter, sans-serif",
          color: "#2A1815",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 0" }}>
          <div style={{ fontFamily: "'Gabarito', sans-serif", fontWeight: 600, fontSize: 13, color: "#B39189" }}>
            my90sec
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 13, color: "#8C6961" }}>
            {step} / 2
          </div>
        </div>

        {step === 1 ? (
          <>
            <div style={{ padding: "32px 20px 0" }}>
              <div style={{ fontFamily: "'Gabarito', sans-serif", fontWeight: 700, fontSize: 28, lineHeight: 1.25, color: "#2A1815" }}>
                {t.hero_line1}
                <br />
                {t.hero_line2}
              </div>
            </div>

            <div style={{ padding: "24px 20px 0" }}>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={t.textarea_placeholder}
                style={{
                  width: "100%",
                  minHeight: 72,
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: isFocused ? "0.5px solid #FF5A47" : "0.5px solid #F0DDD8",
                  background: "#FFFFFF",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "#2A1815",
                  resize: "none",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />

              {!showExamples && (
                <div
                  onClick={() => setShowExamples(true)}
                  style={{
                    marginTop: 8,
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 500,
                    fontSize: 13,
                    color: "#D93B28",
                    cursor: "pointer",
                    display: "inline-block",
                  }}
                >
                  {t.dont_know_yet}
                </div>
              )}

              {showExamples && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                  {EXAMPLES.map((ex) => (
                    <div
                      key={ex}
                      onClick={() => handleExampleClick(ex)}
                      style={{
                        alignSelf: "flex-start",
                        padding: "8px 16px",
                        borderRadius: 999,
                        background: "#FFD9D2",
                        color: "#D93B28",
                        fontFamily: "Inter, sans-serif",
                        fontWeight: 500,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      {ex}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: 1 }} />

            {translateError && (
              <div style={{ padding: "0 20px", marginBottom: 12 }}>
                <p style={{ fontSize: 12, color: "#D93B28", marginBottom: 6 }}>{t.error_msg}</p>
                <button
                  type="button"
                  onClick={handleTranslate}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#D93B28",
                    background: "none",
                    border: "none",
                    textDecoration: "underline",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {t.retry}
                </button>
              </div>
            )}

            <div style={{ padding: "0 20px 24px" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#8C6961", marginBottom: 12 }}>
                {t.who_calling}
              </div>
              <div
                style={{
                  display: "inline-flex",
                  padding: 4,
                  borderRadius: 999,
                  border: "0.5px solid #F0DDD8",
                  background: "#FFEDE8",
                  gap: 4,
                  marginBottom: 24,
                }}
              >
                <button
                  type="button"
                  aria-label={t.voice_female}
                  onClick={() => handleGenderSelect("FEMALE")}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: voiceGender === "FEMALE" ? "#FF5A47" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    border: "none",
                    padding: 0,
                  }}
                >
                  <FemaleIcon color={voiceGender === "FEMALE" ? "#FFFFFF" : "#8C6961"} />
                </button>
                <button
                  type="button"
                  aria-label={t.voice_male}
                  onClick={() => handleGenderSelect("MALE")}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: voiceGender === "MALE" ? "#FF5A47" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    border: "none",
                    padding: 0,
                  }}
                >
                  <MaleIcon color={voiceGender === "MALE" ? "#FFFFFF" : "#8C6961"} />
                </button>
              </div>

              <button
                type="button"
                onClick={handleTranslate}
                disabled={!text.trim() || isTranslating}
                style={{
                  width: "100%",
                  textAlign: "center",
                  padding: "14px 24px",
                  borderRadius: 999,
                  background: text.trim() ? "#FF5A47" : "#FFD9D2",
                  color: "#FFFFFF",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 600,
                  fontSize: 15,
                  border: "none",
                  cursor: text.trim() && !isTranslating ? "pointer" : "default",
                }}
              >
                {isTranslating ? t.loading : t.cta_call}
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 20px",
                gap: 24,
              }}
            >
              <div style={{ width: "100%", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 13, color: "#8C6961" }}>
                {t.step2_label}
              </div>

              <div
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "0.5px solid #F0DDD8",
                  background: "#FFFFFF",
                  padding: 24,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontFamily: "'Pretendard Variable', sans-serif", fontWeight: 600, fontSize: 20, lineHeight: 1.45, color: "#2A1815" }}>
                    {korean}
                  </div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontStyle: "italic", fontSize: 11, lineHeight: 1.4, color: "#8C6961", marginTop: 6 }}>
                    {romanized}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleHearIt}
                  style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", alignSelf: "flex-start", background: "none", border: "none", padding: 0 }}
                >
                  {isHearingIt ? <PauseIcon color="#D93B28" /> : <PlayIcon color="#D93B28" />}
                  <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 13, color: "#D93B28" }}>{t.hear_it}</span>
                </button>
              </div>

              <div style={{ width: "100%", fontFamily: "Inter, sans-serif", fontSize: 15, lineHeight: 1.55, color: "#5C433D" }}>
                {t.can_you_say}
              </div>
            </div>

            <div style={{ padding: "0 20px 24px" }}>
              <button
                type="button"
                onClick={handleTakeCall}
                style={{
                  width: "100%",
                  textAlign: "center",
                  padding: "14px 24px",
                  borderRadius: 999,
                  background: "#FF5A47",
                  color: "#FFFFFF",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                  border: "none",
                }}
              >
                {t.cta_call}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
