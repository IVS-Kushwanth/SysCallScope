/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#030407",
        cobalt: { DEFAULT: "#1558C9", 400: "#3B7BE8", 300: "#6A9BF0", 900: "#0A2A63" },
        lime: { DEFAULT: "#D4FF24", 600: "#A8CC14" },
        fog: "#F5F7FA",
        muted: "#9299A8",
        surface: "#0B0F18",
        card: "#101725",
        line: "rgba(255,255,255,0.08)",
        danger: "#FF5252",
        warn: "#FFB547",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      keyframes: {
        rowin: { from: { opacity: "0", transform: "translateX(-6px)" }, to: { opacity: "1", transform: "none" } },
        pulseDot: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".35" } },
        borderflow: { to: { "--angle": "360deg" } },
      },
      animation: {
        rowin: "rowin .35s ease-out both",
        pulseDot: "pulseDot 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
