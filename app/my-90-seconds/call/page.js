'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const phaseGradients = {
  intro:
    'radial-gradient(ellipse at 50% 30%, rgba(255,138,169,0.42), transparent 70%), #0E0E0F',
  A:
    'radial-gradient(ellipse at 50% 40%, rgba(255,138,169,0.52), transparent 65%), #0E0E0F',
  B:
    'radial-gradient(ellipse at 30% 50%, rgba(255,138,169,0.42), transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(0,227,253,0.38), transparent 60%), #0E0E0F',
  C:
    'radial-gradient(ellipse at 30% 60%, rgba(0,227,253,0.48), transparent 60%), radial-gradient(ellipse at 70% 40%, rgba(255,216,77,0.32), transparent 60%), #0E0E0F',
  D:
    'radial-gradient(ellipse at 50% 50%, rgba(158,143,253,0.38), transparent 70%), #0E0E0F',
  ending: '#050505',
};

const PARTICLE_COLORS = [
  'rgba(255,138,169,0.65)',
  'rgba(0,227,253,0.55)',
  'rgba(255,216,77,0.45)',
  'rgba(158,143,253,0.55)',
  'rgba(255,255,255,0.35)',
];

function buildParticles() {
  return Array.from({ length: 25 }, (_, i) => ({
    top: `${Math.random() * 80 + 10}%`,
    left: `${Math.random() * 90 + 5}%`,
    size:
      Math.random() > 0.52 ? Math.random() * 2 + 4 : Math.random() * 3 + 1,
    color: PARTICLE_COLORS[i % 5],
    delay: `${Math.random() * 5}s`,
    duration: `${Math.random() * 4 + 6}s`,
  }));
}

const emergencyCards = [
  { en: 'Wait, restart', ko: '잠깐, 다시 말할게요' },
  { en: 'Change topic', ko: '다른 얘기 할게요' },
  { en: 'I love you', ko: '너무 좋아요' },
];

function CallPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [scenarioId, setScenarioId] = useState(null);
  const [voiceGender, setVoiceGender] = useState(null);
  const [savedScript, setSavedScript] = useState(null);
  const [isReady, setIsReady] = useState(false);

  const [particles, setParticles] = useState([]);

  const [phase, setPhase] = useState('intro');
  const [timeRemaining, setTimeRemaining] = useState(90);
  const [currentSubtitle, setCurrentSubtitle] = useState({
    korean: '안녕~',
    roman: 'annyeong',
    translation: '',
    visible: true,
  });
  const [micState, setMicState] = useState('idle');
  const [showEmergencyCards, setShowEmergencyCards] = useState(false);
  const [showRomanization, setShowRomanization] = useState(true);

  useEffect(() => {
    setParticles(buildParticles());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sId = searchParams.get('scenario');

    const vGender = localStorage.getItem('kkobi_voice_gender') || 'FEMALE';
    const savedRaw = localStorage.getItem('kkobi_m90s_saved');
    const lastScenario = localStorage.getItem('kkobi_m90s_last_scenario');

    if (!sId || !savedRaw) {
      console.error('[Phase B] 필수 데이터 없음. Phase A로 돌아가야 함');
      console.log('scenario:', sId);
      console.log('savedScript:', savedRaw);
      router.push('/my-90-seconds');
      return;
    }

    let parsedScript;
    try {
      parsedScript = JSON.parse(savedRaw);
    } catch (e) {
      console.error('[Phase B] savedScript 파싱 실패:', e);
      router.push('/my-90-seconds');
      return;
    }

    console.log('=== Phase B 진입 데이터 확인 ===');
    console.log('Scenario ID:', sId);
    console.log('Voice Gender:', vGender);
    console.log('Last Scenario:', lastScenario);
    console.log('Saved Script:', parsedScript);
    console.log('Lines count:', parsedScript?.lines?.length);
    console.log('First line:', parsedScript?.lines?.[0]);
    console.log('==============================');

    setScenarioId(sId);
    setVoiceGender(vGender);
    setSavedScript(parsedScript);
    setIsReady(true);
  }, [searchParams, router]);

  useEffect(() => {
    if (!savedScript?.lines?.[0]) return;
    const line = savedScript.lines[0];
    setCurrentSubtitle((prev) => ({
      ...prev,
      korean: line.korean || prev.korean,
      roman: line.romanization || line.roman || prev.roman,
      translation: line.translation || '',
      visible: true,
    }));
  }, [savedScript]);

  const handleMicTap = useCallback(() => {
    if (micState === 'listening-idol') return;
    if (micState === 'idle' || micState === 'active') {
      setMicState('recording');
    } else if (micState === 'recording') {
      setMicState('processing');
      setTimeout(() => setMicState('active'), 1500);
    }
  }, [micState]);

  const micBoxStyle = (() => {
    if (micState === 'listening-idol') {
      return {
        background: 'rgba(0,227,253,0.14)',
        border: '1.5px solid #00E3FD',
        color: '#fff',
        boxShadow: '0 0 28px rgba(0,227,253,0.35)',
      };
    }
    if (micState === 'recording') {
      return {
        background: '#E24B4A',
        border: 'none',
        color: '#fff',
        boxShadow: 'none',
      };
    }
    if (micState === 'processing') {
      return {
        background: '#2C2C2D',
        border: 'none',
        color: '#00E3FD',
        boxShadow: 'none',
      };
    }
    if (micState === 'active') {
      return {
        background: 'linear-gradient(135deg, #FF8AA9, #FF719B)',
        border: 'none',
        color: '#fff',
        boxShadow: '0 12px 40px rgba(255,138,169,0.35)',
      };
    }
    return {
      background: 'transparent',
      border: '1.5px solid #FF8AA9',
      color: '#FF8AA9',
      boxShadow: 'none',
    };
  })();

  const micLabel =
    micState === 'listening-idol'
      ? 'Listening...'
      : micState === 'recording'
        ? 'Speaking...'
        : micState === 'processing'
          ? 'Processing...'
          : 'Your turn';

  const bgLayer =
    phaseGradients[phase] || phaseGradients.A;

  if (!isReady) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0E0E0F',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Manrope, sans-serif',
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0E0E0F',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '390px',
          height: '100svh',
          position: 'relative',
          overflow: 'hidden',
          background: '#0E0E0F',
        }}
      >
        {process.env.NODE_ENV === 'development' && scenarioId && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              fontSize: '9px',
              color: 'rgba(255,255,255,0.2)',
              fontFamily: 'monospace',
              zIndex: 10001,
              pointerEvents: 'none',
            }}
          >
            [DEV] {scenarioId}
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '620px',
            background: bgLayer,
            transition: 'background 1.5s ease-in-out',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.03,
              backgroundImage:
                'repeating-linear-gradient(45deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              position: 'absolute',
              top: '20%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '120px',
              height: '120px',
              background:
                'radial-gradient(circle, rgba(255,255,255,0.06), transparent 60%)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />

          {particles.map((p, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: p.top,
                left: p.left,
                width: `${p.size}px`,
                height: `${p.size}px`,
                borderRadius: '50%',
                background: p.color,
                boxShadow: `0 0 ${Math.round(p.size * 2)}px ${p.color}`,
                animation: `twinkle ${p.duration} ease-in-out ${p.delay} infinite`,
                pointerEvents: 'none',
                zIndex: 3,
              }}
            />
          ))}

          {micState === 'listening-idol' && (
            <div
              style={{
                position: 'absolute',
                top: '30%',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 4,
                display: 'flex',
                alignItems: 'flex-end',
                gap: '4px',
                height: '60px',
              }}
            >
              {[12, 24, 36, 48, 30, 42, 18, 36, 24].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: '5px',
                    height: `${h}px`,
                    background:
                      'linear-gradient(180deg, rgba(0,227,253,0.95), rgba(0,227,253,0.35))',
                    borderRadius: '2px',
                    animation: `wave 1.4s ease-in-out ${i * 0.07}s infinite`,
                  }}
                />
              ))}
            </div>
          )}

          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '200px',
              background:
                'linear-gradient(180deg, transparent 0%, rgba(14,14,15,0.7) 60%, #0E0E0F 100%)',
              pointerEvents: 'none',
              zIndex: 4,
            }}
          />

          {currentSubtitle.visible && (
            <div
              style={{
                position: 'absolute',
                bottom: '40px',
                left: '24px',
                right: '24px',
                zIndex: 8,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.95)',
                  fontFamily: 'Inter, sans-serif',
                  marginBottom: '12px',
                  lineHeight: 1.3,
                  textShadow: '0 2px 16px rgba(0,0,0,0.85)',
                }}
              >
                {currentSubtitle.translation ||
                  currentSubtitle.korean ||
                  '—'}
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#fff',
                  fontFamily: 'Manrope, sans-serif',
                  marginBottom: '6px',
                  lineHeight: 1.3,
                  textShadow: '0 4px 16px rgba(0,0,0,0.9)',
                }}
              >
                {currentSubtitle.korean}
              </div>
              {showRomanization && (
                <div
                  style={{
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.5)',
                    fontFamily: 'Inter, sans-serif',
                    fontStyle: 'italic',
                    letterSpacing: '0.02em',
                    textShadow: '0 1px 8px rgba(0,0,0,0.8)',
                  }}
                >
                  {currentSubtitle.roman}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowRomanization(!showRomanization)}
                style={{
                  fontSize: '9px',
                  color: 'rgba(255,255,255,0.4)',
                  background: 'transparent',
                  border: 'none',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginTop: '8px',
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {showRomanization
                  ? 'hide pronunciation'
                  : 'show pronunciation'}
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '52px',
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.78) 0%, transparent 100%)',
            zIndex: 19,
            pointerEvents: 'none',
          }}
        />

        <button
          type="button"
          onClick={() => router.push('/my-90-seconds')}
          style={{
            position: 'absolute',
            top: '12px',
            left: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            border: 'none',
            zIndex: 25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.8)',
            fontSize: '14px',
            cursor: 'pointer',
          }}
          aria-label="Close and return to scenarios"
        >
          ✕
        </button>

        <div
          style={{
            position: 'absolute',
            top: '14px',
            left: '60px',
            right: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#FF4444',
                animation: 'liveDot 1.5s ease-in-out infinite',
              }}
            />
            <span
              style={{
                fontFamily: 'Manrope, sans-serif',
                fontSize: '11px',
                fontWeight: 700,
                color: '#FF4444',
                letterSpacing: '0.12em',
              }}
            >
              LIVE
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '2px',
                height: '12px',
              }}
            >
              {[4, 7, 10, 12].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: '3px',
                    height: `${h}px`,
                    background: 'rgba(255,255,255,0.7)',
                    borderRadius: '1px',
                  }}
                />
              ))}
            </div>
            <div
              style={{
                background:
                  timeRemaining <= 20
                    ? 'rgba(255,138,169,0.2)'
                    : 'rgba(255,255,255,0.1)',
                color: timeRemaining <= 20 ? '#FF8AA9' : '#fff',
                fontFamily: 'Manrope, sans-serif',
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '9999px',
                letterSpacing: '0.05em',
                transition: 'all 0.3s',
              }}
            >
              {Math.floor(timeRemaining / 60)}:
              {String(timeRemaining % 60).padStart(2, '0')}
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            top: '60px',
            left: '24px',
            zIndex: 5,
          }}
        >
          <div
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.05em',
              fontFamily: 'Manrope, sans-serif',
              textShadow: '0 2px 12px rgba(0,0,0,0.6)',
            }}
          >
            {voiceGender === 'FEMALE' ? 'WONYOUNG' : 'JISUNG'}
          </div>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginTop: '2px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Member · Group
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '24px',
            width: '76px',
            height: '100px',
            background:
              'linear-gradient(135deg, rgba(40,40,44,0.9) 0%, rgba(20,20,22,0.95) 100%)',
            borderRadius: '14px',
            zIndex: 5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 3px)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              fontSize: '20px',
              opacity: 0.3,
              marginBottom: '8px',
              position: 'relative',
              zIndex: 1,
            }}
          >
            📷
          </div>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.15em',
              fontFamily: 'Manrope, sans-serif',
              position: 'relative',
              zIndex: 1,
            }}
          >
            YOU
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '6px',
              right: '6px',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#FF4444',
              boxShadow: '0 0 6px #FF4444',
              animation: 'pulse 2s infinite',
              zIndex: 2,
            }}
          />
        </div>

        {showEmergencyCards && (
          <div
            style={{
              position: 'absolute',
              bottom: '120px',
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              padding: '0 16px',
              zIndex: 14,
              flexWrap: 'wrap',
              animation: 'slideUpFade 0.4s ease-out',
            }}
          >
            {emergencyCards.map((card, i) => (
              <button
                key={i}
                type="button"
                style={{
                  flex: '1 1 0',
                  maxWidth: '120px',
                  padding: '8px 10px',
                  background: 'rgba(255,138,169,0.15)',
                  backdropFilter: 'blur(12px)',
                  border: 'none',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#FF8AA9',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginBottom: '3px',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {card.en}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.85)',
                    fontFamily: 'Manrope, sans-serif',
                  }}
                >
                  {card.ko}
                </div>
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '224px',
            background:
              'linear-gradient(180deg, transparent 0%, #0E0E0F 30%)',
            zIndex: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingBottom: '32px',
          }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={handleMicTap}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleMicTap();
            }}
            style={{
              width: '220px',
              height: '88px',
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor:
                micState === 'listening-idol' ? 'default' : 'pointer',
              opacity: micState === 'listening-idol' ? 0.42 : 1,
              transition: 'all 0.3s',
              animation:
                micState === 'recording'
                  ? 'recording 1.4s ease-in-out infinite'
                  : 'none',
              boxSizing: 'border-box',
              ...micBoxStyle,
            }}
          >
            {micState === 'processing' ? (
              <svg
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
                aria-hidden
              >
                <circle
                  cx="6.5"
                  cy="6.5"
                  r="5.5"
                  stroke="#00E3FD"
                  strokeWidth="1.3"
                  strokeDasharray="3 2"
                  opacity={0.85}
                />
              </svg>
            ) : (
              <div style={{ fontSize: '28px' }}>
                {micState === 'recording' ? '🔴' : '🎤'}
              </div>
            )}
            <div
              style={{
                fontFamily: 'Manrope, sans-serif',
                fontSize: '12px',
                fontWeight: '700',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {micLabel}
            </div>
          </div>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              zIndex: 9999,
              maxHeight: '70svh',
              overflowY: 'auto',
            }}
          >
            {['intro', 'A', 'B', 'C', 'D'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPhase(p)}
                style={{
                  background: phase === p ? '#FF8AA9' : '#FFD84D',
                  color: '#000',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontWeight: '800',
                  fontFamily: 'Manrope, sans-serif',
                  cursor: 'pointer',
                }}
              >
                {p === phase ? `✓ ${p}` : p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowEmergencyCards(!showEmergencyCards)}
              style={{
                background: '#9E8FFD',
                color: '#fff',
                border: 'none',
                borderRadius: '9999px',
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: '800',
                fontFamily: 'Manrope, sans-serif',
                cursor: 'pointer',
              }}
            >
              Emergency
            </button>
            <button
              type="button"
              onClick={() =>
                setMicState((s) =>
                  s === 'listening-idol' ? 'active' : 'listening-idol'
                )
              }
              style={{
                background: '#00E3FD',
                color: '#0E0E0F',
                border: 'none',
                borderRadius: '9999px',
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: '800',
                fontFamily: 'Manrope, sans-serif',
                cursor: 'pointer',
              }}
            >
              Wave (idol)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0E0E0F',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: 'Manrope, sans-serif',
        fontSize: '14px',
        opacity: 0.5,
      }}
    >
      Loading...
    </div>
  );
}

export default function CallPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CallPageContent />
    </Suspense>
  );
}
