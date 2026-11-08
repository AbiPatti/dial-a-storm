import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dial-a-Storm · What if the Sun hit harder?",
  description:
    "Replay the biggest geomagnetic storms of 2010–2026 from NASA OMNI data, dial the solar wind, and watch an ML surrogate of SYM-H respond. Sheridan Datathon 2026, NASA track.",
};

export const viewport: Viewport = {
  themeColor: "#03050c",
  width: "device-width",
  initialScale: 1,
};

// Orbitron Black (SIL Open Font License), self-hosted so builds and demos work offline.
const display = localFont({ src: "./fonts/Orbitron-Black.woff2", weight: "900", variable: "--font-display", display: "swap" });

/** Skip the landing page on reloads within the same tab session, before first paint (no flash). */
const SKIP_LANDING = `try{if(sessionStorage.getItem("dial-a-storm:entered")==="1")document.documentElement.dataset.entered="1"}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={display.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKIP_LANDING }} />
      </head>
      <body className="min-h-screen bg-void font-sans text-slate-200">{children}</body>
    </html>
  );
}
