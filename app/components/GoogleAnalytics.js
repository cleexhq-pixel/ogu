"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function GoogleAnalytics({ GA_ID }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!GA_ID || !window.gtag) return;
    window.gtag("config", GA_ID, {
      page_path: pathname
    });
  }, [pathname, GA_ID]);

  return null;
}

