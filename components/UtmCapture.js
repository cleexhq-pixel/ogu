'use client';

import { Suspense } from 'react';
import { useUtmCapture } from '@/hooks/useUtmCapture';

function UtmCaptureInner() {
  useUtmCapture();
  return null;
}

export default function UtmCapture() {
  return (
    <Suspense fallback={null}>
      <UtmCaptureInner />
    </Suspense>
  );
}
