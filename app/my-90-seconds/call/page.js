'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { hasReachedDailyLimit, incrementSessionsUsed } from '@/lib/freeLimit';
import { trackEvent } from '@/lib/analytics';
import { normalizeLang } from '@/app/lib/i18n';
import idolScripts, { getRandomLine, getNervousResponse } from '@/src/data/idol-scripts';

/** 팬싱 분류 전용 채팅 라우트 (기존 /api/chat 학습 기능과 분리) */
const FANSIGN_CHAT_API = '/api/chat/fansign';

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
  { id: 'E01', en: 'Wait, restart', ko: '아 잠깐만요~ 다시 말할게요' },
  { id: 'E02', en: 'Change topic', ko: '그거 말고, 다른 얘기 할게요!' },
  { id: 'E03', en: 'Too happy', ko: '그냥 너무 좋아서 말이 안 나와요~' },
  { id: 'E04', en: 'Korean is hard', ko: '한국어가 아직 서툴러요' },
  { id: 'E05', en: 'Check notes', ko: '잠깐만요, 메모 볼게요!' },
];

/** 대화 타임라인 항목 (localStorage kkobi_m90s_conversation) */
function historyEntry(role, text) {
  return { role, text, timestamp: Date.now() };
}

function todayLocalKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
  const [micState, setMicState] = useState('idle');
  const [showEmergencyCards, setShowEmergencyCards] = useState(false);
  const [showRomanization, setShowRomanization] = useState(true);

  const [introStep, setIntroStep] = useState('await_start');
  const [emotionalMoment, setEmotionalMoment] = useState(null);
  const [positiveMoments, setPositiveMoments] = useState([]);
  const [timerState, setTimerState] = useState('normal');

  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentPhase, setCurrentPhase] = useState('PHASE_A');
  const [idolQuestionCount, setIdolQuestionCount] = useState(0);
  const [silenceTimer, setSilenceTimer] = useState(null);
  const [uiLang, setUiLang] = useState('en');
  const [lineHint, setLineHint] = useState('');

  const emotionalClearRef = useRef(null);
  const endSequenceRef = useRef(false);
  const conversationHistoryRef = useRef([]);
  const micStateRef = useRef('idle');
  const introStepRef = useRef(introStep);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const silenceRafRef = useRef(null);
  const silenceAudioCtxRef = useRef(null);
  const recordingStartMsRef = useRef(0);
  const lastSpeechTsRef = useRef(0);
  const phaseAIntroStartedRef = useRef(false);
  const scriptHintIndexRef = useRef(0);
  const yourTurnHintTimeoutRef = useRef(null);
  const stopSpeakingInnerRef = useRef(() => {});
  const scenarioIdRef = useRef(null);
  const currentPhaseRef = useRef('PHASE_A');
  const timeRemainingRef = useRef(90);
  const phaseLogRef = useRef({});
  const prevPhaseForLogRef = useRef(null);
  const callStartedTrackedRef = useRef(false);
  const callCompletedTrackedRef = useRef(false);

  useEffect(() => {
    setParticles(buildParticles());
  }, []);

  useEffect(() => {
    conversationHistoryRef.current = conversationHistory;
  }, [conversationHistory]);

  useEffect(() => {
    micStateRef.current = micState;
  }, [micState]);

  useEffect(() => {
    scenarioIdRef.current = scenarioId;
  }, [scenarioId]);

  useEffect(() => {
    currentPhaseRef.current = currentPhase;
  }, [currentPhase]);

  useEffect(() => {
    timeRemainingRef.current = timeRemaining;
  }, [timeRemaining]);

  useEffect(() => {
    introStepRef.current = introStep;
  }, [introStep]);

  useEffect(() => {
    if (introStep !== 'started' || timeRemaining !== 90) return undefined;
    phaseLogRef.current = {};
    prevPhaseForLogRef.current = 'PHASE_A';
    if (!callStartedTrackedRef.current) {
      callStartedTrackedRef.current = true;
      trackEvent('m90s_call_started', {
        scenario: scenarioIdRef.current || scenarioId,
      });
    }
    return undefined;
  }, [introStep, timeRemaining]);

  useEffect(() => {
    if (introStep !== 'started') return;
    const elapsed = 90 - timeRemaining;
    const prev = prevPhaseForLogRef.current;
    if (prev != null && prev !== currentPhase) {
      if (prev === 'PHASE_A') phaseLogRef.current.phaseA_end = elapsed;
      if (prev === 'PHASE_B') phaseLogRef.current.phaseB_end = elapsed;
      if (prev === 'PHASE_C') phaseLogRef.current.phaseC_end = elapsed;
      if (prev === 'PHASE_D') phaseLogRef.current.phaseD_end = elapsed;
    }
    prevPhaseForLogRef.current = currentPhase;
  }, [introStep, currentPhase, timeRemaining]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setUiLang(normalizeLang(localStorage.getItem('ogu_lang') || 'en'));
  }, []);

  const started = introStep === 'started';

  const unlockAudioAndStartConnecting = useCallback(() => {
    if (typeof window === 'undefined') return;
    const audio = new Audio();
    void audio.play().catch((err) => {
      console.error('Audio unlock failed:', err);
    });
    setIntroStep('connecting');
  }, []);

  useEffect(() => {
    if (!started) return;
    const elapsed = 90 - timeRemaining;
    if (elapsed >= 75) setCurrentPhase('PHASE_D');
    else if (elapsed >= 60) setCurrentPhase('PHASE_C');
    else if (elapsed >= 15) setCurrentPhase('PHASE_B');
    else setCurrentPhase('PHASE_A');
  }, [timeRemaining, started]);

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

    const finalizedPhaseLog = { ...phaseLogRef.current };
    if (finalizedPhaseLog.phaseD_end === undefined) {
      finalizedPhaseLog.phaseD_end = 90;
    }
    window.localStorage.setItem(
      'kkobi_m90s_phase_log',
      JSON.stringify(finalizedPhaseLog),
    );

    window.localStorage.setItem(
      'kkobi_m90s_conversation',
      JSON.stringify(conversationHistoryRef.current),
    );
    if (!callCompletedTrackedRef.current) {
      callCompletedTrackedRef.current = true;
      trackEvent('m90s_call_completed', {
        scenario: scenarioId,
        time_used: 90 - timeRemaining,
        user_turns: conversationHistoryRef.current.filter(
          (m) => m.role === 'user',
        ).length,
      });
    }
  }, [introStep, positiveMoments, timeRemaining, scenarioId, savedScript]);

  const formatTime = (sec) =>
    `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  const genderTts =
    voiceGender === 'MALE' || String(voiceGender || '').toLowerCase() === 'male'
      ? 'MALE'
      : 'FEMALE';

  function cleanupSpeechDetection() {
    if (silenceRafRef.current != null) {
      window.cancelAnimationFrame(silenceRafRef.current);
      silenceRafRef.current = null;
    }
    try {
      void silenceAudioCtxRef.current?.close?.();
    } catch {
      /* ignore */
    }
    silenceAudioCtxRef.current = null;
  }

  function cleanupMicPipeline() {
    cleanupSpeechDetection();
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      try {
        mr.stop();
      } catch {
        /* noop */
      }
    }
    mediaRecorderRef.current = null;
    try {
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch {
      /* noop */
    }
    streamRef.current = null;
    audioChunksRef.current = [];
    setMediaRecorder(null);
    setAudioChunks([]);
    setSilenceTimer((prev) => {
      if (prev != null) window.clearTimeout(prev);
      return null;
    });
  }

  const playTtsAndWait = useCallback(
    async (text, scriptId) => {
      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (!trimmed || typeof window === 'undefined') return;
      try {
        // 캐시 히트: scriptId가 있으면 정적 mp3 직접 재생
        if (scriptId && typeof scriptId === 'string') {
          const genderPath = genderTts === 'MALE' ? 'male' : 'female';
          const audioUrl = `/audio/${genderPath}/${scriptId}.mp3`;
          const audio = new Audio(audioUrl);
          await new Promise((resolve) => {
            audio.onended = resolve;
            audio.onerror = () => {
              // 캐시 파일 없으면 폴백으로 TTS API 호출
              playTtsAndWait(text, null).then(resolve);
            };
            void audio.play().catch((err) => {
              console.error('Cached TTS play failed:', err);
              resolve();
            });
          });
          return;
        }
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: trimmed,
            lang: 'ko-KR',
            gender: genderTts,
          }),
        });
        const data = await res.json();
        if (!data?.audioContent) {
          trackEvent('m90s_tts_failed', {
            scenario: scenarioIdRef.current,
            reason: res.ok ? 'empty_audio' : `http_${res.status}`,
          });
          return;
        }
        const audio = new Audio(
          `data:audio/mp3;base64,${data.audioContent}`,
        );
        await new Promise((resolve) => {
          audio.onended = resolve;
          audio.onerror = resolve;
          void audio.play().catch((err) => {
            console.error('TTS play failed:', err);
            trackEvent('m90s_tts_failed', {
              scenario: scenarioIdRef.current,
              reason: 'playback',
            });
            resolve();
          });
        });
      } catch {
        trackEvent('m90s_tts_failed', {
          scenario: scenarioIdRef.current,
          reason: 'request',
        });
        /* subtitle-only */
      }
    },
    [genderTts],
  );

  /** Legacy name — kept for callers; 실제 종료 안내 텍스트는 idolScripts 기준 */
  const playStaffEndingVoice = useCallback(async () => {
    await playTtsAndWait(idolScripts.staff_closing);
  }, [playTtsAndWait]);

  useEffect(() => {
    if (timeRemaining !== 0 || introStep !== 'started') return;
    if (endSequenceRef.current) return;
    endSequenceRef.current = true;

    cleanupMicPipeline();

    setMicState('idol_speaking');

    const run = async () => {
      const staffText = idolScripts.staff_closing;
      const closePick = getRandomLine('closing');
      const closingText =
        closePick?.text ||
        '다음에 또 봐요~';

      setLineHint('');
      setCurrentSubtitle((prev) => ({
        ...prev,
        korean: staffText,
        roman: '',
        translation: '',
        visible: true,
      }));
      await playTtsAndWait(staffText);

      setCurrentSubtitle((prev) => ({
        ...prev,
        korean: closingText,
        roman: '',
        translation: '',
        visible: true,
      }));
      await playTtsAndWait(closingText);

      window.setTimeout(() => {
        setIntroStep('completed');
        window.setTimeout(() => {
          const sid = scenarioIdRef.current;
          if (sid) {
            router.push(
              `/my-90-seconds/review?scenario=${encodeURIComponent(sid)}`,
            );
          }
        }, 900);
      }, 400);
    };

    void run();

    return undefined;
  }, [timeRemaining, introStep, router, playTtsAndWait]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let cancelled = false;
    const sId = searchParams.get('scenario');

    const vGender = localStorage.getItem('kkobi_voice_gender') || 'FEMALE';
    const savedRaw = localStorage.getItem('kkobi_m90s_saved');
    const lastScenario = localStorage.getItem('kkobi_m90s_last_scenario');

    if (!sId || !savedRaw) {
      console.error('[Phase B] 필수 데이터 없음. Phase A로 돌아가야 함');
      console.log('scenario:', sId);
      console.log('savedScript:', savedRaw);
      router.push('/my-90-seconds');
      return undefined;
    }

    let parsedScript;
    try {
      parsedScript = JSON.parse(savedRaw);
    } catch (e) {
      console.error('[Phase B] savedScript 파싱 실패:', e);
      router.push('/my-90-seconds');
      return undefined;
    }

    void (async () => {
      const supabase = getSupabase();
      const sessionRes = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };
      if (cancelled) return;

      const currentUser = sessionRes.data.session?.user ?? null;

      const tier = localStorage.getItem('kkobi_pass_tier');
      const expires = localStorage.getItem('kkobi_pass_expires');
      const paid = Boolean(
        tier === 'prep_pass' &&
          expires &&
          new Date(expires) > new Date(),
      );

      if (hasReachedDailyLimit(currentUser?.id, paid)) {
        router.replace(
          `/my-90-seconds/paywall?scenario=${encodeURIComponent(sId)}`,
        );
        return;
      }

      const billing = searchParams.get('billing') || '';
      const userKey = currentUser?.id ?? 'guest';
      const todayKey = todayLocalKey();
      const capKey = `kkobi_m90s_charged_${userKey}_${todayKey}_${billing}_${sId}`;

      if (!sessionStorage.getItem(capKey)) {
        if (!paid) {
          incrementSessionsUsed(currentUser?.id ?? null);
        }
        sessionStorage.setItem(capKey, '1');
      }

      if (cancelled) return;

      if (process.env.NODE_ENV === 'development') {
        console.log('=== Phase B 진입 데이터 확인 ===');
        console.log('Scenario ID:', sId);
        console.log('Voice Gender:', vGender);
        console.log('Last Scenario:', lastScenario);
        console.log('Saved Script:', parsedScript);
        console.log('Lines count:', parsedScript?.lines?.length);
        console.log('First line:', parsedScript?.lines?.[0]);
        console.log('==============================');
      }

      setScenarioId(sId);
      setVoiceGender(vGender);
      setIdolName(localStorage.getItem('kkobi_idol_name') || 'IDOL');
      setSavedScript(parsedScript);
      setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  useEffect(() => {
    if (!isReady || introStep !== 'started' || typeof window === 'undefined') {
      return undefined;
    }
    if (!voiceGender) return undefined;
    if (phaseAIntroStartedRef.current) return undefined;
    phaseAIntroStartedRef.current = true;
    let cancelled = false;
    const tid = window.setTimeout(async () => {
      if (cancelled || endSequenceRef.current) return;
      const greet = getRandomLine('greeting');
      const text = greet?.text || '안녕하세요~';
      const opening = [historyEntry('idol', text)];
      setMicState('idol_speaking');
      conversationHistoryRef.current = opening;
      setConversationHistory(opening);
      setLineHint('');
      setCurrentSubtitle({
        korean: text,
        roman: '',
        translation: '',
        visible: true,
      });
      await playTtsAndWait(text);
      if (!cancelled && !endSequenceRef.current) {
        setMicState('your_turn');
      }
    }, 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [isReady, introStep, voiceGender, playTtsAndWait]);

  useEffect(() => {
    window.clearTimeout(yourTurnHintTimeoutRef.current);
    setLineHint('');
    if (
      micState !== 'your_turn' ||
      introStep !== 'started' ||
      endSequenceRef.current
    ) {
      return undefined;
    }
    const lines = savedScript?.lines;
    if (!Array.isArray(lines) || lines.length === 0) return undefined;
    const idx = Math.min(scriptHintIndexRef.current, lines.length - 1);
    const line = lines[idx];
    if (!line?.korean) return undefined;
    yourTurnHintTimeoutRef.current = window.setTimeout(() => {
      const hintText = `💡 ${line.korean}`;
      setLineHint(hintText);
    }, 3000);
    return () => window.clearTimeout(yourTurnHintTimeoutRef.current);
  }, [micState, introStep, savedScript]);

  useEffect(() => {
    stopSpeakingInnerRef.current = async () => {
      if (micStateRef.current !== 'speaking') return;

      cleanupSpeechDetection();
      setSilenceTimer((prev) => {
        if (prev != null) window.clearTimeout(prev);
        return null;
      });

      const mr = mediaRecorderRef.current;
      if (!mr || mr.state === 'inactive') {
        setMicState((s) => (s === 'speaking' ? 'your_turn' : s));
        return;
      }

      let blob;
      try {
        blob = await new Promise((resolve, reject) => {
          mr.onstop = () => {
            try {
              const mime = mr.mimeType || 'audio/webm';
              resolve(new Blob(audioChunksRef.current, { type: mime }));
            } catch (e) {
              reject(e);
            }
          };
          mr.onerror = () => reject(new Error('recorder'));
          try {
            mr.stop();
          } catch (e) {
            reject(e);
          }
        });
      } catch {
        cleanupMicPipeline();
        setMicState('your_turn');
        return;
      }

      try {
        streamRef.current?.getTracks?.().forEach((t) => t.stop());
      } catch {
        /* noop */
      }
      streamRef.current = null;
      mediaRecorderRef.current = null;
      setMediaRecorder(null);
      setMicState('processing');

      let userText = '';
      try {
        const fd = new FormData();
        fd.append(
          'audio',
          blob,
          blob.type.includes('webm') ? 'clip.webm' : 'clip.webm',
        );
        const tr = await fetch('/api/transcribe', {
          method: 'POST',
          body: fd,
        });
        if (!tr.ok) throw new Error('transcribe HTTP');
        const td = await tr.json();
        userText =
          typeof td.text === 'string' ? td.text.trim() : '';
      } catch {
        trackEvent('m90s_transcribe_failed', {
          scenario: scenarioIdRef.current,
          phase: currentPhaseRef.current,
          reason: 'request',
        });
        const fb = getNervousResponse();
        const fbText =
          fb?.text || '괜찮아요~ 천천히 해요.';
        const t0 = Date.now();
        setConversationHistory((prev) => {
          const next = [
            ...prev,
            { role: 'user', text: '(인식 실패)', timestamp: t0 },
            { role: 'idol', text: fbText, timestamp: t0 + 1 },
          ];
          conversationHistoryRef.current = next;
          return next;
        });
        setCurrentSubtitle({
          korean: fbText,
          roman: '',
          translation: '',
          visible: true,
        });
        await playTtsAndWait(fbText);
        setMicState('your_turn');
        return;
      }

      if (!userText.trim()) {
        trackEvent('m90s_transcribe_failed', {
          scenario: scenarioIdRef.current,
          phase: currentPhaseRef.current,
          reason: 'empty_text',
        });
        const fb = getNervousResponse();
        const fbText = fb?.text || '괜찮아요~ 천천히 해요.';
        const t0 = Date.now();
        setConversationHistory((prev) => {
          const next = [
            ...prev,
            { role: 'user', text: '(…)', timestamp: t0 },
            { role: 'idol', text: fbText, timestamp: t0 + 1 },
          ];
          conversationHistoryRef.current = next;
          return next;
        });
        setCurrentSubtitle({
          korean: fbText,
          roman: '',
          translation: '',
          visible: true,
        });
        await playTtsAndWait(fbText);
        setMicState('your_turn');
        return;
      }

      const cap = Math.max((savedScript?.lines?.length ?? 1) - 1, 0);
      scriptHintIndexRef.current = Math.min(
        scriptHintIndexRef.current + 1,
        cap,
      );

      const histBefore = [...conversationHistoryRef.current];
      const lang = normalizeLang(uiLang || 'en');
      const idol = idolName || 'IDOL';
      let idolMain = '';
      let shouldAsk = false;
      let idolQuestionStr = '';
      let idolScriptId = null;

      try {
        const phaseNow = currentPhaseRef.current || 'PHASE_A';
        const resChat = await fetch(FANSIGN_CHAT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userText,
            scenario: scenarioIdRef.current || 'compliment',
            idolName: idol,
            phase: phaseNow,
            conversationHistory: histBefore,
            lang,
          }),
        });
        const chatData = await resChat.json();
        idolMain = String(chatData.idolText || '').trim();
        idolScriptId =
          typeof chatData.scriptId === 'string'
            ? chatData.scriptId.trim()
            : null;
        shouldAsk =
          Boolean(chatData.shouldAskIdolQuestion) &&
          !!chatData.idolQuestion?.trim?.();
        idolQuestionStr =
          typeof chatData.idolQuestion === 'string'
            ? chatData.idolQuestion.trim()
            : '';
      } catch {
        const fb =
          getRandomLine('reaction_nervous') || getNervousResponse();
        idolMain =
          fb?.text || getNervousResponse()?.text || '괜찮아요~ 천천히 해요.';
        shouldAsk = false;
      }

      if (!idolMain) {
        const fb =
          getRandomLine('reaction_nervous') || getNervousResponse();
        idolMain =
          fb?.text ||
          getNervousResponse()?.text ||
          '괜찮아요~ 천천히 해요.';
      }

      setConversationHistory(() => {
        const t0 = Date.now();
        const next = [
          ...histBefore,
          { role: 'user', text: userText, timestamp: t0 },
          { role: 'idol', text: idolMain, timestamp: t0 + 1 },
        ];
        if (shouldAsk && idolQuestionStr) {
          next.push({
            role: 'idol',
            text: idolQuestionStr,
            timestamp: t0 + 2,
          });
        }
        conversationHistoryRef.current = next;
        return next;
      });

      setLineHint('');
      setMicState('idol_speaking');

      setCurrentSubtitle({
        korean: idolMain,
        roman: '',
        translation: '',
        visible: true,
      });
      await playTtsAndWait(idolMain, idolScriptId);

      if (shouldAsk && idolQuestionStr) {
        setIdolQuestionCount((q) => q + 1);
        await new Promise((r) => {
          window.setTimeout(r, 2000);
        });
        setCurrentSubtitle({
          korean: idolQuestionStr,
          roman: '',
          translation: '',
          visible: true,
        });
        await playTtsAndWait(idolQuestionStr, null);
      }

      setMicState('your_turn');
    };
  }, [playTtsAndWait, uiLang, savedScript, idolName]);

  const startSpeaking = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (
      introStepRef.current !== 'started' ||
      endSequenceRef.current
    )
      return;
    if (micStateRef.current !== 'your_turn') return;
    if (timeRemainingRef.current <= 0) return;

    cleanupMicPipeline();
    setLineHint('');

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert('마이크 권한이 필요합니다');
      setMicState('your_turn');
      return;
    }

    streamRef.current = stream;
    audioChunksRef.current = [];

    const mimeCandidate = MediaRecorder.isTypeSupported(
      'audio/webm;codecs=opus',
    )
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
    const recorder = mimeCandidate
      ? new MediaRecorder(stream, { mimeType: mimeCandidate })
      : new MediaRecorder(stream);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    try {
      recorder.start(250);
    } catch {
      alert('마이크 권한이 필요합니다');
      cleanupMicPipeline();
      setMicState('your_turn');
      return;
    }

    mediaRecorderRef.current = recorder;
    setMediaRecorder(recorder);

    recordingStartMsRef.current = Date.now();
    lastSpeechTsRef.current = recordingStartMsRef.current;
    setMicState('speaking');

    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      silenceAudioCtxRef.current = ctx;
      const srcN = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      srcN.connect(analyser);
      const buffer = new Uint8Array(analyser.fftSize);

      const tick = () => {
        if (micStateRef.current !== 'speaking') return;
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i += 1) {
          sum += Math.abs(buffer[i] - 128);
        }
        const lvl = sum / buffer.length;
        const now = Date.now();
        if (lvl > 5.5) lastSpeechTsRef.current = now;
        if (
          now - lastSpeechTsRef.current >= 5000 &&
          now - recordingStartMsRef.current > 450
        ) {
          trackEvent('m90s_silence_detected', {
            scenario: scenarioIdRef.current,
            phase: currentPhaseRef.current,
          });
          void stopSpeakingInnerRef.current?.();
          return;
        }
        silenceRafRef.current = window.requestAnimationFrame(tick);
      };
      silenceRafRef.current = window.requestAnimationFrame(tick);
    } catch {
      /* silence-only fallback handled by tap-to-stop */
    }

    const maxId = window.setTimeout(() => {
      void stopSpeakingInnerRef.current?.();
    }, 28000);
    setSilenceTimer(maxId);
  }, []);

  const stopSpeaking = useCallback(() => {
    void stopSpeakingInnerRef.current?.();
  }, []);

  const handleEmergencyCard = useCallback((card) => {
    setLineHint(card.ko);
    setShowEmergencyCards(false);
    trackEvent('m90s_emergency_card_used', {
      scenario: scenarioIdRef.current,
      card_id: card.id,
    });
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
          minHeight: '100dvh',
          paddingTop: 'env(safe-area-inset-top)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
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
        minHeight: '100dvh',
        width: '100%',
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        background: '#0E0E0F',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          minHeight: 0,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '390px',
            flex: 1,
            minHeight: 0,
            position: 'relative',
            overflow: 'hidden',
            background: '#0E0E0F',
            boxSizing: 'border-box',
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

        {introStep === 'await_start' && (
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
              padding: '40px 32px',
            }}
          >
            <div
              style={{
                fontSize: '32px',
                fontWeight: 800,
                color: '#fff',
                letterSpacing: '-0.03em',
                fontFamily: 'Manrope, sans-serif',
                textAlign: 'center',
              }}
            >
              {idolName}
            </div>
            <div
              style={{
                marginTop: '14px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.55)',
                textAlign: 'center',
                lineHeight: 1.45,
                fontFamily: 'Manrope, sans-serif',
                maxWidth: '280px',
              }}
            >
              Get ready for your 90 seconds
            </div>
            <button
              type="button"
              onClick={unlockAudioAndStartConnecting}
              style={{
                marginTop: '40px',
                width: '100%',
                maxWidth: '260px',
                padding: '16px 24px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontFamily: 'Manrope, sans-serif',
                color: '#fff',
                background:
                  'linear-gradient(135deg, #FF8AA9, #FF719B)',
                boxShadow: '0 0 32px rgba(255,138,169,0.45)',
              }}
            >
              Start call
            </button>
          </div>
        )}

        {(introStep === 'connecting' ||
          introStep === 'incoming' ||
          introStep === 'answered') && (
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
            bottom: 0,
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
            pointerEvents: 'auto',
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
            MEMBER · GROUP
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

        {introStep === 'started' && timeRemaining > 0 && (
          <div
            style={{
              position: 'absolute',
              left: '12px',
              right: '12px',
              top: '174px',
              bottom:
                'calc(150px + env(safe-area-inset-bottom))',
              zIndex: 22,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                pointerEvents: 'auto',
                flexShrink: 0,
                background: 'rgba(255,138,169,0.08)',
                borderRadius: '14px',
                padding: '14px 12px',
                minHeight: '110px',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  fontSize: '9px',
                  color:
                    micState === 'idol_speaking'
                      ? '#FF8AA9'
                      : 'rgba(255,255,255,0.35)',
                  letterSpacing: '1px',
                  fontWeight: 700,
                  fontFamily: 'Manrope, sans-serif',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                {`${String(idolName).toUpperCase()} SAYS`}
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  lineHeight: 1.4,
                  color: 'rgba(255,255,255,0.95)',
                  fontFamily: 'Manrope, sans-serif',
                  wordBreak: 'break-word',
                }}
              >
                {currentSubtitle.visible && currentSubtitle.korean
                  ? currentSubtitle.korean
                  : '\u00a0'}
              </div>
              {showRomanization &&
                currentSubtitle.visible &&
                currentSubtitle.roman?.trim?.() ? (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '11px',
                      lineHeight: 1.35,
                      fontStyle: 'italic',
                      color: 'rgba(255,255,255,0.5)',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {currentSubtitle.roman}
                  </div>
                ) : null}
              {currentSubtitle.visible &&
              currentSubtitle.translation?.trim?.() ? (
                <div
                  style={{
                    marginTop: '6px',
                    fontSize: '12px',
                    lineHeight: 1.35,
                    color: 'rgba(255,255,255,0.65)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {currentSubtitle.translation}
                </div>
              ) : null}
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
                  padding: 0,
                }}
              >
                {showRomanization
                  ? 'Hide pronunciation'
                  : 'Show pronunciation'}
              </button>
            </div>

            {micState === 'your_turn' ? (
              <div
                style={{
                  pointerEvents: 'auto',
                  flexShrink: 0,
                  background: 'rgba(0,227,253,0.06)',
                  borderRadius: '14px',
                  padding: '12px',
                  minHeight: '56px',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    fontSize: '9px',
                    color: '#00E3FD',
                    letterSpacing: '1px',
                    fontWeight: 700,
                    fontFamily: 'Manrope, sans-serif',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  Your turn · Hint
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    lineHeight: 1.4,
                    color: 'rgba(255,255,255,0.85)',
                    fontFamily: 'Manrope, sans-serif',
                    wordBreak: 'break-word',
                  }}
                >
                  {lineHint || '\u00a0'}
                </div>
              </div>
            ) : null}

            <div style={{ flex: 1, minHeight: 0 }} />
          </div>
        )}

        {introStep === 'started' && timeRemaining > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            padding: '0 16px',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            pointerEvents: 'none',
            gap: '10px',
            background:
              'linear-gradient(180deg, transparent 0%, rgba(14,14,15,0.92) 24%, #0E0E0F 100%)',
          }}
        >
          {(micState === 'your_turn' || micState === 'speaking') && (
            <button
              type="button"
              onClick={() => setShowEmergencyCards((v) => !v)}
              style={{
                alignSelf: 'center',
                pointerEvents: 'auto',
                padding: '8px 14px',
                border: 'none',
                borderRadius: '9999px',
                background: showEmergencyCards
                  ? 'rgba(255,138,169,0.24)'
                  : 'rgba(255,255,255,0.1)',
                color: showEmergencyCards ? '#FF8AA9' : 'rgba(255,255,255,0.72)',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: 'Manrope, sans-serif',
                cursor: 'pointer',
              }}
            >
              Emergency phrases
            </button>
          )}
          {showEmergencyCards && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '6px',
                pointerEvents: 'auto',
                animation: 'slideUp 0.4s ease-out',
              }}
            >
              {emergencyCards.map((card, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleEmergencyCard(card)}
                  style={{
                    flex: '1 1 104px',
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
          {micState === 'idle' && (
            <div
              style={{
                width: '100%',
                pointerEvents: 'auto',
                borderRadius: '28px',
                padding: '16px',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.45)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontFamily: 'Manrope, sans-serif',
                background: 'rgba(255,138,169,0.12)',
              }}
            >
              Preparing mic…
            </div>
          )}
          {micState === 'idol_speaking' && (
            <div
              style={{
                width: '100%',
                pointerEvents: 'auto',
                borderRadius: '28px',
                padding: '16px',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.85)',
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontFamily: 'Manrope, sans-serif',
                background:
                  'linear-gradient(135deg, #FF8AA9, #FF719B)',
                boxShadow: '0 0 24px rgba(255,138,169,0.35)',
              }}
            >
              {`${String(idolName).toUpperCase()} is speaking`}
            </div>
          )}
          {micState === 'your_turn' && (
            <button
              type="button"
              onClick={startSpeaking}
              style={{
                width: '100%',
                pointerEvents: 'auto',
                borderRadius: '28px',
                padding: '16px',
                border: 'none',
                cursor: 'pointer',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontFamily: 'Manrope, sans-serif',
                background:
                  'linear-gradient(135deg, #FF8AA9, #FF719B)',
                boxShadow: '0 0 24px rgba(255,138,169,0.45)',
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
                width: '100%',
                pointerEvents: 'auto',
                borderRadius: '28px',
                padding: '16px',
                border: '2px solid rgba(255, 68, 68, 0.55)',
                cursor: 'pointer',
                background: 'rgba(255, 68, 68, 0.12)',
                color: '#FF6B7A',
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              Speaking…
            </button>
          )}
          {micState === 'processing' && (
            <div
              style={{
                width: '100%',
                pointerEvents: 'auto',
                borderRadius: '28px',
                padding: '16px',
                border: '1px solid rgba(0,227,253,0.35)',
                background: 'rgba(0,227,253,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                color: '#00E3FD',
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              <span>Processing…</span>
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
        )}

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
              bottom: 'calc(24px + env(safe-area-inset-bottom))',
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
