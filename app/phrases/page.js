"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function getLangFromSearch(searchParams) {
  const lang = searchParams.get("lang");
  if (lang === "ko" || lang === "id" || lang === "en") return lang;
  return "en";
}

function PhrasesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState("en");
  const [phrases, setPhrases] = useState([]);

  useEffect(() => {
    const lang = getLangFromSearch(searchParams);
    setLanguage(lang);
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("ogu_saved_phrases");
      if (!raw) {
        setPhrases([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setPhrases(parsed);
      } else {
        setPhrases([]);
      }
    } catch {
      setPhrases([]);
    }
  }, [searchParams]);

  const labels = {
    title:
      language === "ko"
        ? "내 표현장 📚"
        : language === "id"
        ? "Frasaku 📚"
        : "My Phrases 📚",
    empty:
      language === "ko"
        ? "아직 저장된 표현이 없어요.\n리포트에서 표현을 저장해보세요! 🐥"
        : language === "id"
        ? "Belum ada frasa tersimpan.\nSimpan dari laporan kamu! 🐥"
        : "No saved phrases yet.\nSave expressions from your report! 🐥",
    back:
      language === "ko"
        ? "← 뒤로가기"
        : language === "id"
        ? "← Kembali"
        : "← Back",
    speak:
      language === "ko" ? "듣기" : language === "id" ? "Dengar" : "Listen",
    chat:
      language === "ko"
        ? "대화하기"
        : language === "id"
        ? "Mulai obrolan"
        : "Chat",
    remove:
      language === "ko"
        ? "삭제"
        : language === "id"
        ? "Hapus"
        : "Delete"
  };

  const handleSpeak = (korean) => {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const utterance = new SpeechSynthesisUtterance(korean);
    utterance.lang = "ko-KR";
    utterance.rate = 0.9;
    synth.cancel();
    synth.speak(utterance);
  };

  const handleChat = (korean) => {
    const params = new URLSearchParams();
    params.set("seed", korean);
    params.set("lang", language);
    router.push(`/chat?${params.toString()}`);
  };

  const handleDelete = (index) => {
    setPhrases((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ogu_saved_phrases", JSON.stringify(next));
      }
      return next;
    });
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    } catch {
      return iso;
    }
  };

  const backToReport = () => {
    router.back();
  };

  const translationFor = (phrase) => {
    // 현재 저장 구조에서는 영어 번역만 있으므로 그대로 사용
    return phrase.translation ?? phrase.english ?? "";
  };

  return (
    <main className="min-h-screen bg-[#FFF8F0] px-4 py-6 text-[#3D2010]">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={backToReport}
            className="text-[13px] text-[#9A7060] transition hover:text-[#FF6B4A]"
          >
            {labels.back}
          </button>
          <h1 className="text-lg font-bold">{labels.title}</h1>
          <div className="w-10" />
        </header>

        {phrases.length === 0 ? (
          <div className="rounded-3xl border border-[#FFE0D0] bg-[#FFFFFF] px-4 py-10 text-center text-[13px] whitespace-pre-line text-[#9A7060] shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
            {labels.empty}
          </div>
        ) : (
          <section className="space-y-3">
            {phrases.map((p, idx) => (
              <article
                key={`${p.korean}-${idx}`}
                className="rounded-3xl border border-[#FFE0D0] bg-[#FFFFFF] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.05)]"
              >
                <p className="text-sm font-semibold text-[#3D2010]">
                  {p.korean}
                </p>
                <p className="mt-1 text-[11px] text-[#9A7060]">
                  {translationFor(p)}
                </p>
                <p className="mt-1 text-[10px] text-[#C09A8A]">
                  {formatDate(p.saved_at)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleSpeak(p.korean)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#FFE0D0] bg-[#FFF8F0] px-3 py-1 font-medium text-[#3D2010] hover:border-[#FF6B4A] hover:bg-[#FFF0E8]"
                  >
                    🔊 {labels.speak}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChat(p.korean)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#FFE0D0] bg-[#FFF8F0] px-3 py-1 font-medium text-[#3D2010] hover:border-[#FF6B4A] hover:bg-[#FFF0E8]"
                  >
                    💬 {labels.chat}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(idx)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#FFE0D0] bg-[#FFF8F0] px-3 py-1 font-medium text-[#B71C1C] hover:border-[#F44336] hover:bg-[#FFEBEE]"
                  >
                    🗑️ {labels.remove}
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

export default function PhrasesPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#FFF8F0] px-4 py-6 text-[#3D2010]">
          <span className="animate-pulse-soft">🐥</span>
        </main>
      }
    >
      <PhrasesContent />
    </Suspense>
  );
}


