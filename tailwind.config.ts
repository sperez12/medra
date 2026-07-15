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
          50: "#f0fdfa",
          100: "#ccfbf1",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          900: "#134e4a",
        },
        finance: {
          ink: "#0f172a",
          muted: "#64748b",
          surface: "#ffffff",
          line: "#e2e8f0",
          gold: "#b45309",
          blue: "#2563eb",
        }
      }
    },
  },
  plugins: [],
};

export default config;
