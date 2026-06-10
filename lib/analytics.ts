declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>,
) {
  if (typeof window === 'undefined') return;
  if (!window.gtag) return;

  // localStorage에서 UTM 읽기
  let utmParams: Record<string, string> = {};
  try {
    const raw = localStorage.getItem('kkobi_utm');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.utm_source) utmParams.utm_source = parsed.utm_source;
      if (parsed.utm_medium) utmParams.utm_medium = parsed.utm_medium;
      if (parsed.utm_campaign) utmParams.utm_campaign = parsed.utm_campaign;
      if (parsed.utm_content) utmParams.utm_content = parsed.utm_content;
    }
  } catch {
    // 무시
  }

  window.gtag('event', eventName, {
    ...utmParams,
    ...params,
  });
}
