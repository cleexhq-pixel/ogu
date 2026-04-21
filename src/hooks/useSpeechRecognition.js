import { useState, useRef, useCallback } from "react";

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setError("음성 인식이 지원되지 않는 브라우저예요. Chrome을 사용해주세요.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e) => {
      setError(e.error);
      setIsListening(false);
    };
    recognition.onresult = (e) => {
      // 텍스트만 추출 — 음성 원본 저장 절대 금지
      const text = e.results[0][0].transcript;
      setTranscript(text);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  return { transcript, isListening, error, startListening, stopListening, reset };
}
