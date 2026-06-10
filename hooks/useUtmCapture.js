'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export function useUtmCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const utm_source = searchParams.get('utm_source');
    const utm_medium = searchParams.get('utm_medium');
    const utm_campaign = searchParams.get('utm_campaign');
    const utm_content = searchParams.get('utm_content');
    const utm_term = searchParams.get('utm_term');

    // UTM 파라미터가 하나라도 있으면 저장
    if (utm_source || utm_medium || utm_campaign) {
      const utmData = {
        utm_source: utm_source || '',
        utm_medium: utm_medium || '',
        utm_campaign: utm_campaign || '',
        utm_content: utm_content || '',
        utm_term: utm_term || '',
        captured_at: new Date().toISOString(),
        landing_url: window.location.href,
      };
      localStorage.setItem('kkobi_utm', JSON.stringify(utmData));
    }
  }, [searchParams]);
}
