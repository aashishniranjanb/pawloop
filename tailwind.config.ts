import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "375px",
      },
      colors: {
        brand: {
          forest: "#1F6F50",
          "forest-light": "#2A8F68",
          "forest-dark": "#185A40",
          sand: "#D9C7A3",
          "sand-light": "#E8DCC4",
          "sand-dark": "#C4AD82",
          sky: "#4DA8DA",
          "sky-light": "#6FBDE6",
          "sky-dark": "#3A8FBF",
          alert: "#F2994A",
          "alert-light": "#F5A55C",
          cream: "#FAFAF7",
          graphite: "#1A1A1A",
          "graphite-light": "#2A2A2A",
        },
        status: {
          active: "#1F6F50",
          water: "#4DA8DA",
          cleanup: "#F2994A",
          emergency: "#EB5757",
          inactive: "#94A3B8",
        },
      },
      fontFamily: {
        heading: ["var(--font-fira-sans)", "system-ui", "sans-serif"],
        body: ["var(--font-fira-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-fira-code)", "monospace"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
        "4xl": "28px",
      },
      animation: {
        "fade-in": "fadeIn 250ms cubic-bezier(0.25,0.46,0.45,0.94)",
        "slide-up": "slideUp 400ms cubic-bezier(0.16,1,0.3,1)",
        "slide-down": "slideDown 250ms cubic-bezier(0.25,0.46,0.45,0.94)",
        "scale-in": "scaleIn 250ms cubic-bezier(0.25,0.46,0.45,0.94)",
        "ping-soft": "ping-soft 2s cubic-bezier(0,0,0.2,1) infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "ping-soft": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "75%": { transform: "scale(1.8)", opacity: "0" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(0,0,0,0.04)",
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
        float: "0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.04)",
        sheet: "0 -4px 32px rgba(0,0,0,0.12), 0 -1px 8px rgba(0,0,0,0.04)",
      },
      backdropBlur: {
        xl: "20px",
        "2xl": "40px",
      },
    },
  },
  plugins: [],
};

export default config;
