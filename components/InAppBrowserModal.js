'use client';

import { useState } from 'react';

const COPY = {
  en: {
    title: 'Open in your browser to sign in',
    desc_prefix: 'Google blocks sign-in inside ',
    desc_suffix: '. Copy the link and open it in Safari or Chrome.',
    copy_btn: 'Copy link',
    copied: 'Copied!',
    how_to: 'How to open',
    how_to_steps: [
      'Tap the ··· or ⋮ menu in the top corner',
      'Select "Open in browser" or "Open in Safari / Chrome"',
    ],
    close: 'Got it',
  },
  ko: {
    title: '브라우저에서 열어야 로그인할 수 있어요',
    desc_prefix: '',
    desc_suffix:
      ' 내부 브라우저에서는 Google 로그인이 차단돼요. 링크를 복사해서 Safari나 Chrome에서 열어주세요.',
    copy_btn: '링크 복사',
    copied: '복사됨!',
    how_to: '여는 방법',
    how_to_steps: [
      '우측 상단 ··· 또는 ⋮ 메뉴를 눌러요',
      '"브라우저에서 열기" 또는 "Safari / Chrome으로 열기" 선택',
    ],
    close: '알겠어요',
  },
  id: {
    title: 'Buka di browser untuk masuk',
    desc_prefix: 'Google memblokir login di dalam ',
    desc_suffix: '. Salin link dan buka di Safari atau Chrome.',
    copy_btn: 'Salin link',
    copied: 'Tersalin!',
    how_to: 'Cara membuka',
    how_to_steps: [
      'Ketuk menu ··· atau ⋮ di sudut atas',
      'Pilih "Buka di browser" atau "Buka di Safari / Chrome"',
    ],
    close: 'Mengerti',
  },
  pt: {
    title: 'Abra no navegador para entrar',
    desc_prefix: 'O Google bloqueia o login dentro do ',
    desc_suffix: '. Copie o link e abra no Safari ou Chrome.',
    copy_btn: 'Copiar link',
    copied: 'Copiado!',
    how_to: 'Como abrir',
    how_to_steps: [
      'Toque no menu ··· ou ⋮ no canto superior',
      'Selecione "Abrir no navegador" ou "Abrir no Safari / Chrome"',
    ],
    close: 'Entendi',
  },
  fr: {
    title: 'Ouvrez dans votre navigateur pour vous connecter',
    desc_prefix: 'Google bloque la connexion dans ',
    desc_suffix: '. Copiez le lien et ouvrez-le dans Safari ou Chrome.',
    copy_btn: 'Copier le lien',
    copied: 'Copié !',
    how_to: 'Comment ouvrir',
    how_to_steps: [
      'Appuyez sur le menu ··· ou ⋮ en haut',
      'Sélectionnez "Ouvrir dans le navigateur" ou "Ouvrir dans Safari / Chrome"',
    ],
    close: 'Compris',
  },
};

export default function InAppBrowserModal({
  isOpen,
  onClose,
  browserName,
  lang = 'en',
}) {
  const [copied, setCopied] = useState(false);
  const t = COPY[lang] || COPY.en;

  if (!isOpen) return null;

  async function handleCopy() {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
      }}
    >
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#1A191B',
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px calc(24px + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxWidth: 390,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'rgba(255,216,77,0.12)',
            border: '1px solid rgba(255,216,77,0.25)',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFD84D"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            width={20}
            height={20}
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>

        <p
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#F2F0F4',
            textAlign: 'center',
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          {t.title}
        </p>

        <p
          style={{
            fontSize: 12,
            color: '#7A7882',
            textAlign: 'center',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {t.desc_prefix}
          {browserName}
          {t.desc_suffix}
        </p>

        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'rgba(255,216,77,0.7)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            {t.how_to}
          </span>
          {t.how_to_steps.map((step, i) => (
            <div
              key={step}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'rgba(255,216,77,0.15)',
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#FFD84D',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: '#B0AEB8',
                  lineHeight: 1.5,
                }}
              >
                {step}
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void handleCopy()}
          style={{
            background: copied ? 'rgba(255,216,77,0.2)' : '#FFD84D',
            color: copied ? '#FFD84D' : '#0E0E0F',
            border: copied ? '0.5px solid rgba(255,216,77,0.4)' : 'none',
            borderRadius: 100,
            padding: '13px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            width: '100%',
            transition: 'all 0.2s',
            cursor: 'pointer',
          }}
        >
          {copied ? t.copied : t.copy_btn}
        </button>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.3)',
            fontSize: 11,
            padding: '8px',
            width: '100%',
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          {t.close}
        </button>
      </div>
    </div>
  );
}
