import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext({
  colorMode: 'light',
  isDark: false,
  setColorMode: () => {},
  toggleColorMode: () => {},
});

const STORAGE_KEY = 'baba_roti_color_mode';

function applyColorModeToDom(mode) {
  const isDark = mode === 'dark';
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
    root.setAttribute('data-color-mode', 'dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-color-mode', 'light');
    root.style.colorScheme = 'light';
  }
}

export const ThemeProvider = ({ children }) => {
  const [colorMode, setColorModeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const initial = saved === 'dark' ? 'dark' : 'light';
      applyColorModeToDom(initial);
      return initial;
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    applyColorModeToDom(colorMode);
    try {
      localStorage.setItem(STORAGE_KEY, colorMode);
    } catch {
      // Ignore storage errors
    }
  }, [colorMode]);

  const setColorMode = useCallback((mode) => {
    setColorModeState(mode === 'dark' ? 'dark' : 'light');
  }, []);

  const toggleColorMode = useCallback(() => {
    setColorModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        colorMode,
        isDark: colorMode === 'dark',
        setColorMode,
        toggleColorMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
