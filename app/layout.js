import "./globals.css";

export const metadata = {
  title: "오구오구 (OguOgu)",
  description: "한국어 AI 회화 학습 앱"
};

export default function RootLayout({ children }) {
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "";

  return (
    <html lang="ko">
      <head>
        {GA_ID && (
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          />
        )}
        {GA_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){window.dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${GA_ID}');
              `,
            }}
          />
        )}
      </head>
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}

