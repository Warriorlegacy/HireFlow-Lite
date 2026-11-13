/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f7f5f0',
        surface: '#fffefb',
        subtle: '#efebe3',
        ink: '#1b1a17',
        graphite: '#56534c',
        muted: '#8a857b',
        rule: '#e3ded2',
        accent: '#1d4d3b',
        accentDark: '#143a2c',
        accentSoft: '#e6efe9',
        clay: '#8f5334',
        claySoft: '#f5e9e0',
        positive: '#1d6b45',
        positiveSoft: '#e8f3ec',
        warning: '#8a5a12',
        warningSoft: '#f7eeda',
        negative: '#8f2f2f',
        negativeSoft: '#f7e7e5',
      },
      fontFamily: {
        display: ['"Newsreader"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        card: '10px',
        panel: '14px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(27, 26, 23, 0.05), 0 8px 20px -14px rgba(27, 26, 23, 0.18)',
        lift: '0 12px 32px -18px rgba(27, 26, 23, 0.35)',
      },
    },
  },
  plugins: [],
};
