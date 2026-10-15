import type { Metadata } from "next";
import { Inter, Vazirmatn } from "next/font/google";
import { designTokenCss } from "@maktablink/design-tokens";
import "./globals.css";

// Next.js self-hosts both fonts in production; only the Admin workspace
// activates them, based on its selected language. preload:false prevents
// other app routes from eagerly downloading two unused font families.
const adminEnglishFont = Inter({
  subsets: ["latin"],
  variable: "--ml-admin-font-english",
  display: "swap",
  preload: false
});

const adminPersianFont = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--ml-admin-font-persian",
  display: "swap",
  preload: false
});

export const metadata: Metadata = {
  title: "MaktabLink",
  description: "School-family platform for Afghanistan"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" className={`${adminEnglishFont.variable} ${adminPersianFont.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: designTokenCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
