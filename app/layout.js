import "./globals.css";
import { Suspense } from "react";
import Analytics from "@/app/components/Analytics";
import GAPageView from "@/app/components/GAPageView";
import UtmCapture from "@/components/UtmCapture";
import OAuthCompleteTracker from "./components/OAuthCompleteTracker";
import { ActiveSessionProvider } from "@/hooks/useActiveSession";

export const metadata = {
  title: "My 90 Seconds — Fansign Video Call Prep",
  description:
    "Practice your 90 seconds before the day comes. For every fan who waited.",
  metadataBase: new URL("https://talk.kkobi.app"),
  openGraph: {
    title: "For every fan who waited.",
    description:
      "Practice your 90 seconds before the day comes. We'll be here every time you want to try again.",
    url: "https://talk.kkobi.app",
    siteName: "My 90 Seconds",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "My 90 Seconds — Fansign Video Call Prep",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "For every fan who waited.",
    description: "Practice your 90 seconds before the day comes.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard-dynamic-subset.css"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen" style={{ backgroundColor: "#0E0E0F" }}>
        <Analytics />
        <Suspense fallback={null}>
          <GAPageView />
        </Suspense>
        <UtmCapture />
        <OAuthCompleteTracker />
        <ActiveSessionProvider>{children}</ActiveSessionProvider>
      </body>
    </html>
  );
}

