export function isInAppBrowser() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  return (
    /KAKAOTALK/i.test(ua) ||          // 카카오톡
    /FB_IAB|FBAV|FBAN/i.test(ua) ||   // 페이스북
    /Instagram/i.test(ua) ||           // 인스타그램
    /Line\//i.test(ua) ||              // 라인
    /Twitter/i.test(ua) ||             // 트위터 앱
    /Discord/i.test(ua) ||             // 디스코드
    /TikTok/i.test(ua) ||             // 틱톡
    /BytedanceWebview/i.test(ua) ||   // 틱톡 (일부 기기)
    /webview/i.test(ua) ||             // 일반 웹뷰
    (/wv\)/i.test(ua) && /Android/i.test(ua))  // Android WebView
  );
}

export function getInAppBrowserName() {
  if (typeof window === 'undefined') return '';
  const ua = window.navigator.userAgent || '';
  if (/KAKAOTALK/i.test(ua)) return 'KakaoTalk';
  if (/FB_IAB|FBAV|FBAN/i.test(ua)) return 'Facebook';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/Line\//i.test(ua)) return 'Line';
  if (/Twitter/i.test(ua)) return 'Twitter';
  if (/Discord/i.test(ua)) return 'Discord';
  if (/TikTok|BytedanceWebview/i.test(ua)) return 'TikTok';
  return 'this app';
}
