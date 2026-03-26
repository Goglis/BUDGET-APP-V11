import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        income: { DEFAULT: "#16a34a", muted: "#dcfce7" },
        expense: { DEFAULT: "#dc2626", muted: "#fee2e2" },
      },
    },
  },
  plugins: [],
};

export default config;
