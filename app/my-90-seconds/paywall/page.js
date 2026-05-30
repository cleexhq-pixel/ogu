'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import { normalizeLang } from '@/app/lib/i18n';

const GUMROAD_URL = 'https://cleexhq.gumroad.com/l/fansign-prep-pass';

const PAYWALL_COPY = {
  en: {
    back: '← Back',
    titleLine1: "Don't waste your",
    titleLine2: 'real 90 seconds',
    subGuest:
      "You've used today's free session.\nSign in for 3/day free — or go unlimited.",
    subSignedIn:
      "You've used today's 3 free sessions.\nGet unlimited access before your fansign.",
    freeStripe: 'Get 3 sessions/day — completely free',
    continueGoogle: 'Continue with Google',
    or: 'or',
    popular: 'Most Popular',
    product: 'Fansign Prep Pass',
    priceSub: '7 days · unlimited practice',
    perks: [
      'Unlimited 90-second simulations',
      'All 5 scenarios unlocked',
      'AI coach feedback after every call',
      "Practice until you're ready",
    ],
    cta: 'Get Prep Pass →',
    redeemLead: 'Already have a license key?',
    redeemAction: 'Enter code here →',
    footerGuest: 'Come back tomorrow for 1 free try',
    footerSignedIn: 'Come back tomorrow for 3 free tries',
    fallbackLoading: 'Loading...',
  },
  ko: {
    back: '← 뒤로',
    titleLine1: '본 팬싸 90초를',
    titleLine2: '허비하지 마세요',
    subGuest:
      '오늘 무료 1번 썼어요.\n로그인하면 매일 3번 · 아니면 무제한 패스!',
    subSignedIn: '오늘 무료 3번 다 썼어요.\n진짜 팬싸 전에 무제한 연습 가보자.',
    freeStripe: '로그인만 하면 하루 3판 무료',
    continueGoogle: 'Google로 계속하기',
    or: '또는',
    popular: '인기 픽',
    product: '팬싸 준비 패스',
    priceSub: '7일 · 무제한 연습',
    perks: [
      '90초 시뮬 무제한',
      '시나리오 5종 전부 오픈',
      '통화 후마다 AI 코칭 피드백',
      '본 무대 전까지 마음 놓고 연습',
    ],
    cta: '패스 받기 →',
    redeemLead: '이미 라이선스 키 있어요?',
    redeemAction: '코드 입력은 여기 →',
    footerGuest: '내일 또 무료 1번 돌려요',
    footerSignedIn: '내일 무료 3판 또 올 거예요',
    fallbackLoading: '불러오는 중...',
  },
  id: {
    back: '← Kembali',
    titleLine1: 'Jangan buang',
    titleLine2: '90 detik aslimu',
    subGuest:
      'Sesi gratis hari ini habis.\nMasuk dapat 3/hari gratis — atau paket tanpa batas.',
    subSignedIn:
      '3 sesi gratis hari ini habis.\nAkses tanpa batas sebelum fansign sungguhan.',
    freeStripe: '3 sesi/hari — gratis total',
    continueGoogle: 'Lanjut dengan Google',
    or: 'atau',
    popular: 'Paling laris',
    product: 'Fansign Prep Pass',
    priceSub: '7 hari · latihan tanpa batas',
    perks: [
      'Simulasi 90 detik tanpa batas',
      'Semua 5 skenario terbuka',
      'Feedback pelatih AI tiap panggilan',
      'Latihan sampai benar-benar pede',
    ],
    cta: 'Ambil Prep Pass →',
    redeemLead: 'Sudah punya license key?',
    redeemAction: 'Masukkan kode di sini →',
    footerGuest: 'Besok ada 1 percobaan gratis lagi',
    footerSignedIn: 'Besok ada 3 sesi gratis lagi',
    fallbackLoading: 'Memuat…',
  },
  fr: {
    back: '← Retour',
    titleLine1: 'Ne gâche pas',
    titleLine2: 'tes 90 vraies secondes',
    subGuest:
      "La session gratuite du jour est finie.\nConnecte-toi pour 3/jour — ou passe illimité.",
    subSignedIn:
      "Tes 3 essais gratuits du jour sont finis.\nPasse en illimité avant le vrai fansign.",
    freeStripe: '3 sessions/jour — totalement gratuites',
    continueGoogle: 'Continuer avec Google',
    or: 'ou',
    popular: 'Le plus choisi',
    product: 'Fansign Prep Pass',
    priceSub: '7 jours · entraînement illimité',
    perks: [
      'Simulations 90 s illimitées',
      'Les 5 scénarios débloqués',
      'Retour coach IA après chaque appel',
      "S'entraîner jusqu'à être prêt·e",
    ],
    cta: 'Prendre le Prep Pass →',
    redeemLead: 'Tu as déjà une clé de licence ?',
    redeemAction: 'Entrer le code ici →',
    footerGuest: 'Demain, 1 essai gratuit de plus',
    footerSignedIn: 'Demain, 3 essais gratuits de plus',
    fallbackLoading: 'Chargement…',
  },
  pt: {
    back: '← Voltar',
    titleLine1: 'Não desperdice',
    titleLine2: 'seus 90 segundos de verdade',
    subGuest:
      'A sessão grátis de hoje acabou.\nEntre para 3/dia grátis — ou vá ilimitado.',
    subSignedIn:
      'As 3 sessões grátis de hoje acabaram.\nPratique ilimitado antes do fansign real.',
    freeStripe: '3 sessões/dia — totalmente grátis',
    continueGoogle: 'Continuar com Google',
    or: 'ou',
    popular: 'Mais popular',
    product: 'Fansign Prep Pass',
    priceSub: '7 dias · prática ilimitada',
    perks: [
      'Simulações de 90 s ilimitadas',
      'Os 5 cenários liberados',
      'Feedback do coach IA após cada call',
      'Treine até sentir confiança',
    ],
    cta: 'Pegar Prep Pass →',
    redeemLead: 'Já tem uma chave de licença?',
    redeemAction: 'Digite o código aqui →',
    footerGuest: 'Amanhã tem mais 1 tentativa grátis',
    footerSignedIn: 'Amanhã voltam 3 sessões grátis',
    fallbackLoading: 'Carregando…',
  },
};

function PaywallContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenario = searchParams.get('scenario') || 'compliment';
  const gumroadWithContext = `${GUMROAD_URL}?scenario=${encodeURIComponent(scenario)}`;

  const [user, setUser] = useState(null);
  const [uiLang, setUiLang] = useState('en');

  useEffect(() => {
    setUiLang(normalizeLang(localStorage.getItem('ogu_lang') || 'en'));
  }, []);

  useEffect(() => {
    trackEvent('m90s_paywall_shown', {
      scenario,
      source: 'paywall',
    });
  }, [scenario]);

  const t = useMemo(() => {
    const k = normalizeLang(uiLang);
    return PAYWALL_COPY[k] || PAYWALL_COPY.en;
  }, [uiLang]);

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    void run();
  }, []);

  const openGumroad = () => {
    trackEvent('m90s_purchase_started', {
      scenario,
      user_type: user ? 'member' : 'guest',
    });
    window.open(gumroadWithContext, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0E0E0F',
        padding: '24px 20px 48px',
        maxWidth: '480px',
        margin: '0 auto',
        fontFamily: 'Manrope, Inter, sans-serif',
      }}
    >
      <button
        type="button"
        onClick={() => router.back()}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '13px',
          cursor: 'pointer',
          padding: '8px 0',
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        {t.back}
      </button>

      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(255,216,77,0.12)',
          border: '1px solid rgba(255,216,77,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFD84D"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      <div
        style={{
          fontSize: '26px',
          fontWeight: 700,
          color: '#fff',
          textAlign: 'center',
          lineHeight: 1.3,
          letterSpacing: '-0.02em',
          marginBottom: '12px',
        }}
      >
        {t.titleLine1}
        <br />
        {t.titleLine2}
      </div>

      <p
        style={{
          fontSize: '14px',
          color: 'rgba(255,255,255,0.4)',
          textAlign: 'center',
          lineHeight: 1.6,
          whiteSpace: 'pre-line',
          marginBottom: '36px',
        }}
      >
        {user ? t.subSignedIn : t.subGuest}
      </p>

      {!user && (
        <>
          <div
            style={{
              margin: '16px 0',
              background: 'rgba(255,255,255,0.04)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: '14px',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontSize: '13px',
                color: 'rgba(255,255,255,0.5)',
                margin: '0 0 12px',
              }}
            >
              {t.freeStripe}
            </p>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const supabase = getSupabase();
                  if (!supabase || typeof window === 'undefined') return;
                  const next = encodeURIComponent('/my-90-seconds');
                  await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
                    },
                  });
                })();
              }}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '99px',
                padding: '13px',
                fontSize: '14px',
                fontWeight: 700,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {t.continueGoogle}
            </button>
          </div>
          <p
            style={{
              textAlign: 'center',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.2)',
              margin: '0 0 12px',
            }}
          >
            {t.or}
          </p>
        </>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={openGumroad}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openGumroad();
          }
        }}
        style={{
          background: '#FFD84D',
          borderRadius: '20px',
          padding: '24px 20px',
          marginBottom: '12px',
          position: 'relative',
          boxShadow: '0 8px 32px rgba(255,216,77,0.25)',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-10px',
            right: '16px',
            padding: '4px 12px',
            background: '#0E0E0F',
            color: '#FFD84D',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            borderRadius: '9999px',
          }}
        >
          {t.popular}
        </div>

        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'rgba(0,0,0,0.45)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}
        >
          {t.product}
        </div>

        <div
          style={{
            fontSize: '40px',
            fontWeight: 700,
            color: '#0E0E0F',
            letterSpacing: '-0.02em',
            marginBottom: '4px',
          }}
        >
          $9.99
        </div>

        <div
          style={{
            fontSize: '12px',
            color: 'rgba(0,0,0,0.5)',
            marginBottom: '20px',
          }}
        >
          {t.priceSub}
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
          {t.perks.map((item, i) => (
            <li
              key={i}
              style={{
                fontSize: '12px',
                color: 'rgba(0,0,0,0.7)',
                marginBottom: '8px',
                paddingLeft: '18px',
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  color: 'rgba(0,0,0,0.5)',
                  fontWeight: 700,
                }}
              >
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openGumroad();
          }}
          style={{
            width: '100%',
            padding: '14px',
            background: '#0E0E0F',
            border: 'none',
            borderRadius: '9999px',
            color: '#FFD84D',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {t.cta}
        </button>
      </div>

      <div
        style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: '10px',
          }}
        >
          {t.redeemLead}
        </div>
        <button
          type="button"
          onClick={() => router.push('/redeem')}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {t.redeemAction}
        </button>
      </div>

      <p
        style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.22)',
          textAlign: 'center',
          marginTop: '12px',
        }}
      >
        {user ? t.footerSignedIn : t.footerGuest}
      </p>
    </div>
  );
}

export default function PaywallPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            background: '#0E0E0F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#7A7882',
          }}
        >
          Loading...
        </div>
      }
    >
      <PaywallContent />
    </Suspense>
  );
}
