'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';

export default function RedeemPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleRedeem = async () => {
    if (!code.trim()) return;

    setStatus('loading');

    try {
      const cleanCode = code.trim().toUpperCase();

      if (cleanCode.length < 8) {
        setStatus('error');
        setErrorMsg('Invalid license key. Please check and try again.');
        return;
      }

      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: cleanCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setStatus('error');
        setErrorMsg(
          data?.error || 'License verification failed. Please check and try again.',
        );
        return;
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('kkobi_pass_tier', data.tier || 'prep_pass');
        localStorage.setItem('kkobi_pass_expires', data.expiresAt);
        localStorage.setItem('kkobi_pass_code', data.licenseKey || cleanCode);
        localStorage.setItem('kkobi_pass_activated', new Date().toISOString());
      }

      trackEvent('m90s_pass_activated');
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg('License verification failed. Please check and try again.');
    }
  };

  if (status === 'success') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0E0E0F',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          fontFamily: 'Manrope, Inter, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '64px', marginBottom: '24px' }}>🎉</div>

        <div
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '12px',
            letterSpacing: '-0.02em',
          }}
        >
          Prep Pass Activated!
        </div>

        <div
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.6,
            marginBottom: '40px',
            maxWidth: '280px',
          }}
        >
          You have 7 days of unlimited practice.
          <br />
          Don&apos;t waste your 90 seconds. 💖
        </div>

        <button
          type="button"
          onClick={() => router.push('/my-90-seconds')}
          style={{
            padding: '16px 40px',
            background: '#FFD84D',
            border: 'none',
            borderRadius: '9999px',
            color: '#0E0E0F',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(255,216,77,0.24)',
          }}
        >
          Start Practicing →
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0E0E0F',
        padding: '24px 20px',
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
          marginBottom: '48px',
        }}
      >
        ← Back
      </button>

      <div
        style={{
          fontSize: '26px',
          fontWeight: 700,
          color: '#fff',
          marginBottom: '8px',
          letterSpacing: '-0.02em',
        }}
      >
        Enter your license key
      </div>

      <div
        style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.5)',
          marginBottom: '32px',
          lineHeight: 1.6,
        }}
      >
        Check the email you received after purchase.
        <br />
        Your key looks like: XXXX-XXXX-XXXX-XXXX
      </div>

      <input
        type="text"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setStatus('idle');
          setErrorMsg('');
        }}
        placeholder="XXXX-XXXX-XXXX-XXXX"
        style={{
          width: '100%',
          padding: '16px 20px',
          background: 'rgba(255,255,255,0.06)',
          border:
            status === 'error'
              ? '1px solid rgba(255,68,68,0.6)'
              : '1px solid rgba(255,255,255,0.1)',
          borderRadius: '14px',
          color: '#fff',
          fontSize: '16px',
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          outline: 'none',
          marginBottom: '8px',
          textTransform: 'uppercase',
        }}
        onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
        autoCapitalize="characters"
      />

      {status === 'error' && (
        <div
          style={{
            fontSize: '12px',
            color: '#FF4444',
            marginBottom: '16px',
          }}
        >
          {errorMsg}
        </div>
      )}

      <button
        type="button"
        onClick={handleRedeem}
        disabled={status === 'loading' || !code.trim()}
        style={{
          width: '100%',
          padding: '16px',
          background: code.trim()
            ? '#FFD84D'
            : 'rgba(255,255,255,0.05)',
          border: 'none',
          borderRadius: '9999px',
          color: code.trim() ? '#0E0E0F' : 'rgba(255,255,255,0.2)',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          cursor: code.trim() ? 'pointer' : 'not-allowed',
          marginBottom: '24px',
          boxShadow: code.trim() ? '0 4px 24px rgba(255,216,77,0.2)' : 'none',
          transition: 'all 0.3s',
        }}
      >
        {status === 'loading' ? 'Activating...' : 'Activate Pass →'}
      </button>

      <div
        style={{
          textAlign: 'center',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.35)',
          lineHeight: 1.6,
        }}
      >
        Purchased but no email?
        <br />
        <button
          type="button"
          onClick={() => window.open('mailto:cleex.hq@gmail.com', '_blank')}
          style={{
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            textDecoration: 'underline',
            background: 'none',
            border: 'none',
            font: 'inherit',
            padding: 0,
          }}
        >
          Contact us
        </button>
      </div>
    </div>
  );
}
