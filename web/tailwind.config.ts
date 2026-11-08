import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#03050c",
        ink: "#08060a",
        ember: { 300: "#ffb38a", 400: "#ff8a4c", 500: "#ff6b2c" },
        mint: { 300: "#b8ffe1", 400: "#7dffc8" },
        crimson: { 400: "#ff4d63", 500: "#fb3b5b" },
        plasma: { 300: "#7dd3fc", 400: "#38bdf8", 500: "#0ea5e9" },
        aurora: { 300: "#86efac", 400: "#4ade80", 500: "#22c55e" },
        flare: { 300: "#fdba74", 400: "#fb923c", 500: "#f97316" },
        alert: { 300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      keyframes: {
        pulseAmber: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(245, 158, 11, 0.55)" },
          "50%": { boxShadow: "0 0 0 8px rgba(245, 158, 11, 0)" },
        },
        impactIn: {
          "0%": { opacity: "0", transform: "translateY(4px)", filter: "blur(4px)" },
          "100%": { opacity: "1", transform: "none", filter: "none" },
        },
      },
      animation: { pulseAmber: "pulseAmber 1.8s ease-in-out infinite", impactIn: "impactIn 0.45s ease-out" },
    },
  },
  plugins: [],
};

export default config;
