'use client';

import { useState, useEffect, Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { hasReachedDailyLimit, getSessionsRemaining } from '@/lib/freeLimit';
import { trackEvent } from '@/lib/analytics';
import { normalizeLang } from '@/app/lib/i18n';
import { calculateDday, formatDday } from '@/src/lib/dday';

import { REVIEW_COPY } from './review-copy';
import { isInAppBrowser, getInAppBrowserName } from '@/lib/inAppBrowser';
import InAppBrowserModal from '@/components/InAppBrowserModal';

const FANSIGN_DATE_KEY = 'kkobi_m90s_fansign_date';

const PREP_PASS_UI = {
  en: {
    label: '7-DAY PREP PASS',
    price: '$9.99',
    sub: 'Unlimited practice · 7 days',
    cta: 'Get Prep Pass →',
    perks: [
      'Unlimited sessions for 7 days',
      'All 5 scenarios unlocked',
      'Full review after every session',
      "When the day is close, we'll be here",
    ],
  },
  ko: {
    label: '7일 프렙 패스',
    price: '$9.99',
    sub: '7일 무제한 연습',
    cta: '패스 받기 →',
    perks: [
      '7일 무제한 세션',
      '시나리오 5종 전부 오픈',
      '통화 후마다 풀 리뷰',
      '팬싸 날이 다가오면 함께할게요',
    ],
  },
  id: {
    label: 'PREP PASS 7 HARI',
    price: '$9.99',
    sub: 'Latihan tanpa batas · 7 hari',
    cta: 'Ambil Prep Pass →',
    perks: [
      'Sesi tanpa batas 7 hari',
      'Semua 5 skenario terbuka',
      'Review lengkap tiap panggilan',
      'Saat hari-H dekat, kami siap bantu',
    ],
  },
  pt: {
    label: 'PREP PASS 7 DIAS',
    price: '$9.99',
    sub: 'Prática ilimitada · 7 dias',
    cta: 'Pegar Prep Pass →',
    perks: [
      'Sessões ilimitadas por 7 dias',
      'Todos os 5 cenários liberados',
      'Review completo após cada call',
      'Quando o dia chegar, estamos aqui',
    ],
  },
  fr: {
    label: 'PREP PASS 7 JOURS',
    price: '$9.99',
    sub: 'Entraînement illimité · 7 jours',
    cta: 'Prendre le Prep Pass →',
    perks: [
      'Sessions illimitées pendant 7 jours',
      'Les 5 scénarios débloqués',
      'Review complète après chaque appel',
      'Quand le jour approche, on est là',
    ],
  },
};

const TRY_AGAIN_CTA = {
  en: 'Practice Again →',
  ko: '다시 연습하기 →',
  id: 'Latihan lagi →',
  pt: 'Praticar de novo →',
  fr: 'Recommencer →',
};

/** Same score shape when review API/network fails — copy is localized by UI lang */
function getFallbackReview(lang) {
  const L = normalizeLang(lang);
  const scores = {
    communication: 4,
    korean_attempts: 4,
    conversation_flow: 3,
    time_used: 4,
    total: 3.8,
  };
  const shareQuoteKo = '고마워요~ 너무 행복해요';
  const shareQuoteRo = 'Gomawoyo~ neomu haengbokhaeyo';
  /** Shared Hangul cue for fallback card */
  const missedKo = '한 번 더 연습하면 상세 코칭을 받아요';
  const missedRoman =
    'Han beon deo yeonseuphamyeon sangse kochingeul badayo.';

  const fallbacks = {
    en: {
      scores,
      real_talk:
        'We could not refresh your breakdown this round. Run one more rehearsal to unlock coach notes.',
      encouragement:
        'Practice complete. Try once more to get a detailed review.',
      best_moment: null,
      missed_moment: {
        korean: missedKo,
        translation:
          'If you rehearse once more, we can unlock a fuller coaching recap.',
        romanization: missedRoman,
        tip: 'Hit Prep again—the next session usually pulls everything through.',
      },
      share_quote: shareQuoteKo,
      share_quote_translation: "Thank you~ I'm so happy",
      share_quote_romanization: shareQuoteRo,
    },
    ko: {
      scores,
      real_talk:
        '이번엔 디테일 리뷰를 못 받았어요. 한 번 더 돌려보면 꽉 찬 코칭 줄게요.',
      encouragement:
        '연습 완료! 한 번 더 해보면 상세 코칭을 받을 수 있어요',
      best_moment: null,
      missed_moment: {
        korean: missedKo,
        translation: '조금 더 이어 가면 디테일한 피드백 받을 수 있어요!',
        romanization: missedRoman,
        tip: '같은 흐름으로 한 번만 더 들어오면 거의 다 받아져요 💪',
      },
      share_quote: shareQuoteKo,
      share_quote_translation: '너무 고마워요~ 진짜 행복해요!',
      share_quote_romanization: shareQuoteRo,
    },
    id: {
      scores,
      real_talk:
        'Detail review kamu gagal kepanggil sekarang. Latihan lagi buat bisa dapet full coaching.',
      encouragement:
        'Latihan selesai. Coba sekali lagi untuk review lengkap.',
      best_moment: null,
      missed_moment: {
        korean: missedKo,
        translation:
          'Kalau ada satu sesi lagi, kita bisa bongkar semua umpan balik.',
        romanization: missedRoman,
        tip: 'Masuk lagi sebentar—biasanya baru nyantol total coach notes-nya.',
      },
      share_quote: shareQuoteKo,
      share_quote_translation:
        'Makasih banget ya~ aku lagi seneng-senengnya!',
      share_quote_romanization: shareQuoteRo,
    },
    pt: {
      scores,
      real_talk:
        'Não conseguimos atualizar esse feedback denso dessa vez. Mais um treino liberando o relatório inteiro.',
      encouragement:
        'Prática concluída. Tente mais uma vez para um review completo.',
      best_moment: null,
      missed_moment: {
        korean: missedKo,
        translation:
          'Rodando mais uma leva a gente consegue o pacote inteiro do coach.',
        romanization: missedRoman,
        tip:
          'Só clicar pra voltar aos 90 segundos — ali o app costuma puxar tudo.',
      },
      share_quote: shareQuoteKo,
      share_quote_translation: 'Caraca, obrigado~ tô absurdamente feliz!',
      share_quote_romanization: shareQuoteRo,
    },
    fr: {
      scores,
      real_talk:
        'La planche coach n’a pas chargé tout de suite cette fois-ci. Un run de plus ouvre généralement le pack complet.',
      encouragement:
        'Pratique terminée. Réessayez pour un retour détaillé.',
      best_moment: null,
      missed_moment: {
        korean: missedKo,
        translation:
          'Une session supplémentaire suffit habituellement à débloquer la version maxi du debrief.',
        romanization: missedRoman,
        tip:
          'Reviens vite sur la répète — comme ça tout le feedback remonte bien.',
      },
      share_quote: shareQuoteKo,
      share_quote_translation:
        'Merciiii~ trop trop heureuse en ce moment !',
      share_quote_romanization: shareQuoteRo,
    },
  };
  return fallbacks[L] || fallbacks.en;
}

function normalizeVoiceGender(raw) {
  const s = String(raw || 'FEMALE').toLowerCase();
  if (s === 'male' || s === 'm') return 'male';
  return 'female';
}

function readFansignStored() {
  if (typeof window === 'undefined') return '';
  const v = (localStorage.getItem(FANSIGN_DATE_KEY) || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
}

function readPaidPrepPass() {
  if (typeof window === 'undefined') return false;
  const tier = localStorage.getItem('kkobi_pass_tier');
  const expires = localStorage.getItem('kkobi_pass_expires');
  return (
    tier === 'prep_pass' &&
    Boolean(expires) &&
    new Date(expires) > new Date()
  );
}

function formatFansignDots(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${y}.${m}.${d}`;
}

function pickLocalizedRealTalk(total, apiText, strings) {
  if (typeof apiText === 'string' && apiText.trim()) return apiText.trim();
  const n = Number(total);
  const t = Number.isFinite(n) ? n : 0;
  if (t >= 4.5) return strings.real_talk_perfect;
  if (t >= 3.5) return strings.real_talk_okay;
  if (t >= 2.5) return strings.real_talk_warning;
  return strings.real_talk_critical;
}

function realTalkTierForScore(total) {
  const n = Number(total);
  const t = Number.isFinite(n) ? n : 0;
  if (t >= 4.5) return 'perfect';
  if (t >= 3.5) return 'okay';
  if (t >= 2.5) return 'warning';
  return 'critical';
}

function StarRow({ value }) {
  const v = Math.min(5, Math.max(0, Math.round(Number(value))));
  return (
    <span style={{ letterSpacing: '2px', fontSize: '16px', lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            color: i <= v ? '#FFD84D' : 'rgba(255,255,255,0.15)',
          }}
          aria-hidden
        >
          ★
        </span>
      ))}
    </span>
  );
}

function ReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenario = searchParams.get('scenario') || 'compliment';

  const [stage, setStage] = useState('loading');
  const [reviewData, setReviewData] = useState(null);
  const [idolName, setIdolName] = useState('IDOL');
  const [user, setUser] = useState(null);

  const [uiLang, setUiLang] = useState(() =>
    typeof window !== 'undefined'
      ? normalizeLang(localStorage.getItem('ogu_lang') || 'en')
      : 'en',
  );
  const [fansignDate, setFansignDate] = useState(() =>
    typeof window !== 'undefined' ? readFansignStored() : '',
  );
  const [isPaid, setIsPaid] = useState(() =>
    typeof window !== 'undefined' ? readPaidPrepPass() : false,
  );
  const [showInAppModal, setShowInAppModal] = useState(false);
  const [inAppBrowserName, setInAppBrowserName] = useState('');

  const t = REVIEW_COPY[normalizeLang(uiLang)] ?? REVIEW_COPY.en;
  const prepPassUi =
    PREP_PASS_UI[normalizeLang(uiLang)] ?? PREP_PASS_UI.en;
  const tryAgainCta =
    TRY_AGAIN_CTA[normalizeLang(uiLang)] ?? TRY_AGAIN_CTA.en;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onLang = () =>
      setUiLang(normalizeLang(localStorage.getItem('ogu_lang') || 'en'));
    window.addEventListener('storage', onLang);
    return () => window.removeEventListener('storage', onLang);
  }, []);

  /** Same-tab return from checkout / edits on scenario picker */
  useEffect(() => {
    if (typeof window === 'undefined' || stage !== 'main') return undefined;
    setFansignDate(readFansignStored());
    setIsPaid(readPaidPrepPass());
    return undefined;
  }, [stage, reviewData?.scores?.total]);

  const sessionsRemaining = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const uid = user?.id ?? null;
    const r = getSessionsRemaining(uid, isPaid);
    if (!Number.isFinite(r)) return null;
    return r;
  }, [user, isPaid]);

  const fetchReview = useCallback(
    async (moments, gender, statPayload, nameForPrompt) => {
      let lang = normalizeLang(
        window.localStorage.getItem('ogu_lang') || 'en',
      );
      try {

        let conversationHistory = [];
        try {
          const rawC = window.localStorage.getItem('kkobi_m90s_conversation');
          if (rawC) {
            const p = JSON.parse(rawC);
            conversationHistory = Array.isArray(p) ? p : [];
          }
        } catch {
          conversationHistory = [];
        }

        let phaseLog = {};
        try {
          const rawP = window.localStorage.getItem('kkobi_m90s_phase_log');
          if (rawP) {
            const p = JSON.parse(rawP);
            if (p && typeof p === 'object' && !Array.isArray(p))
              phaseLog = p;
          }
        } catch {
          phaseLog = {};
        }

        const fd = readFansignStored();
        const fansignDatePayload = fd || null;

        const res = await fetch('/api/generate-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario,
            voiceGender: gender,
            positiveMoments: moments,
            completedLines: statPayload.completedLines,
            totalLines: statPayload.totalLines,
            idolName: nameForPrompt ?? '',
            lang,
            fansignDate: fansignDatePayload,
            conversationHistory,
            phaseLog,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.success === false) {
          trackEvent('m90s_review_generation_failed', {
            scenario,
            reason:
              typeof data?.error === 'string'
                ? data.error
                : `http_${res.status}`,
            status: res.status,
          });
        }
        const nextReview = data?.review || getFallbackReview(lang);
        setReviewData(nextReview);
        trackEvent('m90s_score_received', {
          scenario,
          total: nextReview?.scores?.total,
          communication: nextReview?.scores?.communication,
          korean_attempts: nextReview?.scores?.korean_attempts,
          conversation_flow: nextReview?.scores?.conversation_flow,
          time_used: nextReview?.scores?.time_used,
        });
        trackEvent('m90s_real_talk_tier', {
          scenario,
          tier: realTalkTierForScore(nextReview?.scores?.total),
        });
      } catch (e) {
        console.error('Review fetch error:', e);
        trackEvent('m90s_review_generation_failed', {
          scenario,
          reason: e instanceof Error ? e.message : 'network_error',
          status: 0,
        });
        const fallback = getFallbackReview(lang);
        setReviewData(fallback);
        trackEvent('m90s_score_received', {
          scenario,
          total: fallback.scores.total,
          fallback: true,
        });
        trackEvent('m90s_real_talk_tier', {
          scenario,
          tier: realTalkTierForScore(fallback.scores.total),
          fallback: true,
        });
      }
      window.setTimeout(() => setStage('main'), 500);
    },
    [scenario],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const savedGenderRaw = localStorage.getItem('kkobi_voice_gender') || 'FEMALE';
    const savedGender = normalizeVoiceGender(savedGenderRaw);

    const savedIdolDisplay = localStorage.getItem('kkobi_idol_name') || 'IDOL';
    setIdolName(savedIdolDisplay);

    let savedMoments = [];
    try {
      savedMoments = JSON.parse(
        localStorage.getItem('kkobi_m90s_positive_moments') || '[]',
      );
    } catch {
      savedMoments = [];
    }

    let savedStats = {};
    try {
      savedStats = JSON.parse(
        localStorage.getItem('kkobi_m90s_last_stats') || '{}',
      );
    } catch {
      savedStats = {};
    }

    const wins = Array.isArray(savedMoments) ? savedMoments.length : 0;
    const mergedStats = {
      completedLines:
        savedStats.completedLines !== undefined
          ? savedStats.completedLines
          : 4,
      totalLines: savedStats.totalLines !== undefined ? savedStats.totalLines : 5,
      timeUsed: savedStats.timeUsed !== undefined ? savedStats.timeUsed : 65,
      wins,
    };

    void fetchReview(savedMoments, savedGender, mergedStats, savedIdolDisplay);
    return undefined;
  }, [scenario, fetchReview]);

  useEffect(() => {
    const loadUser = async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    void loadUser();
  }, []);

  const handleTryAgain = () => {
    if (typeof window === 'undefined') return;
    trackEvent('m90s_retry_clicked', {
      scenario,
      sessions_remaining: sessionsRemaining,
    });
    void (async () => {
      const supabase = getSupabase();
      const sess = supabase
        ? (await supabase.auth.getSession()).data.session
        : null;
      const uid = sess?.user?.id ?? null;

      const tier = localStorage.getItem('kkobi_pass_tier');
      const expires = localStorage.getItem('kkobi_pass_expires');
      const paid =
        tier === 'prep_pass' &&
        expires &&
        new Date(expires) > new Date();

      if (hasReachedDailyLimit(uid, paid)) {
        router.push(
          `/my-90-seconds/paywall?scenario=${encodeURIComponent(scenario)}`,
        );
      } else {
        router.push(
          `/my-90-seconds/prep?scenario=${encodeURIComponent(scenario)}`,
        );
      }
    })();
  };

  const handlePrepPass = () => {
    trackEvent('m90s_paywall_shown', {
      scenario,
      source: 'review',
    });
    router.push(`/my-90-seconds/paywall?scenario=${encodeURIComponent(scenario)}`);
  };

  const handleShare = () => {
    if (!reviewData?.share_quote) return;
    trackEvent('m90s_result_shared', {
      scenario,
      score: reviewData?.scores?.total,
    });

    const shareLang = REVIEW_COPY[normalizeLang(uiLang)] ?? REVIEW_COPY.en;
    const shareText = `${shareLang.share_text_template}\n"${reviewData.share_quote}"\n\ntalk.kkobi.app`;

    if (navigator.share) {
      navigator.share({ text: shareText }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText).catch(() => {});
      window.alert(t.clipboard_copied);
    }
  };

  const totalScore = reviewData?.scores?.total ?? 4;
  const realTalkBody = pickLocalizedRealTalk(
    totalScore,
    reviewData?.real_talk,
    t,
  );

  const ddayDiff = fansignDate ? calculateDday(fansignDate) : null;
  const ddayStr = ddayDiff !== null ? formatDday(ddayDiff) : null;

  if (stage === 'loading' || !reviewData) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0E0E0F',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding:
            'max(24px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(32px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
        }}
      >
        <div
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#F2F0F4',
            marginBottom: '8px',
            letterSpacing: '-0.01em',
            fontFamily: 'Manrope, sans-serif',
          }}
        >
          {t.loading_title}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: '#7A7882',
            marginBottom: '32px',
            fontFamily: 'Manrope, sans-serif',
            textAlign: 'center',
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          {t.loading_subtitle}
        </div>
        <div
          style={{
            marginTop: '24px',
            display: 'flex',
            gap: '6px',
          }}
        >
          {[0.3, 0.65, 1].map((op, i) => (
            <span
              key={i}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#FFD84D',
                opacity: op,
                animation: `dot-bounce 1.4s ${i * 0.2}s infinite`,
                display: 'inline-block',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  const scoreRows = [
    { label: t.communication_label, key: 'communication' },
    { label: t.korean_attempts_label, key: 'korean_attempts' },
    { label: t.conversation_flow_label, key: 'conversation_flow' },
    { label: t.time_used_label, key: 'time_used' },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0E0E0F',
        padding:
          'max(12px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(36px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left))',
        maxWidth: '390px',
        margin: '0 auto',
        animation: 'slideUp 0.5s ease-out',
        fontFamily: 'Manrope, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: '20px', textAlign: 'center' }}>
        <div
          style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,216,77,0.7)',
            marginBottom: '6px',
          }}
        >
          {t.practice_complete_label}
        </div>
        <div
          style={{
            fontSize: '17px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.92)',
          }}
        >
          {t.practice_complete_with.replace('{idolName}', idolName)}
        </div>
      </header>

      {/* Total score */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: '22px',
          background: 'rgba(255,255,255,0.03)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '18px 16px',
        }}
      >
        <div
          style={{
            fontSize: '9px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}
        >
          {t.score_label}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <span
            style={{
              fontSize: '56px',
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              color: '#FFD84D',
            }}
          >
            {Number(totalScore).toFixed(1)}
          </span>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.04em',
            }}
          >
            {t.total_score_suffix}
          </span>
        </div>
      </div>

      {/* Real talk */}
      <div
        style={{
          borderLeft: '0.5px solid #FFD84D',
          background: 'rgba(255,216,77,0.05)',
          borderRadius: '0 10px 10px 0',
          padding: '14px 14px 14px 16px',
          marginBottom: '18px',
        }}
      >
        <div
          style={{
            fontSize: '9px',
            fontWeight: 700,
            color: '#FFD84D',
            marginBottom: '8px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {t.real_talk_label}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            fontWeight: 500,
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.88)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {realTalkBody}
        </p>
      </div>

      {/* Star breakdown */}
      <div style={{ marginBottom: '18px' }}>
        {scoreRows.map((row) => (
          <div
            key={row.key}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '0.5px solid rgba(255,255,255,0.07)',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.82)',
              }}
            >
              {row.label}
            </span>
            <StarRow value={reviewData?.scores?.[row.key]} />
          </div>
        ))}
      </div>

      {/* Best moment */}
      <section style={{ marginBottom: '18px' }}>
        <div
          style={{
            fontSize: '9px',
            fontWeight: 700,
            color: '#FFD84D',
            marginBottom: '10px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {t.best_moment_label_template.replace('{idolName}', idolName)}
        </div>

        <div
          style={{
            background: 'rgba(255,216,77,0.04)',
            borderRadius: '14px',
            padding: '18px 18px',
            position: 'relative',
            overflow: 'hidden',
            border: '0.5px solid rgba(255,216,77,0.2)',
          }}
        >
          {reviewData?.best_moment ? (
            <>
              <div
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.35)',
                  marginBottom: '4px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {t.you_said_label}
              </div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#fff',
                  marginBottom: '4px',
                  lineHeight: 1.35,
                }}
              >
                “{reviewData.best_moment.you_said_korean}”
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.62)',
                  fontStyle: 'italic',
                  marginBottom: '14px',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {reviewData.best_moment.you_said_translation}
              </div>

              <div
                style={{
                  textAlign: 'center',
                  color: 'rgba(255,216,77,0.4)',
                  fontSize: '16px',
                  marginBottom: '10px',
                }}
              >
                ↓
              </div>

              <div
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.35)',
                  marginBottom: '4px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {t.idol_replied_template.replace('{idolName}', idolName)}
              </div>
              <div
                style={{
                  fontSize: '17px',
                  fontWeight: 800,
                  color: '#fff',
                  marginBottom: '4px',
                  lineHeight: 1.35,
                }}
              >
                “{reviewData.best_moment.idol_replied_korean}”
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.72)',
                  fontStyle: 'italic',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {reviewData.best_moment.idol_replied_translation}
              </div>
            </>
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                lineHeight: 1.55,
                color: 'rgba(255,255,255,0.76)',
              }}
            >
              {t.best_moment_empty}
            </p>
          )}
        </div>
      </section>

      {/* Missed moment */}
      <section
        style={{
          background: 'rgba(255,216,77,0.05)',
          border: '0.5px dashed rgba(255,216,77,0.3)',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '18px',
        }}
      >
        <div
          style={{
            fontSize: '9px',
            fontWeight: 700,
            color: 'rgba(255,216,77,0.85)',
            marginBottom: '10px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {t.missed_moment_label}
        </div>
        <div
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '6px',
            lineHeight: 1.4,
          }}
        >
          “{reviewData?.missed_moment?.korean}”
        </div>
        <div
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.68)',
            fontFamily: 'Inter, sans-serif',
            marginBottom: '12px',
            lineHeight: 1.45,
          }}
        >
          {reviewData?.missed_moment?.translation}
        </div>
        <div
          style={{
            borderTop: '0.5px solid rgba(255,255,255,0.08)',
            paddingTop: '12px',
            fontSize: '9px',
            fontWeight: 700,
            color: 'rgba(255,216,77,0.7)',
            marginBottom: '6px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {t.missed_moment_tip_label}
        </div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.78)',
            lineHeight: 1.5,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {reviewData?.missed_moment?.tip}
        </div>
      </section>

      {/* D-day or generic */}
      <section
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '18px 16px',
          marginBottom: '18px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.26em',
            color: fansignDate
              ? 'rgba(255,255,255,0.55)'
              : 'rgba(255,255,255,0.45)',
            marginBottom: '10px',
          }}
        >
          {fansignDate && ddayStr ? t.fansign_label : t.no_dday_label}
        </div>
        {fansignDate && ddayStr ? (
          <>
            <div
              style={{
                fontSize: '32px',
                fontWeight: 800,
                color: '#FFD84D',
                marginBottom: '6px',
                letterSpacing: '-0.02em',
              }}
            >
              {ddayStr}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.55)',
                marginBottom: '12px',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              <span style={{ opacity: 0.7 }}>
                {t.fansign_date_value}
              </span>{' '}
              <span>{formatFansignDots(fansignDate)}</span>
            </div>
          </>
        ) : null}
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.82)',
          }}
        >
          {fansignDate && ddayStr ? t.dday_message : t.no_dday_message}
        </p>
      </section>

      {reviewData.encouragement ? (
        <p
          style={{
            margin: '0 0 16px',
            fontSize: '12px',
            textAlign: 'center',
            lineHeight: 1.55,
            color: 'rgba(255,216,77,0.8)',
          }}
        >
          {reviewData.encouragement}
        </p>
      ) : null}

      {/* Prep pass CTA */}
      {!isPaid ? (
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              background: '#FFD84D',
              borderRadius: '14px',
              padding: '16px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                fontSize: '30px',
                fontWeight: 800,
                color: '#0E0E0F',
                lineHeight: 1,
                marginBottom: '4px',
              }}
            >
              {prepPassUi.price}
            </div>
            <div
              style={{
                fontSize: '9px',
                fontWeight: 700,
                color: 'rgba(0,0,0,0.45)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: '4px',
              }}
            >
              {prepPassUi.label}
            </div>
            <div
              style={{
                fontSize: '10px',
                color: 'rgba(0,0,0,0.5)',
                marginBottom: '12px',
              }}
            >
              {prepPassUi.sub}
            </div>
            <button
              type="button"
              onClick={handlePrepPass}
              style={{
                width: '100%',
                background: '#0E0E0F',
                color: '#FFD84D',
                border: 'none',
                borderRadius: '100px',
                padding: '11px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              {prepPassUi.cta}
            </button>
          </div>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {prepPassUi.perks.map((perk) => (
              <li
                key={perk}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.65)',
                  lineHeight: 1.45,
                }}
              >
                <span style={{ color: '#FFD84D', flexShrink: 0 }}>✓</span>
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p
          style={{
            textAlign: 'center',
            margin: '0 0 16px',
            fontSize: '11px',
            color: 'rgba(255,216,77,0.55)',
            fontWeight: 600,
            letterSpacing: '0.06em',
          }}
        >
          {t.premium_status}
        </p>
      )}

      {/* Try again */}
      <button
        type="button"
        onClick={handleTryAgain}
        style={{
          width: '100%',
          padding: '18px',
          background: 'rgba(255,255,255,0.06)',
          border: 'none',
          borderRadius: '9999px',
          color: '#F2F0F4',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          marginBottom: '10px',
          boxShadow: 'none',
          fontFamily: 'Manrope, sans-serif',
        }}
      >
        {tryAgainCta}
      </button>
      <p
        style={{
          textAlign: 'center',
          margin: '0 0 18px',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.4)',
          lineHeight: 1.4,
        }}
      >
        {isPaid || sessionsRemaining === null
          ? t.try_again_unlimited
          : t.try_again_remaining_count.replace(
              '{{n}}',
              String(sessionsRemaining),
            )}
      </p>

      {/* Share */}
      <div
        style={{
          background: 'rgba(255,216,77,0.04)',
          border: '0.5px solid rgba(255,216,77,0.15)',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '18px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255,216,77,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0,
            }}
          >
            📸
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '9px',
                fontWeight: 700,
                color: 'rgba(255,216,77,0.6)',
                marginBottom: '6px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              {t.share_card_title}
            </div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.75)',
                marginBottom: '2px',
                lineHeight: 1.35,
              }}
            >
              “{reviewData?.share_quote}”
            </div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 500,
                color: '#7A7882',
                fontStyle: 'italic',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {reviewData?.share_quote_translation || ''}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleShare}
          style={{
            width: '100%',
            background: 'transparent',
            border: '0.5px solid rgba(255,216,77,0.3)',
            color: '#FFD84D',
            borderRadius: '100px',
            padding: '11px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: 'Manrope, sans-serif',
          }}
        >
          Share →
        </button>
      </div>

      <button
        type="button"
        onClick={() => router.push('/my-90-seconds')}
        style={{
          width: '100%',
          padding: '16px',
          background: 'rgba(255,255,255,0.06)',
          border: 'none',
          borderRadius: '9999px',
          color: 'rgba(255,255,255,0.85)',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          marginBottom: '16px',
          fontFamily: 'Manrope, sans-serif',
        }}
      >
        {t.back_to_scenarios}
      </button>

      <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
        {!user && (
          <div style={{ marginBottom: '14px' }}>
            <p
              style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.3)',
                margin: '0 0 4px',
              }}
            >
              {t.sign_in_prompt}
            </p>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  if (isInAppBrowser()) {
                    setInAppBrowserName(getInAppBrowserName());
                    setShowInAppModal(true);
                    return;
                  }
                  const supabase = getSupabase();
                  if (!supabase || typeof window === 'undefined') return;
                  const next = encodeURIComponent(
                    `${window.location.pathname}${window.location.search}`,
                  );
                  await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
                    },
                  });
                })();
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
              }}
            >
              {t.sign_in_cta}
            </button>
          </div>
        )}

        {!isPaid ? (
          <>
            <p
              style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.22)',
                margin: '0 0 4px',
              }}
            >
              {t.free_resets_notice}
            </p>
            <button
              type="button"
              onClick={handlePrepPass}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                color: '#FFD84D',
                cursor: 'pointer',
              }}
            >
              {t.prep_pass_link}
            </button>
          </>
        ) : (
          <p
            style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.38)',
              margin: '0',
              fontWeight: 600,
            }}
          >
            {t.premium_status}
          </p>
        )}
      </div>

      <InAppBrowserModal
        isOpen={showInAppModal}
        onClose={() => setShowInAppModal(false)}
        browserName={inAppBrowserName}
        lang={uiLang}
      />
    </div>
  );
}

export default function ReviewPage() {
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
            fontFamily: 'Manrope, sans-serif',
          }}
        >
          …
        </div>
      }
    >
      <ReviewContent />
    </Suspense>
  );
}
