import "./globals.css";

export const metadata = {
  title: "오구오구 (OguOgu)",
  description: "한국어 AI 회화 학습 앱"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}

