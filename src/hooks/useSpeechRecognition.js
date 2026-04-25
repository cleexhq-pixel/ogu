import { useState, useRef, useCallback } from "react";

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const restartedRef = useRef(false);
  const gotResultRef = useRef(false);

  const buildRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      gotResultRef.current = false;
      setIsListening(true);
    };
    recognition.onend = () => setIsListening(false);

    recognition.onerror = (e) => {
      // no-speech: 사용자가 아직 말을 시작하지 않은 상태 → 한 번 자동 재시작
      if (e.error === "no-speech" && !restartedRef.current) {
        restartedRef.current = true;
        try {
          const next = buildRecognition();
          recognitionRef.current = next;
          next.start();
          return;
        } catch {}
      }
      // audio-capture(마이크 자체 문제) 또는 그 외 치명적 에러만 실패 처리
      if (e.error === "audio-capture" || e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError(e.error);
      } else if (!gotResultRef.current) {
        // 결과를 한 번도 받지 못한 다른 종류의 에러도 실패로 간주(no-speech 제외)
        if (e.error !== "no-speech" && e.error !== "aborted") {
          setError(e.error);
        }
      }
      setIsListening(false);
    };

    recognition.onresult = (e) => {
      // 텍스트만 추출 — 음성 원본 저장 절대 금지
      let best = "";
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        // alternatives 중 가장 긴 transcript를 선택 (인식률 최대화)
        let chosen = "";
        for (let j = 0; j < result.length; j++) {
          const candidate = result[j].transcript || "";
          if (candidate.trim().length > chosen.trim().length) {
            chosen = candidate;
          }
        }
        best += chosen;
      }
      const trimmed = best.trim();
      if (trimmed.length >= 1) {
        gotResultRef.current = true;
        setTranscript(trimmed);
      }
    };

    return recognition;
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setError("음성 인식이 지원되지 않는 브라우저예요. Chrome을 사용해주세요.");
      return;
    }

    restartedRef.current = false;
    gotResultRef.current = false;

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      const recognition = buildRecognition();
      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      setError("start-failed");
      setIsListening(false);
    }
  }, [buildRecognition]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setIsListening(false);
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  return { transcript, isListening, error, startListening, stopListening, reset };
}
