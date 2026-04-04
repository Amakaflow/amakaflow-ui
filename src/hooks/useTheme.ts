// Re-export from ThemeContext for a single source of truth.
// Components should use this hook; the ThemeProvider in main.tsx
// ensures there is exactly ONE theme effect running in the app,
// preventing the "dark flash on Settings open" bug (AMA-1431).
export type { Theme } from '../context/ThemeContext';
export { useThemeContext as useTheme } from '../context/ThemeContext';
