import "./globals.css";
import OAuthCompleteTracker from "./components/OAuthCompleteTracker";
import { ActiveSessionProvider } from "@/hooks/useActiveSession";

export const metadata = {
  title: "꼬비 (Kkobi)",
  description: "한국어 AI 회화 학습 앱"
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
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard-dynamic-subset.css"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen" style={{ backgroundColor: "#0E0E0F" }}>
        <OAuthCompleteTracker />
        <ActiveSessionProvider>{children}</ActiveSessionProvider>
      </body>
    </html>
  );
}

