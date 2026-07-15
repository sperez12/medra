import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f7fbf9",
          100: "#e7f4ef",
          200: "#a7d5c9",
          500: "#1f7a6e",
          600: "#17685e",
          700: "#12564e",
          900: "#0d1b2a",
        },
        finance: {
          ink: "#0d1b2a",
          muted: "#68717a",
          surface: "#ffffff",
          line: "#e4ded3",
          ivory: "#f2ede3",
          mist: "#f5f6f7",
          mint: "#a7d5c9",
          green: "#1f7a6e",
          gold: "#b28a52",
          blue: "#1f5f8b",
        }
      },
      fontFamily: {
        display: ['"DM Serif Display"', "Georgia", "Cambria", "Times New Roman", "serif"],
        sans: ['"Inter"', "Arial", "Helvetica", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
