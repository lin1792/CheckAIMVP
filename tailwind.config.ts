import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        accent: '#2F80ED',
        success: '#27AE60',
        danger: '#EB5757'
      }
    }
  },
  plugins: []
};

export default config;
