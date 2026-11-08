import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Dial-a-Storm · What if the Sun hit harder?",
  description:
    "Replay the biggest geomagnetic storms of 2010–2026 from NASA OMNI data, dial the solar wind, and watch an ML surrogate of SYM-H respond. Sheridan Datathon 2026, NASA track.",
};

export const viewport: Viewport = {
  themeColor: "#08060a",
  width: "device-width",
  initialScale: 1,
};

// Orbitron Black (SIL Open Font License), self-hosted so builds and demos work offline.
const display = localFont({ src: "./fonts/Orbitron-Black.woff2", weight: "900", variable: "--font-display", display: "swap" });

/** Skip the landing page on reloads within the same tab session, before first paint (no flash). */
const SKIP_LANDING = `try{if(sessionStorage.getItem("dial-a-storm:entered")==="1")document.documentElement.dataset.entered="1"}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKIP_LANDING }} />
      </head>
      <body className="min-h-screen bg-ink font-sans text-stone-200">{children}</body>
    </html>
  );
}
