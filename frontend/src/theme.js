import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const config = defineConfig({
  globalCss: {
    'html, body, #root': {
      minHeight: '100%',
      bg: 'bg.canvas',
      color: 'text.primary',
    },
    body: {
      margin: 0,
      fontFamily: 'body',
      backgroundImage:
        'radial-gradient(circle at 14% 18%, rgba(45, 212, 191, 0.2) 0, transparent 34%), radial-gradient(circle at 88% 8%, rgba(56, 189, 248, 0.15) 0, transparent 34%), linear-gradient(180deg, #03050a 0%, #060b14 55%, #050a12 100%)',
      backgroundAttachment: 'fixed',
    },
    '*': {
      borderColor: 'border.subtle',
    },
    '*::selection': {
      background: 'rgba(45, 212, 191, 0.35)',
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
          50: { value: '#e6fbff' },
          100: { value: '#b8f4ff' },
          200: { value: '#86ecff' },
          300: { value: '#4edfff' },
          400: { value: '#20c9f0' },
          500: { value: '#0ea5e9' },
          600: { value: '#0b87c5' },
          700: { value: '#0c6d9e' },
          800: { value: '#0f597f' },
          900: { value: '#114b69' },
        },
      },
    },
    semanticTokens: {
      colors: {
        'bg.canvas': { value: '#060a13' },
        'bg.surface': { value: '#0c1320' },
        'bg.elevated': { value: '#111b2b' },
        'bg.overlay': { value: 'rgba(6, 10, 19, 0.78)' },
        'border.subtle': { value: '#22324b' },
        'border.focus': { value: '#2dd4bf' },
        'text.primary': { value: '#e7eef8' },
        'text.muted': { value: '#91a6c1' },
        'text.soft': { value: '#6e839e' },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
