import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';
const ThemeContext = createContext({ theme: 'light' as Theme, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('jobapply-theme', theme); } catch { /* Use the theme for this session if storage is unavailable. */ }
  }, [theme]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === 'jobapply-theme') setTheme(event.newValue === 'dark' ? 'dark' : 'light');
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle: () => setTheme(current => current === 'dark' ? 'light' : 'dark') }}>
    {children}
  </ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { theme, toggle } = useContext(ThemeContext);
  return <button type="button" className="theme-toggle" onClick={toggle}
    aria-label="Dark mode" aria-pressed={theme === 'dark'}
    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
  </button>;
}
