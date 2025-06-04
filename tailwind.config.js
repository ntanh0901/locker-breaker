/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "feedback-wrong": "#ef4444",
        "feedback-partial": "#f59e0b",
        "feedback-correct": "#10b981",
      },
    },
  },
  plugins: [],
};
