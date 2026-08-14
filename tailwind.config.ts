import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        pinus: {
          50: '#eefaf3',
          100: '#d6f2e1',
          200: '#aee4c6',
          300: '#7bcfa6',
          400: '#48b385',
          500: '#26966a',
          600: '#187a55',
          700: '#146147',
          800: '#124d3a',
          900: '#0f4030',
          950: '#08241b'
        },
        lembang: {
          50: '#eef6fb',
          100: '#d7eaf5',
          200: '#b3d6ec',
          300: '#82bade',
          400: '#4f98cb',
          500: '#2e7bb3',
          600: '#1f6296',
          700: '#1c4f7a',
          800: '#1c4266',
          900: '#1c3856',
          950: '#12233a'
        }
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
