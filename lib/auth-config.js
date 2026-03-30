/**
 * OAuth / magic-link redirect target. Must match Supabase Dashboard → Auth → URL config.
 * Override with NEXT_PUBLIC_AUTH_CALLBACK_URL (full URL) for custom domains.
 */
export function getAuthCallbackUrl() {
  if (typeof process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL === "string" && process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL) {
    return process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL.replace(/\/$/, "");
  }
  if (typeof process.env.NEXT_PUBLIC_SITE_URL === "string" && process.env.NEXT_PUBLIC_SITE_URL) {
    return `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/auth/callback`;
  }
  return "https://talk.kkobi.app/auth/callback";
}

/** Use in the browser so localhost and production hosts match allowed redirect URLs. */
export function getAuthCallbackUrlForClient() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`;
  }
  return getAuthCallbackUrl();
}

/**
 * OAuth / OTP redirect: explicit NEXT_PUBLIC_AUTH_CALLBACK_URL, else localhost → current origin,
 * else production https://talk.kkobi.app/auth/callback (per product default).
 */
export function getOAuthRedirectUrl() {
  const forced =
    typeof process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL === "string"
      ? process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL.trim()
      : "";
  if (forced) return forced.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return `${window.location.origin}/auth/callback`;
    }
  }

  return "https://talk.kkobi.app/auth/callback";
}
