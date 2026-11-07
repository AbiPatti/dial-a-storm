import type { Metadata, Viewport } from "next";
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-void font-sans text-slate-200">{children}</body>
    </html>
  );
}
