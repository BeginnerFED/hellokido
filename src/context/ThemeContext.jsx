import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  // localStorage'dan kayıtlı temayı al, yoksa varsayılan olarak false (light mode)
  // (Kayıtlı değer bozuksa ya da depolama kullanılamıyorsa sayfa boş kalmasın: açık tema)
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem('theme') === 'true';
    } catch {
      return false;
    }
  });

  // Tema değiştiğinde localStorage'a kaydet
  useEffect(() => {
    try {
      localStorage.setItem('theme', JSON.stringify(isDark));
    } catch {
      // Depolama kullanılamıyor: tema yalnızca bu oturumda geçerli
    }
    // HTML elementine dark class'ını ekle/çıkar
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}; 