'use client';

import { useState, useEffect, Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { hasReachedDailyLimit, getSessionsRemaining } from '@/lib/freeLimit';
import { normalizeLang } from '@/app/lib/i18n';
import { calculateDday, formatDday } from '@/src/lib/dday';

import { REVIEW_COPY } from './review-copy';

const FANSIGN_DATE_KEY = 'kkobi_m90s_fansign_date';

const FALLBACK_REVIEW = {
  scores: {
    communication: 4,
    korean_attempts: 4,
    conversation_flow: 3,
    time_used: 4,
    total: 3.8,
  },
  real_talk: '',
  encouragement: 'Good job — keep practicing!',
  best_moment: {
    you_said_korean: '오빠를 정말 좋아해요',
    you_said_translation: 'I really like you',
    you_said_romanization: 'Oppareul jeongmal joahaeyo',
    idol_replied_korean: '고마워요~ 너무 행복해요',
    idol_replied_translation: "Thank you~ I'm so happy",
    idol_replied_romanization: 'Gomawoyo~ neomu haengbokhaeyo',
    moment_type: 'core_message',
  },
  missed_moment: {
    korean: '다음에 또 만나요',
    translation: "Let's meet again next time",
    romanization: 'Daeume tto mannayo',
    tip: 'Practice with confidence — your Korean is already understandable.',
  },
  share_quote: '고마워요~ 너무 행복해요',
  share_quote_translation: "Thank you~ I'm so happy",
  share_quote_romanization: 'Gomawoyo~ neomu haengbokhaeyo',
};

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

function StarRow({ value }) {
  const v = Math.min(5, Math.max(0, Math.round(Number(value))));
  return (
    <span style={{ letterSpacing: '2px', fontSize: '16px', lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            color: i <= v ? '#FF8AA9' : 'rgba(255,255,255,0.15)',
          }}
          aria-hidden
        >
          ★
        </span>
      ))}
    </span>
  );
}

const pinkHeroNumber = {
  background:
    'linear-gradient(135deg, #FF8AA9 0%, #FF6B95 42%, #FF4D6D 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
};

const pinkHeroSmall = {
  ...pinkHeroNumber,
  fontSize: '42px',
  lineHeight: 1,
  fontWeight: 800,
  letterSpacing: '-0.03em',
};

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

  const t = REVIEW_COPY[normalizeLang(uiLang)] ?? REVIEW_COPY.en;

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
      try {
        const lang = normalizeLang(
          window.localStorage.getItem('ogu_lang') || 'en',
        );

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
        if (data?.review) {
          setReviewData(data.review);
        } else {
          setReviewData(FALLBACK_REVIEW);
        }
      } catch (e) {
        console.error('Review fetch error:', e);
        setReviewData(FALLBACK_REVIEW);
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
    router.push(`/my-90-seconds/paywall?scenario=${encodeURIComponent(scenario)}`);
  };

  const handleShare = () => {
    if (!reviewData?.share_quote) return;

    const shareText = `Just practiced my fansign call with ${idolName} 💖\n"${reviewData.share_quote}"\n\nTry it: talk.kkobi.app`;

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
            fontSize: '20px',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '8px',
            letterSpacing: '-0.01em',
            fontFamily: 'Manrope, sans-serif',
          }}
        >
          {t.loading_title}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
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
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#FF8AA9',
                animation: `dot-bounce 1.4s ${i * 0.2}s infinite`,
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
        background:
          'radial-gradient(ellipse at 50% -10%, rgba(255,138,169,0.18), transparent 55%), #0E0E0F',
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
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'rgba(255,138,169,0.85)',
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
      <div style={{ textAlign: 'center', marginBottom: '22px' }}>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.22em',
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
              ...pinkHeroNumber,
              fontSize: '56px',
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-0.03em',
            }}
          >
            {Number(totalScore).toFixed(1)}
          </span>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.45)',
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
          borderLeft: '3px solid #FF4D6D',
          background: 'rgba(255,77,109,0.08)',
          borderRadius: '12px',
          padding: '14px 14px 14px 16px',
          marginBottom: '18px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#FF8AA9',
            marginBottom: '8px',
            letterSpacing: '0.08em',
          }}
        >
          {t.real_talk_label}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: '13px',
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
            fontSize: '11px',
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
            background:
              'linear-gradient(135deg, rgba(255,138,169,0.2), rgba(255,138,169,0.06) 80%)',
            borderRadius: '18px',
            padding: '18px 18px',
            position: 'relative',
            overflow: 'hidden',
            border: '0.5px solid rgba(255,138,169,0.15)',
          }}
        >
          {reviewData?.best_moment ? (
            <>
              <div
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.45)',
                  marginBottom: '4px',
                  letterSpacing: '0.08em',
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
                  color: 'rgba(255,138,169,0.65)',
                  fontSize: '16px',
                  marginBottom: '10px',
                }}
              >
                ↓
              </div>

              <div
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,138,169,0.75)',
                  marginBottom: '4px',
                  letterSpacing: '0.06em',
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
          background: 'rgba(255,216,77,0.08)',
          border: '1px dashed rgba(255,216,77,0.28)',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '18px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#FFD84D',
            marginBottom: '10px',
            letterSpacing: '0.06em',
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
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: '12px',
            fontSize: '11px',
            fontWeight: 700,
            color: 'rgba(255,216,77,0.85)',
            marginBottom: '6px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {t.missed_moment_tip_label}
        </div>
        <div
          style={{
            fontSize: '12px',
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
          background:
            fansignDate && ddayStr
              ? 'linear-gradient(145deg, rgba(255,138,169,0.16), rgba(14,14,15,0.9))'
              : 'rgba(255,255,255,0.04)',
          border: fansignDate
            ? '0.5px solid rgba(255,138,169,0.25)'
            : '0.5px solid rgba(255,255,255,0.08)',
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
            <div style={{ ...pinkHeroSmall, marginBottom: '6px' }}>
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
            color: 'rgba(255,216,77,0.85)',
          }}
        >
          {reviewData.encouragement}
        </p>
      ) : null}

      {/* Prep pass CTA */}
      {!isPaid ? (
        <button
          type="button"
          onClick={handlePrepPass}
          style={{
            width: '100%',
            padding: '16px',
            marginBottom: '8px',
            border: 'none',
            borderRadius: '999px',
            cursor: 'pointer',
            background: 'linear-gradient(120deg, #FFD84D, #FF8AA9, #FF719B)',
            color: '#0E0E0F',
            fontSize: '13px',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            boxShadow: '0 14px 30px rgba(255,138,169,0.35)',
          }}
        >
          {t.prep_pass_cta}
        </button>
      ) : null}
      {!isPaid ? (
        <p
          style={{
            textAlign: 'center',
            margin: '0 0 16px',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.45)',
            lineHeight: 1.5,
          }}
        >
          {t.prep_pass_subtitle}
        </p>
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
          background: 'linear-gradient(135deg, #FF8AA9, #FF719B)',
          border: 'none',
          borderRadius: '9999px',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          marginBottom: '10px',
          boxShadow: '0 6px 24px rgba(255,138,169,0.28)',
          fontFamily: 'Manrope, sans-serif',
        }}
      >
        {t.try_again_free}
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
        role="button"
        tabIndex={0}
        onClick={handleShare}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleShare();
        }}
        style={{
          background:
            'linear-gradient(135deg, rgba(0,227,253,0.12), rgba(158,143,253,0.08))',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(0,227,253,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            flexShrink: 0,
          }}
        >
          📸
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#fff',
              marginBottom: '4px',
            }}
          >
            {t.share_card_title}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.75)',
              fontWeight: 500,
              marginBottom: '2px',
              lineHeight: 1.35,
            }}
          >
            “{reviewData?.share_quote}”
          </div>
          <div
            style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.4)',
              fontStyle: 'italic',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {reviewData?.share_quote_translation || ''}
          </div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px' }}>›</div>
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
                color: '#FF8AA9',
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
            color: 'rgba(255,255,255,0.5)',
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
