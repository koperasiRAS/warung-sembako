import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#35299d",
          dark: "#4d44b5",
          50: "#e3dfff",
          100: "#c5c0ff",
        },
        secondary: {
          DEFAULT: "#a32299",
        },
        tertiary: {
          DEFAULT: "#004922",
        },
        surface: "#fcf8ff",
        background: "#fcf8ff",
        cash: "#10B981",
        bank: "#3B82F6",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        body: ["Manrope", "system-ui", "sans-serif"],
        label: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
