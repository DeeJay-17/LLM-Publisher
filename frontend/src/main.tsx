import React from 'react'
import ReactDOM from 'react-dom/client'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { App } from './ui/App'
import './styles.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/800.css'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#4da3ff' },
    secondary: { main: '#7bb4ff' },
    background: {
      default: '#081225',
      paper: '#0b1a33',
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(77,163,255,0.18)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)

