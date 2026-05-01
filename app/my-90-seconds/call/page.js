'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function CallPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [scenarioId, setScenarioId] = useState(null);
  const [voiceGender, setVoiceGender] = useState(null);
  const [savedScript, setSavedScript] = useState(null);
  const [isReady, setIsReady] = useState(false);

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

  if (!isReady) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0E0E0F',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Manrope, sans-serif'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0E0E0F',
      color: '#fff',
      padding: '40px 24px',
      fontFamily: 'Manrope, sans-serif',
      maxWidth: '390px',
      margin: '0 auto'
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '24px' }}>
        Phase B 데이터 확인
      </h1>

      <div style={{ marginBottom: '16px' }}>
        <strong>Scenario:</strong> {scenarioId}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <strong>Voice:</strong> {voiceGender}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <strong>Lines ({savedScript?.lines?.length || 0}):</strong>
      </div>

      {savedScript?.lines?.map((line, idx) => (
        <div key={idx} style={{
          background: '#1A191B',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '12px'
        }}>
          <div style={{
            fontSize: '10px',
            color: '#FF8AA9',
            marginBottom: '6px',
            letterSpacing: '0.1em'
          }}>
            LINE {idx + 1} · {line.label || 'NO LABEL'}
          </div>
          <div style={{ fontSize: '16px', marginBottom: '4px' }}>
            {line.korean}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
            {line.romanization}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
            {line.translation}
          </div>
        </div>
      ))}

      <button
        onClick={() => router.push('/my-90-seconds')}
        style={{
          marginTop: '24px',
          padding: '12px 20px',
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          borderRadius: '9999px',
          color: '#fff',
          fontFamily: 'Manrope, sans-serif',
          fontSize: '13px',
          fontWeight: '700',
          cursor: 'pointer'
        }}
      >
        ← Back to scenarios
      </button>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0E0E0F',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontFamily: 'Manrope, sans-serif',
      fontSize: '14px',
      opacity: 0.5,
    }}>
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
