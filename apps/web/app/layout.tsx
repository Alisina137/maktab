import type { Metadata } from "next";
import { designTokenCss } from "@maktablink/design-tokens";
import "./globals.css";

export const metadata: Metadata = {
  title: "MaktabLink",
  description: "School-family platform for Afghanistan"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <style dangerouslySetInnerHTML={{ __html: designTokenCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
