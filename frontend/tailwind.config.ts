import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#060816",
        panel: "#0e1325",
        border: "#1d2844",
        accent: "#29d391",
        danger: "#ff5f5f",
        warning: "#f2c94c",
        text: "#d7e3ff",
        muted: "#8692b3"
      },
      boxShadow: {
        panel: "0 18px 60px rgba(0,0,0,0.45)"
      },
      fontFamily: {
        sans: ["Space Grotesk", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
