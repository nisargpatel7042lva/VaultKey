import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f1117",
        surface: "#111827",
        border: "#1f2937",
        accent: "#38bdf8",
        success: "#22c55e",
        warning: "#facc15",
        danger: "#ef4444",
        muted: "#6b7280",
      },
    },
  },
  plugins: [],
};

export default config;

