export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const pageview = (url) => {
  if (typeof window === "undefined") return;
  if (!GA_ID) return;
  if (!window.gtag) return;
  window.gtag("config", GA_ID, {
    page_path: url
  });
};

export const event = (action, params = {}) => {
  if (typeof window === "undefined") return;
  if (!GA_ID) return;
  if (!window.gtag) return;
  window.gtag("event", action, params);
};

