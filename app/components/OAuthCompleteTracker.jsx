"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

/** Avoid duplicate signup_complete under React Strict Mode; reset when ?oauth_complete= is gone. */
let oauthCompleteGaSent = false;

function OAuthCompleteTrackerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const hasFlag = searchParams.get("oauth_complete") === "1";
    if (!hasFlag) {
      oauthCompleteGaSent = false;
      return;
    }
    if (!oauthCompleteGaSent) {
      trackEvent("signup_complete");
      oauthCompleteGaSent = true;
    }
    const p = new URLSearchParams(searchParams.toString());
    p.delete("oauth_complete");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  return null;
}

export default function OAuthCompleteTracker() {
  return (
    <Suspense fallback={null}>
      <OAuthCompleteTrackerInner />
    </Suspense>
  );
}
