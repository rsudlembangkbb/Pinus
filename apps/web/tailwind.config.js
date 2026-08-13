/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Identitas visual PINUS: hijau (pohon pinus / keasrian Lembang) dan
        // biru (selaras logo RSUD Lembang) -- lihat PRD section 10.1.
        pinus: {
          50: "#f0f9f0",
          100: "#dcf0dc",
          200: "#b8e0b9",
          300: "#8bcb8d",
          400: "#5cb15f",
          500: "#3a9640",
          600: "#2a7830",
          700: "#235f28",
          800: "#1f4c23",
          900: "#1a3f1e",
          950: "#0b220d",
        },
        lembang: {
          50: "#eef6fc",
          100: "#d9ecf8",
          200: "#b8dcf1",
          300: "#87c4e6",
          400: "#4fa4d4",
          500: "#2c86bc",
          600: "#1e6a9d",
          700: "#1a557e",
          800: "#1a4869",
          900: "#193d59",
          950: "#10263a",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
