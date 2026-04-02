import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./Providers";
import { assetUrl } from "./lib/assets";

export const metadata: Metadata = {
  title: "Buddy Script",
  description: "Social media app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href={assetUrl("/assets/images/logo-copy.svg")} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@100;300;400;500;600;700;800&display=swap" rel="stylesheet" />
        
        <link rel="stylesheet" href={assetUrl("/assets/css/bootstrap.min.css")} />
        <link rel="stylesheet" href={assetUrl("/assets/css/common.css")} />
        <link rel="stylesheet" href={assetUrl("/assets/css/main.css")} />
        <link rel="stylesheet" href={assetUrl("/assets/css/responsive.css")} />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
        <Script src={assetUrl("/assets/js/bootstrap.bundle.min.js")} strategy="lazyOnload" />
      </body>
    </html>
  );
}
