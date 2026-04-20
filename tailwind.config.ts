import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /* ─── Stitch Color Palette ─── */
      colors: {
        primary: {
          DEFAULT: "#1c4ed8",
          container: "#4069f2",
          fixed: "#dce1ff",
          fixedDim: "#b7c4ff",
          dark: "#152c9e",
        },
        "on-primary": "#ffffff",
        "on-primary-fixed": "#001551",
        "on-primary-fixed-variant": "#0039b5",

        secondary: {
          DEFAULT: "#5d5c76",
          container: "#e0dcfb",
          fixed: "#e3dffe",
          fixedDim: "#c7c3e2",
        },
        "on-secondary": "#ffffff",
        "on-secondary-container": "#62607a",
        "on-secondary-fixed": "#1a1930",
        "on-secondary-fixed-variant": "#46445d",

        tertiary: {
          DEFAULT: "#9d3e00",
          container: "#c55000",
          fixed: "#ffdbcc",
          fixedDim: "#ffb694",
        },
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#fffbff",
        "on-tertiary-fixed": "#351000",
        "on-tertiary-fixed-variant": "#7b2f00",

        success: "#2ecc71",
        "success-container": "#006331",
        "on-success": "#ffffff",
        "on-success-container": "#4fe587",

        warning: "#f59e0b",
        error: {
          DEFAULT: "#ba1a1a",
          container: "#ffdad6",
        },
        "on-error": "#ffffff",
        "on-error-container": "#93000a",

        background: "#f9f9fa",
        foreground: "var(--foreground)",
        surface: "#f9f9fa",
        "surface-bright": "#f9f9fa",
        "surface-dim": "#dadadb",
        "surface-tint": "#2151da",
        "surface-variant": "#e2e2e3",
        "surface-container": "#eeeeef",
        "surface-container-low": "#f3f3f4",
        "surface-container-high": "#e8e8e9",
        "surface-container-highest": "#e2e2e3",
        "surface-container-lowest": "#ffffff",
        "on-background": "#1a1c1d",
        "on-surface": "#1a1c1d",
        "on-surface-variant": "#434655",

        outline: "#747686",
        "outline-variant": "#c4c5d7",
        inverse: {
          surface: "#2f3132",
          "on-surface": "#f0f1f2",
          primary: "#b7c4ff",
        },

        /* Shadcn compat */
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: "var(--destructive)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
      },

      /* ─── Typography ─── */
      fontFamily: {
        headline: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        label: ["Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },

      /* ─── Border Radius (Stitch Scale) ─── */
      borderRadius: {
        DEFAULT: "1rem",
        lg: "2rem",
        xl: "3rem",
        full: "9999px",
      },

      /* ─── Shadows (Stitch Ambient) ─── */
      boxShadow: {
        ambient: "0px 20px 40px rgba(13, 12, 34, 0.06)",
        "ambient-lg": "0px 20px 40px rgba(13, 12, 34, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;