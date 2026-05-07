'use client';

import { useRouter } from 'next/navigation';

export default function PaywallPage() {
  const router = useRouter();
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0E0E0F',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        padding: 24,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
        Paywall (Step 2)
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.5)',
          marginBottom: 32,
        }}
      >
        Coming next...
      </div>
      <button
        type="button"
        onClick={() => router.push('/my-90-seconds')}
        style={{
          padding: '12px 24px',
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          borderRadius: 9999,
          color: '#fff',
          cursor: 'pointer',
          fontFamily: 'Manrope, sans-serif',
        }}
      >
        Back to scenarios
      </button>
    </div>
  );
}
