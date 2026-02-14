import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const config = defineConfig({
  globalCss: {
    'html, body, #root': {
      minHeight: '100%',
      bg: 'bg.canvas',
      color: 'fg',
    },
    body: {
      margin: 0,
      fontFamily: 'body',
      backgroundImage:
        'radial-gradient(circle at 16% 18%, rgba(34, 197, 154, 0.12) 0, transparent 34%), radial-gradient(circle at 84% 14%, rgba(56, 189, 248, 0.1) 0, transparent 36%), linear-gradient(180deg, #050811 0%, #070d1a 56%, #070c16 100%)',
      backgroundAttachment: 'fixed',
    },
    '*': {
      borderColor: 'border',
    },
    '*::selection': {
      background: 'rgba(45, 212, 191, 0.25)',
    },
  },
  theme: {
    tokens: {
      fonts: {
        heading: { value: "'Sora', 'Avenir Next', 'Segoe UI', sans-serif" },
        body: { value: "'IBM Plex Sans', 'Avenir Next', 'Segoe UI', sans-serif" },
        mono: { value: "'JetBrains Mono', 'SFMono-Regular', Menlo, monospace" },
      },
      colors: {
        brand: {
          50: { value: '#e8fbfb' },
          100: { value: '#c8f2f4' },
          200: { value: '#9ce6ea' },
          300: { value: '#6fd8df' },
          400: { value: '#45c4ce' },
          500: { value: '#27a7b6' },
          600: { value: '#1e8594' },
          700: { value: '#1c6a78' },
          800: { value: '#1a5462' },
          900: { value: '#174653' },
        },
      },
    },
    semanticTokens: {
      colors: {
        bg: { value: '#060a13' },
        'bg.canvas': { value: '#060a13' },
        'bg.surface': { value: '#0d1523' },
        'bg.elevated': { value: '#121c2d' },
        'bg.overlay': { value: 'rgba(6, 10, 19, 0.72)' },
        fg: { value: '#eef4ff' },
        'fg.muted': { value: '#b2bfd3' },
        'fg.subtle': { value: '#8b9cb6' },
        border: { value: '#24354d' },
        'border.subtle': { value: '#24354d' },
        'border.focus': { value: '#2cb9a9' },
        'text.primary': { value: '#eef4ff' },
        'text.muted': { value: '#b2bfd3' },
        'text.soft': { value: '#8b9cb6' },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
