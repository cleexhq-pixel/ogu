"use client";
import { useEffect } from "react";

export default function Analytics() {
  useEffect(() => {
    const GA_ID = "G-S1MBTN4PQ8";
    
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);

    script.onload = () => {
      window.dataLayer = window.dataLayer || [];
      function gtag() { window.dataLayer.push(arguments); }
      window.gtag = gtag;
      gtag("js", new Date());
      gtag("config", GA_ID);
      console.log("GA4 loaded:", GA_ID);
    };
  }, []);

  return null;
}
