"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeLang, tx } from "@/app/lib/i18n";

const KKOBI_ONBOARDING_DONE_KEY = "kkobi_onboarding_done";

/**
 * First-visit full-screen onboarding: vibe cards + optional 3-step pre-flow tooltip.
 * Tooltip and kkobi_onboarding_done checks exist only here (not on home main UI).
 *
 * @param {{
 *   open: boolean;
 *   onRequestClose: () => void;
 *   onProceedToFlow: (category: 'idol'|'drama'|'trip') => void;
 *   onBrowseFirst: () => void;
 *   language: string;
 * }} props
 */
export default function OnboardingModal({ open, onRequestClose, onProceedToFlow, onBrowseFirst, language }) {
  const L = normalizeLang(language);

  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipStep, setTooltipStep] = useState(1);
  const [pendingCategory, setPendingCategory] = useState(/** @type {'idol'|'drama'|'trip'|null} */ (null));

  useEffect(() => {
    if (!open) {
      setShowTooltip(false);
      setTooltipStep(1);
      setPendingCategory(null);
    }
  }, [open]);

  const onboardingCopy = (() => {
    switch (L) {
      case "id":
        return {
          headline1: "Pilih gayamu —",
          headlineAccent: "dan mulai berbicara.",
          overline: "YOUR STYLE",
          browse: "atau jelajahi dulu",
          noAccount: "Tidak perlu akun · Gratis dicoba",
          cards: {
            idol: { title: "Idola favoritku", sub: "Ungkapkan cintamu pada K-pop" },
            drama: { title: "Dialog K-drama", sub: "Momen drama yang ikonik" },
            trip: { title: "Perjalanan ke Korea", sub: "Frasa untuk kunjunganmu" }
          }
        };
      case "fr":
        return {
          headline1: "Choisissez votre style —",
          headlineAccent: "et commencez à parler.",
          overline: "YOUR STYLE",
          browse: "ou parcourir d'abord",
          noAccount: "Aucun compte requis · Gratuit",
          cards: {
            idol: { title: "Mon idole préférée", sub: "Exprimez votre amour du K-pop" },
            drama: { title: "Réplique K-drama", sub: "Moments dramatiques iconiques" },
            trip: { title: "Voyage en Corée", sub: "Phrases pour votre visite" }
          }
        };
      case "pt":
        return {
          headline1: "Escolha seu estilo —",
          headlineAccent: "e comece a falar.",
          overline: "YOUR STYLE",
          browse: "ou explorar primeiro",
          noAccount: "Sem conta necessária · Grátis",
          cards: {
            idol: { title: "Meu idol favorito", sub: "Expresse seu amor pelo K-pop" },
            drama: { title: "Fala de K-drama", sub: "Momentos icônicos do drama" },
            trip: { title: "Viagem à Coreia", sub: "Frases para sua visita" }
          }
        };
      default:
        return {
          headline1: "Choose your style —",
          headlineAccent: "and start speaking.",
          overline: "YOUR STYLE",
          browse: "or browse first",
          noAccount: "No account required · Free to try",
          cards: {
            idol: { title: "My favorite idol", sub: "Express your K-pop love" },
            drama: { title: "K-drama line", sub: "Iconic drama moments" },
            trip: { title: "Korea trip", sub: "Phrases for your visit" }
          }
        };
    }
  })();

  const handleCategoryClick = useCallback(
    (/** @type {'idol'|'drama'|'trip'} */ cat) => {
      if (typeof window === "undefined") return;
      try {
        if (!window.localStorage.getItem(KKOBI_ONBOARDING_DONE_KEY)) {
          setPendingCategory(cat);
          setTooltipStep(1);
          setShowTooltip(true);
          return;
        }
      } catch {
        // proceed
      }
      onRequestClose();
      onProceedToFlow(cat);
    },
    [onRequestClose, onProceedToFlow]
  );

  const handleTooltipNext = useCallback(() => {
    if (tooltipStep < 3) {
      setTooltipStep((s) => s + 1);
      return;
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(KKOBI_ONBOARDING_DONE_KEY, "true");
      } catch {
        // ignore
      }
    }
    const cat = pendingCategory;
    setShowTooltip(false);
    setTooltipStep(1);
    setPendingCategory(null);
    onRequestClose();
    if (cat) onProceedToFlow(cat);
  }, [tooltipStep, pendingCategory, onRequestClose, onProceedToFlow]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex font-jakarta max-[479px]:h-[100dvh] max-[479px]:min-h-0 max-[479px]:flex-col max-[479px]:bg-[var(--surface-lowest)] min-[480px]:min-h-screen min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-center min-[480px]:bg-[#f3f3f5]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-modal-title"
    >
      <div
        className="relative mx-auto flex w-full max-w-[480px] flex-1 flex-col min-h-0 justify-between overflow-hidden bg-[#ffffff] px-6 pb-10 pt-12 min-[480px]:mt-[60px] min-[480px]:max-h-[calc(100vh-80px)] min-[480px]:flex-none min-[480px]:rounded-[32px] min-[480px]:px-6 min-[480px]:shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
        style={{ padding: "48px 24px 40px" }}
      >
        <div className="flex min-h-0 flex-1 flex-col min-[480px]:flex-none">
          <p
            className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-[#2a14b4]"
            style={{
              background: "#f3f0ff",
              padding: "7px 16px",
              borderRadius: 99,
              marginBottom: 20
            }}
          >
            <span aria-hidden>🪄</span>
            <span>Speak 한국어 from Day 1</span>
          </p>
          <h1
            id="onboarding-modal-title"
            className="text-[32px] font-extrabold leading-[1.2] tracking-[-0.6px] text-[#1a1c1d]"
            style={{ wordBreak: L === "en" ? "break-word" : "keep-all", marginBottom: 8 }}
          >
            {onboardingCopy.headline1}
            <br />
            <span style={{ color: "#2a14b4", fontStyle: "italic" }}>{onboardingCopy.headlineAccent}</span>
          </h1>

          <p
            className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6b6f72]"
            style={{ marginBottom: 12 }}
          >
            {onboardingCopy.overline}
          </p>

          <div className="flex w-full max-w-full flex-col overflow-hidden">
            {[
              { cat: "idol", icon: "👑" },
              { cat: "drama", icon: "🎬" },
              { cat: "trip", icon: "✈️" }
            ].map(({ cat, icon }) => {
              const title = onboardingCopy.cards[cat].title;
              const sub = onboardingCopy.cards[cat].sub;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryClick(cat)}
                  className="group mb-[10px] flex w-full max-w-full items-center gap-[14px] rounded-[20px] border-2 border-transparent bg-[#f9f9fb] px-[18px] py-4 text-left transition-all duration-150 hover:border-[#2a14b4] hover:bg-[#2a14b4] active:scale-[0.99]"
                >
                  <span
                    className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px] bg-white text-[22px] leading-none transition-all duration-150 group-hover:bg-[rgba(255,255,255,0.15)]"
                    aria-hidden
                  >
                    {icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-[#1a1c1d] group-hover:text-white">
                      {title}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[#6b6f72] group-hover:text-[rgba(255,255,255,0.7)]">
                      {sub}
                    </span>
                  </span>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2a14b4] transition-all duration-150 group-hover:bg-[rgba(255,255,255,0.25)]"
                    aria-hidden
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M3 7h8M8 4l3 3-3 3"
                        stroke="white"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="w-full max-w-full shrink-0 pt-1">
          <button
            type="button"
            onClick={onBrowseFirst}
            className="w-full max-w-full text-center text-[13px] text-[#6b6f72] underline underline-offset-2 transition hover:opacity-80"
          >
            {onboardingCopy.browse}
          </button>
          <p className="mt-[10px] text-center text-[12px] text-[#9ca3af]">{onboardingCopy.noAccount}</p>
        </div>

        {showTooltip && pendingCategory ? (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 10000,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              padding: "0 24px 48px"
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Onboarding tips"
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: 20,
                padding: 20,
                boxShadow: "0 20px 50px rgba(0,0,0,0.2)"
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#2a14b4",
                  marginBottom: 6
                }}
              >
                {tx(L, "fl_pre_tooltip_step", { n: tooltipStep })}
              </p>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#1a1c1d",
                  lineHeight: 1.5,
                  marginBottom: 16
                }}
              >
                {tooltipStep === 1
                  ? tx(L, "fl_pre_tooltip_1")
                  : tooltipStep === 2
                    ? tx(L, "fl_pre_tooltip_2")
                    : tx(L, "fl_pre_tooltip_3")}
              </p>
              <button
                type="button"
                onClick={handleTooltipNext}
                style={{
                  width: "100%",
                  padding: 13,
                  background: "linear-gradient(135deg, #2a14b4, #4338ca)",
                  color: "white",
                  borderRadius: 14,
                  fontSize: 14,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer"
                }}
              >
                {tooltipStep === 3 ? tx(L, "fl_pre_tooltip_start") : tx(L, "fl5_onboard_cta")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
