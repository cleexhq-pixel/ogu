'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
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
  const [idolName, setIdolName] = useState('IDOL');
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
  const [micState, setMicState] = useState('your_turn');
  const [showEmergencyCards, setShowEmergencyCards] = useState(false);
  const [showRomanization, setShowRomanization] = useState(true);

  const [introStep, setIntroStep] = useState('connecting');
  const [emotionalMoment, setEmotionalMoment] = useState(null);
  const [positiveMoments, setPositiveMoments] = useState([]);
  const [timerState, setTimerState] = useState('normal');

  const emotionalClearRef = useRef(null);
  const endSequenceRef = useRef(false);

  useEffect(() => {
    setParticles(buildParticles());
  }, []);

  useEffect(() => {
    if (micState !== 'processing') return undefined;
    const id = window.setTimeout(() => setMicState('your_turn'), 1500);
    return () => clearTimeout(id);
  }, [micState]);

  useEffect(() => {
    if (timeRemaining <= 5 && timeRemaining > 0) setTimerState('danger');
    else if (timeRemaining <= 20 && timeRemaining > 5) setTimerState('warning');
    else if (timeRemaining === 0) setTimerState('ended');
    else setTimerState('normal');
  }, [timeRemaining]);

  useEffect(() => {
    if (introStep === 'connecting') {
      const t = window.setTimeout(() => setIntroStep('incoming'), 1800);
      return () => clearTimeout(t);
    }
    if (introStep === 'answered') {
      const t = window.setTimeout(() => setIntroStep('started'), 800);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [introStep]);

  useEffect(() => {
    if (introStep !== 'started') return undefined;
    const id = window.setInterval(() => {
      setTimeRemaining((t) => (t <= 0 ? 0 : t - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [introStep]);

  useEffect(() => {
    if (introStep !== 'completed' || typeof window === 'undefined') return;
    window.localStorage.setItem(
      'kkobi_m90s_positive_moments',
      JSON.stringify(positiveMoments),
    );
    window.localStorage.setItem(
      'kkobi_m90s_last_completed',
      new Date().toISOString(),
    );

    const totalLines =
      typeof savedScript?.lines?.length === 'number' && savedScript.lines.length > 0
        ? savedScript.lines.length
        : 5;

    const stats = {
      completedLines: positiveMoments.length || 4,
      totalLines,
      timeUsed: 90 - timeRemaining,
      scenario: scenarioId,
    };
    window.localStorage.setItem('kkobi_m90s_last_stats', JSON.stringify(stats));
  }, [introStep, positiveMoments, timeRemaining, scenarioId, savedScript]);

  const formatTime = (sec) =>
    `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  const playStaffEndingVoice = useCallback(async () => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '통화 시간이 종료되었습니다. 수고하셨습니다.',
          lang: 'ko-KR',
          gender: voiceGender === 'MALE' ? 'MALE' : 'FEMALE',
        }),
      });
      const data = await res.json();
      if (data?.audioContent) {
        const audio = new Audio(
          `data:audio/mp3;base64,${data.audioContent}`,
        );
        await audio.play().catch(() => {});
      }
    } catch {
      // staff TTS optional
    }
  }, [voiceGender]);

  const playStaffRef = useRef(playStaffEndingVoice);
  playStaffRef.current = playStaffEndingVoice;

  useEffect(() => {
    if (timeRemaining !== 0 || introStep !== 'started') return;
    if (endSequenceRef.current) return;
    endSequenceRef.current = true;

    void playStaffRef.current();

    setCurrentSubtitle((prev) => ({
      ...prev,
      korean: '다음에 또 봐요~',
      roman: 'Daeume tto bawayo~',
      translation: 'See you next time~',
      visible: true,
    }));

    const t1 = window.setTimeout(() => {
      setIntroStep('completed');
      window.setTimeout(() => {
        if (scenarioId) {
          router.push(
            `/my-90-seconds/review?scenario=${encodeURIComponent(scenarioId)}`,
          );
        }
      }, 1000);
    }, 2500);

    return () => window.clearTimeout(t1);
  }, [timeRemaining, introStep, scenarioId, router]);

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
    setIdolName(localStorage.getItem('kkobi_idol_name') || 'IDOL');
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

  const startSpeaking = useCallback(() => {
    setMicState((s) => (s === 'your_turn' ? 'speaking' : s));
  }, []);

  const stopSpeaking = useCallback(() => {
    setMicState((s) => (s === 'speaking' ? 'processing' : s));
  }, []);

  const handleEmergencyCard = useCallback((card) => {
    setCurrentSubtitle((prev) => ({
      ...prev,
      korean: card.ko,
      translation: card.en,
      visible: true,
    }));
  }, []);

  const triggerEmotionalMoment = useCallback((type, context) => {
    if (emotionalClearRef.current) window.clearTimeout(emotionalClearRef.current);
    setEmotionalMoment(type);
    setPositiveMoments((prev) => [
      ...prev,
      { type, context, timestamp: 90 - timeRemaining },
    ]);
    emotionalClearRef.current = window.setTimeout(() => {
      setEmotionalMoment(null);
      emotionalClearRef.current = null;
    }, 1500);
  }, [timeRemaining]);

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

        {introStep !== 'started' && introStep !== 'completed' && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: '#0E0E0F',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 0.8s',
              opacity: introStep === 'answered' ? 0 : 1,
              pointerEvents: introStep === 'answered' ? 'none' : 'auto',
            }}
          >
            {introStep === 'connecting' && (
              <div
                style={{
                  textAlign: 'center',
                  animation: 'fadeIn 0.5s ease-out',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.4)',
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    marginBottom: '24px',
                    animation: 'pulse-text 1.5s infinite',
                  }}
                >
                  Connecting...
                </div>
                <div
                  style={{
                    width: '60px',
                    height: '4px',
                    margin: '0 auto',
                    background:
                      'linear-gradient(90deg, transparent, rgba(255,138,169,0.4), transparent)',
                    animation: 'connecting-bar 1.5s infinite',
                  }}
                />
              </div>
            )}

            {introStep === 'incoming' && (
              <div
                style={{
                  textAlign: 'center',
                  animation: 'fadeIn 0.5s ease-out',
                  padding: '0 40px',
                }}
              >
                <div
                  style={{
                    width: '160px',
                    height: '160px',
                    margin: '0 auto 32px',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background:
                        'linear-gradient(135deg, rgba(255,138,169,0.3), rgba(0,227,253,0.2))',
                      animation: 'incoming-pulse 1.5s infinite',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: '20px',
                      borderRadius: '50%',
                      background: '#1a1a1c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '48px',
                    }}
                  >
                    📞
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'rgba(255,138,169,0.8)',
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                  }}
                >
                  Incoming video call
                </div>

                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 700,
                    color: '#fff',
                    fontFamily: 'Manrope, sans-serif',
                    letterSpacing: '-0.02em',
                    marginBottom: '40px',
                  }}
                >
                  {idolName}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '40px',
                    justifyContent: 'center',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => router.push('/my-90-seconds')}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'rgba(255,68,68,0.15)',
                      border: '2px solid rgba(255,68,68,0.4)',
                      cursor: 'pointer',
                      color: '#FF4444',
                      fontSize: '24px',
                    }}
                  >
                    ✗
                  </button>

                  <button
                    type="button"
                    onClick={() => setIntroStep('answered')}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #FF8AA9, #FF719B)',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#fff',
                      fontSize: '24px',
                      boxShadow: '0 0 32px rgba(255,138,169,0.5)',
                      animation: 'pulse-button 1.5s infinite',
                    }}
                  >
                    ✓
                  </button>
                </div>
              </div>
            )}
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

          {micState === 'idol_speaking' && (
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

          {showEmergencyCards && (
            <div
              style={{
                position: 'absolute',
                bottom: '160px',
                left: '12px',
                right: '12px',
                display: 'flex',
                justifyContent: 'center',
                gap: '6px',
                zIndex: 10,
                animation: 'slideUp 0.4s ease-out',
              }}
            >
              {emergencyCards.map((card, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleEmergencyCard(card)}
                  style={{
                    flex: '1 1 0',
                    maxWidth: '110px',
                    padding: '8px 10px',
                    background: 'rgba(255,138,169,0.18)',
                    backdropFilter: 'blur(12px)',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                  }}
                >
                  <div
                    style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      color: '#FF8AA9',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      marginBottom: '2px',
                    }}
                  >
                    {card.en}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
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
              height: '200px',
              background:
                'linear-gradient(180deg, transparent 0%, rgba(14,14,15,0.7) 60%, #0E0E0F 100%)',
              pointerEvents: 'none',
              zIndex: 4,
            }}
          />

          {emotionalMoment && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {emotionalMoment === 'first_korean' && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'radial-gradient(ellipse at center, rgba(255,138,169,0.25), transparent 60%)',
                      animation: 'glow-fade 1.5s ease-out',
                    }}
                  />
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        top: `${30 + i * 15}%`,
                        left: `${20 + i * 25}%`,
                        fontSize: '20px',
                        animation: `sparkle-${i} 1.5s ease-out`,
                      }}
                    >
                      ✨
                    </div>
                  ))}
                </>
              )}

              {emotionalMoment === 'core_message' && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(255,138,169,0.4)',
                      animation: 'flash 0.4s ease-out',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '80px',
                      animation: 'heart-pop 1.5s ease-out',
                    }}
                  >
                    💖
                  </div>
                </>
              )}

              {emotionalMoment === 'name_remembered' && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'radial-gradient(ellipse at center, rgba(255,216,77,0.2), transparent 60%)',
                      animation: 'glow-fade 1.5s ease-out',
                    }}
                  />
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        top: `${20 + i * 12}%`,
                        left: `${15 + i * 15}%`,
                        fontSize: '24px',
                        color: '#FFD84D',
                        animation: `star-${i} 1.5s ease-out`,
                      }}
                    >
                      ⭐
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {introStep === 'started' &&
            timeRemaining <= 5 &&
            timeRemaining > 0 && (
              <div
                key={timeRemaining}
                style={{
                  position: 'absolute',
                  top: '40%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '120px',
                  fontWeight: 900,
                  color: 'rgba(255,68,68,0.4)',
                  fontFamily: 'Manrope, sans-serif',
                  pointerEvents: 'none',
                  zIndex: 8,
                  animation: 'countdown-pop 1s ease-out',
                }}
              >
                {timeRemaining}
              </div>
            )}

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
                  timerState === 'danger'
                    ? 'rgba(255,68,68,0.2)'
                    : timerState === 'warning'
                      ? 'rgba(255,216,77,0.18)'
                      : timerState === 'ended'
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(255,255,255,0.1)',
                padding: '3px 10px',
                borderRadius: '9999px',
                letterSpacing: '0.05em',
                transition: 'all 0.3s',
              }}
            >
              <div
                style={{
                  fontSize: timerState === 'danger' ? '14px' : '11px',
                  fontWeight: 700,
                  color:
                    timerState === 'danger'
                      ? '#FF4444'
                      : timerState === 'warning'
                        ? '#FFD84D'
                        : timerState === 'ended'
                          ? 'rgba(255,255,255,0.35)'
                          : 'rgba(255,255,255,0.7)',
                  animation:
                    timerState === 'danger'
                      ? 'pulse-danger 0.5s infinite'
                      : timerState === 'warning'
                        ? 'pulse-warning 1s infinite'
                        : 'none',
                  transition: 'all 0.3s',
                  fontFamily: 'Manrope, sans-serif',
                  letterSpacing: '0.05em',
                  textAlign: 'center',
                }}
              >
                {formatTime(timeRemaining)}
              </div>
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
            {idolName}
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

        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '180px',
            background:
              'linear-gradient(180deg, transparent 0%, #0E0E0F 30%)',
            zIndex: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 24px',
          }}
        >
          {micState === 'idol_speaking' && (
            <div
              style={{
                width: '220px',
                height: '88px',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.3)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              Listen carefully...
            </div>
          )}

          {micState === 'your_turn' && (
            <button
              type="button"
              onClick={startSpeaking}
              style={{
                width: '220px',
                height: '88px',
                background: 'linear-gradient(135deg, #FF8AA9, #FF719B)',
                border: 'none',
                borderRadius: '9999px',
                cursor: 'pointer',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontFamily: 'Manrope, sans-serif',
                boxShadow: '0 0 24px rgba(255,138,169,0.4)',
                animation: 'pulse-soft 2s infinite',
                transition: 'transform 0.2s',
              }}
            >
              Tap to speak
            </button>
          )}

          {micState === 'speaking' && (
            <button
              type="button"
              onClick={stopSpeaking}
              style={{
                width: '220px',
                height: '88px',
                background: 'rgba(255, 68, 68, 0.15)',
                border: '2px solid rgba(255, 68, 68, 0.6)',
                borderRadius: '9999px',
                cursor: 'pointer',
                color: '#FF4444',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontFamily: 'Manrope, sans-serif',
                boxShadow: '0 0 24px rgba(255, 68, 68, 0.4)',
                animation: 'pulse-recording 1s infinite',
              }}
            >
              Speaking...
            </button>
          )}

          {micState === 'processing' && (
            <div
              style={{
                width: '220px',
                height: '88px',
                margin: '0 auto',
                background: 'rgba(0, 227, 253, 0.1)',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                color: '#00E3FD',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'not-allowed',
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              <span>Processing</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <span
                  style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: '#00E3FD',
                    animation: 'dot-bounce 1.4s infinite',
                    animationDelay: '0s',
                  }}
                />
                <span
                  style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: '#00E3FD',
                    animation: 'dot-bounce 1.4s infinite',
                    animationDelay: '0.2s',
                  }}
                />
                <span
                  style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: '#00E3FD',
                    animation: 'dot-bounce 1.4s infinite',
                    animationDelay: '0.4s',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {introStep === 'completed' && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: '#0E0E0F',
              zIndex: 200,
              opacity: 0,
              animation: 'fadeOut 1.5s ease-out forwards',
            }}
          />
        )}

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
              onClick={() => setMicState('idol_speaking')}
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
              idol
            </button>
            <button
              type="button"
              onClick={() => setMicState('your_turn')}
              style={{
                background: '#FF8AA9',
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
              turn
            </button>
            <button
              type="button"
              onClick={() => setMicState('speaking')}
              style={{
                background: '#E24B4A',
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
              speak
            </button>
            <button
              type="button"
              onClick={() => setMicState('processing')}
              style={{
                background: 'rgba(0,227,253,0.35)',
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
              process
            </button>
            <button
              type="button"
              onClick={() => triggerEmotionalMoment('first_korean', 'test')}
              style={{
                background: '#2C2C2D',
                color: '#FF8AA9',
                border: 'none',
                borderRadius: '9999px',
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: '800',
                fontFamily: 'Manrope, sans-serif',
                cursor: 'pointer',
              }}
            >
              First
            </button>
            <button
              type="button"
              onClick={() => triggerEmotionalMoment('core_message', 'test')}
              style={{
                background: '#2C2C2D',
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
              Core
            </button>
            <button
              type="button"
              onClick={() => triggerEmotionalMoment('name_remembered', 'test')}
              style={{
                background: '#2C2C2D',
                color: '#FFD84D',
                border: 'none',
                borderRadius: '9999px',
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: '800',
                fontFamily: 'Manrope, sans-serif',
                cursor: 'pointer',
              }}
            >
              Name
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
