import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        pinus: {
          50: "#eefbf3",
          100: "#d6f5e1",
          200: "#aeebc7",
          300: "#7adba8",
          400: "#48c489",
          500: "#26a76e",
          600: "#1a8a5a",
          700: "#186f4a",
          800: "#17583d",
          900: "#144934",
          950: "#0a2a1e",
        },
        lembang: {
          50: "#eef6fc",
          100: "#d6e9f7",
          200: "#b3d7f0",
          300: "#80bce4",
          400: "#4998d1",
          500: "#277cb8",
          600: "#1a6299",
          700: "#184f7c",
          800: "#194367",
          900: "#193957",
        },
      },
    },
  },
  plugins: [],
};

export default config;
