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
          DEFAULT: "#0D9488",
          dark: "#0F766E",
          50: "#F0FDFA",
          100: "#CCFBF1",
        },
        secondary: {
          DEFAULT: "#F97316",
          dark: "#EA580C",
        },
        surface: "#FFFFFF",
        background: "#F8FAFC",
        cash: "#10B981",
        bank: "#3B82F6",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
