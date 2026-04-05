"use client";

import { Suspense } from "react";
import FirstLineFlow from "./FirstLineFlow";

function FirstLineFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface,#f9f9fb)]">
      <p className="text-sm text-[var(--on-surface-variant,#6b6f72)]">Loading…</p>
    </div>
  );
}

export default function FirstLinePage() {
  return (
    <Suspense fallback={<FirstLineFallback />}>
      <FirstLineFlow />
    </Suspense>
  );
}
