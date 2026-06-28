"use client";
import { useState, useRef, useCallback } from "react";

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const safetyTimerRef = useRef(null);

  const reset = useCallback(() => {
    setTranscript("");
    setHasResult(false);
    setIsTranscribing(false);
  }, []);

  const finishTranscribing = useCallback(() => {
    setIsTranscribing(false);
  }, []);

  const stopListening = useCallback(() => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
      // 즉시 isListening=false로 설정
      // (Whisper API 응답을 기다리지 않고)
      setIsListening(false);
    }
  }, []);

  const startListening = useCallback(async () => {
    setTranscript("");
    setHasResult(false);
    setIsTranscribing(false);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000,
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        // 녹음이 끝나는 즉시 Listening UI 종료 (전사는 별도 단계)
        setIsListening(false);

        const audioBlob = new Blob(
          audioChunksRef.current,
          { type: mimeType }
        );

        if (audioBlob.size < 3000) {
          setHasResult(false);
          setIsTranscribing(false);
          return;
        }

        setIsTranscribing(true);

        let transcribeSucceeded = false;
        try {
          const formData = new FormData();
          const extension = mimeType.includes("mp4")
            ? "mp4"
            : mimeType.includes("webm")
            ? "webm"
            : "ogg";
          formData.append(
            "audio",
            audioBlob,
            `recording.${extension}`
          );

          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) throw new Error("Transcription failed");

          const data = await response.json();

          if (data.text && data.text.trim().length > 0) {
            setTranscript(data.text.trim());
            setHasResult(true);
            transcribeSucceeded = true;
          } else {
            setHasResult(false);
          }
        } catch (err) {
          console.error("Whisper API error:", err);
          setHasResult(false);
        } finally {
          if (!transcribeSucceeded) {
            setIsTranscribing(false);
          }
        }
      };

      mediaRecorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsListening(false);
        setHasResult(false);
        setIsTranscribing(false);
      };

      mediaRecorder.start();
      setIsListening(true);

      safetyTimerRef.current = setTimeout(() => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording"
        ) {
          mediaRecorderRef.current.stop();
        }
      }, 10000);

    } catch (err) {
      console.error("Microphone access error:", err);
      setIsListening(false);
      setHasResult(false);
      setIsTranscribing(false);
    }
  }, []);

  return {
    transcript,
    isListening,
    hasResult,
    isTranscribing,
    startListening,
    stopListening,
    reset,
    finishTranscribing,
  };
}

function getSupportedMimeType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const type of types) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(type)
    ) {
      return type;
    }
  }
  return "audio/webm";
}
