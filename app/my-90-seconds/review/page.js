'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { hasReachedDailyLimit } from '@/lib/freeLimit';

const FALLBACK_REVIEW = {
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

function ReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenario = searchParams.get('scenario') || 'compliment';

  const [stage, setStage] = useState('loading');
  const [reviewData, setReviewData] = useState(null);
  const [stats, setStats] = useState({
    completedLines: 4,
    totalLines: 5,
    timeUsed: 65,
    wins: 3,
  });
  const [idolName, setIdolName] = useState('IDOL');
  const [continueEnabled, setContinueEnabled] = useState(false);
  const [user, setUser] = useState(null);

  const fetchReview = useCallback(
    async (moments, gender, statPayload, nameForPrompt) => {
      try {
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
      window.setTimeout(() => setStage('entry'), 500);
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

    setStats(mergedStats);
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

  useEffect(() => {
    if (stage !== 'entry') return undefined;
    const t = window.setTimeout(() => setContinueEnabled(true), 3000);
    return () => window.clearTimeout(t);
  }, [stage]);

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

  const handleShare = () => {
    if (!reviewData?.share_quote) return;

    const shareText = `Just practiced my fansign call with ${idolName} 💖\n"${reviewData.share_quote}"\n\nTry it: talk.kkobi.app`;

    if (navigator.share) {
      navigator.share({ text: shareText }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText).catch(() => {});
      window.alert('Copied to clipboard!');
    }
  };

  if (stage === 'loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0E0E0F',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
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
          Looking back at your 90 seconds...
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '32px',
            fontFamily: 'Manrope, sans-serif',
          }}
        >
          Finding your best moment and what to work on next
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

  if (stage === 'entry') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: `
          radial-gradient(ellipse at 50% 50%, rgba(255,138,169,0.25), transparent 60%),
          #0E0E0F
        `,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          animation: 'fadeIn 0.8s ease-out',
          padding: '40px 20px',
        }}
      >
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${10 + (i * 7) % 80}%`,
              left: `${10 + (i * 13) % 80}%`,
              width: `${2 + (i % 3)}px`,
              height: `${2 + (i % 3)}px`,
              borderRadius: '50%',
              background: ['#FFD84D', '#FF8AA9', '#00E3FD', '#9E8FFD', '#fff'][
                i % 5
              ],
              animation: `twinkle 3s ${i * 0.3}s infinite`,
              pointerEvents: 'none',
            }}
          />
        ))}

        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'rgba(255,138,169,0.8)',
            marginBottom: '32px',
            textAlign: 'center',
            fontFamily: 'Manrope, sans-serif',
          }}
        >
          ⭐ Best Moment
        </div>

        <div
          style={{
            textAlign: 'center',
            marginBottom: '16px',
            maxWidth: '340px',
          }}
        >
          <div
            style={{
              fontSize: '22px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.95)',
              lineHeight: 1.4,
              letterSpacing: '-0.01em',
              marginBottom: '14px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            &ldquo;
            {reviewData?.best_moment?.idol_replied_translation ||
              'Really? Thank you so much~'}
            &rdquo;
          </div>

          <div
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.3,
              letterSpacing: '-0.02em',
              marginBottom: '8px',
              fontFamily: 'Manrope, sans-serif',
            }}
          >
            &ldquo;
            {reviewData?.best_moment?.idol_replied_korean ||
              '진짜요? 너무 고마워요~'}
            &rdquo;
          </div>

          <div
            style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.5)',
              fontStyle: 'italic',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.02em',
            }}
          >
            {reviewData?.best_moment?.idol_replied_romanization ||
              'Jinjayo? Neomu gomawoyo~'}
          </div>
        </div>

        <div
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '60px',
            fontFamily: 'Manrope, sans-serif',
          }}
        >
          — {idolName}
        </div>

        <button
          type="button"
          onClick={() => setStage('main')}
          disabled={!continueEnabled}
          style={{
            padding: '12px 32px',
            background: continueEnabled
              ? 'rgba(255,255,255,0.12)'
              : 'rgba(255,255,255,0.04)',
            border: 'none',
            borderRadius: '9999px',
            color: continueEnabled
              ? 'rgba(255,255,255,0.85)'
              : 'rgba(255,255,255,0.3)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            cursor: continueEnabled ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s',
            fontFamily: 'Manrope, sans-serif',
          }}
        >
          Continue ›
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0E0E0F',
        padding: '24px 20px 40px',
        maxWidth: '480px',
        margin: '0 auto',
        animation: 'slideUp 0.5s ease-out',
        fontFamily: 'Manrope, sans-serif',
      }}
    >
      <div style={{ marginBottom: '24px', paddingTop: '12px' }}>
        <div
          style={{
            fontSize: '10px',
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}
        >
          90 seconds with {idolName}
        </div>
        <div
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
          }}
        >
          You did <span style={{ color: '#FF8AA9' }}>great</span>.
        </div>
      </div>

      <div
        style={{
          background:
            'linear-gradient(135deg, rgba(255,138,169,0.18), rgba(255,138,169,0.05) 80%)',
          borderRadius: '20px',
          padding: '20px',
          marginBottom: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: '#FF8AA9',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: '12px',
          }}
        >
          ⭐ Best Moment
        </div>

        <div
          style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '4px',
            letterSpacing: '0.05em',
          }}
        >
          YOU SAID
        </div>
        <div
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#fff',
            marginBottom: '4px',
          }}
        >
          &ldquo;{reviewData?.best_moment?.you_said_korean}&rdquo;
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.55)',
            marginBottom: '12px',
            fontStyle: 'italic',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {reviewData?.best_moment?.you_said_translation}
        </div>

        <div
          style={{
            color: 'rgba(255,138,169,0.6)',
            fontSize: '18px',
            marginBottom: '8px',
            textAlign: 'center',
          }}
        >
          ↓
        </div>

        <div
          style={{
            fontSize: '11px',
            color: 'rgba(255,138,169,0.7)',
            marginBottom: '4px',
            letterSpacing: '0.05em',
          }}
        >
          {idolName} REPLIED
        </div>
        <div
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1.3,
            marginBottom: '4px',
          }}
        >
          &ldquo;{reviewData?.best_moment?.idol_replied_korean}&rdquo;
        </div>
        <div
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.6)',
            fontStyle: 'italic',
          }}
        >
          {reviewData?.best_moment?.idol_replied_translation}
        </div>
      </div>

      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-around',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#fff',
              marginBottom: '2px',
            }}
          >
            <span style={{ color: '#FFD84D' }}>{stats.completedLines}</span>/
            {stats.totalLines}
          </div>
          <div
            style={{
              fontSize: '9px',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            Lines
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#fff',
              marginBottom: '2px',
            }}
          >
            {stats.timeUsed}s
          </div>
          <div
            style={{
              fontSize: '9px',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            Used
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#fff',
              marginBottom: '2px',
            }}
          >
            {stats.wins}
          </div>
          <div
            style={{
              fontSize: '9px',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            Wins
          </div>
        </div>
      </div>

      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '16px',
          padding: '18px 20px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'rgba(255,216,77,0.8)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: '10px',
          }}
        >
          💡 One to practice
        </div>
        <div
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.85)',
            marginBottom: '4px',
          }}
        >
          &ldquo;{reviewData?.missed_moment?.korean}&rdquo;
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          {reviewData?.missed_moment?.translation}
        </div>
        <div
          style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.4,
          }}
        >
          {reviewData?.missed_moment?.tip}
        </div>
      </div>

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
          marginBottom: '24px',
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
          📤
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
            Share your moment
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.7)',
              fontWeight: 500,
              marginBottom: '2px',
            }}
          >
            &ldquo;{reviewData?.share_quote}&rdquo;
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
        onClick={handleTryAgain}
        style={{
          width: '100%',
          padding: '18px',
          background: 'linear-gradient(135deg, #FF8AA9, #FF719B)',
          border: 'none',
          borderRadius: '9999px',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          marginBottom: '12px',
          boxShadow: '0 4px 24px rgba(255,138,169,0.3)',
          fontFamily: 'Manrope, sans-serif',
        }}
      >
        Try once more
      </button>

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
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          marginBottom: '16px',
          fontFamily: 'Manrope, sans-serif',
        }}
      >
        Back to scenarios
      </button>

      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        {!user && (
          <div style={{ marginBottom: '10px' }}>
            <p
              style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.3)',
                margin: '0 0 4px',
              }}
            >
              Want 3 sessions a day?
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
              Sign in — it's free →
            </button>
          </div>
        )}

        <p
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.22)',
            margin: '0 0 4px',
          }}
        >
          Free practice resets in 24h.
        </p>
        <button
          type="button"
          onClick={() => {
            window.location.href = '/my-90-seconds/paywall';
          }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '12px',
            fontWeight: 600,
            color: '#FFD84D',
            cursor: 'pointer',
          }}
        >
          Get Prep Pass for unlimited →
        </button>
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
          Loading...
        </div>
      }
    >
      <ReviewContent />
    </Suspense>
  );
}
