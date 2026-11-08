import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#03050c",
        plasma: { 300: "#7dd3fc", 400: "#38bdf8", 500: "#0ea5e9" },
        aurora: { 300: "#86efac", 400: "#4ade80", 500: "#22c55e" },
        flare: { 300: "#fdba74", 400: "#fb923c", 500: "#f97316" },
        alert: { 300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      keyframes: {
        pulseAmber: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(245, 158, 11, 0.55)" },
          "50%": { boxShadow: "0 0 0 8px rgba(245, 158, 11, 0)" },
        },
      },
      animation: { pulseAmber: "pulseAmber 1.8s ease-in-out infinite" },
    },
  },
  plugins: [],
};

export default config;
