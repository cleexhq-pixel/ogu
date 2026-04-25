"use client";
import { useState, useRef, useCallback } from "react";

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  const recognitionRef = useRef(null);
  const safetyTimerRef = useRef(null);
  const hasResultRef = useRef(false);

  const isIOS = typeof navigator !== "undefined"
    && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const reset = useCallback(() => {
    setTranscript("");
    setHasResult(false);
    hasResultRef.current = false;
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported");
      return;
    }

    // 시작 전 반드시 초기화
    setTranscript("");
    setHasResult(false);
    hasResultRef.current = false;

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    // iOS에서는 interimResults 끄는 것이 더 안정적
    recognition.interimResults = !isIOS;

    recognition.onstart = () => {
      setIsListening(true);

      // 10초 안전 타임아웃
      safetyTimerRef.current = setTimeout(() => {
        if (!hasResultRef.current) {
          console.warn("10초 타임아웃: 결과 없음");
          stopListening();
        }
      }, 10000);
    };

    recognition.onresult = (event) => {
      // 타임아웃 취소
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
      }

      const result = event.results[event.results.length - 1];
      const text = result[0].transcript.trim();

      if (text.length > 0) {
        hasResultRef.current = true;
        setHasResult(true);
        setTranscript(text);
      }

      // isFinal + 텍스트 있을 때만 완료
      if (result.isFinal && text.length > 0) {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
      }
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
      }
      console.warn("Speech recognition error:", event.error);
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("Recognition start error:", e);
      setIsListening(false);
    }
  }, [isIOS, stopListening]);

  return {
    transcript,
    isListening,
    hasResult,
    startListening,
    stopListening,
    reset,
  };
}
