"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { normalizeLang, OGU_LANG_KEY } from "@/app/lib/i18n";

const BRAND_PURPLE = "#6c2eff";
const BRAND_GOLD = "#ffd84d";
const LAVENDER_BG = "#EDE9FE";

/** @typedef {'ko'|'en'|'id'|'fr'|'pt'} UILang */

const COPY = /** @type {Record<UILang, { title: string; subtitle: string; send: string; later: string; placeholder: string; nudge: string; sendError: string }>} */ ({
  en: {
    title: "Before you go... 👋",
    subtitle: "How was your experience?",
    send: "Send feedback",
    later: "Maybe later",
    placeholder: "Any thoughts? (optional)",
    nudge: "A quick star rating helps us a lot — or tap Send again to share anyway.",
    sendError: "Could not send. Try again.",
  },
  ko: {
    title: "잠깐만요... 👋",
    subtitle: "어떠셨나요?",
    send: "피드백 보내기",
    later: "다음에",
    placeholder: "하고 싶은 말이 있나요? (선택)",
    nudge:
      "별점을 눌러 주시면 큰 도움이 돼요. 그래도 보내고 싶다면 ‘피드백 보내기’를 한 번 더 눌러 주세요.",
    sendError: "전송에 실패했어요. 다시 시도해 주세요.",
  },
  id: {
    title: "Sebelum pergi... 👋",
    subtitle: "Bagaimana pengalamanmu?",
    send: "Kirim feedback",
    later: "Nanti saja",
    placeholder: "Ada pendapat? (opsional)",
    nudge: "Bintang singkat sangat membantu — ketuk Kirim lagi untuk lanjut tanpa bintang.",
    sendError: "Gagal mengirim. Coba lagi.",
  },
  fr: {
    title: "Avant de partir... 👋",
    subtitle: "Comment était votre expérience?",
    send: "Envoyer",
    later: "Plus tard",
    placeholder: "Une idée ? (facultatif)",
    nudge: "Une note rapide nous aide beaucoup — touchez Envoyer une seconde fois pour continuer.",
    sendError: "Envoi impossible. Réessayez.",
  },
  pt: {
    title: "Antes de sair... 👋",
    subtitle: "Como foi sua experiência?",
    send: "Enviar feedback",
    later: "Mais tarde",
    placeholder: "Alguma sugestão? (opcional)",
    nudge: "Uma avaliação rápida ajuda muito — ou envie mesmo assim.",
  },
});

function readLang() {
  if (typeof window === "undefined") return /** @type {UILang} */ ("en");
  return normalizeLang(window.localStorage.getItem(OGU_LANG_KEY));
}

function shouldOfferFeedback() {
  if (typeof window === "undefined") return false;
  if (!window.localStorage.getItem("ogu_visited")) return false;
  if (window.localStorage.getItem("kkobi_feedback_given")) return false;
  return true;
}

function FeedbackModalUI({ open, onClose, lang, onSubmitted }) {
  const L = COPY[lang] ? lang : "en";
  const t = COPY[L];
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState("");
  const [nudge, setNudge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setRating(null);
    setComment("");
    setNudge(false);
    setError(null);
    setBusy(false);
  }, [open]);

  const submit = useCallback(async () => {
    if (busy) return;

    if (rating == null && !nudge) {
      setNudge(true);
      return;
    }

    setBusy(true);
    setError(null);

    const supabase = getSupabase();
    const langCode = readLang();
    // DB uses `language` (see app/report/page.js); spec "lang" maps here.
    const payload = {
      rating: rating ?? null,
      rating_label: rating != null ? `${rating}/5 (exit)` : null,
      comment: comment.trim(),
      language: langCode,
      visit_type: "exit_modal",
      mission_id: null,
    };

    try {
      if (!supabase) throw new Error("offline");

      let { error: insErr } = await supabase.from("feedback").insert(payload);

      if (insErr && rating == null) {
        const retry = await supabase.from("feedback").insert({
          ...payload,
          rating: 3,
          rating_label: "3/5 (exit, no explicit pick)",
        });
        insErr = retry.error;
      }

      if (insErr) throw insErr;

      if (typeof window !== "undefined") {
        window.localStorage.setItem("kkobi_feedback_given", "true");
      }
      onSubmitted();
    } catch (e) {
      console.error("Exit feedback insert failed:", e);
      setError(t.sendError);
    } finally {
      setBusy(false);
    }
  }, [busy, rating, nudge, comment, t.sendError, onSubmitted]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-jakarta"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-feedback-title"
    >
      <div
        className="w-full max-w-[340px] rounded-[20px] bg-white px-6 py-7 shadow-xl"
        style={{ border: `1px solid ${LAVENDER_BG}` }}
      >
        <h2 id="exit-feedback-title" className="text-center text-[20px] font-bold leading-snug text-[#0f172a]">
          {t.title}
        </h2>
        <p className="mt-2 text-center text-[14px] text-[#6b7280]">{t.subtitle}</p>

        <div className="mt-5 flex justify-center gap-1.5" role="group" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = rating != null && n <= rating;
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setRating(n);
                  setNudge(false);
                }}
                className="p-1 text-[28px] leading-none transition-transform hover:scale-110 active:scale-95"
                style={{ color: active ? BRAND_GOLD : "#d1d5db" }}
                aria-pressed={active}
                aria-label={`${n} stars`}
              >
                ★
              </button>
            );
          })}
        </div>

        {nudge ? <p className="mt-2 text-center text-[12px] text-[#6b7280]">{t.nudge}</p> : null}

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t.placeholder}
          rows={3}
          className="mt-4 w-full resize-none rounded-xl border-2 border-[#e5e7eb] bg-[#fafafa] px-3 py-2.5 text-[14px] text-[#0f172a] outline-none transition focus:border-[#6c2eff]"
        />

        {error ? <p className="mt-2 text-center text-[12px] text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="mt-5 w-full rounded-[14px] py-3.5 text-[15px] font-bold text-white transition hover:brightness-110 disabled:opacity-50 active:scale-[0.99]"
          style={{ backgroundColor: BRAND_PURPLE, boxShadow: "0 8px 20px rgba(108, 46, 255, 0.25)" }}
        >
          {busy ? "…" : t.send}
        </button>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-[14px] text-[#6b7280] underline-offset-2 transition hover:opacity-80"
            style={{ color: "#6b7280" }}
          >
            {t.later}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Listens for tab hide / leave intent; opens custom feedback modal when the user returns.
 * Does not use the browser beforeunload dialog.
 */
export function FeedbackExitListener() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState(/** @type {UILang} */ ("en"));
  const pendingRef = useRef(false);
  const blockingOverlayRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onBlocking = (e) => {
      blockingOverlayRef.current = !!e.detail?.active;
    };
    window.addEventListener("ogu-blocking-overlay", onBlocking);

    const syncLang = () => setLang(readLang());
    syncLang();
    window.addEventListener("storage", syncLang);

    return () => {
      window.removeEventListener("ogu-blocking-overlay", onBlocking);
      window.removeEventListener("storage", syncLang);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const bumpLang = () => setLang(readLang());

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (shouldOfferFeedback() && !blockingOverlayRef.current) {
          pendingRef.current = true;
        }
        return;
      }
      if (document.visibilityState === "visible") {
        if (pendingRef.current && shouldOfferFeedback() && !blockingOverlayRef.current) {
          bumpLang();
          setOpen(true);
        }
        pendingRef.current = false;
      }
    };

    const onBeforeUnload = () => {
      if (shouldOfferFeedback() && !blockingOverlayRef.current) {
        pendingRef.current = true;
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const submitted = useCallback(() => setOpen(false), []);

  return <FeedbackModalUI open={open} onClose={close} lang={lang} onSubmitted={submitted} />;
}
