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
        // Futuristic palette inspired by the project logo (violet + cyan).
        background: "#070613",
        // Slightly translucent so the neon background shows through (glass effect).
        surface: "rgba(12, 11, 31, 0.68)",
        border: "rgba(167, 139, 250, 0.28)",
        accent: "#a78bfa",
        accent2: "#22d3ee",
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

