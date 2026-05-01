'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const gradientByPhase = {
  intro:
    'radial-gradient(ellipse at 30% 20%, rgba(255,138,169,0.35) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(158,143,253,0.25) 0%, transparent 55%), #0E0E0F',
  A:
    'radial-gradient(ellipse at 30% 20%, rgba(255,138,169,0.45) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(255,113,155,0.35) 0%, transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(158,143,253,0.25) 0%, transparent 60%), linear-gradient(180deg, #1a0e1a 0%, #0E0E0F 100%)',
  B:
    'radial-gradient(ellipse at 25% 30%, rgba(255,138,169,0.4) 0%, transparent 50%), radial-gradient(ellipse at 75% 40%, rgba(0,227,253,0.3) 0%, transparent 55%), radial-gradient(ellipse at 50% 90%, rgba(158,143,253,0.3) 0%, transparent 50%), linear-gradient(180deg, #1a0e1f 0%, #0E0E0F 100%)',
  C:
    'radial-gradient(ellipse at 50% 25%, rgba(255,138,169,0.5) 0%, transparent 45%), radial-gradient(ellipse at 20% 60%, rgba(0,227,253,0.35) 0%, transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(255,216,77,0.2) 0%, transparent 50%), linear-gradient(180deg, #1f0e1a 0%, #0E0E0F 100%)',
  D: '#050505',
  ending: '#050505',
};

const PARTICLE_COLORS = [
  'rgba(255,138,169,0.6)',
  'rgba(0,227,253,0.5)',
  'rgba(255,216,77,0.4)',
  'rgba(158,143,253,0.5)',
  'rgba(255,255,255,0.3)',
];

function buildParticles() {
  return Array.from({ length: 18 }, (_, i) => ({
    top: `${Math.random() * 80 + 10}%`,
    left: `${Math.random() * 90 + 5}%`,
    size: Math.random() * 4 + 1,
    color: PARTICLE_COLORS[i % 5],
    delay: `${Math.random() * 5}s`,
    duration: `${Math.random() * 4 + 6}s`,
  }));
}

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
  const [showTranslation, setShowTranslation] = useState(false);

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
        background: '#E24B4A',
        border: 'none',
        color: '#fff',
        boxShadow: 'none',
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
        color: '#9E9BA4',
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
        {/* 1. photocard-area */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '620px',
            background: gradientByPhase[phase] || gradientByPhase.A,
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
                animation: `float ${p.duration} ease-in-out ${p.delay} infinite`,
              }}
            />
          ))}

          {micState === 'listening-idol' && (
            <div
              style={{
                position: 'absolute',
                bottom: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
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
                      'linear-gradient(180deg, rgba(255,138,169,0.9), rgba(255,138,169,0.4))',
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
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '26px',
                  fontWeight: '800',
                  color: '#fff',
                  lineHeight: 1.3,
                  letterSpacing: '-0.01em',
                  marginBottom: '8px',
                  textShadow: '0 4px 20px rgba(0,0,0,0.9)',
                }}
              >
                {currentSubtitle.korean}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: '10px',
                  textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                }}
              >
                {currentSubtitle.roman}
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setShowTranslation(!showTranslation)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ')
                    setShowTranslation(!showTranslation);
                }}
                style={{
                  display: 'inline-block',
                  background: showTranslation
                    ? 'rgba(0,227,253,0.12)'
                    : 'transparent',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '4px 12px',
                  fontSize: '10px',
                  fontWeight: '600',
                  color: showTranslation
                    ? '#00E3FD'
                    : 'rgba(255,255,255,0.4)',
                  fontFamily: 'Manrope, sans-serif',
                  letterSpacing: '0.1em',
                  textTransform: showTranslation ? 'none' : 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                }}
              >
                {showTranslation
                  ? currentSubtitle.translation || '—'
                  : 'translate'}
              </div>
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
              'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px 0 12px',
            zIndex: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <button
              type="button"
              onClick={() => router.push('/my-90-seconds')}
              style={{
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(8px)',
                border: 'none',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-label="Close and return to scenarios"
            >
              ✕
            </button>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#FF3838',
                  boxShadow: '0 0 8px #FF3838',
                  animation: 'liveDot 1.5s ease-in-out infinite',
                }}
              />
              <span
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '12px',
                  fontWeight: '800',
                  color: '#FF3838',
                  letterSpacing: '0.15em',
                }}
              >
                LIVE
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                fontWeight: '800',
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
            top: '64px',
            left: '24px',
            zIndex: 5,
          }}
        >
          <div
            style={{
              fontFamily: 'Manrope, sans-serif',
              fontSize: '16px',
              fontWeight: '800',
              color: '#fff',
              textShadow: '0 2px 12px rgba(0,0,0,0.6)',
            }}
          >
            {voiceGender === 'FEMALE' ? 'Idol_F' : 'Idol_M'}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            top: '64px',
            right: '24px',
            width: '76px',
            height: '100px',
            background:
              'linear-gradient(135deg, #1a1a1c 0%, #2a2a2e 50%, #1a1a1c 100%)',
            borderRadius: '14px',
            zIndex: 5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <div style={{ fontSize: '20px', opacity: 0.4 }}>📷</div>
          <div
            style={{
              fontFamily: 'Manrope, sans-serif',
              fontSize: '8px',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            YOU
          </div>
        </div>

        {showEmergencyCards && (
          <div
            style={{
              position: 'absolute',
              bottom: '232px',
              left: '16px',
              right: '16px',
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              zIndex: 7,
              padding: '0 8px',
              scrollbarWidth: 'none',
              animation: 'slideUpFade 0.4s ease-out',
            }}
          >
            {[
              '"잠깐, 다시 말할게요"',
              '"다른 얘기 할게요"',
              '"너무 좋아서 말이 안 나와요"',
            ].map((text, i) => (
              <div
                key={i}
                style={{
                  flexShrink: 0,
                  background: 'rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: '9999px',
                  padding: '10px 16px',
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'rgba(255,255,255,0.85)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {text}
              </div>
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
              opacity: micState === 'listening-idol' ? 0.35 : 1,
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
                color: micState === 'processing' ? '#00E3FD' : undefined,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {micState === 'listening-idol'
                ? 'Listening...'
                : micState === 'recording'
                  ? 'Recording...'
                  : micState === 'processing'
                    ? 'Processing...'
                    : 'Tap to speak'}
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
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'Manrope, sans-serif',
                color: 'rgba(255,255,255,0.5)',
                textAlign: 'right',
              }}
            >
              {scenarioId}
            </span>
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
