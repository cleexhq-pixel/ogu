"use client";

import { useEffect } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function Analytics() {
  useEffect(() => {
    if (!GA_ID) return;
    if (typeof window === "undefined") return;

    // Already loaded
    if (window.gtag) return;

    // GA script dynamic load
    const script1 = document.createElement("script");
    script1.async = true;
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script1);

    script1.onload = () => {
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        window.dataLayer.push(arguments);
      }
      window.gtag = gtag;
      gtag("js", new Date());
      gtag("config", GA_ID);
      // eslint-disable-next-line no-console
      console.log("GA4 loaded:", GA_ID);
    };

    return () => {
      // keep script for SPA lifetime
    };
  }, []);

  return null;
}

