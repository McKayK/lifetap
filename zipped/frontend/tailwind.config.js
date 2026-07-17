/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      animation: {
        "heartbeat": "heartbeat 1s ease-in-out infinite",
        "overshield": "overshield 2s ease-in-out infinite",
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
      },
    },
  },
  plugins: [],
};
