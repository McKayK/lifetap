/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      animation: {
        "heartbeat": "heartbeat 1s ease-in-out infinite",
        "overshield": "overshield 2s ease-in-out infinite",
        "neon-flicker": "neon-flicker 7s ease-in-out infinite, neon-pop 1.4s ease-out",
      },
      keyframes: {
        heartbeat: {
          "0%, 100%": { opacity: "0.08" },
          "14%": { opacity: "0.25" },
          "28%": { opacity: "0.08" },
          "42%": { opacity: "0.25" },
          "70%": { opacity: "0" },
        },
        overshield: {
          "0%, 100%": { opacity: "0.1" },
          "50%": { opacity: "0.35" },
        },
        // Gentle neon-sign flicker — lit almost the whole time, with a
        // single soft, brief dim once per (long) cycle instead of a
        // rapid double-buzz, so it reads as ambient rather than distracting
        // at the table.
        "neon-flicker": {
          "0%, 90%, 100%": { opacity: "1" },
          "94%": { opacity: "0.88" },
          "97%": { opacity: "1" },
        },
        // One-shot fade-in when the sign first switches on — a slow, calm
        // reveal instead of a quick bouncy pop.
        "neon-pop": {
          "0%": { transform: "scale(0.92)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
