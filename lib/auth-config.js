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
 * Google OAuth `redirectTo` for signInWithOAuth. Matches Supabase Dashboard → Auth → URL config.
 * Production builds always use the live callback; local dev uses localhost.
 */
export function getOAuthRedirectUrl() {
  const redirectUrl =
    process.env.NODE_ENV === "production"
      ? "https://talk.kkobi.app/auth/callback"
      : "http://localhost:3000/auth/callback";
  return redirectUrl;
}
