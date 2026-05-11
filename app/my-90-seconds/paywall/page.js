'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

const GUMROAD_URL = 'https://cleexhq.gumroad.com/l/fansign-prep-pass';

function PaywallContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenario = searchParams.get('scenario') || 'compliment';
  const gumroadWithContext = `${GUMROAD_URL}?scenario=${encodeURIComponent(scenario)}`;

  const [user, setUser] = useState(null);

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    void run();
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0E0E0F',
        padding: '24px 20px 48px',
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
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        ← Back
      </button>

      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background:
            'linear-gradient(135deg, rgba(255,216,77,0.3), rgba(255,138,169,0.2))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          margin: '0 auto 24px',
        }}
      >
        🔒
      </div>

      <div
        style={{
          fontSize: '26px',
          fontWeight: 700,
          color: '#fff',
          textAlign: 'center',
          lineHeight: 1.3,
          letterSpacing: '-0.02em',
          marginBottom: '12px',
        }}
      >
        Don&apos;t waste your
        <br />
        real 90 seconds
      </div>

      <p
        style={{
          fontSize: '14px',
          color: 'rgba(255,255,255,0.4)',
          textAlign: 'center',
          lineHeight: 1.6,
          whiteSpace: 'pre-line',
          marginBottom: '36px',
        }}
      >
        {user
          ? "You've used today's 3 free sessions.\nGet unlimited access before your fansign."
          : "You've used today's free session.\nSign in for 3/day free — or go unlimited."}
      </p>

      {!user && (
        <>
          <div
            style={{
              margin: '16px 0',
              background: 'rgba(255,255,255,0.04)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: '14px',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontSize: '13px',
                color: 'rgba(255,255,255,0.5)',
                margin: '0 0 12px',
              }}
            >
              Get 3 sessions/day — completely free
            </p>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const supabase = getSupabase();
                  if (!supabase || typeof window === 'undefined') return;
                  const next = encodeURIComponent('/my-90-seconds');
                  await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
                    },
                  });
                })();
              }}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '99px',
                padding: '13px',
                fontSize: '14px',
                fontWeight: 700,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Continue with Google
            </button>
          </div>
          <p
            style={{
              textAlign: 'center',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.2)',
              margin: '0 0 12px',
            }}
          >
            or
          </p>
        </>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={() =>
          window.open(gumroadWithContext, '_blank', 'noopener,noreferrer')
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.open(gumroadWithContext, '_blank', 'noopener,noreferrer');
          }
        }}
        style={{
          background: 'linear-gradient(135deg, #FF8AA9, #FF719B)',
          borderRadius: '20px',
          padding: '24px 20px',
          marginBottom: '12px',
          position: 'relative',
          boxShadow: '0 8px 32px rgba(255,138,169,0.4)',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-10px',
            right: '16px',
            padding: '4px 12px',
            background: '#FFD84D',
            color: '#0E0E0F',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            borderRadius: '9999px',
          }}
        >
          Most Popular
        </div>

        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.85)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}
        >
          Fansign Prep Pass
        </div>

        <div
          style={{
            fontSize: '40px',
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-0.02em',
            marginBottom: '4px',
          }}
        >
          $9.99
        </div>

        <div
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.85)',
            marginBottom: '20px',
          }}
        >
          7 days · unlimited practice
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
          {[
            'Unlimited 90-second simulations',
            'All 5 scenarios unlocked',
            'AI coach feedback after every call',
            "Practice until you're ready",
          ].map((item, i) => (
            <li
              key={i}
              style={{
                fontSize: '12px',
                color: '#fff',
                marginBottom: '8px',
                paddingLeft: '18px',
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.open(gumroadWithContext, '_blank', 'noopener,noreferrer');
          }}
          style={{
            width: '100%',
            padding: '14px',
            background: '#fff',
            border: 'none',
            borderRadius: '9999px',
            color: '#FF719B',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Get Prep Pass →
        </button>
      </div>

      <div
        style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: '10px',
          }}
        >
          Already have a license key?
        </div>
        <button
          type="button"
          onClick={() => router.push('/redeem')}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Enter code here →
        </button>
      </div>

      <p
        style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.22)',
          textAlign: 'center',
          marginTop: '12px',
        }}
      >
        {user
          ? 'Come back tomorrow for 3 free tries'
          : 'Come back tomorrow for 1 free try'}
      </p>
    </div>
  );
}

export default function PaywallPage() {
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
          }}
        >
          Loading...
        </div>
      }
    >
      <PaywallContent />
    </Suspense>
  );
}
