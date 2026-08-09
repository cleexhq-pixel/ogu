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
import { toRoman } from '@/lib/romanize';

/** 팬싱 분류 전용 채팅 라우트 (기존 /api/chat 학습 기능과 분리) */
const FANSIGN_CHAT_API = '/api/chat/fansign';

/** 마이크 진단 표시줄 킬스위치. true면 통화 화면에서 항상 보인다. 실사용자 배포 전 반드시 false로. */
const MIC_DEBUG_BAR_ENABLED = true;

const pulseKeyframes = `
  @keyframes pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.2); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

function normalizeForTTS(text) {
  return text
    .replace(/~+/g, '')
    .replace(/!+/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

const MIN_RECORDING_BYTES = 3000;
/** 재사용 전 짧게 마이크를 찔러보는 시간(ms). 너무 길면 턴 시작이 눈에 띄게 늦어진다. */
const MIC_PROBE_DURATION_MS = 250;
/** 이 값을 한 번도 못 넘기면 "죽은 스트림"으로 본다. 완전 무음이어도 살아있는 마이크는
 * 보통 이보다 약간이라도 높은 배경 잡음을 잡는다 — 발화 감지 기준(5.5)보다 훨씬 낮게 잡았다. */
const MIC_PROBE_LEVEL_THRESHOLD = 1.2;
const GUIDING_NERVOUS_TEXT = '천천히 한 글자씩 말해봐도 괜찮아요~';

/** true면 TTS 호출/재생을 건너뛰고 자막만 2500ms 보여준 뒤 진행한다. 테스트 전용, 배포 전 반드시 false로. */
const SKIP_TTS_FOR_TEST = false;

/** AudioContext 진단용 모듈 스코프 카운터. 컴포넌트 인스턴스가 아니라 모듈 로드 기준으로 누적된다 — 디버그 표시줄 전용이며 실제 로직에는 관여하지 않는다. */
let audioContextCreateCount = 0;
let probeExceptionCount = 0;

function pickAudioMime() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/mp4;codecs=mp4a.40.2',
  ];
  for (const type of candidates) {
    if (
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported(type)
    ) {
      return type;
    }
  }
  return '';
}

function getAudioFilename(mimeType) {
  if (!mimeType) return 'clip.webm';
  if (mimeType.includes('webm')) return 'clip.webm';
  if (mimeType.includes('mp4')) return 'clip.mp4';
  if (mimeType.includes('aac')) return 'clip.aac';
  if (mimeType.includes('ogg')) return 'clip.ogg';
  if (mimeType.includes('mpeg')) return 'clip.mp3';
  return 'clip.webm';
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

  const [phase, setPhase] = useState('intro');
  const [timeRemaining, setTimeRemaining] = useState(90);
  const [currentSubtitle, setCurrentSubtitle] = useState({
    korean: '안녕~',
    roman: toRoman('안녕~'),
    translation: '',
    visible: true,
  });
  const [micState, setMicState] = useState('idle');
  const [showEmergencyCards, setShowEmergencyCards] = useState(false);

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
  const [showHint, setShowHint] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');

  // 마이크 진단용 (개발/디버그 표시줄 전용, MIC_DEBUG_BAR_ENABLED로만 켜고 끔)
  const [pipelineStage, setPipelineStage] = useState('idle');
  const [micLevel, setMicLevel] = useState(0);
  const [lastRecordingBytes, setLastRecordingBytes] = useState(0);
  const [micTrackInfo, setMicTrackInfo] = useState({ readyState: 'none', muted: false });
  const [micProbeStatus, setMicProbeStatus] = useState('none');
  const [ctxCount, setCtxCount] = useState(0);
  const [closePending, setClosePending] = useState(false);
  const [probeExceptions, setProbeExceptions] = useState(0);

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
  const hintTimerRef = useRef(null);
  const stopSpeakingInnerRef = useRef(() => {});
  const scenarioIdRef = useRef(null);
  const currentPhaseRef = useRef('PHASE_A');
  const timeRemainingRef = useRef(90);
  const phaseLogRef = useRef({});
  const prevPhaseForLogRef = useRef(null);
  const callStartedTrackedRef = useRef(false);
  const callCompletedTrackedRef = useRef(false);
  const speechRecognitionRef = useRef(null);
  const interimTranscriptRef = useRef('');
  const consecutiveFailCountRef = useRef(0);
  const audioRef = useRef(null);
  const micLevelLastUpdateRef = useRef(0);

  const getSharedAudio = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    return audioRef.current;
  }, []);

  useEffect(() => {
    conversationHistoryRef.current = conversationHistory;
  }, [conversationHistory]);

  useEffect(() => {
    micStateRef.current = micState;
  }, [micState]);

  useEffect(() => {
    // your_turn 상태 진입 시 3초 후 힌트 표시
    if (micState === 'your_turn') {
      setShowHint(false);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      hintTimerRef.current = window.setTimeout(() => {
        setShowHint(true);
      }, 3000);
    } else {
      // 다른 상태로 전환 시 힌트 즉시 숨김
      setShowHint(false);
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }
    }
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
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

  // 화면을 벗어나는 모든 경우(뒤로가기, 탭 전환 등)에 마이크가 켜진 채로 남지 않도록 하는 안전장치
  useEffect(() => {
    return () => {
      cleanupMicPipeline();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const started = introStep === 'started';

  const unlockAudioAndStartConnecting = useCallback(() => {
    if (typeof window === 'undefined') return;
    const audio = getSharedAudio();
    if (audio) {
      const attemptUnlock = async (isRetry) => {
        try {
          await audio.play();
        } catch (err) {
          if (!isRetry) {
            await new Promise((r) => setTimeout(r, 100));
            return attemptUnlock(true);
          }
          console.error('Audio unlock failed:', err);
          trackEvent('m90s_audio_unlock_failed');
        }
      };
      void attemptUnlock(false);
    }
    setIntroStep('connecting');
  }, [getSharedAudio]);

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
      const ctxToClose = silenceAudioCtxRef.current;
      if (ctxToClose) {
        setClosePending(true);
        ctxToClose
          .close()
          .then(() => setClosePending(false))
          .catch(() => setClosePending(false));
      }
    } catch {
      /* ignore */
    }
    silenceAudioCtxRef.current = null;
  }

  /** 녹음기만 정리. 마이크 스트림 자체는 살려둔다 (턴 사이 전환용). */
  function cleanupRecorderOnly() {
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
    audioChunksRef.current = [];
    setMediaRecorder(null);
    setAudioChunks([]);
    setSilenceTimer((prev) => {
      if (prev != null) window.clearTimeout(prev);
      return null;
    });
    setMicLevel(0);
  }

  /** 녹음기 + 마이크 스트림 전체 종료. 통화 종료/화면 이탈 시에만 호출. */
  function cleanupMicPipeline() {
    cleanupRecorderOnly();
    try {
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch {
      /* noop */
    }
    streamRef.current = null;
    setMicTrackInfo({ readyState: 'ended', muted: false });
  }

  const isWebSpeechSupported = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  /** 트랙이 살아있고(live) 음소거되지 않았는지 확인. false면 재요청이 필요하다는 뜻. */
  const isStreamUsable = useCallback((stream) => {
    const track = stream?.getAudioTracks?.()[0];
    return !!track && track.readyState === 'live' && !track.muted;
  }, []);

  /** 마이크 트랙 상태(live/ended, muted 여부)를 진단 표시줄용 state에 반영 */
  const attachTrackListeners = useCallback((stream) => {
    const track = stream?.getAudioTracks?.()[0];
    if (!track) return;
    const update = () => {
      setMicTrackInfo({ readyState: track.readyState, muted: track.muted });
    };
    track.onended = update;
    track.onmute = update;
    track.onunmute = update;
    update();
  }, []);

  /**
   * 스트림을 아주 짧게(MIC_PROBE_DURATION_MS) 들어보고 실제로 신호가 잡히는지 확인한다.
   * readyState/muted 같은 겉보기 상태값은 정상인데 하드웨어 캡처만 죽어있는 iOS 케이스를
   * 걸러내기 위한 것 — 사용자에게 말하라고 하는 게 아니라 배경 잡음 수준만 본다.
   * 분석 자체가 실패하면(브라우저 제약 등) 판단 불가로 보고 재사용을 막지 않는다.
   */
  const probeStreamHasSignal = useCallback((stream) => {
    return new Promise((resolve) => {
      let ctx;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
        audioContextCreateCount += 1;
        setCtxCount(audioContextCreateCount);
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const buffer = new Uint8Array(analyser.fftSize);
        const startedAt = Date.now();
        let maxLevel = 0;

        const finish = (hasSignal) => {
          try {
            setClosePending(true);
            ctx
              .close()
              .then(() => setClosePending(false))
              .catch(() => setClosePending(false));
          } catch {
            /* noop */
          }
          resolve(hasSignal);
        };

        const sample = () => {
          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i += 1) {
            sum += Math.abs(buffer[i] - 128);
          }
          const lvl = sum / buffer.length;
          if (lvl > maxLevel) maxLevel = lvl;

          if (Date.now() - startedAt >= MIC_PROBE_DURATION_MS) {
            finish(maxLevel > MIC_PROBE_LEVEL_THRESHOLD);
            return;
          }
          window.requestAnimationFrame(sample);
        };
        window.requestAnimationFrame(sample);
      } catch (e) {
        try { ctx?.close?.(); } catch {}
        probeExceptionCount += 1;
        setProbeExceptions(probeExceptionCount);
        resolve(true);
      }
    });
  }, []);

  /**
   * 통화 내내 재사용할 마이크 스트림을 반환한다.
   * 기존 스트림의 상태값이 정상이면, 재사용하기 전에 아주 짧게 신호가 실제로
   * 잡히는지 한 번 더 확인한다. 신호가 없으면 죽은 스트림으로 보고 트랙을
   * 확실히 정지시킨 뒤 새로 요청한다 — 죽은 트랙을 정지시키지 않은 채 새로
   * 요청하면 iOS에서 새 요청마저 실패할 수 있어, 정지를 먼저 한다.
   */
  const ensureMicStream = useCallback(async () => {
    const candidate = streamRef.current;
    if (isStreamUsable(candidate)) {
      setMicProbeStatus('probing');
      const hasSignal = await probeStreamHasSignal(candidate);
      if (hasSignal) {
        setMicProbeStatus('reused');
        return candidate;
      }
      setMicProbeStatus('rejected');
      try {
        candidate.getTracks().forEach((t) => t.stop());
      } catch {
        /* noop */
      }
      streamRef.current = null;
      setMicTrackInfo({ readyState: 'ended', muted: false });
    } else if (candidate) {
      // 상태값부터 이미 비정상 — 확인 없이 바로 죽은 것으로 보고 트랙을 정지시킨다
      setMicProbeStatus('stale');
      try {
        candidate.getTracks().forEach((t) => t.stop());
      } catch {
        /* noop */
      }
      streamRef.current = null;
      setMicTrackInfo({ readyState: 'ended', muted: false });
    } else {
      setMicProbeStatus('first');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    attachTrackListeners(stream);
    return stream;
  }, [isStreamUsable, attachTrackListeners, probeStreamHasSignal]);

  const runAudioPlayback = useCallback(
    (src, { onLoadError, failReasonOnPlay = 'playback' }) =>
      new Promise((resolve) => {
        const audio = getSharedAudio();
        if (!audio) {
          resolve();
          return;
        }

        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          audio.onended = null;
          audio.onerror = null;
          resolve();
        };

        try {
          audio.pause();
          audio.currentTime = 0;
          audio.onended = null;
          audio.onerror = null;
          audio.src = src;
          audio.load();
        } catch {
          trackEvent('m90s_tts_failed', {
            scenario: scenarioIdRef.current,
            reason: failReasonOnPlay,
          });
          finish();
          return;
        }

        audio.onended = finish;

        audio.onerror = () => {
          audio.onended = null;
          audio.onerror = null;
          if (onLoadError) {
            void Promise.resolve(onLoadError()).then(finish);
          } else {
            trackEvent('m90s_tts_failed', {
              scenario: scenarioIdRef.current,
              reason: 'playback',
            });
            finish();
          }
        };

        const attemptPlay = async (isRetry) => {
          try {
            await audio.play();
          } catch (err) {
            if (!isRetry) {
              await new Promise((r) => setTimeout(r, 100));
              return attemptPlay(true);
            }
            console.error('TTS play failed:', err);
            trackEvent('m90s_tts_failed', {
              scenario: scenarioIdRef.current,
              reason: failReasonOnPlay,
            });
            finish();
          }
        };

        void attemptPlay(false);
      }),
    [getSharedAudio],
  );

  const playTtsAndWait = useCallback(
    async (text, scriptId) => {
      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (!trimmed || typeof window === 'undefined') return;
      if (SKIP_TTS_FOR_TEST) {
        await new Promise((r) => setTimeout(r, 2500));
        return;
      }
      try {
        // 캐시 히트: scriptId가 있으면 정적 mp3 직접 재생
        if (scriptId && typeof scriptId === 'string') {
          const genderPath = genderTts === 'MALE' ? 'male' : 'female';
          const audioUrl = `/audio/${genderPath}/${scriptId}.mp3`;
          await runAudioPlayback(audioUrl, {
            failReasonOnPlay: 'cached_play',
            onLoadError: async () => {
              trackEvent('m90s_tts_failed', {
                scenario: scenarioIdRef.current,
                reason: 'cached_load',
              });
              await playTtsAndWait(text, null);
            },
          });
          return;
        }
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: normalizeForTTS(trimmed),
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
        await runAudioPlayback(
          `data:audio/mp3;base64,${data.audioContent}`,
          { failReasonOnPlay: 'playback' },
        );
      } catch {
        trackEvent('m90s_tts_failed', {
          scenario: scenarioIdRef.current,
          reason: 'request',
        });
        /* subtitle-only */
      }
    },
    [genderTts, runAudioPlayback],
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
    setPipelineStage('idol_speaking');

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
        roman: toRoman(staffText),
        translation: '',
        visible: true,
      }));
      await playTtsAndWait(staffText);

      setCurrentSubtitle((prev) => ({
        ...prev,
        korean: closingText,
        roman: toRoman(closingText),
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
      setPipelineStage('idol_speaking');
      conversationHistoryRef.current = opening;
      setConversationHistory(opening);
      setLineHint('');
      setCurrentSubtitle({
        korean: text,
        roman: toRoman(text),
        translation: '',
        visible: true,
      });
      await playTtsAndWait(text);
      if (!cancelled && !endSequenceRef.current) {
        setMicState('your_turn');
        setPipelineStage('idle');
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
      const hintText = line.korean;
      setLineHint(hintText);
    }, 3000);
    return () => window.clearTimeout(yourTurnHintTimeoutRef.current);
  }, [micState, introStep, savedScript]);

  const processUserUtterance = useCallback(
    async (userText) => {
      const recentSttFailures = consecutiveFailCountRef.current;
      consecutiveFailCountRef.current = 0;

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

      setAiThinking(true);
      setPipelineStage('waiting_idol');
      setCurrentSubtitle((prev) => ({ ...prev, visible: false }));

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
            timeRemaining: timeRemainingRef.current,
            recentSttFailures,
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
          {
            role: 'user',
            text: userText,
            roman: toRoman(userText),
            timestamp: t0,
          },
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
      setAiThinking(false);
      setMicState('idol_speaking');
      setPipelineStage('idol_speaking');

      setCurrentSubtitle({
        korean: idolMain,
        roman: toRoman(idolMain),
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
          roman: toRoman(idolQuestionStr),
          translation: '',
          visible: true,
        });
        await playTtsAndWait(idolQuestionStr, null);
      }

      setMicState('your_turn');
      setPipelineStage('idle');
    },
    [playTtsAndWait, uiLang, savedScript, idolName],
  );

  const applySttFailureFallback = useCallback(
    async (userDisplayText, reason) => {
      consecutiveFailCountRef.current += 1;
      const count = consecutiveFailCountRef.current;

      if (count >= 3) {
        trackEvent('m90s_consecutive_stt_failures', {
          count,
          phase: currentPhaseRef.current,
        });
        consecutiveFailCountRef.current = 0;
        const e04 = emergencyCards.find((c) => c.id === 'E04');
        setLineHint(e04?.ko || '');
        setShowEmergencyCards(false);
        trackEvent('m90s_emergency_card_used', {
          scenario: scenarioIdRef.current,
          card_id: 'E04',
          auto: true,
        });
        if (e04?.ko) {
          await processUserUtterance(e04.ko);
        } else {
          setMicState('your_turn');
          setPipelineStage('idle');
        }
        return;
      }

      trackEvent('m90s_transcribe_failed', {
        scenario: scenarioIdRef.current,
        phase: currentPhaseRef.current,
        reason,
      });

      const fbText =
        count === 2
          ? GUIDING_NERVOUS_TEXT
          : getNervousResponse()?.text || '괜찮아요~ 천천히 해요.';
      const t0 = Date.now();
      setConversationHistory((prev) => {
        const next = [
          ...prev,
          { role: 'user', text: userDisplayText, timestamp: t0 },
          { role: 'idol', text: fbText, timestamp: t0 + 1 },
        ];
        conversationHistoryRef.current = next;
        return next;
      });
      setCurrentSubtitle({
        korean: fbText,
        roman: toRoman(fbText),
        translation: '',
        visible: true,
      });
      setPipelineStage('idol_speaking');
      await playTtsAndWait(fbText);
      setMicState('your_turn');
      setPipelineStage('idle');
    },
    [playTtsAndWait, processUserUtterance],
  );

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

      // Web Speech 정리
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch {}
        speechRecognitionRef.current = null;
      }
      setLiveTranscript('');
      interimTranscriptRef.current = '';

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
        // 마이크 스트림 자체는 살려둔다 — 녹음기만 실패했을 뿐이므로
        cleanupRecorderOnly();
        setMicState('your_turn');
        setPipelineStage('idle');
        return;
      }

      console.log('[transcribe] blob.type:', blob.type, 'size:', blob.size);

      // 마이크 스트림은 통화 내내 유지 — 여기서 트랙을 끊지 않는다
      mediaRecorderRef.current = null;
      setMediaRecorder(null);
      setMicState('processing');
      setPipelineStage('uploading');
      setMicLevel(0);
      setLastRecordingBytes(blob.size);

      if (blob.size < MIN_RECORDING_BYTES) {
        await applySttFailureFallback('(…)', 'too_short');
        return;
      }

      let userText = '';
      try {
        const filename = getAudioFilename(blob.type);
        const fd = new FormData();
        fd.append('audio', blob, filename);
        const tr = await fetch('/api/transcribe', {
          method: 'POST',
          body: fd,
        });
        if (!tr.ok) throw new Error('transcribe HTTP');
        const td = await tr.json();
        userText =
          typeof td.text === 'string' ? td.text.trim() : '';
      } catch {
        await applySttFailureFallback('(인식 실패)', 'request');
        return;
      }

      if (!userText.trim()) {
        await applySttFailureFallback('(…)', 'empty_text');
        return;
      }

      await processUserUtterance(userText);
    };
  }, [
    playTtsAndWait,
    uiLang,
    savedScript,
    idolName,
    applySttFailureFallback,
    processUserUtterance,
  ]);

  const startSpeaking = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (
      introStepRef.current !== 'started' ||
      endSequenceRef.current
    )
      return;
    if (micStateRef.current !== 'your_turn') return;
    if (timeRemainingRef.current <= 0) return;

    cleanupRecorderOnly();
    setLineHint('');
    setPipelineStage('mic_prep');

    let stream;
    try {
      stream = await ensureMicStream();
    } catch {
      alert('마이크 권한이 필요합니다');
      setMicState('your_turn');
      setPipelineStage('idle');
      return;
    }

    audioChunksRef.current = [];

    const mimeCandidate = pickAudioMime();
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
      cleanupRecorderOnly();
      setMicState('your_turn');
      setPipelineStage('idle');
      return;
    }

    mediaRecorderRef.current = recorder;
    setMediaRecorder(recorder);

    recordingStartMsRef.current = Date.now();
    lastSpeechTsRef.current = recordingStartMsRef.current;
    setMicState('speaking');
    setPipelineStage('recording');
    setMicLevel(0);

    // Web Speech API 실시간 자막 (지원 환경만)
    if (isWebSpeechSupported()) {
      try {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SR();
        recognition.lang = 'ko-KR';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              interimTranscriptRef.current += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          setLiveTranscript(interimTranscriptRef.current + interim);
        };
        recognition.onerror = () => {
          // 오류 시 조용히 무시 (Whisper가 백업)
        };
        recognition.onend = () => {
          speechRecognitionRef.current = null;
        };
        recognition.start();
        speechRecognitionRef.current = recognition;
        interimTranscriptRef.current = '';
      } catch {
        // Web Speech 실패 시 Whisper만 사용
      }
    }

    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      audioContextCreateCount += 1;
      setCtxCount(audioContextCreateCount);
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
        if (now - micLevelLastUpdateRef.current > 120) {
          micLevelLastUpdateRef.current = now;
          setMicLevel(Math.round(lvl * 10) / 10);
        }
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
  }, [isWebSpeechSupported, ensureMicStream]);

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

  const devSkipToReview = useCallback(() => {
    const sid = scenarioIdRef.current || scenarioId;
    if (!sid) return;

    const now = new Date().toISOString();
    localStorage.setItem('kkobi_m90s_last_completed', now);
    localStorage.setItem(
      'kkobi_m90s_last_stats',
      JSON.stringify({
        completedLines: 4,
        totalLines: 4,
        timeUsed: 45,
        scenario: sid,
      }),
    );
    localStorage.setItem(
      'kkobi_m90s_positive_moments',
      JSON.stringify([
        { type: 'first_korean', line: '안녕하세요!', timestamp: 10 },
        { type: 'core_message', line: '노래 진짜 좋아요!', timestamp: 30 },
      ]),
    );
    localStorage.setItem(
      'kkobi_m90s_conversation',
      JSON.stringify([
        { role: 'idol', text: '어, 안녕! 왔구나~', timestamp: 5 },
        { role: 'user', text: '안녕하세요!', timestamp: 10 },
        { role: 'idol', text: '오늘 많이 떨려?', timestamp: 20 },
        { role: 'user', text: '노래 진짜 좋아요!', timestamp: 30 },
      ]),
    );

    router.push(`/my-90-seconds/review?scenario=${encodeURIComponent(sid)}`);
  }, [scenarioId, router]);

  const returnToScenarios = useCallback((source) => {
    if (
      introStepRef.current === 'started' &&
      !endSequenceRef.current &&
      timeRemainingRef.current > 0
    ) {
      trackEvent('m90s_call_abandoned', {
        scenario: scenarioIdRef.current,
        phase: currentPhaseRef.current,
        elapsed: 90 - timeRemainingRef.current,
        source,
      });
    }
    cleanupMicPipeline();
    router.push('/my-90-seconds');
  }, [router]);

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
      <style>{pulseKeyframes}</style>
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
                color: '#0E0E0F',
                background: '#FFD84D',
                boxShadow: '0 0 32px rgba(255,216,77,0.35)',
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
                      'linear-gradient(90deg, transparent, rgba(255,216,77,0.5), transparent)',
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
                      background: 'rgba(255,216,77,0.08)',
                      border: '0.5px solid rgba(255,216,77,0.25)',
                      animation: 'incoming-pulse 1.5s infinite',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: '20px',
                      borderRadius: '50%',
                      background: 'rgba(255,216,77,0.1)',
                      border: '0.5px solid rgba(255,216,77,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#FFD84D"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12 19.79 19.79 0 0 1 1.93 3.38 2 2 0 0 1 3.9 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.07-1.07a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'rgba(255,216,77,0.8)',
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
                    onClick={() => returnToScenarios('decline_incoming')}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'transparent',
                      border: '0.5px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIntroStep('answered')}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: '#FFD84D',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 32px rgba(255,216,77,0.4)',
                      animation: 'pulse-button 1.5s infinite',
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#0E0E0F"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
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
            background: '#0E0E0F',
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
                        'radial-gradient(ellipse at center, rgba(255,216,77,0.2), transparent 60%)',
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
                      background: 'rgba(255,216,77,0.28)',
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
          onClick={() => returnToScenarios('close_button')}
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
                background: '#FFD84D',
                animation: 'liveDot 1.5s ease-in-out infinite',
              }}
            />
            <span
              style={{
                fontFamily: 'Manrope, sans-serif',
                fontSize: '11px',
                fontWeight: 700,
                color: '#FFD84D',
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
            background: 'rgba(255,255,255,0.06)',
            border: '0.5px solid rgba(255,255,255,0.12)',
            borderRadius: '12px',
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
              fontSize: '10px',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.15em',
              fontFamily: 'Manrope, sans-serif',
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
                background: 'transparent',
                borderLeft: '0.5px solid rgba(255,216,77,0.6)',
                borderRadius: 0,
                padding: '4px 12px',
                minHeight: '110px',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  fontSize: '9px',
                  color:
                    micState === 'idol_speaking'
                      ? '#FFD84D'
                      : 'rgba(255,216,77,0.4)',
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
              {aiThinking && !currentSubtitle.visible && (
                <div style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px 0',
                }}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#FFD84D',
                        display: 'inline-block',
                        animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              )}
              {currentSubtitle.visible &&
                currentSubtitle.roman?.trim?.() ? (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '11px',
                      lineHeight: 1.35,
                      fontStyle: 'italic',
                      color: 'rgba(255,255,255,0.45)',
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
            </div>

            {micState === 'your_turn' && showHint && lineHint ? (
              <div
                style={{
                  pointerEvents: 'auto',
                  flexShrink: 0,
                  borderTop: '0.5px solid rgba(255,216,77,0.15)',
                  borderBottom: '0.5px solid rgba(255,216,77,0.15)',
                  borderRadius: 0,
                  padding: '10px 12px',
                  boxSizing: 'border-box',
                  animation: 'fadeIn 0.4s ease-in-out',
                }}
              >
                <div
                  style={{
                    fontSize: '9px',
                    color: '#FFD84D',
                    letterSpacing: '1px',
                    fontWeight: 700,
                    fontFamily: 'Manrope, sans-serif',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                    opacity: 0.7,
                  }}
                >
                  YOUR TURN · HINT
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    lineHeight: 1.4,
                    color: 'rgba(255,255,255,0.75)',
                    fontFamily: 'Manrope, sans-serif',
                    wordBreak: 'break-word',
                  }}
                >
                  {lineHint}
                </div>
              </div>
            ) : null}

            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingTop: '4px',
              }}
            >
              {conversationHistory
                .filter((item) => item.role === 'user')
                .map((item, i) => (
                  <div
                    key={`${item.timestamp}-${i}`}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: '10px',
                      padding: '8px 10px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '12px',
                        lineHeight: 1.4,
                        color: 'rgba(255,255,255,0.85)',
                        fontFamily: 'Manrope, sans-serif',
                        wordBreak: 'break-word',
                      }}
                    >
                      {item.text}
                    </div>
                    {item.roman?.trim?.() ? (
                      <div
                        style={{
                          fontSize: '10px',
                          color: 'rgba(255,255,255,0.35)',
                          fontStyle: 'italic',
                          marginTop: '2px',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        {item.roman}
                      </div>
                    ) : null}
                  </div>
                ))}
            </div>
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
          {MIC_DEBUG_BAR_ENABLED && (
            <div
              style={{
                alignSelf: 'stretch',
                pointerEvents: 'none',
                fontFamily: 'monospace',
                fontSize: '10px',
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.75)',
                background: 'rgba(0,0,0,0.55)',
                border: '0.5px solid rgba(255,216,77,0.35)',
                borderRadius: '8px',
                padding: '5px 10px',
              }}
            >
              <div>
                stage: <b style={{ color: '#FFD84D' }}>{pipelineStage}</b>
                {' · mic: '}
                <b style={{ color: micTrackInfo.readyState === 'live' ? '#4ADE80' : '#FF4444' }}>
                  {micTrackInfo.readyState}/{micTrackInfo.muted ? 'muted' : 'unmuted'}
                </b>
                {' · probe: '}
                <b
                  style={{
                    color:
                      micProbeStatus === 'reused' || micProbeStatus === 'first'
                        ? '#4ADE80'
                        : micProbeStatus === 'rejected' || micProbeStatus === 'stale'
                          ? '#FF4444'
                          : '#FFD84D',
                  }}
                >
                  {micProbeStatus}
                </b>
              </div>
              <div>
                {'level: '}
                <b style={{ fontSize: '13px', color: '#FFD84D' }}>{micLevel}</b>
                {'  ·  lastRecBytes: '}
                <b>{lastRecordingBytes}</b>
              </div>
              <div>
                {'ctx: '}
                <b style={{ color: '#FFD84D' }}>
                  {silenceAudioCtxRef.current?.state || 'none'}({ctxCount})
                </b>
                {' · close: '}
                <b style={{ color: closePending ? '#FF4444' : '#4ADE80' }}>
                  {closePending ? 'pending' : 'idle'}
                </b>
                {' · exc: '}
                <b style={{ color: probeExceptions > 0 ? '#FF4444' : '#4ADE80' }}>
                  {probeExceptions}
                </b>
              </div>
            </div>
          )}
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
                  ? 'rgba(255,216,77,0.24)'
                  : 'rgba(255,255,255,0.1)',
                color: showEmergencyCards ? '#FFD84D' : 'rgba(255,255,255,0.72)',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.08em',
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
                    background: 'rgba(255,216,77,0.08)',
                    border: '0.5px solid rgba(255,216,77,0.25)',
                    backdropFilter: 'blur(12px)',
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
                      color: '#FFD84D',
                      letterSpacing: '0.05em',
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
                fontFamily: 'Manrope, sans-serif',
                background: 'rgba(255,216,77,0.08)',
              }}
            >
              Preparing mic…
            </div>
          )}
          {micState === 'idol_speaking' && (
            <div
              style={{
                width: '100%',
                borderRadius: '100px',
                padding: '14px',
                border: '0.5px solid rgba(255,216,77,0.5)',
                background: 'transparent',
                color: 'rgba(255,216,77,0.6)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                fontFamily: 'Manrope, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxSizing: 'border-box',
                pointerEvents: 'none',
              }}
            >
              {`${String(idolName)} is speaking`}
              <span style={{ display: 'inline-flex', gap: '3px', marginLeft: '2px' }}>
                {[0.35, 0.6, 0.9].map((op, i) => (
                  <span key={i} style={{ width: 4, height: 4, background: `rgba(255,216,77,${op})`, borderRadius: '50%', display: 'inline-block' }} />
                ))}
              </span>
            </div>
          )}
          {micState === 'speaking' && liveTranscript && (
            <div style={{
              padding: '10px 16px',
              marginBottom: 8,
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '0.5px solid rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              lineHeight: 1.5,
              textAlign: 'center',
              maxWidth: '100%',
              wordBreak: 'break-all',
            }}>
              {liveTranscript}
            </div>
          )}
          {micState === 'your_turn' && (
            <button
              type="button"
              onClick={startSpeaking}
              style={{
                width: '100%',
                pointerEvents: 'auto',
                borderRadius: '100px',
                padding: '14px',
                border: 'none',
                cursor: 'pointer',
                color: '#0E0E0F',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                fontFamily: 'Manrope, sans-serif',
                background: '#FFD84D',
                boxShadow: 'none',
                boxSizing: 'border-box',
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
                borderRadius: '100px',
                padding: '14px',
                border: 'none',
                background: '#FFD84D',
                color: '#0E0E0F',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                fontFamily: 'Manrope, sans-serif',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              Tap to stop
            </button>
          )}
          {micState === 'processing' && (
            <div
              style={{
                width: '100%',
                borderRadius: '100px',
                padding: '14px',
                border: '0.5px solid rgba(255,216,77,0.3)',
                background: 'transparent',
                color: 'rgba(255,216,77,0.4)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                fontFamily: 'Manrope, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxSizing: 'border-box',
                pointerEvents: 'none',
              }}
            >
              Processing
              <span style={{ display: 'inline-flex', gap: '3px', marginLeft: '2px' }}>
                {[0.2, 0.45, 0.7].map((op, i) => (
                  <span key={i} style={{ width: 4, height: 4, background: `rgba(255,216,77,${op})`, borderRadius: '50%', display: 'inline-block' }} />
                ))}
              </span>
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
                  background: phase === p ? '#FFD84D' : 'rgba(255,255,255,0.08)',
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
                background: 'rgba(255,216,77,0.18)',
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
              Emergency
            </button>
            <button
              type="button"
              onClick={() => setMicState('idol_speaking')}
              style={{
                background: '#FFD84D',
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
                background: '#FFD84D',
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
                background: 'rgba(255,216,77,0.22)',
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
              process
            </button>
            <button
              type="button"
              onClick={() => triggerEmotionalMoment('first_korean', 'test')}
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
            <div
              style={{
                width: '100%',
                height: '0.5px',
                background: 'rgba(255,255,255,0.15)',
                margin: '4px 0',
              }}
            />
            <button
              type="button"
              onClick={devSkipToReview}
              style={{
                background: '#FFD84D',
                color: '#0E0E0F',
                border: 'none',
                borderRadius: '100px',
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              ⚡ → REVIEW
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
